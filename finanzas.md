# Finanzas del Hogar

**URL:** https://finanzas.torrax.cloud | **Puerto:** 4000 | **Directorio:** `/var/www/finanzas-hogar`

Sistema de control de finanzas personales y del hogar con integración WhatsApp via n8n.

## Arquitectura general

```
WhatsApp / PDF / Excel / XML / Ticket
        │
      n8n (puerto 5678, loopback)
        │
finanzas-processor (Node.js + TS)   ← /var/www/finanzas-processor
        │
finanzas-hogar API (Next.js)        ← /var/www/finanzas-hogar  ← este repo
        │
  PostgreSQL — base: finanzas_hogar (Docker, 127.0.0.1:5432)
```

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

## Variables de entorno

### finanzas-hogar (`.env`)
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://finanzas.torrax.cloud"
INTERNAL_TOKEN="fh-internal-n8n-2026-xK9mP3qL7vR2nT8w"
```

### finanzas-processor (`.env`)
```env
WHATSAPP_ALLOWED_SENDER_PHONE=5627561937
WHATSAPP_ALLOWED_CONVERSATION=Alexis Valdez Cortez (Tú)
FINANZAS_HOGAR_URL=http://172.17.0.1:4000
INTERNAL_TOKEN=fh-internal-n8n-2026-xK9mP3qL7vR2nT8w
```

> **Nota:** Para llamadas desde el container n8n usar `http://172.17.0.1:4000` (no `localhost`).

## Credenciales demo

| Rol | Email | Password |
|-----|-------|----------|
| Admin | `admin@hogar.com` | admin123 |
| Editor | `editor@hogar.com` | editor123 |
| Viewer | `viewer@hogar.com` | viewer123 |

## Usuarios del sistema (producción)

| Nombre | Email app | WhatsApp JID | userId DB |
|--------|-----------|-------------|-----------|
| Alexis | `alexis@productdesign.mx` | `5215627561937@s.whatsapp.net` | `f974c707-02b5-40db-a76e-4631b7f6e3ea` |
| Bety | `bxmerchand@gmail.com` | `246153182449863@lid` | `cmn5r02z800000racb4b4pbzj` |

## Scripts

```bash
cd /var/www/finanzas-hogar
npm run dev           # puerto 4000
npm run build
npm run db:push       # sync schema sin migraciones
npm run db:migrate
npm run db:seed
npm run db:studio     # Prisma Studio GUI
npm run db:generate   # regenerar cliente Prisma

cd /var/www/finanzas-processor
npm run dev
npm run build
npm test
```

## Modelos Prisma

### Hogar
- **User** — roles: `ADMIN | EDITOR | VIEWER`
- **Payment** — pagos del hogar; enums: `PaymentStatus`, `PaymentMethod`, `Period`
- **Category** — categorías globales (`PAYMENT | PANTRY | BOTH`)
- **PantryItem** + **PantryPurchaseHistory**

### Finanzas personales
- **PersonalPayment** — folio único, period, status, paymentMethod, dueDate
  - `type String?` — `"INCOME" | "EXPENSE" | "TRANSFER"` (rellenado por finanzas-processor)
  - `financialClass FinancialClass?` — `INCOME | EXPENSE | TRANSFER | SAVING` (preferido para análisis; migrado 2026-05-17)
  - Clasificación jerárquica: `financialClass` → `type` → inferencia por nombre de categoría
- **PersonalCategory** — por usuario (`userId + name` únicos)
- **PersonalCard** — tarjetas/cuentas

### Datos bancarios
- **BankAccount** / **BankStatement** / **BankTransaction** — deduplicados por `txnHash`
- **FinancialSnapshot** — historial mensual del score financiero (`@@unique([userId, date])`, fecha = primer día del mes)

### Enums clave

```
Period:         ONCE | WEEKLY | BIWEEKLY | MONTHLY | BIMONTHLY | QUARTERLY | SEMIANNUAL | ANNUAL
PaymentMethod:  CASH | CREDIT_CARD | DEBIT_CARD | TRANSFER | CHECK | OTHER
PaymentStatus:  PENDING | PAID | OVERDUE | CANCELLED
FinancialClass: INCOME | EXPENSE | TRANSFER | SAVING
```

## API Routes internas

| Ruta | Uso |
|------|-----|
| `GET/POST /api/internal/payments` | Usada por n8n (header `x-internal-token` requerido) |
| `GET /api/financial/recovery-plan?months=1\|3\|6` | Plan de recuperación financiera |
| `PATCH /api/personal/payments/[id]/mark-paid` | Marcar PENDING/OVERDUE → PAID |

## Plan de Recuperación Financiera (`/financial/recovery-plan`)

**Estado:** ✅ v5 — funcional en producción

Módulo determinístico (sin IA generativa) que calcula:

1. **Score financiero 0-100** — flujo libre (0-40 pts) + deuda vencida (0-35 pts) + urgencia (0-25 pts)
2. **Resumen financiero** — ingreso/egreso promedio, totales vencido/pendiente/dueIn7/dueIn15, flujo libre
3. **Matriz priorizada** — P1 vencidos → P2 ≤7 días → P3 8-15 días recurrentes → P4 resto (top 20)
4. **Proyección 3 meses** — `remainingDebt` vs `cumulativePaid`, meses para ponerse al corriente
5. **Historial del score** — `FinancialSnapshot` upsert mensual automático (fire-and-forget)
6. **Sugerencias de recorte** — top 5 categorías variables con reducción sugerida del 30%
7. **Insights** — tarjetas risk/warning/opportunity/info por reglas

## finanzas-processor (microservicio)

**Ruta:** `/var/www/finanzas-processor`

### Pipeline
```
normalizar → extraer (IA o parser) → clasificar → validar → deduplicar → guardar en PersonalPayment
```

### Fuentes soportadas
PDF · Excel · XML (CFDI) · Imagen/ticket (OCR con visión) · Texto/WhatsApp

### Deduplicación
Hash principal: `name_normalized + amount_centavos + paymentDate(YYYY-MM-DD)` — solo para `period = ONCE`.

## n8n — Automatización WhatsApp

**URL:** `http://localhost:5678` | **Login:** `alexis.pro_sk8@hotmail.com` / `TorreBot2026!`

```bash
# Obtener API key (tras reinicio de n8n)
sqlite3 ~/.n8n/database.sqlite "SELECT apiKey FROM user_api_keys WHERE label='Claude Automation';"
```

### Workflows

| Workflow | ID | Webhook |
|----------|-----|---------|
| Finanzas con amor (hogar) | `74t4EGI8TmuJ3p7m` | `/webhook/whatsapp-finanzas` |
| Finanzas personales | — | `/finanzas-personales-whatsapp` |

**Grupo WhatsApp hogar:** `120363417563297058@g.us` — "Finanzas con amor" (Alexis + Bety)

### Fixes críticos conocidos

1. **Grupos WhatsApp** (`not-acceptable`): enviar a `senderJid` (key.participant), no al JID del grupo
2. **webhookId se resetea** al reiniciar n8n:
   ```sql
   UPDATE webhook_entity SET webhookId='whatsapp-finanzas-001' WHERE workflowId='74t4EGI8TmuJ3p7m';
   ```
3. **localhost desde container** → usar `172.17.0.1:4000`
4. **bajo_confianza routing**: Output 2 → conectar a `Obtener pagos recientes` (no a WhatsApp Confirmar)
5. **Obtener pagos recientes 0 items**: agregar `alwaysOutputData: true` en el nodo

## Pendientes

| Tarea | Prioridad |
|-------|-----------|
| Resumen ejecutivo con IA (Claude Haiku, 3 bullets) | P3 |
| Chat CFO personal — panel lateral de preguntas sobre el plan | P3 |
| Notificación WhatsApp cuando pago llega a 3 días de vencimiento | P4 |
| Alerta crítica por WhatsApp si `financialStatus === "critical"` | P4 |
| Caché del endpoint recovery-plan (5 min TTL con `unstable_cache`) | P5 |
| Test E2E (Playwright) | P5 |
