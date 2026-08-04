# 🚀 QUICK REFERENCE — Módulo Deudas y Préstamos

**Última actualización:** 2026-08-04  
**Estado:** Incremento 1 ✅ | Incremento 2 🔄 | Incremento 3 📋

---

## 📍 Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `/docs/debts-loans.md` | Documentación completa (todas las reglas, modelos, APIs) |
| `/INCREMENTO_1_RESUMEN.md` | Resumen ejecutivo de lo que se completó |
| `/INCREMENTO_2_MASTER.md` | Prompt ejecutable para fase UI |
| `/prisma/schema.prisma` | 3 modelos + 5 enums + relaciones |
| `/src/app/api/personal/debts/` | 8 endpoints API |
| `/src/lib/financial/debt-calculations.ts` | Lógica de cálculos financieros |
| `/src/lib/validations/debt.ts` | Schemas Zod |

---

## 🔗 APIs Disponibles

```
GET    /api/personal/debts                    (listar con filtros)
POST   /api/personal/debts                    (crear deuda)
GET    /api/personal/debts/summary            (KPIs)
GET    /api/personal/debts/[id]               (detalle)
PATCH  /api/personal/debts/[id]               (editar)
DELETE /api/personal/debts/[id]               (eliminar)
GET    /api/personal/debts/[id]/installments  (cuotas)
POST   /api/personal/debts/[id]/installments/generate  (generar calendario)
GET    /api/personal/debts/[id]/payments      (historial)
POST   /api/personal/debts/[id]/payments      (registrar abono)
PATCH  /api/personal/debts/[id]/payments/[paymentId]  (editar abono)
DELETE /api/personal/debts/[id]/payments/[paymentId]  (eliminar abono)
POST   /api/personal/debts/[id]/link-transaction  (vincular movimiento)
```

---

## 💾 Modelos de Datos

### DebtAccount
```
id, userId, direction, type, name, counterpartyName,
originalPrincipal, currentPrincipal, annualInterestRate,
scheduleMode, paymentFrequency, scheduledPayment, numberOfInstallments,
startDate, estimatedEndDate, nextDueDate, personalCardId,
status, notes, agreementUrl, createdAt, updatedAt
```

### DebtInstallment
```
id, debtId, sequence, dueDate, expectedAmount,
expectedPrincipal, expectedInterest, expectedFees,
totalPaid, status, isEstimated, createdAt, updatedAt
```

### DebtPayment
```
id, debtId, installmentId, personalPaymentId, paidAt,
principalAmount, interestAmount, feeAmount, penaltyAmount,
totalAmount, notes, createdAt, updatedAt
```

---

## ✅ Reglas Financieras Clave

1. **Saldo = originalPrincipal - Σ(principalAmount pagado)**
2. **Interés, comisión, penalización NO reducen saldo**
3. **Cuota puede quedar PARTIALLY_PAID**
4. **nextDueDate = próxima cuota con status != PAID/CANCELLED**
5. **Si saldo ≤ 0 → status = PAID_OFF automáticamente**
6. **Desglose validado: totalAmount = capital + interés + comisión + penalización**

---

## 🔐 Seguridad

- ✅ UserId siempre de sesión (nunca cliente)
- ✅ Todas las queries filtran por userId
- ✅ VIEWER = read-only
- ✅ PersonalPayment protegido si vinculado a deuda (409)
- ✅ Transacciones ACID con prisma.$transaction
- ✅ Recalculación desde BD (no incremental)

---

## 🎯 Próximo: Incremento 2 (UI)

**Rutas a crear:**
- `/personal/debts` — listado con KPIs
- `/personal/debts/[id]` — detalle completo

**Componentes a crear:**
- DebtFormSheet, DebtSummaryCards, DebtListTable, DebtMobileCard,
- DebtProgress, DebtPaymentSheet, DebtPaymentHistory, InstallmentTable, LinkTransactionModal

**Cambios a hacer:**
- Agregar "Deudas y préstamos" al sidebar (después de "Mis Pagos")
- Responsive desde 375px
- WCAG 2.2 (labels, aria-*, focus)

**Prompt master:** `/INCREMENTO_2_MASTER.md`

---

## 📊 Estado

| Incremento | Tarea | Status |
|-----------|-------|--------|
| 1 | Datos, APIs, validación | ✅ COMPLETADO |
| 2 | UI, componentes, responsive | 🔄 EN PROGRESO |
| 3 | Integraciones (Mis Pagos, Statements, Dashboard) | 📋 PENDIENTE |

---

## 🚀 Para Continuar

```bash
# Cuando esté listo para Incremento 2:
# Copia el contenido de /INCREMENTO_2_MASTER.md
# y úsalo como prompt al equipo senior
```

---

