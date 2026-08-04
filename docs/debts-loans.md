# Módulo Deudas y Préstamos — Documentación

**Fecha de inicio:** 2026-08-04  
**Estado actual:** Incremento 1 (Datos y Backend) — ✅ COMPLETADO  
**Próximo:** Incremento 2 (UI y Componentes)

---

## 📋 Contenido

1. [Objetivo](#objetivo)
2. [Arquitectura](#arquitectura)
3. [Modelos de Datos](#modelos-de-datos)
4. [Reglas Financieras](#reglas-financieras)
5. [APIs](#apis)
6. [Cálculos y Validación](#cálculos-y-validación)
7. [Autorización y Seguridad](#autorización-y-seguridad)
8. [Integraciones](#integraciones)
9. [QA y Pruebas](#qa-y-pruebas)
10. [Riesgos y Pendientes](#riesgos-y-pendientes)

---

## Objetivo

Permitir al usuario gestionar deudas que debe pagar y préstamos que debe cobrar, con:

- Registro de obligación (monto, plazo, tasa)
- Seguimiento de cuotas (programadas o libres)
- Registro de abonos con desglose (capital, interés, comisiones, penalizaciones)
- Recalcular saldo y detectar liquidación automáticamente
- Vincular movimientos bancarios a deudas
- Historial completo de transacciones

**Principio:** No es un score financiero ni un calculador de amortización automático. Es un **registro operacional** de obligaciones con cálculos financieros auxiliares.

---

## Arquitectura

### Planos de Datos

```
Deuda (DebtAccount)
  ├─ Metadatos: nombre, contraparte, tipo, tasa
  ├─ Saldos: originalPrincipal, currentPrincipal
  ├─ Fechas: startDate, estimatedEndDate, nextDueDate
  ├─ Cuotas (DebtInstallment[]) — opcional
  │   ├─ sequence, dueDate, expectedAmount
  │   └─ totalPaid, status
  └─ Pagos (DebtPayment[]) — el vinculante
      ├─ Apunta a PersonalPayment (folio, monto)
      ├─ Desglose: capital, interés, comisiones, penalizaciones
      └─ Asociación opcional a cuota

PersonalPayment — Movimiento de dinero
  ├─ folio (único)
  ├─ monto (total del abono)
  ├─ status (PAID por defecto en deudas)
  ├─ financialClass: TRANSFER (no afecta gasto/ingreso)
  └─ type: DEBT_PAYMENT (identifica origen)

DebtPayment — Vinculante
  ├─ personalPaymentId (FK única)
  ├─ debtId
  ├─ installmentId (opcional)
  └─ Desglose detallado
```

### Flujo de un Pago

```
Usuario: "Registrar abono de $500 a deuda X"
  ↓
API POST /api/personal/debts/[id]/payments
  ├─ Validar desglose (suma = $500)
  ├─ Validar capital ≤ saldo
  ├─ [Transacción]:
  │   ├─ Crear PersonalPayment (folio DEBT-YYMMDD-XXXX, monto $500)
  │   ├─ Crear DebtPayment (capital $400, interés $60, comisión $40)
  │   ├─ Actualizar cuota (si existe): totalPaid +$400, status
  │   └─ Recalcular DebtAccount:
  │       ├─ currentPrincipal = originalPrincipal - suma(principalAmount)
  │       ├─ nextDueDate = próxima cuota sin pagar
  │       └─ status = ACTIVE o PAID_OFF (si saldo ≤ 0)
  └─ Retornar DebtPayment
```

---

## Modelos de Datos

### DebtAccount

```prisma
model DebtAccount {
  id                   String            @id @default(cuid())
  userId               String            // FK única (sesión)
  direction            DebtDirection     // PAYABLE | RECEIVABLE
  type                 DebtType          // 8 tipos
  name                 String            // "Crédito Azteca"
  counterpartyName     String?           // "Banco X"
  originalPrincipal    Decimal(14,2)     // Monto del contrato
  currentPrincipal     Decimal(14,2)     // Saldo pendiente
  annualInterestRate   Decimal(8,4)?     // Nullable, para referencia
  scheduleMode         DebtScheduleMode  // FREE | INSTALLMENTS
  paymentFrequency     Period?           // Si INSTALLMENTS
  scheduledPayment     Decimal(14,2)?    // Monto esperado por cuota
  numberOfInstallments Int?              // Total cuotas (si aplica)
  startDate            DateTime @db.Date
  estimatedEndDate     DateTime? @db.Date
  nextDueDate          DateTime?         // Próximo vencimiento
  personalCardId       String?           // FK tarjeta asociada
  status               DebtStatus        // ACTIVE, PAID_OFF, PAUSED, CANCELLED, DEFAULTED
  notes                String? @db.Text
  agreementUrl         String?           // Enlace a contrato/comprobante
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  personalCard  PersonalCard?     @relation(fields: [personalCardId], references: [id], onDelete: SetNull)
  installments  DebtInstallment[]
  payments      DebtPayment[]

  @@index([userId, status])
  @@index([userId, direction])
  @@index([userId, nextDueDate])
}
```

### DebtInstallment

```prisma
model DebtInstallment {
  id               String                 @id @default(cuid())
  debtId           String                 // FK
  sequence         Int                    // Número de cuota (1, 2, 3...)
  dueDate          DateTime @db.Date
  expectedAmount   Decimal(14,2)          // Monto esperado total
  expectedPrincipal Decimal(14,2)?        // Si se conoce desglose
  expectedInterest Decimal(14,2)?
  expectedFees     Decimal(14,2)?
  totalPaid        Decimal(14,2) @default(0)  // Suma de principalAmount
  status           DebtInstallmentStatus  // PENDING, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED
  isEstimated      Boolean @default(false) // true si se generó sin tasa exacta
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  debt      DebtAccount   @relation(fields: [debtId], references: [id], onDelete: Cascade)
  payments  DebtPayment[]

  @@unique([debtId, sequence])
  @@index([debtId, dueDate])
  @@index([debtId, status])
}
```

### DebtPayment

```prisma
model DebtPayment {
  id                String   @id @default(cuid())
  debtId            String   // FK
  installmentId     String?  // FK opcional
  personalPaymentId String   @unique  // FK única
  paidAt            DateTime
  principalAmount   Decimal(14,2)  // Reduce saldo
  interestAmount    Decimal(14,2) @default(0)
  feeAmount         Decimal(14,2) @default(0)
  penaltyAmount     Decimal(14,2) @default(0)
  totalAmount       Decimal(14,2)  // capital + interés + comisiones + penalizaciones
  notes             String? @db.Text
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  debt            DebtAccount     @relation(fields: [debtId], references: [id], onDelete: Cascade)
  installment     DebtInstallment? @relation(fields: [installmentId], references: [id], onDelete: SetNull)
  personalPayment PersonalPayment  @relation(fields: [personalPaymentId], references: [id], onDelete: Cascade)

  @@index([debtId, paidAt])
  @@index([personalPaymentId])
}
```

---

## Reglas Financieras

### 1. Saldos

- **Saldo = originalPrincipal - Σ(principalAmount pagado)**
- Intereses, comisiones y penalizaciones **NO reducen** saldo
- El saldo nunca puede ser negativo (se clampea a 0)
- Si saldo ≤ 0 → status = PAID_OFF

### 2. Cuotas

- Una cuota puede quedar PARTIALLY_PAID
- El totalPaid de cuota = Σ(principalAmount) de DebtPayments asociados
- Status se recalcula automáticamente tras cada pago

### 3. Próximo Vencimiento

- nextDueDate = dueDate de la cuota más próxima con status != PAID y != CANCELLED
- Si no hay cuotas sin pagar → nextDueDate = NULL
- Si status = PAID_OFF → nextDueDate = NULL

### 4. Desglose de Pago

- **Invariante:** totalAmount = principalAmount + interestAmount + feeAmount + penaltyAmount
- Validación: suma de componentes debe coincidir exactamente
- Uso de Prisma.Decimal para evitar pérdida de precisión

### 5. Liquidación

- Detectada automáticamente cuando currentPrincipal ≤ 0
- Status cambia a PAID_OFF
- nextDueDate se limpia
- No se permite volver a ACTIVE manualmente (se debe crear nueva deuda)

### 6. Tasa de Interés

- Opcional (nullable)
- Solo para referencia; no calcula amortización automática
- Si se genera calendario sin tasa exacta: marcar isEstimated = true

---

## APIs

### Listado y Búsqueda

**GET `/api/personal/debts`**

Parámetros de filtro (query string):
- `direction` (PAYABLE | RECEIVABLE)
- `status` (ACTIVE | PAID_OFF | PAUSED | CANCELLED | DEFAULTED)
- `type` (PERSONAL_LOAN | CREDIT_CARD | AUTO_LOAN | MORTGAGE | BNPL | FAMILY_LOAN | LOAN_GRANTED | OTHER)
- `search` (nombre o contraparte, insensible a mayúsculas)
- `cardId` (deudas vinculadas a tarjeta específica)
- `dueFrom` / `dueTo` (rango de próxima fecha de pago)

Respuesta:
```json
[
  {
    "id": "...",
    "userId": "...",
    "direction": "PAYABLE",
    "type": "CREDIT_CARD",
    "name": "Tarjeta Azteca",
    "counterpartyName": "Banco Azteca",
    "originalPrincipal": 10000,
    "currentPrincipal": 7500,
    "status": "ACTIVE",
    "nextDueDate": "2026-09-15T00:00:00Z",
    "_count": {
      "installments": 12,
      "payments": 3
    }
  }
]
```

**GET `/api/personal/debts/summary`**

Respuesta:
```json
{
  "payableBalance": 45000.50,
  "receivableBalance": 12000.00,
  "estimatedMonthlyCommitment": 3500.00,
  "nextDue": "2026-08-20T00:00:00Z",
  "overdueInstallments": 2,
  "principalPaidCurrentYear": 18500.00
}
```

### Detalle y Edición

**GET `/api/personal/debts/[id]`**

Retorna deuda con cuotas e historial de pagos.

**PATCH `/api/personal/debts/[id]`**

Actualiza campos (no recalcula de cero).

**DELETE `/api/personal/debts/[id]`**

Solo si no tiene pagos vinculados (409 si existen).

### Cuotas

**GET `/api/personal/debts/[id]/installments`**

Lista todas las cuotas con pagos asociados.

**POST `/api/personal/debts/[id]/installments/generate`**

Genera calendario uniforme:
```json
{
  "numberOfInstallments": 12,
  "firstPaymentDate": "2026-09-15",
  "paymentFrequency": "MONTHLY"
}
```

Retorna array de cuotas creadas con status PENDING e isEstimated = true.

### Pagos de Deuda

**POST `/api/personal/debts/[id]/payments`**

Registra abono (transacción ACID):
```json
{
  "paidAt": "2026-08-04",
  "principalAmount": 400,
  "interestAmount": 60,
  "feeAmount": 30,
  "penaltyAmount": 10,
  "paymentMethod": "TRANSFER",
  "personalCardId": null,
  "installmentId": null,
  "notes": "Pago en línea"
}
```

Crea PersonalPayment + DebtPayment en transacción.

**PATCH `/api/personal/debts/[id]/payments/[paymentId]`**

Edita desglose (recalcula desde BD).

**DELETE `/api/personal/debts/[id]/payments/[paymentId]`**

Elimina coordinadamente (restaura saldos).

### Vincular Movimiento Bancario

**POST `/api/personal/debts/[id]/link-transaction`**

```json
{
  "bankTransactionId": "...",
  "principalAmount": 400,
  "interestAmount": 60,
  "feeAmount": 30,
  "penaltyAmount": 10,
  "installmentId": null,
  "notes": "Importado desde estado de cuenta"
}
```

- Evita duplicados (409 si ya está vinculado a otra deuda)
- Reutiliza PersonalPayment si existe
- Crea uno nuevo si no existe

---

## Cálculos y Validación

### Librería: `src/lib/financial/debt-calculations.ts`

```typescript
// Totales acumulados
calculateDebtTotals(originalPrincipal, payments): DebtTotals
  → { principalPaid, interestPaid, feesPaid, penaltiesPaid, totalPaid, currentBalance, isFullyPaid }

// Progreso (solo capital)
calculateDebtProgress(originalPrincipal, principalPaid): DebtProgressInfo
  → { progress: 0-100, isPaidOff: boolean, principalRemaining }

// Estado de cuota
deriveInstallmentStatus(installment, today?): DebtInstallmentStatus

// Estado de deuda
deriveDebtStatus(debt, currentBalance, nextDueDate): DebtStatus

// Próximo vencimiento
findNextDueDate(installments, today?): Date | null

// Validar desglose
validateDebtPayment(principal, interest, fees, penalties, currentBalance)
  → { valid: boolean, error?: string }

// Detectar liquidación
shouldMarkAsPaidOff(currentBalance): boolean
```

### Validación Zod

**Esquemas en `src/lib/validations/debt.ts`:**

- `debtFormSchema` — Crear/editar deuda
- `debtPaymentSchema` — Registrar abono
- `linkTransactionSchema` — Vincular transacción
- `generateInstallmentsSchema` — Generar cuotas

---

## Autorización y Seguridad

### Sesión

- NextAuth JWT + userId extraído de sesión (nunca del cliente)
- Todas las operaciones filtran por userId

### Roles

| Rol     | GET | POST | PATCH | DELETE |
|---------|-----|------|-------|--------|
| ADMIN   | ✅  | ✅   | ✅    | ✅     |
| EDITOR  | ✅  | ✅   | ✅    | ✅     |
| VIEWER  | ✅  | ❌   | ❌    | ❌     |

### Ownership

- Todas las queries filtran `userId = session.user.id`
- DELETE retorna 404 si no pertenece (no 403)
- Nunca exponer que existe un recurso de otro usuario

### Protección de PersonalPayment

- DELETE bloqueado si existe DebtPayment vinculado (409)
- Mensaje: "Elimínalo desde el historial de la deuda para recalcular..."
- Evita estados inconsistentes

### Datos Sensibles

- No loguear montos exactos
- No loguear nombres de contraparte
- No loguear folios de PersonalPayment
- No exponer .env en errores

---

## Integraciones

### Mis Pagos (`/personal/payments`)

**Cambios:**
- Badge "Pago de deuda" en pagos vinculados
- Badge enlaza a `/personal/debts/[debtId]`
- DELETE bloqueado (409) si está vinculado
- PATCH bloqueado o redirige (futuro)

**Implementación:** Incremento 3

### Estados de Cuenta (`/personal/statements`)

**Cambios:**
- Acción "Asociar a deuda" en menú de opciones
- Abre modal con selector de deuda activa
- Permite desglose manual (capital/interés/comisiones)
- Reutiliza BankTransaction → PersonalPayment → DebtPayment

**Implementación:** Incremento 3

### Dashboard Personal (`/personal/dashboard`)

**Cambios:**
- 4 KPIs nuevos:
  - Saldo por pagar
  - Saldo por cobrar
  - Próximo vencimiento
  - Cuotas vencidas
- Todos enlazable a `/personal/debts`
- No saturar UI existente

**Implementación:** Incremento 3

---

## QA y Pruebas

### Casos Funcionales

✅ Crear deuda (sin cuotas)  
✅ Crear deuda (con cuotas)  
✅ Generar calendario  
✅ Registrar abono (desglose válido)  
✅ Capital reduce saldo ← principal  
✅ Interés NO reduce saldo  
✅ Cuota parcialmente pagada  
✅ Liquidación automática (saldo = 0)  
✅ Editar pago (recalcula cascada)  
✅ Eliminar pago (restaura saldos)  
✅ Vincular movimiento bancario  
✅ Evitar duplicados (409)  
✅ VIEWER solo lectura  
✅ Ownership verificado  

### Cobertura Mínima

- [ ] Tests unitarios de cálculos
- [ ] Tests de validación (Zod)
- [ ] Tests de API (GET, POST, PATCH, DELETE)
- [ ] Tests de transacciones (ACID)
- [ ] Tests de seguridad (ownership, roles)

**Nota:** Primera versión sin test suite automatizada. Pruebas manuales E2E requeridas en Incremento 2.

---

## Riesgos y Pendientes

### Conocidos

1. **Amortización exacta**
   - No calculamos automáticamente capital/interés por cuota
   - Usuario debe proporcionarlo o marcamos como "estimado"
   - Riesgo: usuario confía en calendario 100% pero varía tasa real
   - Mitigación: UI marca "estimado" claramente

2. **Cambio de tasa**
   - Si tasa cambia a mitad del contrato, no recalculamos automáticamente
   - Usuario debe editar cuotas o registrar el cambio manualmente
   - Futuro: herramienta de recálculo de calendario

3. **Divisas**
   - Asumimos MXN (Decimal(14,2) suficiente)
   - Si multimoneda: usar campo en DebtAccount
   - Futuro: conversión de tasas

4. **Múltiples pagos en un día**
   - Válido (totalPaid puede sumar en mismo día)
   - Pero nextDueDate solo toma la más próxima
   - No hay concepto de "pago parcial de múltiples cuotas" aún

5. **Rollback de pago**
   - Solo vía DELETE (elimina y recalcula desde BD)
   - No hay "reversal" (reembolso) formal
   - Futuro: campo reversal con linked DebtPayment

### Deseables para Futuro

- [ ] Calculadora de amortización (mostrar desglose estimado)
- [ ] Recálculo automático de calendario si tasa cambia
- [ ] Historial de cambios (auditoría)
- [ ] Alertas de vencimiento próximo
- [ ] Reporte de deudas por período
- [ ] Multimoneda
- [ ] Pagos agrupados (cobrar/pagar múltiples deudas en un transfer)

---

## Historial de Cambios

| Fecha      | Evento                          | Estado    |
|------------|---------------------------------|-----------|
| 2026-08-04 | Inicio Incremento 1             | En curso  |
| 2026-08-04 | Schema, APIs, cálculos          | ✅ Done   |
| 2026-08-04 | Commit feat(debts)              | ✅ Done   |
| —          | **Próximo: Incremento 2**       | —         |
| TBD        | UI (listado, detalle, formas)   | 🔄        |
| TBD        | Sidebar + responsive            | 🔄        |
| TBD        | Incremento 3 (integraciones)    | 📋        |

---

## Referencias

- Commit: `a72f3b7` — `feat(debts): add debt domain and APIs`
- Archivos: `src/app/api/personal/debts/`, `src/lib/financial/`, `src/lib/validations/debt.ts`
- Próximo: `/prompts/INCREMENTO_2_MASTER.md`
