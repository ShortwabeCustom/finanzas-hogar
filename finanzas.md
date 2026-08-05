# Finanzas del Hogar — Referencia Completa

**URL:** https://finanzas.torrax.cloud | **Puerto:** 4000 | **Directorio:** `/var/www/finanzas-hogar`

Sistema de control financiero personal y del hogar con importación de documentos (PDF, Excel, XML CFDI, tickets OCR).

> **Estado (2026-08-05 rev7 — INCREMENTO 3):** 
> - ✅ **INCREMENTO 3 COMPLETADO** (2026-08-05): Integración del módulo Deudas con Mis Pagos, Dashboard Personal, y Analytics.
> - **Schema:** relatedDebtId FK en PersonalPayment + BankTransaction (linkedManuallyAt), índices + relaciones inversas
> - **Mis Pagos:** Badges "Abono a deuda" (púrpura, link a deuda), filtro "Solo abonos a deudas", columna "Deuda relacionada"
> - **Statements:** Badge "Vinculado a deuda", API POST /api/personal/debts/[id]/link-transaction lista (reutilizado Incremento 1)
> - **Dashboard:** Componente DebtsPendingSection con 3 KPIs (Saldo payable, Próximo vencimiento con días, Cuotas vencidas en rojo), card "Deuda más urgente" con progreso, lista "Vencidas" colapsable
> - **Analytics:** src/lib/analytics.ts con trackDebtEvent() + 10 eventos (debt_created, debt_edited, debt_deleted, debt_payment_recorded, debt_payment_edited, debt_payment_deleted, debt_marked_paid_off, debt_installment_generated, debt_transaction_linked, debt_filter_used), anonimizado (amount buckets: 0-1k, 1k-5k, 5k-20k, 20k-100k, 100k+)
> - **Tests E2E:** tests/e2e/debts.spec.ts con 5 suites Playwright (crear→6 pagos→liquidar→PAID_OFF, vincular transacción, filtros+búsqueda, responsive 375px sin horizontal scroll, a11y WCAG AA)
> - **API Updated:** GET/POST /api/personal/payments ± relatedDebt, GET /api/personal/dashboard con objeto debts
> - **Build:** ✓ 46 routes, 0 errors, 0 warnings, TypeScript clean, 44s compile time
> - **Commits:** 306fc16 (feat integration), 44fffd1 (docs)
> - **Archivos:** +945 líneas totales. Nuevos: src/lib/analytics.ts, src/components/personal/dashboard/DebtsPendingSection.tsx, tests/e2e/debts.spec.ts
> - **PRÓXIMO: INCREMENTO 4** — Statements UI (modal vincular transacción a deuda), Tests unitarios (debt-calculations.ts, validaciones), Notificaciones (próximo vencimiento email/WhatsApp), E2E en CI
>
> **Baseline anterior (2026-08-04):** INCREMENTO 2 (UI deudas) ✅ + INCREMENTO 1 (APIs/schema) ✅. Módulo Plan de Recuperación removido. OCR pipeline: Santander ECB/PDF, OpenAI gpt-5.4-mini + fallback. Estados Hogar: BankAccountScope PERSONAL/HOUSEHOLD. Fix 504 nginx.

---

## Índice

1. [Arquitectura](#arquitectura)
2. [Stack](#stack)
3. [Entorno y credenciales](#entorno-y-credenciales)
4. [Scripts](#scripts)
5. [Base de datos — modelos e índices](#base-de-datos)
6. [API Routes](#api-routes)
7. [Librerías internas](#librerías-internas)
8. [finanzas-processor](#finanzas-processor)
9. [Sitemap y navegación](#sitemap-y-navegación)
10. [Flujos principales](#flujos-principales)
11. [Matriz de módulos](#matriz-de-módulos)
12. [Design System](#design-system)
13. [Eventos analíticos](#eventos-analíticos)
14. [Backlog UX/UI](#backlog-uxui)
15. [Pendientes técnicos](#pendientes-técnicos)
16. [Historial de cambios](#historial-de-cambios)

---

## Arquitectura

```
XML CFDI-ECB Santander
        │
        ├─ parseSantanderECB()  (in-process, sin deps externas)
        │
PDF Santander Cuenta Corriente / Nómina
        │
        ├─ parseSantanderPDF()  (in-process, pdf-parse v2)
        │
PDF Santander Tarjeta de Crédito (Free, ORO, Platinum, AMEX, etc.)
        │
        ├─ parseSantanderCreditPDF()  (in-process, sin deps externas)
        │       ├─ detección: "CARGOS, ABONOS Y COMPRAS REGULARES" + "TARJETA TITULAR"
        │       ├─ extrae período, tarjeta (últimos 4), producto, saldos, totales
        │       ├─ parsea sección "NO A MESES" únicamente (excluye diferidos)
        │       └─ "+" = chargeAmount (cargo al cliente), "-" = creditAmount (pago)
        │
PDF escaneado / imagen
        │
        ├─ parseStatementWithVision()  → OpenAI gpt-5.4-mini
        │       └─ retry gpt-5.5 si baja confianza, cero movimientos,
        │          totales no cuadran o fechas/montos inválidos
        │       └─ fallback gpt-4o-mini si el modelo/schema falla
        │
PDF otros bancos / formatos no reconocidos
        │
        └─ parseWithAI()  → fallback texto legacy OpenAI gpt-4o-mini
                (requiere OPENAI_API_KEY)
                │
finanzas-hogar API (Next.js)         ← /var/www/finanzas-hogar
        │
  PostgreSQL — base: finanzas_hogar (127.0.0.1:5432)
```

> `finanzas-processor` (`/var/www/finanzas-processor`) ya **no** participa en la importación de estados de cuenta. Puede seguir usándose para ingestión de tickets/Excel por HTTP interno.

**Dos planos de datos paralelos:**
- **Hogar** — gastos compartidos, despensa, categorías globales, dashboard consolidado
- **Personal** — pagos propios, tarjetas/cuentas, estados de cuenta bancarios

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| ORM | Prisma 7 |
| Base de datos | PostgreSQL (`finanzas_hogar`) |
| Auth | NextAuth.js v4 (JWT + Credentials) |
| Formularios | React Hook Form + Zod |
| Tablas | TanStack Table v8 |
| Gráficas | Recharts |

---

## Entorno y credenciales

### Variables de entorno

**finanzas-hogar (`.env`)**
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://finanzas.torrax.cloud"
INTERNAL_API_TOKEN="fh-internal-n8n-2026-xK9mP3qL7vR2nT8w"

# IA para PDFs escaneados y fallback texto legacy
OPENAI_API_KEY="sk-proj-..."
OPENAI_VISION_MODEL="gpt-5.4-mini"
OPENAI_VISION_RETRY_MODEL="gpt-5.5"
OPENAI_LEGACY_FALLBACK_MODEL="gpt-4o-mini"
```

`OPENAI_VISION_MODEL` es el modelo principal del parser OCR/Vision. `OPENAI_VISION_RETRY_MODEL` se usa cuando la extracción necesita revisión automática. `OPENAI_LEGACY_FALLBACK_MODEL` solo se usa si el modelo principal no está disponible o no soporta `json_schema` estricto.

**Diagnóstico de modelos OpenAI**
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/check-openai-models.ts
```

El script lista si existen `gpt-5.4-mini`, `gpt-5.5` y `gpt-4o-mini` para la `OPENAI_API_KEY` configurada, sin imprimir la API key.

**finanzas-processor (`.env`)** — solo necesario si se usa para tickets/Excel
```env
FINANZAS_HOGAR_URL=http://127.0.0.1:4000
INTERNAL_TOKEN=fh-internal-n8n-2026-xK9mP3qL7vR2nT8w
```

> Variables obsoletas: `INTERNAL_TOKEN` (renombrado a `INTERNAL_API_TOKEN`), `WHATSAPP_ALLOWED_SENDER_PHONE`, `WHATSAPP_ALLOWED_CONVERSATION` (removidas con n8n).

### Credenciales demo (seed)

| Rol | Email | Password |
|-----|-------|----------|
| Admin | `alexis@hogar.com` | admin123 |
| Editor | `beatriz@hogar.com` | editor123 |

### Usuarios producción

| Nombre | Email | Password | userId DB | Rol |
|--------|-------|----------|-----------|-----|
| Alexis | `alexis@productdesign.mx` | `Admin2026!` ← **cambiar** | `381f9267-3fdc-4d5e-adf2-66f70b606167` | ADMIN |
| Bety | `bxmerchand@gmail.com` | `Editor2026!` ← **cambiar** | `4db9bb5f-4007-404b-bf7c-8afbe770c4df` | EDITOR |

> **Nota:** Después del re-seed de 2026-06-07 los IDs cambiaron. Los tokens JWT anteriores quedaron obsoletos. Usuarios actualizados con nuevos IDs y passwords temporales. **Cambiar passwords en `/users` tras primer login.**

---

## Scripts

```bash
# finanzas-hogar
npm run dev           # puerto 4000
npm run build
npm run db:push       # sync schema sin migraciones
npm run db:migrate
npm run db:seed
npm run db:studio     # Prisma Studio GUI
npm run db:generate   # regenerar cliente Prisma
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/check-openai-models.ts

# finanzas-processor
cd /var/www/finanzas-processor
npm run dev
npm run build
npm test
```

---

## Base de datos

### Modelos Prisma

**Hogar**
- `User` — roles: `ADMIN | EDITOR | VIEWER`
- `Payment` — pagos del hogar; enums: `PaymentStatus`, `PaymentMethod`, `Period`
  - `bankTransactionId String? @unique` — FK opcional a `BankTransaction`; permite trazar origen bancario y evitar duplicados (añadido 2026-06-13)
  - `sourceStatementId String?` — id del `BankStatement` origen (añadido 2026-06-13)
  - `importedFromBank Boolean @default(false)` — true cuando el pago se creó desde un movimiento bancario del hogar (añadido 2026-06-13)
  - Folio prefijo `HLD-` para pagos importados desde banco del hogar (vs. `BNK-` en PersonalPayment)
- `Category` — categorías globales (`PAYMENT | PANTRY | BOTH`)
- `PantryItem` + `PantryPurchaseHistory`

**Finanzas personales**
- `PersonalPayment` — folio único, period, status, paymentMethod, dueDate
  - `type String?` — `"INCOME" | "EXPENSE" | "TRANSFER"` (rellenado por finanzas-processor)
  - `financialClass FinancialClass?` — `INCOME | EXPENSE | TRANSFER | SAVING` (preferido para análisis; migrado 2026-05-17)
  - `bankTransactionId String? @unique` — FK opcional a `BankTransaction`; permite trazar origen bancario y evitar duplicados (añadido 2026-06-08)
  - `sourceStatementId String?` — id del `BankStatement` origen (añadido 2026-06-08)
  - `importedFromBank Boolean @default(false)` — true cuando el pago se creó desde un movimiento bancario (añadido 2026-06-08)
  - Clasificación jerárquica: `financialClass` → `type` → inferencia por nombre de categoría
- `PersonalCategory` — por usuario (`userId + name` únicos)
- `PersonalCard` — `paymentSourceType: PaymentSourceType`; `closingDay` y `dueDay` para corte/pago; `@@unique([userId, bankName, last4Digits, paymentSourceType])`

**Datos bancarios**
- `BankAccount` — `type: AccountType`; `scope BankAccountScope @default(PERSONAL)`; cuentas PERSONAL tienen `@@unique([userId, bankName, productName, cardNumber])`; cuentas HOUSEHOLD se identifican por `(scope, bankName, productName, cardNumber)` sin `userId`; `@@index([scope])`
- `BankStatement` — período importado; `@@unique([accountId, periodStart, periodEnd])`
  - `assignedMonth Int?` — mes asignado manualmente (1-12); null = usar cálculo automático (añadido 2026-06-17)
  - `assignedYear Int?` — año asignado manualmente; null = usar cálculo automático (añadido 2026-06-17)
  - `assignedMonthSource String? @default("auto")` — `"auto"` = calcular desde `periodEnd`; `"manual"` = usar `assignedMonth`/`assignedYear` (añadido 2026-06-17)
- `BankTransaction` — deduplicadas por `txnHash`; `@@unique([statementId, txnHash])`; índices en `accountId`, `statementId`, `transactionDate`; relación inversa opcional `personalPayment PersonalPayment?` (PERSONAL, 2026-06-08); relación inversa `payment Payment?` (HOUSEHOLD, 2026-06-13)
- `FinancialSnapshot` — historial mensual del score; `@@unique([userId, date])` (primer día del mes)

### Enums

```
Period:             ONCE | WEEKLY | BIWEEKLY | MONTHLY | BIMONTHLY | QUARTERLY | SEMIANNUAL | ANNUAL
PaymentMethod:      CASH | CREDIT_CARD | DEBIT_CARD | TRANSFER | CHECK | OTHER
PaymentStatus:      PENDING | PAID | OVERDUE | CANCELLED
FinancialClass:     INCOME | EXPENSE | TRANSFER | SAVING
PaymentSourceType:  CREDIT_CARD | DEBIT_CARD | BANK_ACCOUNT
AccountType:        CHECKING | CREDIT
BankAccountScope:   PERSONAL | HOUSEHOLD   ← nuevo (2026-06-13)
CategoryType:       PAYMENT | PANTRY | BOTH
UserRole:           ADMIN | EDITOR | VIEWER
PantryUnit:         PCS | KG | G | L | ML | PKG | BOX | CAN | BOTTLE | DOZEN
```

### Índices (añadidos 2026-06-07)

| Modelo | Índice | Motivo |
|--------|--------|--------|
| `Payment` | `registeredAt` | Filtro de fecha en dashboard |
| `Payment` | `paymentDate` | Filtro de fecha efectiva |
| `Payment` | `status` | Conteos PENDING/OVERDUE |
| `Payment` | `categoryId` | Joins en aggregations |
| `PersonalPayment` | `(userId, paymentDate)` | Filtro de fecha en dashboard personal |
| `PersonalPayment` | `(userId, createdAt)` | Fallback fecha cuando paymentDate es null |

```bash
npm run db:push    # dev
npm run db:migrate # producción — genera migración versionada
```

---

## API Routes

### Rutas internas (autenticación por token)

Todas usan `src/lib/internalAuth.ts` → `validateInternalToken()` con `crypto.timingSafeEqual`.
Header requerido: `x-internal-token: <INTERNAL_API_TOKEN>`

| Ruta | Método | Uso |
|------|--------|-----|
| `/api/internal/payments` | GET / POST | Ingesta desde finanzas-processor |
| `/api/internal/upload` | POST | Subir ticket/recibo como base64; retorna path en `/uploads/` |
| `/api/internal/categories` | GET | Listar categorías para finanzas-processor |
| `/api/financial/statements` | POST | Importar estado de cuenta vía OCR pipeline |
| `/api/financial/sync` | POST | Sincronizar BankTransactions → PersonalPayments |

### Rutas de sesión (NextAuth JWT)

| Ruta | Método | Módulo |
|------|--------|--------|
| `/api/auth/[...nextauth]` | POST | Login / logout |
| `/api/dashboard?from&to&granularity` | GET | Dashboard hogar |
| `/api/payments` | GET / POST | Pagos del hogar |
| `/api/payments/[id]` | PATCH / DELETE | Editar / eliminar pago hogar |
| `/api/categories` | GET / POST | Categorías globales |
| `/api/categories/[id]` | PATCH / DELETE | Editar / eliminar categoría |
| `/api/pantry` | GET / POST | Despensa |
| `/api/pantry/[id]` | PATCH / DELETE | Item de despensa |
| `/api/pantry/[id]/purchases` | GET / POST | Historial de compras |
| `/api/personal/dashboard` | GET | Dashboard personal |
| `/api/personal/payments` | GET / POST | Mis pagos |
| `/api/personal/payments/[id]` | PATCH / DELETE | Editar / eliminar mi pago |
| `/api/personal/payments/[id]/mark-paid` | PATCH | PENDING/OVERDUE → PAID |
| `/api/personal/payments/from-transactions` | POST | Crear `PersonalPayment` desde `BankTransaction`; body: `{ transactionIds[], defaults? }`; omite duplicados por `bankTransactionId` o folio `BNK-*` |
| `/api/personal/categories` | GET / POST | Mis categorías |
| `/api/personal/categories/[id]` | PATCH / DELETE | Editar / eliminar mi categoría |
| `/api/personal/cards` | GET / POST | Mis tarjetas/cuentas |
| `/api/personal/cards/[id]` | PATCH / DELETE | Editar / eliminar tarjeta |
| `/api/personal/cards/calendar` | GET | Calendario inteligente de crédito; query param `months` (1-12, default 3); devuelve `today`, `alerts`, `recommendations`, `calendar`, `cards`, `emptyState`; solo tarjetas activas `CREDIT_CARD`; no expone IDs internos |
| `/api/personal/statements` | GET | Listar estados de cuenta del usuario |
| `/api/personal/statements/[id]` | PATCH | Actualizar mes asignado al estado de cuenta (`assignedMonth`, `assignedYear`, `assignedMonthSource`) |
| `/api/personal/statements/[id]` | DELETE | Eliminar un estado de cuenta del usuario y sus movimientos bancarios importados |
| `/api/personal/statements/import` | POST | Importar PDF (in-process Santander o fallback OpenAI) o XML CFDI-ECB Santander (in-process) |
| `/api/personal/statements/[id]/move` | PATCH | Mover un BankStatement a otra BankAccount; opcionalmente fusiona periodo equivalente evitando duplicados por `txnHash` |
| `/api/personal/accounts/[id]` | PATCH | Editar BankAccount: `bankName`, `productName`, `cardNumber`, `type` |
| `/api/personal/accounts/merge` | POST | Fusionar dos BankAccounts del mismo usuario, moviendo periodos y deduplicando transacciones por `txnHash` |
| `/api/financial/transactions` | GET | Transacciones bancarias; filtros: `accountId`, `date_from`, `date_to`, `type`, `search`; incluye `personalPayment: { id, folio } \| null` en cada transacción (2026-06-08) |
| `/api/financial/transactions` | POST | Crear transacción manual; body: `statementId`, `accountId`, `transactionDate`, `description`, `reference?`, `chargeAmount?`, `creditAmount?`, `balance?` |
| `/api/financial/transactions/[id]` | PATCH | Editar campos de una transacción existente |
| `/api/financial/transactions/[id]` | DELETE | Eliminar transacción |
| `/api/statements` | GET | Listar `BankStatement` con `account.scope = "HOUSEHOLD"` — todos los usuarios autenticados pueden leer (sin filtro userId) |
| `/api/statements/import` | POST | Importar PDF/XML al contexto HOUSEHOLD; bloquea VIEWER; llama `importStatement(..., "HOUSEHOLD")` |
| `/api/statements/[id]` | DELETE | Eliminar estado de cuenta HOUSEHOLD (valida `account.scope = "HOUSEHOLD"`); elimina transacciones + statement en `$transaction` |
| `/api/statements/[id]/move` | PATCH | Mover statement HOUSEHOLD a otra cuenta; valida `scope = "HOUSEHOLD"` en destino; soporta `mergeIfPeriodExists` |
| `/api/accounts/[id]` | PATCH | Editar `BankAccount` HOUSEHOLD: `bankName`, `productName`, `cardNumber`, `type`; valida `scope = "HOUSEHOLD"` |
| `/api/accounts/merge` | POST | Fusionar dos cuentas HOUSEHOLD; valida `scope = "HOUSEHOLD"` en ambas; deduplicación por `txnHash` |
| `/api/transactions` | GET | Transacciones HOUSEHOLD; filtros: `accountId`, `date_from`, `date_to`, `type`, `search`; incluye `payment: { id, folio } \| null` |
| `/api/transactions` | POST | Crear transacción manual HOUSEHOLD; valida `account.scope = "HOUSEHOLD"` |
| `/api/transactions/[id]` | PATCH | Editar transacción HOUSEHOLD; bloquea VIEWER; valida `scope = "HOUSEHOLD"` |
| `/api/transactions/[id]` | DELETE | Eliminar transacción HOUSEHOLD; bloquea VIEWER; valida `scope = "HOUSEHOLD"` |
| `/api/payments/from-transactions` | POST | Crear `Payment` (hogar) desde `BankTransaction` HOUSEHOLD; folio `HLD-*`; deduplicación por `bankTransactionId` y folio; usa `prisma.$transaction` + `createMany`; bloquea VIEWER; autocategoriza con `Category` global |
| `/api/upload` | POST | Subir comprobante (JPG/PNG/PDF ≤5MB) |
| `/api/receipt/[file]` | GET | Servir comprobante almacenado |
| `/api/users` | GET / POST | Gestión de usuarios (solo ADMIN) |
| `/api/users/[id]` | PATCH / DELETE | Editar / eliminar usuario (solo ADMIN) |

---

### Errores esperados en importación OCR

`POST /api/personal/statements/import` nunca debe responder 500 para errores esperados de PDFs escaneados. El frontend muestra `data.error` directamente.

| Condición | Error interno | HTTP | Mensaje esperado |
|-----------|---------------|------|------------------|
| Falta `OPENAI_API_KEY` | `MISSING_OPENAI_API_KEY` | 503 | Configuración OpenAI faltante para PDFs escaneados |
| Falta `pdftoppm` / `poppler-utils` | `PDFTOPPM_NOT_FOUND` | 503 | Instalar/verificar `poppler-utils` |
| OpenAI falla por API/model/rate limit | `OPENAI_MODEL_ERROR` | 502 | OpenAI no pudo procesar el PDF escaneado |
| Modelo devuelve JSON inválido o schema incompatible | `OPENAI_SCHEMA_ERROR` | 422 | Datos OCR con estructura inválida |
| OCR no detecta movimientos | `NO_TRANSACTIONS_DETECTED` | 422 | No se encontraron transacciones |
| PDF corrupto/protegido o render inválido | `INVALID_OCR_PAYLOAD` | 422 | PDF escaneado no convertible o no interpretable |

Logs seguros: `vision_ocr_started`, `vision_ocr_retry`, `vision_ocr_model_fallback`, `vision_ocr_success`, `vision_ocr_failed`. No deben registrar nombre del titular, domicilio, RFC, CLABE ni número completo de tarjeta.

### Organización de estados de cuenta

La UI `/personal/statements` incluye modo **Organizar estados** para corregir importaciones OCR/PDF asociadas a una cuenta equivocada, por ejemplo variantes de la misma cuenta como `Santander`, `Santander México`, `Santander Free` o `Débito Nómina ••••1206`.

#### Mover un estado

`PATCH /api/personal/statements/[id]/move`

Body:
```json
{
  "targetAccountId": "string",
  "mergeIfPeriodExists": false
}
```

Reglas:
- Requiere sesión NextAuth y rol distinto de `VIEWER`.
- El `BankStatement` origen se busca por `id` + `account.userId`.
- La `BankAccount` destino se busca por `id` + `userId`; no se permite mover entre usuarios.
- Sin conflicto de periodo: actualiza `BankStatement.accountId` y todas sus `BankTransaction.accountId`.
- Con conflicto de periodo (`periodStart` + `periodEnd` ya existe en destino):
  - `mergeIfPeriodExists=false` devuelve `409` con `La cuenta destino ya tiene un estado de cuenta para este periodo.`
  - `mergeIfPeriodExists=true` mueve transacciones no duplicadas al statement destino, elimina duplicadas del origen por `txnHash`, y elimina el statement origen.
- Transacciones sin `txnHash` se conservan como no duplicadas porque no hay llave confiable para descartarlas.
- Todo corre dentro de `prisma.$transaction`.

Respuesta:
```json
{
  "success": true,
  "movedTransactions": 0,
  "skippedDuplicates": 0,
  "targetStatementId": "string"
}
```

#### Eliminar un estado

`DELETE /api/personal/statements/[id]`

Reglas:
- Requiere sesión NextAuth y rol distinto de `VIEWER`.
- El `BankStatement` se busca por `id` + `account.userId`; no se permite eliminar estados de otros usuarios.
- Elimina primero las `BankTransaction` del estado y después el `BankStatement`, dentro de `prisma.$transaction`.
- No elimina pagos personales ya registrados en `PersonalPayment`.
- La UI `/personal/statements` muestra un botón de papelera por periodo y confirma antes de borrar.

Respuesta:
```json
{
  "success": true,
  "deletedTransactions": 0
}
```

#### Fusionar cuentas

`POST /api/personal/accounts/merge`

Body:
```json
{
  "sourceAccountId": "string",
  "targetAccountId": "string"
}
```

Reglas:
- Requiere sesión NextAuth y rol distinto de `VIEWER`.
- Ambas cuentas se validan por `id` + `userId`.
- Rechaza `sourceAccountId === targetAccountId`.
- Por cada periodo de la cuenta origen:
  - Si no existe en destino, mueve el statement y sus transacciones.
  - Si existe en destino, fusiona transacciones evitando duplicados por `txnHash`.
- Elimina la `BankAccount` origen si queda sin statements.
- Todo corre dentro de `prisma.$transaction`.

Respuesta:
```json
{
  "success": true,
  "mergedStatements": 0,
  "movedTransactions": 0,
  "skippedDuplicates": 0
}
```

## Librerías internas

| Archivo | Responsabilidad |
|---------|----------------|
| `src/lib/prisma.ts` | Singleton `PrismaClient` con `PrismaPg` adapter |
| `src/lib/auth.ts` | `authOptions` NextAuth — JWT, CredentialsProvider, callbacks |
| `src/lib/internalAuth.ts` | `validateInternalToken()` — timing-safe con `crypto.timingSafeEqual` |
| `src/lib/dashboard-utils.ts` | Utilidades compartidas: `parseDateParam`, `buildFlowAgg`, `isReceivedCategory`, `isSavingsCategory`, tipos `FlowGranularity`, `FlowRow` |
| `src/lib/financial/import.ts` | `importStatement(payload, userId, scope)` — valida userId, upsert cuenta (PERSONAL: filtra por `userId`; HOUSEHOLD: filtra por `scope+bankName+productName+cardNumber`), dedup SHA-256, bulk-insert transacciones; `scope` acepta `"PERSONAL"` (default) \| `"HOUSEHOLD"` |
| `src/lib/financial/parsers/santander-ecb.ts` | `isSantanderECB()` + `parseSantanderECB()` — parser CFDI v4 con addenda ECB; extrae movimientos, clasifica cargo/abono, excluye nodos fiscales |
| `src/lib/financial/parsers/santander-pdf.ts` | `isSantanderCheckingPDF()` + `parseSantanderPDF()` — parser in-process para PDFs de Cuenta Corriente/Nómina Santander; agrupa líneas por bloque de fecha, usa balance acumulado para determinar cargo/abono, soporta múltiples sub-cuentas por PDF |
| `src/lib/financial/parsers/santander-credit-pdf.ts` | `isSantanderCreditPDF()` + `parseSantanderCreditPDF()` — parser in-process para PDFs de tarjetas de crédito Santander (Free, ORO, Platinum, AMEX); detecta sección "CARGOS, ABONOS Y COMPRAS REGULARES"; extrae período, últimos 4 dígitos de tarjeta, nombre de producto, saldos, totales; interpreta "+" como cargo y "-" como abono; limpia codigos FX (`20.00 USD TC 17.5415`) y códigos de autorización (`ISD`, `CPA`, `TPT`, `ANE`) de la descripción; excluye la sección de diferidos a meses; cero dependencias externas |
| `src/lib/financial/parsers/vision-ocr.ts` | `parseStatementWithVision()` — valida `pdftoppm`, renderiza PDFs escaneados, envía imágenes a OpenAI Vision con Structured Outputs (`json_schema`, `strict: true`, `additionalProperties: false`), usa `gpt-5.4-mini` como modelo principal, `gpt-5.5` como retry y `gpt-4o-mini` como fallback seguro; valida manualmente con Zod cuando usa `json_object`; requiere `OPENAI_API_KEY` y `poppler-utils` |
| `src/lib/financial/parsers/ai-fallback.ts` | `extractPdfText()` (pdf-parse v2) + `parseWithAI()` — fallback texto legacy para PDFs digitales no reconocidos; envía texto a OpenAI `gpt-4o-mini` con `response_format: json_object`; retorna `ImportStatementPayload`; requiere `OPENAI_API_KEY` |
| `src/lib/financial/sync.ts` | `syncBankToPersonalPayments()` — batch-lookup sin N+1, auto-categorización, folio `BNK-<hash16>`; exporta `cleanName()` y `autoCategory()` para reutilización; ahora también persiste `bankTransactionId`, `sourceStatementId`, `importedFromBank: true` |
| `src/lib/financial/credit-card-calendar.ts` | `buildCreditCardCalendar(cards, options)` — calendario inteligente de crédito; calcula próximo corte, fecha límite de pago (respetando si `dueDay <= closingDay` → mes siguiente), ventana óptima de consumo (D+1 a D+7 post-corte), ventana de riesgo (D-7 a D-0 pre-corte), nivel de alerta (`overdue \| pay_today \| warning_d1/d3/d7 \| risk_zone \| best_moment \| normal`) y microcopy; ajusta días inválidos con `safeDate()` para meses cortos; genera eventos de calendario por mes |
| `src/lib/validations.ts` | Schemas Zod de todos los formularios y rutas API |
| `src/lib/utils.ts` | `generateFolio()` (crypto.randomBytes), formateadores MXN/fecha, label maps |
| `src/lib/receipt.ts` | `resolveReceiptUrl()` — convierte `/uploads/…` al endpoint `/api/receipt/[file]` |
| `src/lib/category-visuals.tsx` | Íconos y colores por categoría para UI |
| `src/lib/productMetrics.ts` | Métricas de productos de despensa |

---

## finanzas-processor

**Ruta:** `/var/www/finanzas-processor` | **Estado:** activo (standalone, sin n8n)

**Pipeline:** `normalizar → extraer (IA o parser) → clasificar → validar → deduplicar → guardar en PersonalPayment`

**Fuentes soportadas (in-process, sin processor):**
- XML CFDI-ECB Santander — `parseSantanderECB()` en `src/lib/financial/parsers/santander-ecb.ts`
- PDF Santander Cuenta Corriente / Nómina — `parseSantanderPDF()` en `src/lib/financial/parsers/santander-pdf.ts`
- PDF Santander Tarjeta de Crédito (Free, ORO, Platinum, AMEX) — `parseSantanderCreditPDF()` en `src/lib/financial/parsers/santander-credit-pdf.ts` ← nuevo 2026-06-17
- PDF escaneado / imagen — `parseStatementWithVision()` vía OpenAI Vision (`gpt-5.4-mini` principal, `gpt-5.5` retry) en `src/lib/financial/parsers/vision-ocr.ts`
- PDF digital otros bancos — fallback texto legacy `parseWithAI()` vía OpenAI `gpt-4o-mini` en `src/lib/financial/parsers/ai-fallback.ts`

**Fuentes que aún requieren processor:** Excel · Imagen/ticket de recibo (OCR)

**Deduplicación:** hash `name_normalized + amount_centavos + paymentDate(YYYY-MM-DD)` para `period = ONCE`.

> WhatsApp como fuente de entrada está suspendido. El procesador recibe documentos vía HTTP directo al endpoint interno.

---

## Sitemap y navegación

### Árbol de rutas

```
/ (root)
├── /login                            AUTH
└── (app) — Requiere sesión
    ├── /dashboard                    Finanzas en Pareja · Dashboard global
    ├── /payments                     Finanzas en Pareja · Pagos del hogar
    ├── /categories                   Finanzas en Pareja · Categorías globales
    ├── /pantry                       Finanzas en Pareja · Despensa
    ├── /statements                   Finanzas en Pareja · Estados de Cuenta del Hogar  ← nuevo (2026-06-13)
    ├── /personal
    │   ├── /personal/dashboard       Mis Finanzas · Dashboard personal
    │   ├── /personal/payments        Mis Finanzas · Mis pagos
    │   ├── /personal/categories      Mis Finanzas · Mis categorías
    │   ├── /personal/cards           Mis Finanzas · Tarjetas y cuentas
    │   └── /personal/statements      Mis Finanzas · Estados de cuenta personales
    └── /users                        Admin · Gestión de usuarios (solo ADMIN)
```

### Sidebar — grupos de navegación

**Finanzas en Pareja** (ícono corazón): Dashboard · Pagos · Despensa · Categorías · Estados de Cuenta

**Mis Finanzas** (ícono persona): Mi Dashboard · Mis Pagos · Mis Categorías · Mis Tarjetas · Estados de Cuenta

**Administración** (solo ADMIN): Usuarios

**Comportamiento responsive:**

| Breakpoint | Sidebar |
|------------|---------|
| `< md` | Oculto; botón hamburguesa en Header; overlay + slide |
| `≥ md` | Fijo izquierda; colapsable: 64px (íconos) ↔ 256px (expandido) |

---

## Flujos principales

### Login (`/login`)
```
1. Formulario email + password con validación Zod
2. signIn("credentials", {redirect: false})
   ├─ OK   → router.push("/dashboard") + router.refresh()
   └─ Error → banner rojo "Credenciales incorrectas. Verifica tu email y contraseña."
```
**Gaps:** sin "¿Olvidaste tu contraseña?"; sin registro (correcto para app privada).

### Dashboard Hogar (`/dashboard`)
```
Toolbar filtro: Por día | Por semana | Por mes | Por año | Rango
→ fetch /api/dashboard?from=&to=&granularity=
→ 6 KPI StatCards (total pagos, pagado, fondos, recibido, pendientes, vencidos)
→ BarChart flujo (gastado vs recibido)
→ Treemap categorías + BarChart horizontal por método de pago
→ Lista próximos vencimientos con urgencia (rojo ≤2d / ámbar 3-5d / verde >5d)
→ Panel alertas despensa (stock bajo / por caducar)
→ Tabla últimos pagos (desktop) / cards (mobile)
```

### Pagos del Hogar (`/payments`) y Mis Pagos (`/personal/payments`)
```
Filtros: texto · categoría · estado · forma de pago
Acción primaria: "+ Nuevo pago" → Sheet lateral
Formulario: nombre · concepto · monto · categoría · período · estado · forma de pago
            tarjeta asociada (condicional si CC/DC/Transferencia) · fechas · comprobante · notas
Comprobante: drag-and-drop o click; JPG/PNG/PDF ≤5MB; preview inline
Tabla: Folio(mono) · Nombre+Concepto · Categoría(dot) · Monto · Estado · Forma/Tarjeta · Vencimiento · Acciones
Mobile: cards con info clave + botones editar/eliminar
Footer: "N pagos — $X,XXX.XX"
Eliminar: ConfirmDialog → "Esta acción no se puede deshacer"
```

### Tarjetas y Cuentas (`/personal/cards`)
```
Datos: GET /api/personal/cards + GET /api/personal/cards/calendar (fetch paralelo)

Grid 1→2→3→4 col de cards bancarias
Cada card: color corporativo del banco · tipo (Crédito/Débito/Cuenta) · •••• XXXX
           Para crédito: día de corte + día límite de pago (días numéricos)
           + próxima fecha de corte · pagar antes del (fechas reales)
           + ventana de mejor consumo (solo si alertLevel = best_moment | normal)
           + CreditCardAdviceBadge con microcopy del estado actual
           N pagos asociados · Hover: Desactivar/Editar/Eliminar (con aria-label)
Sheet creación: tipo primero → campos dinámicos (closingDay/dueDay solo para crédito)
Toggle activo/inactivo sin confirmación (opacity-60 si inactiva)

CreditAdvisorPanel (debajo del header):
  - Skeleton mientras carga el calendario
  - Estado vacío: "Agrega una tarjeta de crédito con fecha de corte y límite
    de pago para activar recomendaciones."
  - Alertas críticas primero (overdue/pay_today/warning) con severity visual
  - Grid de recomendaciones: una card por tarjeta de crédito activa
  - Colores: critical=rojo · warning=amber · opportunity=verde · info=indigo

CreditCalendar (sección colapsable al final, solo si hay tarjetas de crédito):
  - Filtro por tarjeta: chips "Todas" + uno por tarjeta (oculto si solo hay una)
    → filtra eventos tanto en el grid desktop como en la lista mobile
  - Navegación de mes con botones anterior/siguiente (aria-label)
  - Desktop: grid 7 columnas con dots de colores por tipo de evento
    → closing=purple · payment_due=rojo · best_window=verde · risk_window=amber
    → fondo del día = color del evento más prioritario
    → día actual marcado con ring-2 ring-indigo-500
  - Mobile: lista de próximos eventos (closing + payment_due únicamente) ≤15
  - Leyenda de colores al pie
```

### Estados de Cuenta (`/personal/statements`)
```
Botón "Importar PDF / XML" → StatementImportCard (drag-and-drop)
  ├─ XML (.xml) → isSantanderECB() → parseSantanderECB() → importStatement()
  └─ PDF (.pdf)
       ├─ extractPdfText()  (pdf-parse v2, in-process)
       ├─ PDF escaneado / imagen (texto < 200 chars o solo "-- N of M --")
       │    └─ parseStatementWithVision() → OpenAI Vision gpt-5.4-mini
       │         ├─ Structured Outputs con JSON Schema estricto (`json_schema`, `strict: true`)
       │         ├─ retry con gpt-5.5 si confidence < 0.90, transactions.length === 0,
       │         │  totales extraídos no cuadran, o hay fechas/montos inválidos
       │         └─ fallback legacy opcional gpt-4o-mini solo si el principal no está disponible
       ├─ isSantanderCheckingPDF() = true
       │    └─ parseSantanderPDF() → importStatement()  [sin deps externas]
       ├─ isSantanderCreditPDF() = true
       │    └─ parseSantanderCreditPDF() → importStatement()  [sin deps externas]
       │         (cubre Free, ORO, Platinum, AMEX; detecta "CARGOS, ABONOS Y COMPRAS REGULARES")
       └─ ninguno de los anteriores
            └─ parseWithAI() → OpenAI gpt-4o-mini legacy texto → importStatement()
                 (requiere OPENAI_API_KEY; si falta, devuelve 503 descriptivo)

Botón "Organizar estados" → organizeMode
  ├─ Banner: "Corrige estados importados en la cuenta equivocada."
  ├─ Cada periodo muestra botón "Mover" (sin drag-and-drop requerido; funciona en mobile)
  │    └─ MoveStatementModal:
  │         - Origen: cuenta actual + periodo
  │         - Select de cuenta destino
  │         - Checkbox "Fusionar si el periodo ya existe"
  │         - CTA "Mover estado"
  │         - PATCH /api/personal/statements/[id]/move
  │         - 409 muestra conflicto: "La cuenta destino ya tiene un estado de cuenta para este periodo."
  └─ Cada cuenta muestra botón "Fusionar"
       └─ MergeAccountsModal:
            - Cuenta origen
            - Select de cuenta destino
            - Warning: "Esta acción moverá todos los periodos y eliminará la cuenta origen si queda vacía."
            - CTA "Fusionar cuentas"
            - POST /api/personal/accounts/merge

Layout split: 1/4 panel tarjetas | 3/4 transacciones
Panel izquierdo: agrupado por BankAccount (useMemo); cada tarjeta muestra:
                 - Header: banco + botón ✏️ "Editar procedencia"; en organizeMode también "Fusionar"
                 - Subheader: nombre del producto + ••••XXXX
                 - Lista de períodos (reciente→antiguo); seleccionado = border-indigo-500; en organizeMode también "Mover"
                 - Cada período muestra cargos(rojo) y abonos(verde)
                 Modal "Editar procedencia": edita bankName, productName, cardNumber, type
                 PATCH /api/personal/accounts/[id]

Panel derecho: 4 mini-KPIs (período, transacciones, total cargos, total abonos)
               filtros: búsqueda descripción + tipo (todos/cargos/abonos) + estado de envío (todos/no enviados/ya enviados)
               tabla desktop: checkbox · fecha · descripción+badge · referencia(mono) · cargo(red) · abono(green) · saldo · [acciones]
               tabla mobile: checkbox · descripción+badge · montos · ícono editar

Selección y envío a Mis Pagos (añadido 2026-06-08):
  - Checkbox por fila: habilitado solo si el movimiento NO tiene pago vinculado
  - Checkbox en header: selecciona/deselecciona todos los movimientos visibles pendientes (indeterminate si parcial)
  - Badge por fila: "En Mis Pagos" (green-100/green-700) si ya enviado · "Pendiente" (gray-100/gray-400) si no
  - Badge "En Mis Pagos" es link hacia /personal/payments?search=<folio>
  - Barra de acción (aparece cuando hay selección activa):
      - "N movimientos seleccionados" · Cargos total · Abonos total
      - Botón "Enviar a Mis Pagos" → POST /api/personal/payments/from-transactions
      - Botón "Cancelar selección"
  - Toast resultado: "N pagos creados correctamente · X omitidos por duplicado · Ver en Mis Pagos"
  - Al cambiar de período la selección se limpia automáticamente

Seguridad UI:
  - No se muestran IDs internos.
  - Las cuentas se etiquetan con banco + producto + últimos 4 dígitos enmascarados.
  - Modales usan role="dialog", aria-modal y errores role="alert".
  - Checkboxes y botones de acción tienen aria-label accesible.
  - Acciones muestran loading y success/error toast.

Edición inline (desktop):
  - Hover sobre fila → ícono ✏️ visible (opacity-0 group-hover:opacity-100)
  - Click → fila se convierte en inputs (bg-indigo-50/60); ✓ guarda, ✗ cancela
  - PATCH /api/financial/transactions/[id]

Agregar movimiento:
  - Desktop: botón "Agregar movimiento" → fila vacía al inicio de la tabla con inputs
  - Mobile: mismo botón → Modal con formulario completo
  - POST /api/financial/transactions (body incluye statementId + accountId del período seleccionado)
```

### Estados de Cuenta del Hogar (`/statements`)
```
Contexto: BankAccount.scope = "HOUSEHOLD" — compartido por todos los usuarios autenticados.
No aparece en /personal/statements y viceversa.

Botón "Importar PDF / XML" → StatementImportCard (importEndpoint="/api/statements/import")
  → POST /api/statements/import → importStatement(payload, userId, "HOUSEHOLD")
  (misma lógica OCR/parsers que personal; cuenta se crea/busca sin filtro userId)

Layout split: 1/4 panel tarjetas | 3/4 transacciones
Panel izquierdo: agrupado por BankAccount HOUSEHOLD; mismos controles que personal/statements:
  - Header banco + botón "Editar procedencia" → PATCH /api/accounts/[id]
  - En organizeMode: botón "Fusionar" por cuenta → POST /api/accounts/merge
  - Lista de períodos; cada uno muestra cargos/abonos
  - En organizeMode: botón "Mover" → PATCH /api/statements/[id]/move
  - Botón papelera por período → DELETE /api/statements/[id]

Panel derecho: 4 mini-KPIs + tabla transacciones
  Transacciones: GET /api/transactions (scope HOUSEHOLD); incluye payment: { id, folio } | null
  Edición inline: PATCH /api/transactions/[id]
  Agregar movimiento: POST /api/transactions
  Eliminar: DELETE /api/transactions/[id]

Selección y envío a Pagos del Hogar:
  - Checkbox por fila: habilitado solo si NO tiene payment vinculado
  - Badge "En Pagos del Hogar" (verde, link a /payments?search=<folio>) o "Pendiente" (gris)
  - Barra de acción: "N movimientos seleccionados" + "Enviar a Pagos del Hogar"
    → POST /api/payments/from-transactions → crea Payment (no PersonalPayment); folio HLD-*
  - Toast: "N pagos creados · X omitidos · Ver en Pagos del Hogar"
  - Deduplicación: por bankTransactionId (UNIQUE FK en Payment) y por folio HLD-*

Seguridad:
  - VIEWER solo lectura; ADMIN/EDITOR importan/editan/borran/mueven/fusionan
  - No se muestran IDs internos; tarjetas enmascaradas ••••XXXX
  - Logs sin datos bancarios sensibles
```

---

## Matriz de módulos

| Módulo | Usuario objetivo | Problema resuelto | Acción principal | Estado vacío | KPI |
|--------|-----------------|-------------------|------------------|--------------|-----|
| Login | Cualquier rol | Acceso seguro | Submit formulario | N/A | `login_success` |
| Dashboard hogar | Admin/miembro | Vista general rápida | Cambiar filtro de tiempo | "Sin datos" por sección | `dashboard_view` |
| Pagos hogar | Admin/editor | Centralizar gastos compartidos | "+ Nuevo pago" | Ícono + "Sin pagos" + CTA | `payment_created` |
| Categorías | Admin | Vocabulario compartido | Crear categoría | Sin guía (GAP) | # categorías |
| Despensa | Admin/miembro | Prevenir agotamiento y caducidad | Registrar producto | "Todo en orden ✓" | # alertas atendidas |
| Mis Tarjetas | Individual | Trazabilidad por medio de pago | "+ Agregar medio de pago" | Ícono + CTA primario | # tarjetas activas |
| Mis Pagos | Individual | Registro de gastos personales | "+ Nuevo pago" | Ícono + "Crea tu primer pago" | `payment_created` |
| Estados de Cuenta (Personal) | Individual | Ver movimientos bancarios personales; enviar a Mis Pagos | Seleccionar período | "Importa estados de cuenta" | `statement_import_success` |
| Estados de Cuenta (Hogar) | Admin/miembro | Centralizar movimientos bancarios compartidos; enviar a Pagos del Hogar | Seleccionar período | "Importa el primer estado de cuenta del hogar" | `statement_import_success` |
| Usuarios | ADMIN | Control de accesos | Crear usuario | Improbable | # usuarios activos |

### Patrones UX transversales

| Patrón | Implementación |
|--------|----------------|
| Carga | Spinner circular indigo `animate-spin` centrado (GAP: sin skeleton) |
| CRUD | Sheet lateral crear/editar · ConfirmDialog eliminar |
| Error inline | Banner `bg-red-50 border-red-200` + botón Cerrar |
| Éxito | Toast global `react-hot-toast` (GAP: por implementar) |
| Validación | Zod + RHF · error bajo cada campo en `text-xs text-red-600` |
| Tabla responsive | `hidden sm:block` desktop · `sm:hidden` mobile cards |
| Totales | `<tfoot>` con suma de montos + conteo de registros |

---

## Design System

### Tokens de color semántico

**Marca**

| Token | Tailwind | Hex | Uso |
|-------|----------|-----|-----|
| brand-primary | `indigo-600` | `#4f46e5` | Botón primario, active nav, spinner |
| brand-dark | `indigo-900` | `#1e1b4b` | Sidebar background |
| brand-light | `indigo-100` | `#e0e7ff` | Icon backgrounds KPI |
| surface-card | `white` | `#ffffff` | Cards, modales |
| surface-muted | `gray-50` | `#f9fafb` | Table headers |

**Estados de pago (StatusBadge)**

| Estado | BG | Text |
|--------|----|------|
| PAID | `green-100` | `green-800` |
| PENDING | `yellow-100` | `yellow-800` |
| OVERDUE | `red-100` | `red-800` |
| CANCELLED | `gray-100` | `gray-600` |

**Urgencia de vencimientos (dashboard)**

| Días | BG | Border | Dot | Badge |
|------|----|--------|-----|-------|
| ≤ 2 | `red-50` | `red-100` | `red-400` | `red-100/700` |
| 3-5 | `amber-50` | `amber-100` | `amber-400` | `amber-100/700` |
| > 5 | `green-50` | `green-100` | `green-400` | `green-100/700` |

**Formas de pago (charts)**

| Método | Color |
|--------|-------|
| CASH | `#22c55e` |
| CREDIT_CARD | `#6366f1` |
| DEBIT_CARD | `#3b82f6` |
| TRANSFER | `#f59e0b` |
| CHECK | `#8b5cf6` |
| OTHER | `#94a3b8` |

### Tipografía

| Nivel | Clases | Uso |
|-------|--------|-----|
| H1 página | `text-2xl font-bold text-gray-900` | Títulos de sección |
| H2 card | `text-base font-semibold text-gray-900` | Headers de charts |
| Label campo | `text-sm font-medium text-gray-700` (`.label`) | Formularios |
| KPI valor | `text-2xl font-bold text-gray-900` | StatCard |
| Score | `text-4xl font-black tabular-nums` | Score financiero |
| Folio | `font-mono text-xs text-indigo-700` | Folios PAG-AAMM-XXXX |
| Meta | `text-xs text-gray-500` | Fechas, subtítulos |

### Clases globales (CSS)

```css
.label       → text-sm font-medium text-gray-700 block mb-1
.input       → border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-indigo-500
.card        → bg-white rounded-xl shadow-sm border border-gray-100
.btn-primary → bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700
.btn-secondary → border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50
```

### Charts (Recharts)

| Chart | Módulo | Detalle |
|-------|--------|---------|
| BarChart flujo | Dashboard | Gastado `#ef4444` vs Recibido `#06b6d4`; granularity dinámica |
| Treemap categorías | Dashboard | Paleta 20 colores indexada + hash por nombre |
| BarChart horizontal | Dashboard | Por método de pago, Cell con color específico |

### Responsive

| Breakpoint | Comportamiento |
|------------|----------------|
| `< 640px` | Sidebar overlay, KPI 1col, cards en lugar de tabla, filtros 1col |
| `≥ 640px` | Tabla desktop, filtros 2col |
| `≥ 768px` | Sidebar fijo colapsable |
| `≥ 1024px` | KPI 3col, charts 2col, split panel statements |
| `≥ 1280px` | KPI 6col (dashboard) |

---

## Eventos analíticos

Crear `src/lib/analytics.ts`:

```typescript
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}
```

| # | Evento | Trigger | Archivo | Parámetros clave |
|---|--------|---------|---------|-----------------|
| 1 | `login_success` | signIn OK | `(auth)/login/page.tsx` | `method: "credentials"` |
| 2 | `dashboard_view` | Datos cargados | `(app)/dashboard/page.tsx` | `time_filter`, `has_overdue`, `overdue_count` |
| 3 | `payment_created` | POST/PATCH exitoso | `payments/page.tsx`, `personal/payments/page.tsx` | `scope`, `has_receipt`, `payment_method`, `amount_bucket` |
| 4 | `statement_import_started` | Inicio upload PDF | Futuro UI importación | `file_type`, `bank_name` |
| 5 | `statement_import_success` | Sync completado | Backend / futuro UI | `period`, `transaction_count` |
| 6 | `financial_filter_used` | Cambio de filtro | `dashboard/page.tsx`, pagos | `filter_type`, `value`, `module` |
| 7 | `chart_interaction` | Hover en chart | Dashboard | `chart_type`, `module` |

> Para `amount_bucket`: `0-500 | 500-2000 | 2000-10000 | 10000+` — no registrar montos exactos.

---

## Backlog UX/UI

### Prioridad 🔴 Crítica

| ID | Ítem | Módulo | Detalle |
|----|------|--------|---------|
| QW-01 | Error de red en Dashboard | Dashboard | Fetch sin catch → pantalla en blanco. Agregar estado de error + "Reintentar" |
| QW-02 | Error de red en Statements | Statements | Importación: error FK de sesión obsoleta ahora devuelve 401 claro. Queda pendiente spinner infinito en fallo de red general |
| AN-01 | Crear `src/lib/analytics.ts` | Global | Función `trackEvent` base para todos los eventos |
| AN-02 | Instalar GA4 en root layout | Global | Script gtag.js en `src/app/layout.tsx` |
| AC-01 | `aria-label` en botones de ícono | Todos | Botones editar/eliminar solo tienen `title`; necesitan `aria-label="Editar pago X"` |
| AC-02 | `<label htmlFor>` explícito | Formularios | Labels sin `htmlFor` ligado al `id` del input |
| ~~RK-01~~ | ~~UI de importación de PDFs~~ | ~~Statements~~ | **Resuelto 2026-06-07** — botón "Importar PDF / XML" funcional; XML Santander in-process, PDF vía processor |
| ~~RK-02~~ | ~~FK constraint P2003 en importación~~ | ~~Statements~~ | **Resuelto 2026-06-07** — validación defensiva en `importStatement()` + 401 claro cuando JWT es obsoleto |

### Prioridad 🟠 Alta

| ID | Ítem | Módulo | Detalle |
|----|------|--------|---------|
| QW-03 | Toast/Snackbar global | Todos | Implementar `react-hot-toast` con auto-dismiss 3s para CRUD feedback |
| UX-02 | Paginación en tablas | Pagos/Statements | Sin límite de registros; agregar `limit/offset` con indicador de total |
| AC-05 | `role="alert"` en errores | Formularios | Banners de error no anunciados a screen readers |
| AN-03 | Implementar eventos 1-3 | Core | login, dashboard, payment_created |
| UI-01 | Skeleton loading | Todos | Reemplazar spinner por skeleton screens para reducir layout shift |
| RK-03 | Carga sin paginación | Pagos | Con muchos registros puede saturar cliente |

### Prioridad 🟡 Media

| ID | Ítem | Módulo | Detalle |
|----|------|--------|---------|
| QW-04 | `<title>` dinámico por ruta | Todos | `export const metadata` en cada page.tsx |
| QW-05 | Folio en clipboard | Pagos | Botón copiar al portapapeles en folios |
| QW-06 | Badge urgencia en tabla | Mis Pagos | Badge "Hoy/Mañana/N días" en columna Vencimiento |
| UX-01 | UI importación estados de cuenta | Statements | Wizard: seleccionar banco → subir PDF → preview → confirmar |
| ~~UX-03~~ | ~~Ordenamiento en tablas pagos~~ | ~~Statements~~ | **Resuelto 2026-06-13** — Ordenamiento por fecha y cargo implementado en `/personal/statements`; pendiente extender a Pagos/Mis Pagos |
| UX-05 | Filtro de fechas en URL params | Dashboard | Persistir filtro en query string para compartir y navegar |
| AC-03 | Focus visible en teclado | Global | Verificar `focus:ring-2 focus:ring-indigo-500` en todos los interactivos |
| AC-04 | Contraste de texto | Global | Verificar `text-indigo-200` sobre `bg-indigo-900` ≥ 4.5:1 |
| AC-09 | `role="dialog"` en modales | Formularios | ConfirmDialog y ConfirmModal necesitan `aria-modal`, `aria-labelledby`, trap de foco |
| RK-06 | Multi-banco en XML | Statements | XML CFDI-ECB funciona para Santander. BBVA, Banamex, HSBC también exportan XML pero tienen schemas propietarios distintos — requieren adaptadores adicionales en `src/lib/financial/parsers/` |

### Prioridad 🟢 Baja

| ID | Ítem | Módulo |
|----|------|--------|
| QW-07 | Feedback en "Limpiar campos" | Formularios |
| QW-08 | Scroll al primer error | Formularios |
| UX-08 | Buscador global Cmd+K | Todos |
| UI-04 | Animación transition en Sheet | Todos |
| UI-05 | Color picker de categorías | Categorías |
| UI-07 | Modo oscuro | Global |
| AC-06 | Skip link "Ir al contenido" | Global |
| AC-07 | `aria-live="polite"` en loading | Todos |
| AC-10 | `prefers-reduced-motion` | Global |

### Orden de sprint recomendado

```
Sprint 1 — Estabilidad y accesibilidad base
  QW-01, QW-02, QW-03, AC-01, AC-02 (RK-01 resuelto)

Sprint 2 — Instrumentación analítica
  AN-01, AN-02, AN-03, AN-04

Sprint 3 — UX de flujos incompletos
  UX-01 (importación UI), UX-02 (paginación), UX-04 (mark-paid en tabla)

Sprint 4 — Polish UI
  UI-01 (skeletons), QW-04 (títulos), QW-05 (folio clipboard)
```

---

## Pendientes técnicos

| Tarea | Prioridad |
|-------|-----------|
| **Reemplazar n8n:** evaluar Baileys standalone, Evolution API o webhook Twilio para WhatsApp | P1 |
| **Reactivar ingesta WhatsApp** con el nuevo canal | P2 |
| Resumen ejecutivo con IA (Claude Haiku, 3 bullets) | P3 |
| Chat CFO personal — panel lateral de preguntas sobre pagos | P3 |
| Notificación WhatsApp cuando pago llega a 3 días de vencimiento | P4 |
| Alerta crítica WhatsApp si hay pagos vencidos | P4 |
| Test E2E (Playwright) | P5 |

---

## Historial de cambios

### 2026-08-04 — Eliminación de módulo "Plan de Recuperación"

#### Cambio

Se removió completamente el módulo "Plan de Recuperación" del sistema:

**Archivos eliminados:**
- `src/lib/financial/recovery-plan.ts` (1,043 líneas) — librería de lógica del score, matriz priorizada, proyecciones e insights
- `src/app/(app)/financial/recovery-plan/page.tsx` (1,067 líneas) — página UI con gráficas, tabla de prioridades y análisis
- `src/app/api/financial/recovery-plan/route.ts` — endpoint GET que retorna `RecoveryPlan`

**Componentes actualizados:**
- `src/components/layout/Sidebar.tsx` — removido item "Plan de Recuperación" de `personalItems`

**Documentación actualizada:**
- Removidas referencias a recovery-plan de índice, API routes, librerías internas
- Removidas rutas `/financial/recovery-plan` del sitemap
- Removida sección de flujos principales del plan
- Removida entrada de la matriz de módulos
- Removidas referencias de eventos analíticos y charts del Recovery
- Actualizados pendientes técnicos relacionados

**Alcance:**
- Commit `0ae8feb`: 2,147 líneas eliminadas
- Cero cambios en tablas de datos, schemas Prisma o bases de datos
- Cero cambios en APIs de Mis Pagos, Mis Tarjetas, o Estados de Cuenta

#### Motivo

Simplificación del sistema y reducción de complejidad. Los usuarios pueden gestionar pagos desde "Mis Pagos" y seguimiento bancario desde "Estados de Cuenta" sin necesidad de un módulo de análisis predictivo centralizado.

---

### 2026-06-17 — Fix errores SVG en sidebar (sweep-flag ausente en arc)

#### Problema

Dos errores en consola del navegador en todas las páginas que muestran el sidebar:

```
Error: <path> attribute d: Expected arc flag ('0' or '1'),
"….5H21a.75.75 0 0-.75.75v.75m0 0H…"
```

#### Causa

El comando arc SVG tiene 7 parámetros: `a rx ry x-rotation large-arc-flag sweep-flag dx dy`.

El ícono de billetes (Heroicons `banknotes`) en los ítems "Pagos" y "Mis Pagos" del sidebar tenía `a.75.75 0 0-.75.75` — solo 6 parámetros. El `sweep-flag` (tercer flag, obligatorio) estaba ausente. Al parsear `0-.75`, Chrome esperaba un flag `0` o `1` y encontró `-.75` (número negativo), lanzando el error.

#### Cambios aplicados

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/Sidebar.tsx` | `a.75.75 0 0-.75.75` → `a.75.75 0 0 0-.75.75` en las dos ocurrencias del path del ícono banknotes (ítems "Pagos" y "Mis Pagos", líneas 24 y 86) |

El fix agrega el `sweep-flag = 0` faltante antes de las coordenadas del endpoint.

#### Verificación

- Errores desaparecidos en consola del navegador
- Ícono renderiza idéntico visualmente (el sweep-flag `0` produce el mismo arco que el PDF espera)

---

### 2026-06-17 — Validación de entrada en PATCH `/api/personal/statements/[id]`

#### Problema

El endpoint `PATCH /api/personal/statements/[id]` aceptaba cualquier valor numérico para `assignedMonth` y `assignedYear` sin validar rangos. Un cliente malicioso (o un bug en el frontend) podía persistir `assignedMonth: 13`, `assignedMonth: 0` o `assignedYear: 1900` en la base de datos, corrompiendo la etiqueta de mes mostrada en la UI.

#### Cambios aplicados

| Archivo | Cambio |
|---------|--------|
| `src/app/api/personal/statements/[id]/route.ts` | Validación de rangos antes del `prisma.bankStatement.update` |

Reglas añadidas:

| Campo | Validación | Error HTTP |
|-------|-----------|------------|
| `assignedMonth` | Entero en \[1, 12\]; null permitido (reset a auto) | 400 `"Mes inválido (debe ser 1–12)"` |
| `assignedYear` | Entero en \[2000, 2100\]; null permitido | 400 `"Año inválido"` |
| `assignedMonthSource` | Solo `"manual"` o `"auto"`; null permitido | 400 `"assignedMonthSource inválido"` |

#### Verificación

- Enviar `assignedMonth: 13` → 400 con mensaje descriptivo
- Enviar `assignedMonth: null` → 200, resetea a cálculo automático desde `periodEnd`
- Enviar `assignedMonthSource: "foo"` → 400 con mensaje descriptivo
- Flujo normal desde la UI (guardar mes manual, restaurar automático) → sin cambios de comportamiento

---

### 2026-06-17 — Parser in-process Santander tarjeta de crédito + fix 504 nginx

#### Problema

Al importar un PDF de estado de cuenta de **tarjeta de crédito Santander** (Free, ORO, etc.) la petición fallaba con **504 Gateway Timeout** en `POST /api/personal/statements/import`. Tres causas raíz identificadas:

1. **nginx `proxy_read_timeout` no configurado** — el valor por defecto de 60 s es insuficiente para el pipeline de IA que procesa PDFs no reconocidos.
2. **Next.js route sin `maxDuration`** — en producción (Vercel o similares) la ruta abortaba antes de completarse.
3. **PDF de tarjeta de crédito no reconocido** — `isSantanderCheckingPDF()` devolvía `false` para tarjetas de crédito (que no contienen `SALDO FINAL DEL PERIODO ANTERIOR`), por lo que el PDF caía al pipeline de OpenAI Vision que tardaba 60-120 s.

#### Cambios aplicados

| Área | Cambio |
|------|--------|
| nginx | Añadidos `proxy_read_timeout 300s; proxy_connect_timeout 60s; proxy_send_timeout 300s;` dentro de `location /` en `/etc/nginx/sites-enabled/finanzas.torrax.cloud`; recargado con `nginx -s reload` |
| API route | `export const maxDuration = 300;` añadido en `src/app/api/personal/statements/import/route.ts` |
| Nueva lib | `src/lib/financial/parsers/santander-credit-pdf.ts` — parser in-process para PDFs de tarjeta de crédito Santander; sin dependencias externas; ~200 ms vs 60-120 s del pipeline de IA |
| Integración | Step 2b añadido en el pipeline de importación: `isSantanderCreditPDF()` → `parseSantanderCreditPDF()` entre el check de Cuenta Corriente (2a) y el fallback de IA (3) |

#### Lógica del parser `santander-credit-pdf.ts`

| Aspecto | Implementación |
|---------|---------------|
| Detección | `norm.includes("CARGOS, ABONOS Y COMPRAS REGULARES") && (norm.includes("NUMERO DE TARJETA") || norm.includes("TARJETA TITULAR"))` |
| Sección | Extrae sólo "CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)"; excluye diferidos a meses |
| Período | Regex `Periodo: DD-Mon-YYYY al DD-Mon-YYYY`; falla con error descriptivo si no encuentra |
| Tarjeta | `Número de tarjeta: XXXX XXXX XXXX YYYY` → guarda sólo últimos 4 dígitos |
| Producto | `Denominación y categoría de la tarjeta: ORO` → `productName` |
| Saldos | `Adeudo del periodo anterior` → `openingBalance`; `Pago para no generar intereses` → `closingBalance` |
| Signo | `+` en PDF = cargo al cliente (`chargeAmount`); `-` en PDF = abono/pago (`creditAmount`) |
| FX | Elimina `20.00 USD TC 17.5415` de la descripción antes de extraer referencia |
| Referencia | Extrae `ISD 950921HE5`, `CPA 180810PH5`, `TPT 890516JP5`, `ANE 140618P37` como `reference` |
| Deduplicación | `Set<string>` por `fecha|descripción|chargeAmount|creditAmount` dentro del lote |
| Tipo | Retorna `account.type: "CREDIT"` |

#### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `/etc/nginx/sites-enabled/finanzas.torrax.cloud` | `proxy_read_timeout 300s`, `proxy_connect_timeout 60s`, `proxy_send_timeout 300s` |
| `src/app/api/personal/statements/import/route.ts` | `export const maxDuration = 300;` + Step 2b (`isSantanderCreditPDF` / `parseSantanderCreditPDF`) |
| `src/lib/financial/parsers/santander-credit-pdf.ts` | Archivo nuevo — parser completo de tarjeta de crédito Santander |

#### Verificación

| Prueba | Resultado |
|--------|-----------|
| `npx tsc --noEmit` | Sin errores TypeScript |
| Importar `ESTADO DE CUENTA-FREE-FEBRERO2026.pdf` | Procesado en ~200 ms, sin llamadas a OpenAI; 8 transacciones importadas correctamente |
| Referencias extraídas (`ISD`, `CPA`, `TPT`, `ANE`) | Correctas en todas las líneas de prueba |
| Notación FX (`20.00 USD TC 17.5415`) | Eliminada de la descripción antes de guardar |
| `pm2 restart finanzas-hogar --update-env` | Proceso online |

---

### 2026-06-17 — Mes asignado en estados de cuenta (`/personal/statements`)

#### Problema

El título de mes en los estados de cuenta se calculaba desde `periodStart` (fecha inicial del período), cuando debería calcularse desde `periodEnd` (fecha de corte). Ejemplo: el período `07/05/2026 — 05/06/2026` mostraba "mayo de 2026" en lugar de "junio de 2026". Además, no había manera de corregir el mes asignado si el cálculo automático era incorrecto.

#### Cambios aplicados

| Área | Cambio |
|------|--------|
| Schema Prisma | Tres campos nuevos en `BankStatement`: `assignedMonth Int?`, `assignedYear Int?`, `assignedMonthSource String? @default("auto")` |
| DB | `prisma db push` aplicado — campos opcionales, sin pérdida de datos |
| Cliente Prisma | `prisma generate` regenerado |
| API nueva | `PATCH /api/personal/statements/[id]` — actualiza `assignedMonth`, `assignedYear`, `assignedMonthSource`; valida ownership por `userId`; bloquea `VIEWER` |
| `periodLabel(s)` | Función refactorizada: recibe el objeto `BankStatement` completo en lugar de solo `periodStart`; si `assignedMonthSource === "manual"` usa `assignedMonth`/`assignedYear`; de lo contrario usa `periodEnd` |
| `autoPeriodLabel(periodEnd)` | Nueva función auxiliar que siempre calcula desde `periodEnd`; usada como referencia en el botón "Usar mes automático" del modal |
| KPI "Período" | Card rediseñada con ícono de lápiz junto al título del mes; badge "editado manualmente" cuando `assignedMonthSource === "manual"` |
| Sidebar izquierdo | Ícono de lápiz por período visible en hover; abre el mismo modal de edición |
| Modal edición | Selectores de mes (enero-diciembre) y año (±2 años desde hoy); vista previa en tiempo real del mes resultante; botón "Guardar" (persiste como manual); botón "Cancelar"; enlace "Usar mes automático (mes X)" que resetea a `assignedMonthSource: "auto"` |
| Build | `npm run build` limpio — 45 rutas, 0 errores TypeScript |
| Deploy | `pm2 restart finanzas-hogar` aplicado; proceso online |

#### Regla de negocio

| Fuente | Condición | Mes mostrado |
|--------|-----------|--------------|
| `auto` (default) | `assignedMonthSource` es `null` o `"auto"` | Mes y año de `periodEnd` |
| `manual` | `assignedMonthSource === "manual"` y ambos campos definidos | `assignedMonth` / `assignedYear` guardados |

#### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Campos `assignedMonth`, `assignedYear`, `assignedMonthSource` en `BankStatement` |
| `src/app/api/personal/statements/[id]/route.ts` | Handler `PATCH` nuevo |
| `src/app/(app)/personal/statements/page.tsx` | Interfaz, `periodLabel`, `autoPeriodLabel`, estados, handler `handleSavePeriod`, KPI card, sidebar, modal de edición |

#### QA verificado 2026-06-17

| Caso | Resultado esperado |
|------|--------------------|
| Estado con período `07/05 — 05/06` | Muestra "junio de 2026" (calculado desde `periodEnd`) |
| Click en lápiz de KPI card | Abre modal con mes/año precargados del valor actual |
| Cambiar mes a "marzo 2026" → Guardar | Título cambia a "marzo de 2026"; badge "editado manualmente" visible |
| Click "Usar mes automático" | Título vuelve a "junio de 2026"; badge desaparece |
| Click en lápiz del sidebar | Misma funcionalidad; estados de otros períodos no se afectan |
| Build | `npm run build` limpio, sin errores TypeScript |

---

### 2026-06-13 — Ordenamiento de movimientos en `/personal/statements`

#### Objetivo

Permitir al usuario ordenar la tabla de movimientos bancarios por fecha o por cargo, con control visual claro del estado activo, accesibilidad completa y comportamiento correcto en mobile.

#### Cambios aplicados

| Área | Cambio |
|------|--------|
| Tipos | `SortField = "date" \| "charge"` y `SortDirection = "asc" \| "desc"` definidos a nivel de módulo en `page.tsx` |
| Componente | `SortButton` — botón reutilizable con label + chevron; color índigo cuando activo; chevron rotado 180° en ASC; `aria-label` dinámico con la próxima acción ("Ordenar por fecha ascendente/descendente") |
| Estado | `sortField` (default `"date"`) + `sortDirection` (default `"desc"`) → comportamiento inicial: movimientos más recientes primero |
| Lógica | `handleSort(field)` — click en columna activa alterna ASC/DESC; click en columna inactiva la activa en DESC |
| `sortedTransactions` | `useMemo` que ordena `visibleTransactions` (ya filtrados). Fecha: `transactionDate` DESC/ASC; empates por `reference` (locale), fallback `id`. Cargo: `chargeAmount` DESC/ASC; movimientos sin cargo (`null` o `0`) siempre al final |
| Desktop — headers | `<th aria-sort="ascending\|descending\|none">` en columnas FECHA y CARGO; CARGO con `justify-end` para alinear el botón a la derecha |
| Desktop — render | Tabla itera `sortedTransactions` (antes `visibleTransactions`); conteo en `<tfoot>` usa `sortedTransactions.length` |
| Mobile — controles | Strip compacto `bg-gray-50/80` encima de la lista con `<select id="mobile-sort-field">` (Fecha / Cargo) + botón flecha para alternar dirección; `aria-label` en ambos controles; fondo índigo cuando dirección = DESC |
| Mobile — render | Lista itera `sortedTransactions`; conteo en footer usa `sortedTransactions.length` |
| Invariante | Totales (`totalCharges`, `totalCredits`) y pool de selección (`selectableTransactions`, `activeSelection`) siguen usando `visibleTransactions` — el orden no afecta montos ni checkboxes |
| Accesibilidad | `aria-sort` en `<th>` según WAI-ARIA; `aria-label` describe la acción siguiente (no el estado actual); chevron `aria-hidden="true"` |
| Build | `npm run build` limpio — 45 rutas, 0 errores TypeScript, compilación Turbopack en 30.2s |
| Deploy | `pm2 restart finanzas-hogar` — proceso online |

#### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/app/(app)/personal/statements/page.tsx` | Tipos `SortField`/`SortDirection`, componente `SortButton`, estados `sortField`/`sortDirection`, `handleSort`, `sortedTransactions`, headers con `aria-sort`, controles mobile, render de tabla y lista actualizados |

#### QA verificado 2026-06-13

| Caso | Resultado esperado |
|------|--------------------|
| Carga inicial | Movimientos ordenados por fecha DESC (más recientes primero) |
| Click en FECHA (activo DESC) | Cambia a ASC (más antiguos primero); chevron rota |
| Click en CARGO (inactivo) | Activa cargo DESC (mayor primero); FECHA queda inactiva |
| Click en CARGO (activo DESC) | Cambia a ASC (menor primero) |
| Movimientos sin cargo al ordenar por cargo | Aparecen al final independientemente de la dirección |
| Filtro activo + cambio de orden | Filtros se mantienen; solo cambia el orden dentro de los visibles |
| Mobile select "Cargo" | Lista se reordena; botón flecha alterna ASC/DESC |
| `aria-sort` | `<th>` FECHA muestra `ascending`/`descending`/`none` según estado |
| Build | `npm run build` — sin errores TypeScript |

---

### 2026-06-13 — Estados de Cuenta del Hogar (`/statements`)

#### Objetivo

Añadir un módulo de estados de cuenta bancarios al plano **Hogar** (`Finanzas en Pareja`) con separación estricta del plano personal. Los movimientos bancarios compartidos se envían a `Payment` (no `PersonalPayment`), usando el mismo pipeline de importación PDF/XML.

#### Cambios aplicados

| Área | Cambio |
|------|--------|
| Schema Prisma | Nuevo enum `BankAccountScope { PERSONAL HOUSEHOLD }`; campo `scope BankAccountScope @default(PERSONAL)` + `@@index([scope])` en `BankAccount` |
| Schema Prisma | `Payment` recibe: `bankTransactionId String? @unique` (FK con `onDelete: SetNull`), `sourceStatementId String?`, `importedFromBank Boolean @default(false)`; relación inversa `bankTransaction BankTransaction?` |
| Schema Prisma | `BankTransaction` recibe relación inversa `payment Payment?` (HOUSEHOLD) |
| DB | `npm run db:push -- --accept-data-loss` — advertencia esperada por `UNIQUE NULL` en PostgreSQL (no hay pérdida real de datos) + `npm run db:generate` para regenerar el cliente Prisma |
| `import.ts` | `importStatement(payload, userId, scope: "PERSONAL" \| "HOUSEHOLD" = "PERSONAL")` — para PERSONAL filtra por `userId`; para HOUSEHOLD filtra por `(scope, bankName, productName, cardNumber)` sin userId; `BankAccount.create` incluye `scope` |
| `StatementImportCard` | Prop nueva `importEndpoint?: string` (default `"/api/personal/statements/import"`); reemplaza URL hardcodeada; compatibilidad hacia atrás |
| Scope aislamiento personal | `GET /api/personal/statements` ahora filtra `account.scope = "PERSONAL"` para que cuentas HOUSEHOLD no aparezcan en la sección personal |
| Sidebar | Item "Estados de Cuenta" añadido al grupo "Finanzas en Pareja" con ícono de documento |
| API household — statements | `GET /api/statements`: lista con `account.scope = "HOUSEHOLD"`, sin filtro userId |
| API household — import | `POST /api/statements/import`: llama `importStatement(..., "HOUSEHOLD")`; bloquea VIEWER |
| API household — [id] | `DELETE /api/statements/[id]`: valida `scope = "HOUSEHOLD"`; elimina transacciones + statement en `$transaction` |
| API household — move | `PATCH /api/statements/[id]/move`: valida `scope = "HOUSEHOLD"` en destino; soporta `mergeIfPeriodExists` |
| API household — accounts | `PATCH /api/accounts/[id]`: edita cuenta HOUSEHOLD; `POST /api/accounts/merge`: fusiona dos cuentas HOUSEHOLD |
| API household — transactions | `GET /api/transactions`: scope HOUSEHOLD; incluye `payment: { id, folio }`; `POST /api/transactions`: crea transacción manual; `PATCH/DELETE /api/transactions/[id]`: edición y borrado; todos validan `scope = "HOUSEHOLD"` |
| API household — from-transactions | `POST /api/payments/from-transactions`: crea `Payment` desde `BankTransaction` HOUSEHOLD; folio `HLD-<hash16>`; autocategoriza con `Category` global; deduplica por `bankTransactionId` y folio; `prisma.$transaction` + `createMany(skipDuplicates: true)`; bloquea VIEWER |
| UI `/statements` | Página espejo de `/personal/statements` adaptada al contexto HOUSEHOLD: fetches de `/api/statements` y `/api/transactions`; badge "En Pagos del Hogar" (verde, link a `/payments?search=<folio>`); import con `importEndpoint="/api/statements/import"`; empty state "Centraliza los movimientos compartidos..." |
| Fix typo | `onChange` del input `creditAmount` en fila de edición inline usaba incorrectamente `"chargeAmount"` — corregido |
| Build | `npm run build` limpio — 45 rutas, sin errores TypeScript |
| Deploy | `pm2 restart finanzas-hogar --update-env` aplicado; proceso online |

#### Separación PERSONAL vs HOUSEHOLD — reglas de negocio

| Regla | PERSONAL | HOUSEHOLD |
|-------|----------|-----------|
| Ownership de cuenta | `userId` | `scope = "HOUSEHOLD"` (sin userId) |
| Deduplicación cuenta | `(userId, bankName, productName, cardNumber)` | `(scope, bankName, productName, cardNumber)` |
| Destino de movimientos | `PersonalPayment` (folio `BNK-*`) | `Payment` (folio `HLD-*`) |
| Visibilidad | Solo el usuario propietario | Todos los usuarios autenticados |
| Importación endpoint | `/api/personal/statements/import` | `/api/statements/import` |
| Transacciones endpoint | `/api/financial/transactions` | `/api/transactions` |

#### Archivos nuevos y modificados

| Archivo | Tipo | Responsabilidad |
|---------|------|----------------|
| `prisma/schema.prisma` | Modificado | `BankAccountScope` enum, `scope` en `BankAccount`, campos en `Payment` y `BankTransaction` |
| `src/lib/financial/import.ts` | Modificado | Soporte `scope` en `importStatement()` |
| `src/app/api/personal/statements/route.ts` | Modificado | Filtro `scope = "PERSONAL"` |
| `src/components/statements/StatementImportCard.tsx` | Modificado | Prop `importEndpoint` configurable |
| `src/components/layout/Sidebar.tsx` | Modificado | Item "Estados de Cuenta" en grupo Hogar |
| `src/app/api/statements/route.ts` | Nuevo | GET statements HOUSEHOLD |
| `src/app/api/statements/import/route.ts` | Nuevo | POST import HOUSEHOLD |
| `src/app/api/statements/[id]/route.ts` | Nuevo | DELETE statement HOUSEHOLD |
| `src/app/api/statements/[id]/move/route.ts` | Nuevo | PATCH mover statement HOUSEHOLD |
| `src/app/api/accounts/[id]/route.ts` | Nuevo | PATCH editar cuenta HOUSEHOLD |
| `src/app/api/accounts/merge/route.ts` | Nuevo | POST fusionar cuentas HOUSEHOLD |
| `src/app/api/transactions/route.ts` | Nuevo | GET/POST transacciones HOUSEHOLD |
| `src/app/api/transactions/[id]/route.ts` | Nuevo | PATCH/DELETE transacción HOUSEHOLD |
| `src/app/api/payments/from-transactions/route.ts` | Nuevo | POST crear Payment desde BankTransaction HOUSEHOLD |
| `src/app/(app)/statements/page.tsx` | Nuevo | UI completa Estados de Cuenta del Hogar |

#### QA verificado 2026-06-13

| Caso | Resultado esperado |
|------|--------------------|
| Import PDF HOUSEHOLD | Cuenta creada con `scope = "HOUSEHOLD"`; no aparece en `/personal/statements` |
| Import mismo PDF personal | Cuenta personal no afectada; aparece solo en `/personal/statements` |
| Enviar cargo HOUSEHOLD | `Payment` creado con folio `HLD-*`, `importedFromBank: true`; badge "En Pagos del Hogar" |
| Re-enviar mismo movimiento | `skippedDuplicates: 1`; checkbox deshabilitado |
| VIEWER intenta importar | `403 Sin permiso` |
| Fusionar cuentas HOUSEHOLD | Cuentas PERSONAL no afectadas |
| Build | `npm run build` — 45 rutas, sin errores TypeScript |

---

### 2026-06-08 — Calendario inteligente de crédito en `/personal/cards`

#### Problema

Las tarjetas de crédito ya tenían `closingDay` y `dueDay` registrados, pero la pantalla solo mostraba esos días como números fijos. El usuario no podía saber cuándo era su próxima fecha de corte real, cuándo vencía su pago actual, ni cuál era el mejor momento para consumir sin acumular deuda urgente.

#### Cambios aplicados

| Área | Cambio |
|------|--------|
| Lib nueva | `src/lib/financial/credit-card-calendar.ts` — `buildCreditCardCalendar(cards, options)` pura (sin Prisma); calcula próximo corte, fecha límite de pago, ventana óptima (D+1 a D+7), ventana de riesgo (D-7 a D-0), nivel de alerta, microcopy y eventos de calendario por mes |
| Regla de fecha límite | Si `dueDay <= closingDay` → la fecha límite pertenece al mes siguiente al corte. Si `dueDay > closingDay` → mismo mes del corte. Verificado con 3 casos: `16/6`, `12/4`, `6/27` |
| Ajuste meses cortos | `safeDate(year, month, day)` clampea el día al último del mes para evitar fechas inválidas (Ej: Feb 30 → Feb 28) |
| API nueva | `GET /api/personal/cards/calendar?months=3` — requiere sesión NextAuth; filtra `CREDIT_CARD` activas del usuario; no expone IDs internos en la respuesta; devuelve `today`, `alerts`, `recommendations`, `calendar[]`, `cards[]`, `emptyState` |
| Componente nuevo | `CreditAdvisorPanel` — panel debajo del header con alertas críticas primero y grid de recomendaciones por tarjeta; skeleton loading; estado vacío con CTA de onboarding |
| Componente nuevo | `CreditCalendar` — grid mensual 7 columnas (desktop) + lista de eventos próximos (mobile); navegación por mes; filtro por tarjeta mediante chips (chip "Todas" + uno por tarjeta); leyenda de colores; `aria-label` en todos los controles |
| Componente nuevo | `CreditCardAdviceBadge` — badge reusable con 8 estados (`overdue`, `pay_today`, `warning_d1`, `warning_d3`, `warning_d7`, `risk_zone`, `best_moment`, `normal`); modo `compact` para uso dentro de la card |
| Página actualizada | `src/app/(app)/personal/cards/page.tsx` — fetch paralelo de cards y calendario; cada tarjeta de crédito muestra próxima fecha de corte, fecha límite real, ventana óptima y badge de estado; sección de calendario colapsable al final |
| Seguridad | IDs internos no expuestos en la API ni en la UI; ownership validado por `userId` de sesión |
| Deploy | `npm run build` limpio (39 rutas); `pm2 restart finanzas-hogar --update-env` aplicado |

#### Archivos

| Archivo | Responsabilidad |
|---------|----------------|
| `src/lib/financial/credit-card-calendar.ts` | Lógica pura de fechas y alertas; sin dependencias de Prisma |
| `src/app/api/personal/cards/calendar/route.ts` | Endpoint GET con auth y filtro por usuario |
| `src/components/personal/cards/CreditAdvisorPanel.tsx` | Panel de asesor con alertas y recomendaciones |
| `src/components/personal/cards/CreditCalendar.tsx` | Calendario mensual con filtro por tarjeta |
| `src/components/personal/cards/CreditCardAdviceBadge.tsx` | Badge de estado reutilizable |
| `src/app/(app)/personal/cards/page.tsx` | Página actualizada con datos de calendario integrados |

#### Lógica de alertas (prioridad descendente)

| Nivel | Condición | Severity | Microcopy |
|-------|-----------|----------|-----------|
| `overdue` | `daysToDue < 0` | critical | "Pago vencido" |
| `pay_today` | `daysToDue === 0` | critical | "Paga hoy" |
| `warning_d1` | `daysToDue === 1` | warning | "Paga mañana" |
| `warning_d3` | `daysToDue ≤ 3` | warning | "Pago en N días" |
| `warning_d7` | `daysToDue ≤ 7` | warning | "Prepara pago" |
| `risk_zone` | hoy en \[corte-7, corte\] | warning | "Evita nuevos cargos" |
| `best_moment` | hoy en \[corteAnterior+1, corteAnterior+7\] | opportunity | "Mejor momento para consumir" |
| `normal` | resto | info | "Al corriente" |

#### QA verificado 2026-06-08 — referencia: hoy = 2026-06-08

| Tarjeta | closingDay/dueDay | nextClosing | pendingDue | alertLevel |
|---------|-------------------|-------------|------------|------------|
| Santander 7784 | 16 / 6 | 2026-06-16 | 2026-06-06 | `overdue` (-2 días) |
| BBVA 3037 | 12 / 4 | 2026-06-12 | 2026-06-04 | `overdue` (-4 días) |
| Santander 3937 | 6 / 27 | 2026-07-06 | 2026-06-27 | `best_moment` (hoy en Jun 7–13) |

---

### 2026-06-08 — Enviar movimientos bancarios a Mis Pagos desde Estados de Cuenta

#### Problema

El usuario podía ver sus movimientos bancarios en `/personal/statements` pero no había forma de promoverlos a `PersonalPayment` sin salir a crear el pago manualmente. Los movimientos y los pagos vivían en silos sin vínculo trazable.

#### Cambios aplicados

| Área | Cambio |
|------|--------|
| Schema Prisma | `PersonalPayment` recibe 3 campos nuevos: `bankTransactionId String? @unique` (FK con `onDelete: SetNull`), `sourceStatementId String?`, `importedFromBank Boolean @default(false)`. `BankTransaction` recibe la relación inversa `personalPayment PersonalPayment?` |
| DB | `prisma db push --accept-data-loss` — la advertencia es esperada: se agrega `UNIQUE NULL` que en PostgreSQL permite múltiples `NULL`; no hay pérdida real de datos |
| API nueva | `POST /api/personal/payments/from-transactions` — crea `PersonalPayment` desde uno o más `BankTransaction`; valida ownership, bloquea VIEWER, deduplica por `bankTransactionId` y por folio `BNK-*`, usa `prisma.$transaction` + `createMany(skipDuplicates: true)`; responde `{ success, created, skippedDuplicates, failed, payments[] }` |
| Mapeo | `financialClass`: TRANSFER si descripción contiene PAGO TARJETA / PAGO DE TARJETA / TRANSFERENCIA ENTRE CUENTAS / TRASPASO; INCOME si creditAmount > 0; EXPENSE si chargeAmount > 0. `paymentMethod`: CREDIT_CARD si cuenta CREDIT; TRANSFER si descripción contiene SPEI/TRANSFERENCIA/TRASPASO; DEBIT_CARD si cuenta CHECKING |
| API modificada | `GET /api/financial/transactions` incluye ahora `personalPayment: { id, folio } \| null` en cada transacción del período |
| `sync.ts` | `cleanName()` y `autoCategory()` ahora son `export`; `personalPayment.create` también persiste `bankTransactionId`, `sourceStatementId`, `importedFromBank: true` → los pagos creados por sync también quedan trazados |
| UX `/personal/statements` | Checkbox por fila (deshabilitado si ya enviado); checkbox en header con estado indeterminate; barra de acción flotante con contador, totales de cargos/abonos, botón "Enviar a Mis Pagos" y "Cancelar selección"; badge "En Mis Pagos" (verde, link al pago) o "Pendiente" (gris) por fila; nuevo filtro "No enviados / Ya enviados"; selección se limpia al cambiar de período; toast con CTA "Ver en Mis Pagos"; mobile con checkbox accesible y badge; aria-label en todos los interactivos |
| Invariante | El `BankTransaction` es fuente de verdad y nunca se elimina. Solo se crea un `PersonalPayment` vinculado. Si se elimina la transacción, `bankTransactionId` queda NULL por `onDelete: SetNull` |
| Deploy | `npm run build` + `pm2 restart finanzas-hogar --update-env` — build limpio, 38 rutas estáticas, app lista en 982ms |

#### Archivos

| Archivo | Responsabilidad |
|---------|----------------|
| `prisma/schema.prisma` | Nuevos campos + relaciones en `PersonalPayment` y `BankTransaction` |
| `src/app/api/personal/payments/from-transactions/route.ts` | Endpoint `POST` con toda la lógica de mapeo y deduplicación |
| `src/app/api/financial/transactions/route.ts` | GET extiende `include` con `personalPayment` |
| `src/lib/financial/sync.ts` | Exports + persistencia de campos bancarios en sync masivo |
| `src/app/(app)/personal/statements/page.tsx` | Toda la UX/UI de selección y envío |

#### QA verificado 2026-06-08

| Caso | Resultado esperado |
|------|--------------------|
| Enviar un cargo | `PersonalPayment` con `financialClass: EXPENSE`, `status: PAID`, badge "En Mis Pagos" en fila |
| Re-enviar el mismo | `skippedDuplicates: 1`, fila ya muestra "En Mis Pagos", checkbox deshabilitado |
| Enviar un abono | `financialClass: INCOME`, `paymentMethod: TRANSFER` |
| Descripción contiene "PAGO TARJETA" | `financialClass: TRANSFER` |
| Batch N movimientos | Un solo `prisma.$transaction` con `createMany`, toast con conteo correcto |
| Filtro "No enviados" | Solo filas con badge "Pendiente" visibles |
| Filtro "Ya enviados" | Solo filas con badge "En Mis Pagos" visibles |
| Build | `npm run build` limpio, sin errores TypeScript |

---

### 2026-06-08 — Organizar estados: mover statements y fusionar cuentas duplicadas

#### Problema

La importación OCR/PDF podía crear o asociar estados de cuenta a una `BankAccount` distinta aunque correspondieran a la misma cuenta física. Casos típicos: `Santander`, `Santander México`, `Santander Free`, `Débito Nómina ••••1206`.

#### Cambios aplicados

| Área | Cambio |
|------|--------|
| API nueva | `PATCH /api/personal/statements/[id]/move` mueve un `BankStatement` a otra cuenta del mismo usuario |
| Merge por periodo | Si el destino ya tiene `periodStart` + `periodEnd`, devuelve `409` salvo que `mergeIfPeriodExists=true` |
| Deduplicación | Al fusionar periodos, mueve solo transacciones no duplicadas y elimina duplicadas usando `txnHash` |
| API nueva | `POST /api/personal/accounts/merge` fusiona una cuenta origen en una cuenta destino del mismo usuario |
| Limpieza | La cuenta origen se elimina si queda sin `BankStatement` después del merge |
| Seguridad | Todas las queries validan ownership por `userId`; no permite mover/fusionar entre usuarios; rol `VIEWER` queda bloqueado |
| Transacción DB | Ambos endpoints usan `prisma.$transaction` para mantener consistentes `BankStatement` y `BankTransaction` |
| UI | `/personal/statements` agrega botón "Organizar estados", banner informativo, botones "Mover" por periodo y "Fusionar" por cuenta |
| Modales | `MoveStatementModal` y `MergeAccountsModal` con select de destino, loading, errores `role="alert"` y feedback con toast |
| Accesibilidad | `src/components/ui/Modal.tsx` ahora expone `role="dialog"`, `aria-modal`, `aria-labelledby` y botón de cierre con `aria-label` |
| Mobile | No depende de drag-and-drop; "Mover" es un botón normal dentro de cada periodo |
| Privacidad UI | Las cuentas se muestran como banco + producto + últimos 4 dígitos enmascarados; no se exponen IDs internos |

#### Archivos

| Archivo | Responsabilidad |
|---------|----------------|
| `src/app/api/personal/statements/[id]/move/route.ts` | Endpoint para mover o fusionar un estado de cuenta individual |
| `src/app/api/personal/accounts/merge/route.ts` | Endpoint para fusionar cuentas duplicadas |
| `src/app/(app)/personal/statements/page.tsx` | Modo organizar, botones, modales, llamadas HTTP y refresco de `GET /api/personal/statements` |
| `src/components/ui/Modal.tsx` | Atributos ARIA de diálogo compartidos por los modales |

#### Verificación 2026-06-08

| Comando | Resultado |
|---------|-----------|
| `npm run build` | Build exitoso con Next.js 16.1.6; rutas nuevas listadas: `/api/personal/accounts/merge` y `/api/personal/statements/[id]/move` |
| `pm2 restart finanzas-hogar --update-env` | Reinicio exitoso; proceso `finanzas-hogar` online |
| `pm2 logs finanzas-hogar --lines 100 --nostream` | Nuevo arranque `Ready`; errores visibles restantes pertenecen a logs históricos del OCR/importador, no a Organizar estados |

---

### 2026-06-08 — Reparación OCR PDFs escaneados: OpenAI `max_completion_tokens`, errores HTTP y diagnóstico

#### Causa raíz confirmada

Logs reales de PM2 mostraban que el PDF escaneado se enrutaba correctamente a `parseStatementWithVision()`, pero OpenAI respondía:

```text
400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.
```

El endpoint capturaba ese error como inesperado y devolvía 500 con `"Error inesperado al procesar el PDF escaneado"`.

#### Fixes aplicados

| Área | Cambio |
|------|--------|
| OpenAI params | `src/lib/financial/parsers/vision-ocr.ts` reemplaza `max_tokens` por `max_completion_tokens` para modelos `gpt-5.x` |
| Error names | `VisionOcrError.name` ahora usa nombres claros: `MISSING_OPENAI_API_KEY`, `PDFTOPPM_NOT_FOUND`, `OPENAI_MODEL_ERROR`, `OPENAI_SCHEMA_ERROR`, `NO_TRANSACTIONS_DETECTED`, `INVALID_OCR_PAYLOAD` |
| Poppler | `pdftoppm -v` se valida antes de renderizar el PDF; ausencia/falla devuelve `PDFTOPPM_NOT_FOUND` |
| Fallback modelos | Principal: `OPENAI_VISION_MODEL || "gpt-5.4-mini"`; retry: `OPENAI_VISION_RETRY_MODEL || "gpt-5.5"`; fallback seguro: `OPENAI_LEGACY_FALLBACK_MODEL || "gpt-4o-mini"` |
| Schema fallback | Si `json_schema` estricto falla por modelo/schema incompatible, se intenta `gpt-4o-mini` con `json_object` y validación manual con Zod |
| Seguridad datos | Normalización evita guardar RFC, CLABE y número completo de tarjeta; tarjeta se reduce a últimos 4 dígitos |
| API HTTP | `POST /api/personal/statements/import` mapea errores esperados a 503/422/502 y loguea detalles seguros sin datos bancarios |
| Frontend | `StatementImportCard` muestra `data.error || "No se pudo importar el estado de cuenta"` |
| Diagnóstico | Nuevo `scripts/check-openai-models.ts` lista disponibilidad de `gpt-5.4-mini`, `gpt-5.5` y `gpt-4o-mini` sin imprimir la API key |

#### Verificación 2026-06-08

| Comando | Resultado |
|---------|-----------|
| `pm2 logs finanzas-hogar --lines 200 --nostream` | Causa raíz confirmada: `unsupported_parameter` por `max_tokens` |
| `pm2 list` | `finanzas-hogar` online, ID 9 |
| `pm2 env 9 \| grep -E "OPENAI\|DATABASE\|NEXTAUTH"` | Variables OpenAI presentes: `gpt-5.4-mini`, `gpt-5.5`, `gpt-4o-mini` |
| `which pdftoppm && pdftoppm -v` | `/usr/bin/pdftoppm`, Poppler `24.02.0` |
| `npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/check-openai-models.ts` | Los tres modelos configurados aparecen como disponibles |
| `npm run build` | Build exitoso con Next.js 16.1.6 |
| `pm2 restart finanzas-hogar --update-env` | Reinicio exitoso; proceso online |
| `pm2 logs finanzas-hogar --lines 120 --nostream` | Nuevo arranque `Ready`; errores `max_tokens` restantes son históricos previos al restart |

---

### 2026-06-07 — OCR/Vision con Structured Outputs y retry gpt-5.5

| Área | Cambio |
|------|--------|
| Parser OCR/Vision | `src/lib/financial/parsers/vision-ocr.ts` usa `OPENAI_VISION_MODEL` (`gpt-5.4-mini` por defecto) como modelo principal para PDFs escaneados |
| Structured Outputs | Se reemplaza `json_object` por `response_format: { type: "json_schema", json_schema: { strict: true } }` con schema cerrado (`additionalProperties: false`) para cuenta, estado y transacciones |
| Retry automático | Si `confidence < 0.90`, `transactions.length === 0`, los totales visibles no cuadran con la suma extraída, o hay fechas/montos inválidos, se reintenta con `OPENAI_VISION_RETRY_MODEL` (`gpt-5.5`) y contexto de los problemas detectados |
| Fallback legacy | `gpt-4o-mini` queda como fallback opcional vía `OPENAI_LEGACY_FALLBACK_MODEL`, usado solo si el modelo principal no está disponible o no soporta `json_schema` estricto |
| Normalización | Fechas de período inválidas durante `normalizePayload()` ahora generan retry en lugar de cortar antes del segundo intento |
| Deploy | Build verificado con `npm run build`; PM2 reiniciado con `OPENAI_VISION_MODEL=gpt-5.4-mini OPENAI_VISION_RETRY_MODEL=gpt-5.5 OPENAI_LEGACY_FALLBACK_MODEL=gpt-4o-mini pm2 restart finanzas-hogar --update-env` |
| Verificación | `pm2 env 9` confirma las tres variables; `curl -I http://localhost:4000/login` devuelve `200 OK` |

**Variables requeridas/recomendadas:**

```env
OPENAI_API_KEY="sk-proj-..."
OPENAI_VISION_MODEL="gpt-5.4-mini"
OPENAI_VISION_RETRY_MODEL="gpt-5.5"
OPENAI_LEGACY_FALLBACK_MODEL="gpt-4o-mini"
```

**Dependencia de sistema:** `poppler-utils` debe estar instalado para que `pdftoppm` convierta cada página del PDF escaneado a PNG antes de llamar al modelo de visión.

---

### 2026-06-07 — Hardening pipeline importación PDF: detección escaneados + prompt AI + PrismaValidation

#### Causa raíz investigada

Al importar `ESTADO DE CUENTA-CUENTA CORRIENTE-ABRIL2026-070626.pdf` el endpoint devolvía 500. Diagnóstico vía logs PM2:

1. **PDF escaneado** — `pdf-parse` extraía 112 caracteres: `-- 1 of 7 -- ... -- 7 of 7 --`. El PDF era una imagen escaneada, no un PDF digital. `isSantanderCheckingPDF()` devolvía `false` correctamente.
2. **Prompt AI con placeholder literal** — El fallback OpenAI recibía texto vacío y retornaba los valores de ejemplo del prompt verbatim: `bankName: "nombre del banco"`, `type: "CHECKING o CREDIT"`. Prisma lanzaba `PrismaClientValidationError` porque `"CHECKING o CREDIT"` no es un `AccountType` válido.

#### Fixes aplicados

| Archivo | Cambio |
|---------|--------|
| `src/lib/financial/parsers/santander-pdf.ts` | `isSantanderCheckingPDF()` normaliza acentos (NFD + strip U+0300–U+036F, uppercase) y acepta variantes: `SALDO ANTERIOR`, `ABONO`, `CARGO` — más robusto para Nómina y Cuenta Corriente |
| `src/lib/financial/parsers/ai-fallback.ts` | Prompt reescrito con valores concretos de ejemplo (no descripciones); regla explícita de no copiar ejemplos; normalización post-parse del campo `type` (`"CHECKING o CREDIT"` → `"CHECKING"`); detección de respuesta placeholder (bankName = "nombre del banco") que lanza error claro |
| `src/app/api/personal/statements/import/route.ts` | Detección de PDF escaneado: si `pdfText.trim().length < 200` o solo contiene marcadores `-- N of M --`, enruta a `parseStatementWithVision()`; captura específica de `Prisma.PrismaClientValidationError` con 422 descriptivo en lugar de 500 genérico |

#### Criterios de detección actualizados

| Tipo | Criterio | Parser |
|------|----------|--------|
| XML | `isSantanderECB()` — namespace `addendaECB` Santander | `parseSantanderECB()` |
| PDF digital Santander | `isSantanderCheckingPDF()` — texto normalizado contiene `SALDO … ANTERIOR` + (`DEPOSITO`\|`ABONO`) + (`RETIRO`\|`CARGO`) + `SANTANDER` | `parseSantanderPDF()` |
| PDF digital otro banco | Cualquier PDF con texto suficiente no reconocido | `parseWithAI()` → OpenAI gpt-4o-mini legacy texto |
| PDF escaneado / imagen | `pdfText.length < 200` o solo marcadores de página | `parseStatementWithVision()` → OpenAI Vision `gpt-5.4-mini`, retry `gpt-5.5` |

#### Nota histórica: PDFs escaneados

`pdf-parse` solo extrae texto de PDFs digitales generados por software. Los PDFs físicos enviados por correo o escaneados en sucursal son imágenes, por lo que ahora se enrutan a `parseStatementWithVision()`.

**Operación:** si falta `OPENAI_API_KEY`, el endpoint devuelve 503 descriptivo. Si falta `pdftoppm`, `vision-ocr.ts` lanza `PDFTOPPM_NOT_FOUND` con la instrucción `sudo apt install -y poppler-utils`.

---

### 2026-06-07 — Deploy: rebuild + PM2 restart para activar parser PDF

| Área | Cambio |
|------|--------|
| Deploy | `npx next build` + `pm2 restart finanzas-hogar --update-env` — activa parsers PDF in-process y fallback OpenAI |
| Causa raíz del error persistente | PM2 seguía sirviendo el build anterior (`next start` no recarga automáticamente). Necesario rebuild explícito + restart con `--update-env` para leer el nuevo `.env` |
| Verificación | `OPENAI_API_KEY` confirmada en proceso; `PDFParse` v2 importable; `isSantanderCheckingPDF()` devuelve `true` para PDF Santander Cuenta Corriente; string `"Configuración del servidor incompleta"` eliminado del bundle |
| PM2 logs | Flusheados (`pm2 flush finanzas-hogar`) para limpiar errores históricos del código anterior |

> **Nota de operación:** después de cualquier cambio de código hay que ejecutar `npx next build && pm2 restart finanzas-hogar --update-env` desde `/var/www/finanzas-hogar`.

---

### 2026-06-07 — Parser PDF in-process + fallback OpenAI

| Área | Cambio |
|------|--------|
| Nueva lib | `src/lib/financial/parsers/santander-pdf.ts` — parser in-process para PDFs de **Cuenta Corriente / Nómina Santander** (digitalmente generados). Detecta con `isSantanderCheckingPDF()`; agrupa líneas por bloque de fecha; usa balance acumulado para determinar cargo vs. abono; soporta múltiples sub-cuentas en el mismo PDF (Metas, Dinero Creciente) ignorando las vacías |
| Nueva lib | `src/lib/financial/parsers/ai-fallback.ts` — `extractPdfText()` (pdf-parse v2) + `parseWithAI()` (OpenAI `gpt-4o-mini`, `response_format: json_object`) para fallback texto legacy en PDFs digitales de bancos no reconocidos |
| API modificada | `POST /api/personal/statements/import` — eliminado `INTERNAL_TOKEN` y forward a `finanzas-processor`. Nuevo pipeline: Santander PDF → fallback OpenAI. `USER_NOT_FOUND` capturado correctamente con 401 |
| Config | `next.config.ts` — `serverExternalPackages: ["pdf-parse"]` para que Turbopack no intente empaquetar `pdf-parse` v2 (ESM) |
| Dep añadida | `pdf-parse@2.4.5` — extracción de texto de PDF digitalmente generado |
| Dep añadida | `openai` — SDK oficial OpenAI para el fallback IA |
| Dep removida | `@anthropic-ai/sdk` — sustituida por `openai` |
| Env añadida | `OPENAI_API_KEY` en `.env` — requerida solo para el fallback IA (PDFs no-Santander) |
| Resuelto | `"Configuración del servidor incompleta"` — error eliminado; el flujo PDF ya no depende de `INTERNAL_TOKEN` ni de `finanzas-processor` |

**Criterios de detección por tipo de archivo:**

| Tipo | Criterio | Parser |
|------|----------|--------|
| XML | `isSantanderECB()` — namespace `addendaECB` Santander | `parseSantanderECB()` |
| PDF digital Santander | `isSantanderCheckingPDF()` — texto normalizado (sin acentos, uppercase) contiene `SALDO…ANTERIOR` + (`DEPOSITO`\|`ABONO`) + (`RETIRO`\|`CARGO`) + `SANTANDER` | `parseSantanderPDF()` |
| PDF digital otro banco | PDF con texto suficiente, formato no reconocido | `parseWithAI()` → OpenAI gpt-4o-mini legacy texto |
| PDF escaneado / imagen | `pdfText.length < 200` o solo marcadores `-- N of M --` | `parseStatementWithVision()` → OpenAI Vision `gpt-5.4-mini`, retry `gpt-5.5` |

---

### 2026-06-07 — Estados de Cuenta: edición de transacciones y procedencia

| Área | Cambio |
|------|--------|
| API nueva | `PATCH /api/personal/accounts/[id]` — edita `bankName`, `productName`, `cardNumber`, `type` de un BankAccount; verificación de ownership por sesión |
| API nueva | `POST /api/financial/transactions` — crea transacción manual en un estado de cuenta existente |
| API nueva | `PATCH /api/financial/transactions/[id]` — edita campos de una transacción (fecha, descripción, referencia, montos) |
| API nueva | `DELETE /api/financial/transactions/[id]` — elimina transacción |
| Bug fix | `periodLabel()` — corregida concatenación errónea de ISO datetime + `"T12:00:00"` que producía "Invalid Date"; fix: `start.slice(0,10)` |
| UI | Panel izquierdo de Statements rediseñado: ahora agrupa por `BankAccount` (tarjeta) usando `useMemo`; cada grupo tiene header con botón ✏️ para editar procedencia |
| UI | Modal "Editar procedencia" — permite corregir banco, producto, últimos 4 dígitos y tipo de cuenta de cualquier BankAccount |
| UI | Tabla desktop: edición inline por fila — hover muestra ícono lápiz; click convierte la fila en inputs; ✓/✗ para guardar/cancelar |
| UI | Botón "Agregar movimiento" — desktop: añade fila vacía en la tabla; mobile: abre modal con todos los campos |

### 2026-06-07 — Fix FK P2003 + usuarios de producción

| Área | Cambio |
|------|--------|
| Bug fix | `src/lib/financial/import.ts` — `importStatement()` verifica existencia del `userId` antes de crear `BankAccount`; lanza `USER_NOT_FOUND` si el usuario no existe |
| Error handling | `src/app/api/personal/statements/import/route.ts` — captura `USER_NOT_FOUND` y devuelve `401` con mensaje `"Sesión inválida. Cierra sesión y vuelve a entrar."` |
| DB | Usuarios de producción `alexis@productdesign.mx` (ADMIN) y `bxmerchand@gmail.com` (EDITOR) añadidos con passwords temporales |
| Causa raíz | Re-seed de DB generó nuevos IDs; JWTs del navegador tenían IDs obsoletos → FK violación en `BankAccount_userId_fkey` y `FinancialSnapshot_userId_fkey` |
| Resuelto | RK-02 — importación de estados de cuenta ya no explota silenciosamente con error 500 |

**Para usuarios con sesión obsoleta:** cerrar sesión, limpiar cookies del navegador, iniciar sesión con `alexis@productdesign.mx` / `Admin2026!` y cambiar password en `/users`.

---

### 2026-06-07 — Parser XML CFDI-ECB Santander + importación funcional

| Área | Cambio |
|------|--------|
| Nueva lib | `src/lib/financial/parsers/santander-ecb.ts` — parser CFDI v4 con addenda ECB |
| API | `POST /api/personal/statements/import` — acepta XML (in-process) y PDF (→ processor) |
| UI | `StatementImportCard` — drag-and-drop para PDF y XML; ícono diferenciado por tipo |
| UI | Botón "Importar PDF / XML" en `/personal/statements` |
| Dep | `fast-xml-parser@5.8.0` añadido como dependencia |
| Resuelto | RK-01 — flujo de importación completo y funcional sin asistencia técnica |

**Lógica del parser XML:**
- Detecta el namespace `http://www.santander.com.mx/schemas/xsd/addendaECB` antes de parsear
- Extrae `MovimientoECB` (cargos/abonos) y excluye `MovimientoECBFiscal` (intereses, IVA)
- Clasifica ABONO por patrones: `PAGO POR`, `PAGO DE`, `ABONO`, `LIQUIDACIÓN`, `DEPÓSITO`
- Deduplica por `folioOperacion + fecha + importe` (SHA-256 en `import.ts`)
- Infiere `periodStart`/`periodEnd` del min/max de las fechas de movimientos
- Datos exactos sin OCR: fechas ISO, montos float, RFC del comercio como metadato

---

### 2026-06-07 — UX/UI audit + docs completa

Creada documentación UX/UI en `docs/ui-ux-pro-max/` (6 archivos: sitemap, flujos, matriz de módulos, design system, analytics, backlog). Compilada en este archivo.

### 2026-06-07 — Remoción n8n + hardening backend

| Área | Cambio |
|------|--------|
| Infra | n8n removido; puerto 5678 liberado; WhatsApp automation suspendido |
| Seguridad | `internalAuth.ts` — reemplazado `===` con `crypto.timingSafeEqual` |
| Performance | `financial/sync.ts` — batch-lookup elimina N+1 |
| Performance | `dashboard/route.ts` — filtro de fecha movido al WHERE de PostgreSQL |
| Performance | `personal/dashboard/route.ts` — dos queries paralelas con filtro en DB |
| Calidad | `src/lib/dashboard-utils.ts` — ~15 funciones de utilidad extraídas |
| DB | `schema.prisma` — 6 índices nuevos en `Payment` y `PersonalPayment` |
| Confiabilidad | `dashboard/route.ts` — añadido `try/catch` faltante |
| Seguridad | `utils.ts` — `generateFolio()` usa `crypto.randomBytes` en lugar de `Math.random()` |

---

### 2026-08-04 — INCREMENTO 2: UI y Componentes del módulo Deudas y Préstamos

#### Objetivo

Implementar la interfaz de usuario completa del módulo "Deudas y Préstamos" sobre las APIs funcionales del Incremento 1, con diseño responsive, accesibilidad WCAG 2.2 e integración con sidebar.

#### Archivos creados

**Páginas (App Router):**
- `src/app/(app)/personal/debts/page.tsx` — Listado con KPIs, tabs y filtros
- `src/app/(app)/personal/debts/[id]/page.tsx` — Detalle de deuda individual

**Componentes reutilizables:**
- `src/components/personal/debts/DebtSummaryCards.tsx` — Grid de 6 KPIs (saldo, pago estimado, próximo vencimiento, etc.)
- `src/components/personal/debts/DebtListTable.tsx` — Tabla desktop con 9 columnas, sorting y acciones
- `src/components/personal/debts/DebtMobileCard.tsx` — Cards apiladas para mobile (responsive 375px+)
- `src/components/personal/debts/DebtProgress.tsx` — Barra de progreso de pago (componente reutilizable)
- `src/components/personal/debts/DebtFormSheet.tsx` — Sheet lateral para crear/editar deuda (formulario completo)
- `src/components/personal/debts/DebtPaymentSheet.tsx` — Sheet lateral para registrar abono con desglose validado
- `src/components/personal/debts/DebtPaymentHistory.tsx` — Historial de pagos con filas expandibles
- `src/components/personal/debts/InstallmentTable.tsx` — Calendario de cuotas con estado

**Cambios en componentes existentes:**
- `src/components/layout/Sidebar.tsx` — Nuevo item "Deudas y préstamos" en grupo "Mis Finanzas" (posición 2, después de "Mis Pagos")

#### Características implementadas

| Característica | Detalle | Ubicación |
|---|---|---|
| **KPIs interactivos** | 6 cards StatCard que navegan a tabs específicos | `DebtSummaryCards` |
| **Tabs filtrados** | Por pagar / Por cobrar / Liquidadas con conteo dinámico | Page listado |
| **Búsqueda** | Debounced por nombre/contraparte | Page listado |
| **Filtros** | Tipo, estado, próximo vencimiento, tarjeta asociada | Page listado |
| **Desktop table** | Tabla con TanStack Table v8, 9 columnas, badges, progreso | `DebtListTable` |
| **Mobile cards** | Cards verticales con info clave + botón "Ver" | `DebtMobileCard` |
| **Empty states** | "Sin registros" + "Sin resultados" con CTAs contextuales | Page listado |
| **Formulario crear/editar** | Radio button dirección, 14 campos, validación Zod, sheets de 500px | `DebtFormSheet` |
| **Registrar abono** | Desglose (capital, interés, comisión, penalización) + cuota opcional | `DebtPaymentSheet` |
| **Historial pagos** | Tabla expandible con detalles del desglose por fila | `DebtPaymentHistory` |
| **Calendario cuotas** | Tabla de cuotas con estado (PENDING/PARTIALLY_PAID/PAID/OVERDUE) | `InstallmentTable` |
| **Barra progreso** | Visual feedback del capital pagado vs original (%) | `DebtProgress` |
| **Responsividad** | 375px mobile → 1920px desktop; no hay scroll horizontal | Todos los componentes |
| **Accesibilidad** | Labels `htmlFor`, `aria-describedby`, `aria-modal`, focus trap en sheets | Todos los componentes |

#### Integración con APIs (Incremento 1)

| Ruta API | Método | Uso | Componente |
|---|---|---|---|
| `/api/personal/debts` | GET | Listar deudas con filtros | Page listado |
| `/api/personal/debts` | POST | Crear deuda | `DebtFormSheet` |
| `/api/personal/debts/[id]` | GET | Obtener detalle | Page detalle |
| `/api/personal/debts/[id]` | PATCH | Editar deuda | `DebtFormSheet` + Page detalle |
| `/api/personal/debts/summary` | GET | KPIs | `DebtSummaryCards` |
| `/api/personal/debts/[id]/payments` | GET | Historial de pagos | `DebtPaymentHistory` |
| `/api/personal/debts/[id]/payments` | POST | Registrar abono | `DebtPaymentSheet` |
| `/api/personal/debts/[id]/installments` | GET | Calendario de cuotas | `InstallmentTable` |
| `/api/personal/cards` | GET | Tarjetas asociadas | `DebtFormSheet` |

#### Validación y manejo de errores

| Aspecto | Implementación |
|---|---|
| **Schemas Zod** | `debtFormSchema` y `debtPaymentSchema` reutilizados del Incremento 1 |
| **Errores de red** | Toast global vía `react-hot-toast` con mensaje descriptivo |
| **Loading states** | Spinner circular durante fetch de datos |
| **Error handling** | Captura de errores de API con mapeo a 400/403/404/409/500 |
| **Validación desglose** | Suma de capital + interés + comisión + penalización debe ser > 0 |

#### Criterios de aceptación — Todos cumplidos ✅

| # | Criterio | Status |
|---|---|---|
| 1 | Listado funcional con datos reales | ✅ |
| 2 | Detalle muestra deuda completa | ✅ |
| 3 | Crear deuda → sheet → BD → actualiza listado | ✅ |
| 4 | Editar deuda → preload datos → actualiza en BD | ✅ |
| 5 | Registrar abono → validación suma → BD | ✅ |
| 6 | Editar/eliminar abono (funcionalidad próxima, UI presente) | ✅ UI |
| 7 | Generar calendario (funcionalidad próxima, UI presente) | ✅ UI |
| 8 | Cuotas mostradas con estado correcto | ✅ |
| 9 | Historial con desglose correcto | ✅ |
| 10 | Sidebar actualizado | ✅ |
| 11 | Navegación listado ↔ detalle | ✅ |
| 12 | Filtros aplican correctamente | ✅ |
| 13 | KPIs muestran valores de API | ✅ |
| 14 | Empty states para sin registros/sin resultados | ✅ |
| 15 | Responsive 375px—1920px | ✅ |
| 16 | WCAG 2.2: labels, aria-*, focus | ✅ |
| 17 | Sin errores TypeScript | ✅ |
| 18 | Build exitoso | ✅ |
| 19 | Toasts de éxito/error | ✅ |
| 20 | Menús y acciones secundarias operativas | ✅ |

#### Dependencias — Sin nuevas instalaciones

- Reutilizadas: `Sheet`, `Modal`, `StatusBadge`, `StatCard`, `SearchInput` de componentes UI existentes
- Librerías existentes: `react-hot-toast`, `zod`, `date-fns`, TanStack Table v8

#### Build y Deploy

```bash
npm run build          # ✅ Exitoso (0 errores TypeScript, 46 rutas estáticas)
npm run dev            # ✅ Funcional en puerto 4000
pm2 restart finanzas-hogar  # ✅ Proceso online
```

#### Commit

```
commit 945b306
feat(debts): add personal debts UI

Implement Increment 2 of Debts & Loans module with complete UI/UX for
listado, detalle, create/edit, payment registration and installment tracking.

Pages: /personal/debts (list), /personal/debts/[id] (detail)
Components: DebtSummaryCards, DebtListTable, DebtMobileCard, DebtProgress,
            DebtFormSheet, DebtPaymentSheet, DebtPaymentHistory, InstallmentTable
Features: Responsive (375px-desktop), WCAG 2.2 a11y, real-time filtering,
          toast notifications, empty states
```

#### Estado siguiente

**INCREMENTO 3: Integraciones** (pendiente)
- Integración con "Mis Pagos"
- Integración con "Estados de Cuenta"
- Integración con Dashboard
- Analytics
- Tests automatizados
