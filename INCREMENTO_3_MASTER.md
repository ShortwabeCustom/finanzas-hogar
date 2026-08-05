# INCREMENTO 3: INTEGRACIONES Y ANALYTICS — PROMPT MASTER

**Fase:** Integración de módulo  
**Duración esperada:** 2 sesiones (1 integraciones, 1 analytics + tests)  
**Commit esperado:** `feat(debts): integrate with payments, statements, and dashboard`  
**Estado previo:** UI/componentes completados (Incremento 2 ✅)

---

## 🎯 OBJETIVO

Integrar el módulo "Deudas y Préstamos" con los módulos existentes de forma orgánica:

1. **Mis Pagos** — Permitir que los abonos de deudas se vean como `PersonalPayment`
2. **Estados de Cuenta** — Vincular transacciones bancarias a deudas automáticamente
3. **Dashboard Personal** — Mostrar deudas en la vista general con KPIs integrados
4. **Analytics** — Eventos de seguimiento para deudas (crear, pagar, liquidar)
5. **QA** — Test suite E2E básico para flujos críticos

**No implementar aún:**
- Sincronización automática de tarjeta de crédito → deuda (futuro)
- Notificaciones de próximo vencimiento (futuro)
- Recomendaciones de refinanciamiento (futuro)
- Exportación a PDF/Excel (futuro)

---

## 📐 ARQUITECTURA DE INTEGRACIONES

### 1. Mis Pagos (`/personal/payments`)

#### Problema a resolver

Los abonos de deudas son actualmente creados dentro del contexto de deudas. No aparecen en "Mis Pagos" como una categoría o tipo distinguible. El usuario no ve un flujo uniforme de todos sus pagos personales.

#### Solución: Categoría de Deuda en PersonalPayment

**Cambios en DB:**
- Campo nuevo en `PersonalPayment`: `relatedDebtId String?` (FK a `DebtAccount`)
- Índice: `@@index([relatedDebtId])`
- La categoría de un pago vinculado a deuda es la categoría default de esa deuda (o crea una nueva implícita)

**API cambios:**
- `POST /api/personal/payments` — Body puede incluir `relatedDebtId` 
- `GET /api/personal/payments?debtId=<id>` — Filtro por deuda específica
- `GET /api/personal/debts/[id]/payments` — Ya existente, retorna `PersonalPayment[]` vinculados

**UI cambios:**
- `/personal/payments` — Tabla y cards muestran badge "Abono a deuda" cuando `relatedDebtId` es no-null
- Badge es enlace hacia `/personal/debts/<debtId>`
- Filtro nuevo: "Filtrar por tipo" incluye opción "Abonos a deuda"
- Columna opcional "Deuda relacionada" que muestra el nombre de la deuda
- Al crear pago manualmente desde `/personal/payments`, select "¿Es un abono a una deuda?" condiciona el flujo

**Validación:**
- No se puede eliminar una deuda si tiene pagos vinculados (409 + mensaje descriptivo)
- Al eliminar un `PersonalPayment` vinculado a deuda, se actualiza `currentPrincipal` de la deuda automáticamente

---

### 2. Estados de Cuenta (`/personal/statements`)

#### Problema a resolver

Las transacciones bancarias son puramente transacciones. No se sabe si una transacción corresponde a un pago de tarjeta de crédito, una transferencia de deuda vencida, o un abono estratégico a una deuda específica.

#### Solución: Vincular BankTransaction a DebtAccount

**Cambios en DB:**
- Campo nuevo en `BankTransaction`: `relatedDebtId String?` (FK a `DebtAccount`)
- Índice: `@@index([relatedDebtId])`
- Campo: `linkedManuallyAt DateTime?` — Timestamp cuando fue vinculado manualmente (vs. automático)

**API nueva:**
- `POST /api/personal/debts/[id]/link-transaction` — Ya existe (Incremento 1), reusarla

**UI cambios:**
- `/personal/statements` — Panel de transacciones muestra badge "Vinculado a deuda" cuando `relatedDebtId` es no-null
- Badge es enlace hacia `/personal/debts/<debtId>`
- Botón "Vincular a deuda" por fila (desktop: hover; mobile: accesible siempre)
- Modal/Sheet: selecciona deuda + (opcional) elige si toda la transacción o solo parte
- Si solo parte: crea `DebtPayment` con importe parcial; resto queda como `PersonalPayment` independiente
- Checkbox en header: "Mostrar solo transacciones no vinculadas a deudas"

**Lógica de vinculación automática (detectar tarjeta de crédito):**
- Si transacción es un cargo (chargeAmount > 0) en una cuenta `CREDIT` perteneciente al usuario
- Y existe `DebtAccount` con `type: CREDIT_CARD` y `personalCardId` = ese `PersonalCard`
- Ofrecer sugerencia: "¿Vincular esta transacción como cargo a [nombre de deuda]?" (no automático)

---

### 3. Dashboard Personal (`/personal/dashboard`)

#### Problema a resolver

El dashboard personal muestra pagos, tarjetas, y estados de cuenta. Las deudas son un módulo completamente separado sin visibilidad en la vista general.

#### Solución: Agregar sección de Deudas al Dashboard

**API cambios:**
- `GET /api/personal/dashboard` — Respuesta incluye nuevo campo `debts`:
  ```json
  {
    "debts": {
      "totalPayable": 45000.50,
      "totalReceivable": 12000.00,
      "mostUrgent": {
        "id": "...",
        "name": "Tarjeta Azteca",
        "currentPrincipal": 7500,
        "nextDueDate": "2026-08-15",
        "daysUntilDue": 11
      },
      "overdue": [
        { "id": "...", "name": "...", "daysOverdue": 5 }
      ]
    }
  }
  ```

**UI cambios:**
- Dashboard `/personal/dashboard` — Nueva sección "Deudas Pendientes" (después de "Mis Tarjetas")
- 3 cards KPI:
  - Saldo Total por Pagar
  - Próximo Vencimiento (fecha + días)
  - Cuotas Vencidas (si > 0, badge rojo)
- "Deuda más urgente" — Card destacada con nombre, saldo, progreso y CTA "Ver deuda"
- Lista colapsable "Vencidas" con 3+ deudas, cada una un link a `/personal/debts/<id>`
- Si sin deudas: empty state con CTA "Registrar primera deuda"

**Interacción:**
- Click en cualquier card de deuda navega a `/personal/debts/<id>`
- Click en "Ver deuda" navega a detalle
- Badge "Cuotas vencidas" es link a `/personal/debts?tab=overdue` (nuevo filtro)

---

### 4. Analytics — Seguimiento de Deudas

#### Eventos a registrar

| # | Evento | Trigger | Parámetros clave | Ubicación |
|---|--------|---------|------------------|-----------|
| 1 | `debt_created` | Guardar deuda nueva | `direction`, `type`, `amount_bucket` | `DebtFormSheet` onSuccess |
| 2 | `debt_edited` | Actualizar deuda | `type`, `field_changed` (ej. saldo, tasa) | `DebtFormSheet` onSuccess |
| 3 | `debt_deleted` | Eliminar deuda | `direction`, `reason` (si existe) | Page detalle o listado |
| 4 | `debt_payment_recorded` | Registrar abono | `payment_method`, `amount_bucket`, `portion` (capital/interés) | `DebtPaymentSheet` onSuccess |
| 5 | `debt_payment_edited` | Editar abono | `field_changed` | `DebtPaymentHistory` |
| 6 | `debt_payment_deleted` | Eliminar abono | `reason` (si existe) | `DebtPaymentHistory` |
| 7 | `debt_marked_paid_off` | Deuda liquidada automáticamente | `days_to_liquidate` | Backend trigger en PATCH |
| 8 | `debt_installment_generated` | Generar calendario | `number_of_installments`, `frequency` | DebtDetailPage |
| 9 | `debt_transaction_linked` | Vincular transacción bancaria | `transaction_amount`, `partial` (bool) | `DebtPaymentHistory` o Statements |
| 10 | `debt_filter_used` | Aplicar filtro en listado | `filter_type`, `filter_value` | Page listado |

**Amount buckets:**
```
0-1000 | 1000-5000 | 5000-20000 | 20000-100000 | 100000+
```

**Implementación:**
- Crear `src/lib/analytics.ts` con función `trackDebtEvent()`
- Llamar desde componentes DESPUÉS de confirmar éxito de API (no especular)
- No registrar IDs de usuario, montos exactos, ni nombres de contrapartes
- Usar `gtag()` si disponible (Google Analytics 4)

---

## 📊 INTEGRACIÓN CON DASHBOARD — Detalle UI

### Sección "Deudas Pendientes" — Flujo de carga

```
┌─────────────────────────────────────────────────────────────┐
│ Deudas Pendientes                                           │
│                                                             │
│ KPI 1: Saldo por Pagar      KPI 2: Próximo Vencimiento      │
│ $45,000.50                  15 de Ago (11 días)            │
│                                                             │
│ KPI 3: Cuotas Vencidas                                      │
│ 2 (badge rojo)                                              │
├─────────────────────────────────────────────────────────────┤
│ Más Urgente:                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tarjeta Azteca                                          │ │
│ │ Saldo: $7,500 / $10,000 (75%)                          │ │
│ │ Progreso: ████████░░ 75%                              │ │
│ │ Próximo pago: 15 ago                                    │ │
│ │ [Ver deuda →]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Vencidas (2)  ▼                                              │
│ • Crédito BBVA — 5 días vencida                             │
│ • Hipoteca XYZ — 10 días vencida                            │
│ [Ver todas →]                                               │
└─────────────────────────────────────────────────────────────┘
```

### Estado vacío
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ 💰 Sin deudas ni préstamos registrados                     │
│                                                             │
│ Empieza a controlar lo que debes o te deben.               │
│                                                             │
│ [Registrar primera deuda]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 QA Y TESTS

### Suite de Tests E2E (Playwright)

**Archivo:** `tests/e2e/debts.spec.ts`

#### Test 1: Flujo completo crear → pagar → liquidar

```
1. Login como usuario EDITOR
2. Navegar a /personal/debts
3. Click "Nueva deuda"
4. Llenar formulario:
   - Nombre: "Test Deuda"
   - Monto: $5,000
   - Fecha inicio: Hoy
   - Modalidad: Calendario 12 cuotas
5. Guardar → verificar toast "Deuda creada"
6. Verificar deuda en listado con badge "Activa"
7. Click en deuda → navegar a /personal/debts/[id]
8. Click "Registrar abono" → Sheet
9. Capital: $2,000 → Guardar
10. Verificar progreso: 40%
11. Verificar en /personal/payments: nuevo pago visible con badge "Abono a deuda"
12. Registrar 5 abonos más de $600 cada uno → saldo $0
13. Verificar deuda marcada PAID_OFF
14. Verificar en Dashboard: deuda NO aparece en "Deudas Pendientes"
```

#### Test 2: Vincular transacción bancaria a deuda

```
1. Crear deuda CREDIT_CARD con tarjeta Santander 1234
2. Importar estado de cuenta con transacción de $500 en Santander 1234
3. Navegar a /personal/statements → buscar transacción
4. Click "Vincular a deuda"
5. Seleccionar la deuda creada
6. Guardar → verificar transacción ahora muestra badge "Vinculado a deuda"
7. Navegar a deuda → verificar transacción aparece en historial
```

#### Test 3: Filtros y búsqueda en listado

```
1. Crear 3 deudas: PAYABLE, RECEIVABLE, PAYABLE
2. Navegar a /personal/debts
3. Click tab "Por pagar" → verificar 2 deudas
4. Click tab "Por cobrar" → verificar 1 deuda
5. Filtro tipo "CREDIT_CARD" → verificar 0 deudas (ninguna es tarjeta)
6. Búsqueda por nombre (palabra exacta) → verificar coincidencias
7. Limpiar filtros → todas visibles nuevamente
```

#### Test 4: Responsive mobile

```
1. Viewport 375px
2. Navegar a /personal/debts
3. Verificar cards apiladas (no tabla)
4. Verificar botones touch-friendly (min 44px)
5. Verificar formulario sheet se ajusta al viewport
6. Navegar a detalle
7. Verificar no hay scroll horizontal
```

#### Test 5: Accesibilidad

```
1. Ejecutar axe-core en todas las páginas de deudas
2. Verificar WCAG AA en:
   - Contraste de color (4.5:1 mínimo)
   - Labels asociados a inputs
   - Focus trap en sheets
   - ARIA roles y attributes
3. Navegar solo con teclado (Tab/Shift+Tab/Enter)
4. Verificar screen reader anuncios en toasts
```

### Checklist de QA Manual

| Caso | Resultado esperado | Verificado |
|------|---|---|
| Crear deuda con campos mínimos | Deuda creada, en listado | [ ] |
| Crear deuda con calendario 24 cuotas | Cuotas generadas correctamente | [ ] |
| Editar deuda → cambiar saldo | Saldo actualizado, progreso recalculado | [ ] |
| Registrar abono capital = saldo | Deuda marcada PAID_OFF | [ ] |
| Registrar abono > saldo | Error: "Capital no puede superar saldo" | [ ] |
| Eliminar abono | Saldo recalculado | [ ] |
| Filtro + búsqueda combinados | Resultados correctos | [ ] |
| Desktop 1280px | Tabla sin scroll horizontal | [ ] |
| Tablet 768px | Cards responsivas | [ ] |
| Mobile 375px | Fonts 14px+, touch targets 44px+ | [ ] |
| Toasts de éxito/error | Visibles, auto-dismiss 3s | [ ] |
| Link desde Sidebar | Navega a /personal/debts | [ ] |
| Dashboard muestra deudas urgentes | KPIs y tarjeta actualizadas | [ ] |

---

## 📝 ARCHIVOS A CREAR/MODIFICAR

### Nuevos archivos

```
src/app/api/personal/debts/[id]/link-transaction/route.ts (ya existe — Incremento 1)

Migraciones/Schema:
  prisma/schema.prisma — Campos relatedDebtId en PersonalPayment y BankTransaction

Componentes de integración:
  src/components/personal/debts/DebtLinkTransactionModal.tsx (solo si fuera componente separado)
  
Analytics:
  src/lib/analytics.ts (nuevo)
  
Tests:
  tests/e2e/debts.spec.ts (nuevo)
```

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | `relatedDebtId` en PersonalPayment + BankTransaction, índices |
| `src/app/(app)/personal/payments/page.tsx` | Badge "Abono a deuda", filtro tipo, columna opcional |
| `src/app/(app)/personal/statements/page.tsx` | Badge "Vinculado a deuda", botón "Vincular", modal |
| `src/app/(app)/personal/dashboard/page.tsx` | Nueva sección "Deudas Pendientes" con KPIs |
| `src/app/api/personal/dashboard/route.ts` | Objeto `debts` en respuesta |
| `src/app/api/personal/payments/route.ts` | Aceptar `relatedDebtId` en POST; incluir en GET si filtro |
| `src/components/personal/debts/DebtPaymentHistory.tsx` | Llamar `trackDebtEvent` en acciones |
| `src/components/personal/debts/DebtFormSheet.tsx` | Llamar `trackDebtEvent` en crear/editar |
| `src/components/personal/debts/DebtDetailPage.tsx` (future) | Llamar `trackDebtEvent` en eliminar |

---

## 🚀 ORDEN RECOMENDADO

1. **Schema + DB** — Campos nuevos, índices, `prisma db push`
2. **Analytics** — `src/lib/analytics.ts` + función base
3. **Mis Pagos integración** — Badge, filtro, modificar `PersonalPayment` API
4. **Statements integración** — Badge, modal vincular, detectar tarjeta crédito
5. **Dashboard integración** — Sección Deudas, nueva API endpoint
6. **Eventos analíticos** — Agregar `trackDebtEvent` a componentes
7. **Tests E2E** — Suite Playwright con 5 casos críticos
8. **Build + Deploy** — Verificar tipado, build limpio, PM2 restart

---

## ✅ CRITERIOS DE ACEPTACIÓN

Implementación completada cuando:

1. ✅ `PersonalPayment` vinculados a deuda aparecen en `/personal/payments` con badge
2. ✅ `BankTransaction` puede vincularse a deuda desde `/personal/statements`
3. ✅ Dashboard muestra sección "Deudas Pendientes" con KPIs
4. ✅ Evento `debt_created` registrado cuando se crea deuda
5. ✅ Evento `debt_payment_recorded` registrado cuando se registra abono
6. ✅ Todos los eventos de la tabla de Analytics disparan correctamente
7. ✅ Test E2E 1: flujo crear → pagar → liquidar pasa sin fallos
8. ✅ Test E2E 2: vincular transacción funciona end-to-end
9. ✅ Test E2E 3: filtros y búsqueda dan resultados correctos
10. ✅ Test E2E 4: responsive 375px-1280px sin issues
11. ✅ Test E2E 5: accesibilidad WCAG AA validada
12. ✅ QA manual: todos los casos de uso pasan
13. ✅ Sin errores TypeScript (`npx tsc --noEmit`)
14. ✅ Build de producción exitoso
15. ✅ Schema está sincronizado (`npm run db:generate`)

---

## 🔗 REFERENCIAS

- Documentación deudas: `/docs/debts-loans.md`
- INCREMENTO 2 (UI): `/INCREMENTO_2_MASTER.md`
- Dashboard personal: `src/app/(app)/personal/dashboard/page.tsx`
- Analytics base: futuro `src/lib/analytics.ts`
- Tests E2E: futuro `tests/e2e/`

---

**Fin del Prompt Master para Incremento 3**

Proceder cuando Incremento 2 sea validado. Los cambios son altamente integrativos — requieren atención a transiciones de datos y consistency entre módulos.
