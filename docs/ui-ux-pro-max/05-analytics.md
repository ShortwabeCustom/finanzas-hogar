# 05 — Eventos Analíticos (GA4 / Firebase)

> Definición completa de los 10 eventos principales. Cada evento incluye: nombre, trigger, parámetros, tipo de implementación sugerida y ubicación en código.

---

## Instrucciones de implementación

Los eventos deben dispararse desde el cliente (componentes `"use client"`). Usar la función genérica:

```typescript
// src/lib/analytics.ts (por crear)
declare global {
  interface Window { gtag: (...args: unknown[]) => void; }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}
```

---

## EVENTO 1: `login_success`

| Campo | Valor |
|-------|-------|
| **Nombre** | `login_success` |
| **Trigger** | Resultado OK de `signIn("credentials")` antes de `router.push("/dashboard")` |
| **Archivo** | `src/app/(auth)/login/page.tsx` — función `onSubmit`, rama `!result?.error` |
| **Parámetros** | `{ method: "credentials" }` |
| **Evento negativo** | `login_error` con `{ error_type: "invalid_credentials" }` |

```typescript
// En onSubmit, tras verificar !result?.error:
trackEvent("login_success", { method: "credentials" });
```

---

## EVENTO 2: `dashboard_view`

| Campo | Valor |
|-------|-------|
| **Nombre** | `dashboard_view` |
| **Trigger** | `useEffect` inicial del Dashboard — cuando `data` se carga y `loading = false` |
| **Archivo** | `src/app/(app)/dashboard/page.tsx` — dentro del `useEffect` de fetch, en el `.then()` |
| **Parámetros** | `{ time_filter: timeFilter, year: selectedYear, has_overdue: summary.overduePayments > 0 }` |

```typescript
// Tras setData(d) y setLoading(false):
trackEvent("dashboard_view", {
  time_filter: timeFilter,
  has_overdue: d.summary.overduePayments > 0,
  overdue_count: d.summary.overduePayments,
});
```

---

## EVENTO 3: `payment_created`

| Campo | Valor |
|-------|-------|
| **Nombre** | `payment_created` |
| **Trigger** | PATCH/POST exitoso al crear un pago (hogar o personal) |
| **Archivos** | `src/app/(app)/payments/page.tsx` y `src/app/(app)/personal/payments/page.tsx` — función `handleSubmit`, tras `!res.ok` falso |
| **Parámetros** | `{ scope: "household" | "personal", category_id: data.categoryId, has_receipt: !!data.receipt, payment_method: data.paymentMethod, amount_bucket: getBucket(data.amount) }` |

```typescript
// Helper para anonimizar montos:
function getBucket(amount: number): string {
  if (amount < 500) return "0-500";
  if (amount < 2000) return "500-2000";
  if (amount < 10000) return "2000-10000";
  return "10000+";
}

trackEvent("payment_created", {
  scope: "personal",
  has_receipt: !!data.receipt,
  payment_method: data.paymentMethod,
  amount_bucket: getBucket(Number(data.amount)),
});
```

---

## EVENTO 4: `payment_marked_paid`

| Campo | Valor |
|-------|-------|
| **Nombre** | `payment_marked_paid` |
| **Trigger** | PATCH exitoso a `/api/personal/payments/[id]/mark-paid` |
| **Archivo** | `src/app/(app)/financial/recovery-plan/page.tsx` — función `handleMarkPaid`, tras `!res.ok` falso |
| **Parámetros** | `{ payment_priority: confirmItem.priority, days_overdue: calcDaysOverdue(confirmItem.dueDate), amount_bucket: getBucket(confirmItem.amount), from_recovery_plan: true }` |

```typescript
trackEvent("payment_marked_paid", {
  payment_priority: confirmItem.priority,
  from_recovery_plan: true,
  amount_bucket: getBucket(confirmItem.amount),
});
```

---

## EVENTO 5: `statement_import_started`

| Campo | Valor |
|-------|-------|
| **Nombre** | `statement_import_started` |
| **Trigger** | Inicio del proceso de importación (cuando exista UI directa) |
| **Archivo** | Futuro `src/app/(app)/personal/statements/page.tsx` — al iniciar upload |
| **Parámetros** | `{ file_type: "pdf", bank_name: string }` |
| **Nota** | Actualmente el import es backend-only. Implementar cuando se cree UI de importación |

---

## EVENTO 6: `statement_import_success`

| Campo | Valor |
|-------|-------|
| **Nombre** | `statement_import_success` |
| **Trigger** | Fetch exitoso a `/api/financial/sync` o cuando un nuevo statement aparece en la lista |
| **Archivo** | Backend o futuro UI de importación |
| **Parámetros** | `{ period: "YYYY-MM", transaction_count: number, bank_name: string }` |

---

## EVENTO 7: `recovery_plan_viewed`

| Campo | Valor |
|-------|-------|
| **Nombre** | `recovery_plan_viewed` |
| **Trigger** | Plan cargado exitosamente (data disponible, !loading, !error) |
| **Archivo** | `src/app/(app)/financial/recovery-plan/page.tsx` — en `useEffect` de fetchPlan, tras `setData(d)` |
| **Parámetros** | `{ financial_status: data.summary.financialStatus, score: data.financialScore?.score, overdue_total: data.summary.overdueTotal > 0, months_analyzed: months }` |

```typescript
trackEvent("recovery_plan_viewed", {
  financial_status: d.summary.financialStatus,
  score: d.financialScore?.score ?? null,
  has_overdue: d.summary.overdueTotal > 0,
  months_analyzed: m,
  payment_plan_count: d.paymentPlan.length,
});
```

---

## EVENTO 8: `recovery_priority_clicked`

| Campo | Valor |
|-------|-------|
| **Nombre** | `recovery_priority_clicked` |
| **Trigger** | Click en botón "Marcar pagado" en una fila del plan de pagos |
| **Archivo** | `src/app/(app)/financial/recovery-plan/page.tsx` — `onClick={() => { setSuccessId(null); setConfirmItem(item); }}` |
| **Parámetros** | `{ priority: item.priority, status: item.status, recommended_action: item.recommendedAction }` |

```typescript
// En el onClick del botón "Marcar pagado":
trackEvent("recovery_priority_clicked", {
  priority: item.priority,
  status: item.status,
  recommended_action: item.recommendedAction,
});
setSuccessId(null);
setConfirmItem(item);
```

---

## EVENTO 9: `financial_filter_used`

| Campo | Valor |
|-------|-------|
| **Nombre** | `financial_filter_used` |
| **Trigger** | Cambio en cualquier filtro de período en el Dashboard o filtros en tablas de pagos |
| **Archivos** | `src/app/(app)/dashboard/page.tsx` — `onChange` del select de tiempo; y filtros de `/personal/payments` |
| **Parámetros** | `{ filter_type: "time_period" | "category" | "status" | "payment_method" | "search", value: string, module: "dashboard" | "personal_payments" | "household_payments" | "statements" }` |

```typescript
// En el onChange del select de tiempo del dashboard:
trackEvent("financial_filter_used", {
  filter_type: "time_period",
  value: e.target.value,
  module: "dashboard",
});
```

---

## EVENTO 10: `chart_interaction`

| Campo | Valor |
|-------|-------|
| **Nombre** | `chart_interaction` |
| **Trigger** | Hover sobre tooltip de cualquier chart (Recharts) |
| **Archivos** | `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/financial/recovery-plan/page.tsx` |
| **Parámetros** | `{ chart_type: "bar_flow" | "treemap_category" | "bar_payment_method" | "area_forecast" | "line_score", module: string }` |
| **Implementación** | Prop `onMouseMove` o custom `<Tooltip content={...}>` que dispara evento |

```typescript
// Ejemplo en BarChart:
<BarChart
  data={monthlyFlow}
  onMouseMove={() => {
    if (!chartEventFired.current) {
      trackEvent("chart_interaction", {
        chart_type: "bar_flow",
        module: "dashboard",
      });
      chartEventFired.current = true; // dispara solo 1 vez por sesión de vista
    }
  }}
>
```

---

## Tabla resumen de eventos

| # | Evento | Módulo | Acción usuario | Prioridad |
|---|--------|--------|----------------|-----------|
| 1 | `login_success` | Login | Submit formulario exitoso | Alta |
| 2 | `dashboard_view` | Dashboard | Carga de datos | Alta |
| 3 | `payment_created` | Pagos / Mis Pagos | Guardar nuevo pago | Alta |
| 4 | `payment_marked_paid` | Plan Recuperación | Confirmar pago en modal | Alta |
| 5 | `statement_import_started` | Statements | Iniciar importación | Media |
| 6 | `statement_import_success` | Statements | Importación completada | Media |
| 7 | `recovery_plan_viewed` | Plan Recuperación | Carga del plan | Alta |
| 8 | `recovery_priority_clicked` | Plan Recuperación | Clic en "Marcar pagado" | Media |
| 9 | `financial_filter_used` | Dashboard / Pagos | Cambio de filtro | Media |
| 10 | `chart_interaction` | Dashboard / Recovery | Hover en gráfica | Baja |

---

## Notas de implementación

1. **GA4 setup:** Agregar `gtag.js` en `src/app/layout.tsx` (root layout) con el Measurement ID
2. **Privacy:** No registrar montos exactos en analytics — usar `amount_bucket` para anonimizar
3. **Throttle:** Para `chart_interaction`, usar una ref para disparar solo la primera interacción por render de página
4. **Debug:** Usar GA4 DebugView durante el desarrollo (`?gtag_debug=1`)
5. **Consentimiento:** Para GDPR/LFPDPPP considerar consentimiento si la app es usada fuera del contexto familiar privado
