# INCREMENTO 3 — SESIÓN SIGUIENTE

**Fecha de inicio:** 2026-08-05  
**Estado previo:** INCREMENTO 2 ✅ completado (UI/componentes listos)  
**Objetivo:** Integración del módulo Deudas con Mis Pagos, Statements y Dashboard

---

## 🎯 Resumen Ejecutivo

Implementar 3 integraciones críticas + analytics + tests:

1. **Mis Pagos** — Los abonos a deudas aparecen como `PersonalPayment` con badge "Abono a deuda"
2. **Statements** — Transacciones bancarias pueden vincularse a deudas (vincular movimiento)
3. **Dashboard Personal** — Nueva sección "Deudas Pendientes" con KPIs urgentes
4. **Analytics** — 10 eventos de seguimiento (crear, pagar, liquidar, filtrar, etc.)
5. **Tests E2E** — Suite Playwright con 5 casos críticos (crear→pagar→liquidar, vincular, filtros, responsive, a11y)

---

## 📋 Cambios DB Mínimos

```prisma
model PersonalPayment {
  // ... campos existentes ...
  relatedDebtId String?  // FK a DebtAccount
  @@index([relatedDebtId])
}

model BankTransaction {
  // ... campos existentes ...
  relatedDebtId String?  // FK a DebtAccount
  linkedManuallyAt DateTime?
  @@index([relatedDebtId])
}
```

Comando: `npm run db:push && npm run db:generate`

---

## 🔄 Cambios por Módulo

### 1. Mis Pagos (`/personal/payments`)
- Badge "Abono a deuda" en filas vinculadas (link a `/personal/debts/[id]`)
- Filtro nuevo: "Mostrar solo abonos a deuda"
- Columna opcional "Deuda relacionada" (nombre de la deuda)

### 2. Statements (`/personal/statements`)
- Badge "Vinculado a deuda" en transacciones linked
- Botón "Vincular a deuda" por fila
- Modal: selecciona deuda + (opcional) importe parcial
- Sugerencia automática si transacción es cargo en tarjeta crédito

### 3. Dashboard Personal (`/personal/dashboard`)
- Nueva sección "Deudas Pendientes" después de "Mis Tarjetas"
- 3 KPIs: Saldo total por pagar | Próximo vencimiento | Cuotas vencidas
- Card destacada: "Deuda más urgente" con progreso
- Lista colapsable: "Vencidas" (si > 0)
- Empty state: "Registra tu primera deuda"

### 4. Analytics (`src/lib/analytics.ts`)
- 10 eventos: `debt_created`, `debt_edited`, `debt_deleted`, `debt_payment_recorded`, `debt_payment_edited`, `debt_payment_deleted`, `debt_marked_paid_off`, `debt_installment_generated`, `debt_transaction_linked`, `debt_filter_used`
- Parámetros: `direction`, `type`, `amount_bucket`, `payment_method`, `portion`, etc.
- NO registrar montos exactos, IDs, ni nombres de contrapartes
- Usar `gtag()` si disponible (Google Analytics 4)

### 5. Tests E2E (`tests/e2e/debts.spec.ts`)
- Test 1: crear → pagar (5 abonos) → liquidar → verificar Dashboard
- Test 2: vincular transacción bancaria a deuda
- Test 3: filtros y búsqueda en listado
- Test 4: responsive mobile 375px (cards, no scroll)
- Test 5: accesibilidad WCAG AA (axe-core, labels, focus)

---

## 📁 Archivos a Modificar

| Archivo | Responsabilidad |
|---------|-----------------|
| `prisma/schema.prisma` | Agregar `relatedDebtId` a PersonalPayment + BankTransaction |
| `src/app/api/personal/payments/route.ts` | GET/POST actualizar para incluir `relatedDebtId` |
| `src/app/api/personal/dashboard/route.ts` | Agregar objeto `debts` en respuesta |
| `src/app/(app)/personal/payments/page.tsx` | Badge, filtro, columna opcional |
| `src/app/(app)/personal/statements/page.tsx` | Badge, botón, modal de vincular |
| `src/app/(app)/personal/dashboard/page.tsx` | Nueva sección "Deudas Pendientes" |
| `src/lib/analytics.ts` | NUEVO — función `trackDebtEvent()` |
| `src/components/personal/debts/DebtFormSheet.tsx` | Agregar `trackDebtEvent` en crear/editar |
| `src/components/personal/debts/DebtPaymentSheet.tsx` | Agregar `trackDebtEvent` en registrar abono |
| `src/components/personal/debts/DebtPaymentHistory.tsx` | Agregar `trackDebtEvent` en acciones |
| `tests/e2e/debts.spec.ts` | NUEVO — Suite Playwright (5 tests) |

---

## 🚀 Orden de Implementación (Recomendado)

1. Schema + DB migration (5 min)
2. Analytics base (10 min)
3. Mis Pagos integración (20 min)
4. Statements integración (20 min)
5. Dashboard integración (15 min)
6. Eventos analytics en componentes (10 min)
7. Tests E2E suite (30 min)
8. Build + QA + Deploy (15 min)

**Total estimado:** 2-2.5 horas

---

## ✅ Criterios de Aceptación

- [ ] PersonalPayment vinculados muestran badge en Mis Pagos
- [ ] BankTransaction puede vincularse a DebtAccount desde Statements
- [ ] Dashboard muestra sección "Deudas Pendientes" con KPIs
- [ ] 10 eventos analytics disparan correctamente
- [ ] Test E2E 1: crear→pagar→liquidar pasa
- [ ] Test E2E 2: vincular transacción funciona
- [ ] Test E2E 3: filtros dan resultados correctos
- [ ] Test E2E 4: responsive 375px sin issues
- [ ] Test E2E 5: accesibilidad WCAG AA validada
- [ ] Build limpio (`npm run build`)
- [ ] PM2 restart exitoso

---

## 📚 Documentación Referencia

- `/INCREMENTO_3_MASTER.md` — Prompt completo (700+ líneas) con todos los detalles
- `/docs/debts-loans.md` — Modelos, APIs, reglas financieras
- `finanzas.md` — Arquitectura general del sistema

---

## 🎯 Próximas Sesiones (Futuro)

- **Sesión 3:** Tests unitarios + E2E completos + coverage > 80%
- **Sesión 4:** Notificaciones de próximo vencimiento (email/WhatsApp)
- **Sesión 5:** Recomendaciones de refinanciamiento (IA)

---

**¡Listo para empezar INCREMENTO 3!** Copia el contenido de `/INCREMENTO_3_MASTER.md` y úsalo como prompt en la siguiente conversación.
