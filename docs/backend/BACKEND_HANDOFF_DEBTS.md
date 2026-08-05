# Backend Handoff: Inconsistencia de currentPrincipal en Deudas

**Fecha:** 2026-08-05  
**Prioridad:** 🔴 CRÍTICA  
**Impacto:** Datos de progreso y saldo inconsistentes  
**Status:** 📋 PENDIENTE DE INVESTIGACIÓN Y CORRECCIÓN

---

## 📊 Síntoma Observado

En la UI se observa:

```
Deuda: Tarjeta de Crédito
├─ Monto original:    $18,359.00
├─ Capital pagado:    $0.00
├─ Saldo pendiente:   $0.00  ⚠️ INCONSISTENTE
├─ Progreso:          100%   ⚠️ INCONSISTENTE (debería ser 0%)
└─ Estado:            Liquidada (debería ser Activa)
```

**El problema:** Una deuda sin pagos muestra 100% de progreso y $0 saldo pendiente.

---

## 🔎 Causa Raíz Probable

### Hipótesis 1: Inicialización de currentPrincipal

```typescript
// Posible escenario problemático en POST /api/personal/debts

// ❌ INCORRECTO: currentPrincipal empieza en 0
const debt = await prisma.debtAccount.create({
  data: {
    originalPrincipal: 18359.00,
    currentPrincipal: 0,  // ← AQUÍ ESTÁ EL PROBLEMA
    // ...
  },
});

// ✅ CORRECTO: currentPrincipal = originalPrincipal
const debt = await prisma.debtAccount.create({
  data: {
    originalPrincipal: 18359.00,
    currentPrincipal: 18359.00,  // ← DEBE SER IGUAL
    // ...
  },
});
```

### Hipótesis 2: Cálculo de progreso incorrecto

```typescript
// ❌ Si se calcula así:
progress = (originalPrincipal - currentPrincipal) / originalPrincipal * 100
         = (18359 - 0) / 18359 * 100
         = 100%  ← INCORRECTO

// ✅ Debería calcularse:
principalPaid = originalPrincipal - currentPrincipal
              = 18359 - 18359
              = 0
progress = principalPaid / originalPrincipal * 100
         = 0 / 18359 * 100
         = 0%  ← CORRECTO
```

### Hipótesis 3: Serialización Decimal → number

```typescript
// ✅ Conversión correcta:
currentPrincipal: debt.currentPrincipal.toNumber()  // Decimal → number

// ❌ Conversión incorrecta (pérdida de precisión):
currentPrincipal: parseFloat(debt.currentPrincipal)  // Posible pérdida

// ❌ O si currentPrincipal es NULL:
currentPrincipal: debt.currentPrincipal || 0  // ← Defaultea a 0
```

---

## 🔍 Consulta de Diagnóstico

### Prisma/SQL para identificar deudas problemáticas

```prisma
// En src/app/api/admin/diagnostics.ts (crear si no existe)

export async function getDeptInconsistencies() {
  const debts = await prisma.debtAccount.findMany({
    where: {
      userId: "USER_ID",  // Filtrar por usuario específico
    },
    include: {
      payments: true,
      installments: true,
    },
  });

  const inconsistencies = debts
    .map(debt => {
      const principalPaid = debt.payments.reduce(
        (sum, p) => sum + parseFloat(p.principalAmount.toString()),
        0
      );

      const expectedCurrentPrincipal = parseFloat(
        debt.originalPrincipal.toString()
      ) - principalPaid;

      const actualCurrentPrincipal = parseFloat(
        debt.currentPrincipal.toString()
      );

      const isInconsistent =
        Math.abs(expectedCurrentPrincipal - actualCurrentPrincipal) > 0.01;

      return {
        id: debt.id,
        name: debt.name,
        originalPrincipal: debt.originalPrincipal,
        payments: debt.payments.length,
        principalPaid,
        expectedCurrentPrincipal,
        actualCurrentPrincipal,
        difference: actualCurrentPrincipal - expectedCurrentPrincipal,
        isInconsistent,
      };
    })
    .filter(d => d.isInconsistent);

  return inconsistencies;
}
```

### Ejecutar diagnóstico SQL directo

```sql
-- En psql o administrador de BD
SELECT
  da.id,
  da.name,
  da.original_principal,
  da.current_principal,
  COALESCE(SUM(dp.principal_amount), 0) AS total_principal_paid,
  da.original_principal - COALESCE(SUM(dp.principal_amount), 0) AS calculated_balance,
  da.current_principal - (da.original_principal - COALESCE(SUM(dp.principal_amount), 0)) AS discrepancy
FROM
  debt_account da
LEFT JOIN
  debt_payment dp ON da.id = dp.debt_id
WHERE
  da.user_id = 'USER_ID'
  AND da.current_principal != (da.original_principal - COALESCE(SUM(dp.principal_amount), 0))
GROUP BY
  da.id, da.name, da.original_principal, da.current_principal
ORDER BY
  ABS(discrepancy) DESC;
```

---

## 🏥 Estrategia de Corrección

### Fase 1: Auditoría (Hoy)

1. **Ejecutar diagnóstico** para identificar todas las deudas inconsistentes
2. **Documentar casos:**
   - ¿Cuántas deudas afectadas?
   - ¿Son todas sin pagos o hay deudas con pagos parciales también?
   - ¿Cuál es la magnitud de la discrepancia?

3. **Resultado esperado:** Archivo `inconsistencies.json` con lista de deudas problemáticas

### Fase 2: Corrección de Datos (Este sprint)

#### Opción A: Recalcular desde Pagos (Recomendado)

```typescript
// src/scripts/fix-debt-balances.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixDebtBalances() {
  const debts = await prisma.debtAccount.findMany({
    include: {
      payments: true,
    },
  });

  for (const debt of debts) {
    const principalPaid = debt.payments.reduce(
      (sum, p) => sum + new Prisma.Decimal(p.principalAmount),
      new Prisma.Decimal(0)
    );

    const correctBalance = new Prisma.Decimal(debt.originalPrincipal).minus(
      principalPaid
    );

    if (
      !correctBalance.equals(new Prisma.Decimal(debt.currentPrincipal))
    ) {
      console.log(
        `Fixing debt ${debt.id}: ${debt.currentPrincipal} → ${correctBalance}`
      );

      await prisma.debtAccount.update({
        where: { id: debt.id },
        data: {
          currentPrincipal: correctBalance,
        },
      });
    }
  }

  console.log("✅ Debt balance correction complete");
}

fixDebtBalances().catch(console.error);
```

**Ejecutar:**
```bash
npx ts-node src/scripts/fix-debt-balances.ts
```

#### Opción B: Corrección Quirúrgica (Si solo hay nuevas deudas sin pagos)

```typescript
// SQL directo
UPDATE debt_account
SET current_principal = original_principal
WHERE
  current_principal = 0
  AND status = 'ACTIVE'
  AND id NOT IN (
    SELECT DISTINCT debt_id FROM debt_payment
  );
```

---

## ✅ Validación Post-Corrección

Después de ejecutar la corrección, verificar:

```typescript
// Test: Todas las deudas sin pagos deben tener currentPrincipal = originalPrincipal
const validations = debts.map(debt => ({
  name: debt.name,
  isValid:
    debt.payments.length === 0
      ? debt.currentPrincipal.equals(debt.originalPrincipal)
      : true,
}));

const allValid = validations.every(v => v.isValid);
console.log(allValid ? "✅ All debts valid" : "❌ Issues found");
```

---

## 🔄 Rollback Plan

Si la corrección causa problemas:

```bash
# 1. Crear backup antes de corregir
pg_dump finanzas_hogar > backup_2026_08_05.sql

# 2. Restaurar si es necesario
psql finanzas_hogar < backup_2026_08_05.sql

# 3. Revertir cambios en Prisma migration (si se usó migrate)
npx prisma migrate resolve --rolled-back <migration-name>
```

---

## 🧪 Casos de Prueba Requeridos

Después de corregir, validar:

### Test 1: Deuda Nueva Sin Pagos
```
POST /api/personal/debts
{
  "name": "Tarjeta Test",
  "originalPrincipal": 1000,
  "direction": "PAYABLE",
  ...
}

Esperado:
✓ currentPrincipal = 1000
✓ Progreso = 0%
✓ Estado = ACTIVE
```

### Test 2: Registrar Primer Abono
```
POST /api/personal/debts/{id}/payments
{
  "principalAmount": 500,
  ...
}

Esperado:
✓ currentPrincipal = 500
✓ Progreso = 50%
✓ Estado = ACTIVE
```

### Test 3: Liquidar Deuda
```
POST /api/personal/debts/{id}/payments
{
  "principalAmount": 500,
  ...
}

Esperado:
✓ currentPrincipal = 0
✓ Progreso = 100%
✓ Estado = PAID_OFF
```

---

## 📈 Mitigación Temporal (Frontend)

Mientras se corrige el backend, la UI implementa un fix temporal:

```typescript
// src/components/personal/debts/DebtProgress.tsx

if (principalPaid === 0 && originalPrincipal > 0) {
  // Fuerza progreso a 0% si no hay pagos registrados
  // (aunque backend reporte inconsistencia)
  progress = 0;
  color = "bg-gray-400";  // Gris, no verde
}
```

Este fix **no es perfecto** pero evita mostrar 100% a usuarios finales hasta que backend se corrija.

---

## 📋 Checklist de Implementación

Backend:

- [ ] Ejecutar diagnóstico SQL
- [ ] Documentar cantidad y magnitud de inconsistencias
- [ ] Crear script de corrección
- [ ] Testing en environment de staging
- [ ] Ejecutar corrección en production
- [ ] Validar con test cases
- [ ] Documentar cambios en commit

Frontend:

- [x] Implementar fix temporal (UI no muestra 100% si $0 pagado)
- [x] Mejorar color de progreso (gris=0%, indigo=1-99%, verde=100%)
- [ ] Tests automáticos para progreso

---

## 🔗 Referencias

- **Documentación deudas:** `/docs/debts-loans.md`
- **Cálculos:** `src/lib/financial/debt-calculations.ts`
- **API deudas:** `src/app/api/personal/debts/`
- **Auditoría frontend:** `/docs/ui-ux/AUDIT_DEBTS_MODULE.md`

---

## 📞 Contacto

Implementada: Frontend fix temporal  
Requerida: Corrección backend + migración de datos  
Criticidad: 🔴 BLOQUEADORA para datos correctos

