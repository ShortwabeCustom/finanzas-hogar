# 06 — Backlog Priorizado UX/UI

> Clasificado por categoría y prioridad. Cada ítem incluye: descripción, impacto, esfuerzo y módulo afectado.  
> Prioridad: 🔴 Crítica · 🟠 Alta · 🟡 Media · 🟢 Baja

---

## SECCIÓN A: Quick Wins (impacto alto, esfuerzo bajo)

| # | Ítem | Módulo | Impacto | Esfuerzo | Detalle |
|---|------|--------|---------|----------|---------|
| QW-01 | 🔴 Manejo de error de red en Dashboard | Dashboard | Alto | Bajo | El dashboard no tiene `catch` en el fetch → pantalla en blanco si falla la API. Agregar estado de error con botón "Reintentar" |
| QW-02 | 🔴 Manejo de error en Statements | Statements | Alto | Bajo | El fetch de statements no maneja error de red → spinner infinito. Misma solución que QW-01 |
| QW-03 | 🟠 Sistema de Toast/Snackbar global | Todos | Alto | Bajo | Actualmente el éxito de "pago creado" no tiene feedback visual claro. Implementar `react-hot-toast` o similar con 3s auto-dismiss |
| QW-04 | 🟠 Título dinámico `<head>` por ruta | Todos | Medio | Bajo | Agregar `export const metadata` en cada page.tsx para SEO y accesibilidad (tab title) |
| QW-05 | 🟠 Folio en clipboard con un clic | Pagos / Mis Pagos | Medio | Bajo | Agregar botón de copiar al portapapeles en el folio `PAG-XXXX-XXXX` de cada fila |
| QW-06 | 🟡 Badge de "Mañana" y "Hoy" para pagos en tabla | Mis Pagos | Medio | Bajo | Mostrar badge de urgencia en la columna Vencimiento de la tabla (como ya existe en el dashboard) |
| QW-07 | 🟡 Confirmación visual al "Limpiar campos" | Formularios | Bajo | Bajo | El botón "Limpiar campos" no da feedback. Agregar texto transitorio "Campos limpiados" o deshabilitar 1s |
| QW-08 | 🟡 Scroll automático al error en formulario | Formularios | Medio | Bajo | Si hay error de validación en campo fuera de vista, hacer scroll al primer error |

---

## SECCIÓN B: Mejoras UX (experiencia de usuario)

| # | Ítem | Módulo | Impacto | Esfuerzo | Detalle |
|---|------|--------|---------|----------|---------|
| UX-01 | 🔴 UI de importación de estados de cuenta | Statements | Crítico | Alto | No existe UI para que el usuario importe PDFs bancarios. Actualmente es proceso manual backend. Crear wizard: seleccionar banco → subir PDF → preview → confirmar |
| UX-02 | 🟠 Paginación o scroll infinito en tablas | Pagos / Statements | Alto | Medio | Las tablas cargan todos los registros sin límite. Agregar `limit/offset` o cursor-based pagination con indicador de total |
| UX-03 | 🟠 Ordenamiento de columnas en tablas de pagos | Pagos / Mis Pagos | Alto | Medio | Solo el Plan de Recuperación tiene tablas ordenables. Agregar sorting en las tablas de pagos principales |
| UX-04 | 🟠 "Marcar como pagado" desde Mis Pagos | Mis Pagos | Alto | Bajo | Actualmente solo está en el Plan de Recuperación. Agregar acción rápida en la tabla de Mis Pagos para marcar como pagado sin entrar al plan |
| UX-05 | 🟠 Filtro de fechas persistente (URL params) | Dashboard | Medio | Medio | El filtro de tiempo se resetea al navegar. Guardar el estado en URL query params para que persista y sea compartible |
| UX-06 | 🟡 Modo "vista rápida" de pago desde tabla | Pagos / Mis Pagos | Medio | Medio | Click en nombre de pago → panel lateral de solo lectura con todos los detalles (sin abrir el editor) |
| UX-07 | 🟡 Indicador de progreso en importación | Statements | Alto | Medio | Si se crea UI de importación, mostrar progreso por pasos: Subir → Procesar → Revisar → Confirmar |
| UX-08 | 🟡 Buscador global (Cmd+K) | Todos | Medio | Alto | Buscador unificado que busque en pagos, categorías y despensa simultáneamente |
| UX-09 | 🟡 Dashboard personal (`/personal/dashboard`) con datos | Personal Dashboard | Alto | Medio | La página `/personal/dashboard` existe pero no fue detallada en el código leído. Verificar que tiene paridad de features con el dashboard global |
| UX-10 | 🟢 Bulk actions en tablas | Pagos | Bajo | Alto | Selección múltiple + "Marcar seleccionados como pagados" / "Eliminar seleccionados" |

---

## SECCIÓN C: Mejoras UI (interfaz visual)

| # | Ítem | Módulo | Impacto | Esfuerzo | Detalle |
|---|------|--------|---------|----------|---------|
| UI-01 | 🟠 Skeleton loading en lugar de spinner | Todos | Alto | Bajo | Reemplazar el spinner circular con skeleton screens (placeholder de forma de la UI) para reducir layout shift |
| UI-02 | 🟠 Gráfica de distribución en Mis Dashboard personal | Personal Dashboard | Alto | Medio | Agregar donut chart o mini BarChart de categorías en el dashboard personal, similar al treemap del hogar |
| UI-03 | 🟠 Highlight de fila seleccionada en Statements | Statements | Medio | Bajo | Cuando se selecciona un período, hacer scroll automático a las transacciones en móvil |
| UI-04 | 🟠 Animación de transición en Sheet/Modal | Todos | Bajo | Bajo | Agregar `transition-transform duration-300` al abrir/cerrar Sheet (actualmente puede ser abrupto) |
| UI-05 | 🟡 Paleta de colores para categorías (color picker real) | Categorías | Medio | Medio | Reemplazar input[type=color] nativo con un componente de selección de colores predefinidos para consistencia visual |
| UI-06 | 🟡 Tarjeta bancaria con diseño de tarjeta física | Mis Tarjetas | Bajo | Medio | Rediseñar la card bancaria con proporciones 3.375:2.125 (CR-80), chip visual, nombre de portador opcional |
| UI-07 | 🟡 Modo oscuro | Global | Bajo | Alto | Agregar soporte para `dark:` en Tailwind. El sidebar ya tiene fondo oscuro; el body aún es blanco |
| UI-08 | 🟡 Indicador visual del score en sidebar | Sidebar | Bajo | Bajo | Mini badge con color del score financiero actual en el link "Plan de Recuperación" del sidebar |
| UI-09 | 🟢 Logo/favicon personalizado | Global | Bajo | Bajo | El logo actual es un SVG de casa genérico. Considerar un ícono de marca más específico |
| UI-10 | 🟢 Formato de moneda en inputs numéricos | Formularios | Medio | Medio | Mostrar formato MXN mientras el usuario escribe (máscara de input) en lugar de número plano |

---

## SECCIÓN D: Analytics

| # | Ítem | Módulo | Impacto | Esfuerzo | Detalle |
|---|------|--------|---------|----------|---------|
| AN-01 | 🔴 Implementar `src/lib/analytics.ts` | Global | Crítico | Bajo | Crear la función `trackEvent` descrita en 05-analytics.md |
| AN-02 | 🔴 Instalar GA4 en root layout | Global | Crítico | Bajo | Agregar script de gtag.js en `src/app/layout.tsx` |
| AN-03 | 🟠 Implementar eventos 1-4 (login, dashboard, payment, mark-paid) | Core flows | Alto | Bajo | Los más críticos para medir adopción y uso core |
| AN-04 | 🟠 Implementar evento 7 (recovery_plan_viewed) | Recovery | Alto | Bajo | Medir engagement con el módulo más complejo |
| AN-05 | 🟡 Implementar eventos 8-10 (filtros, charts) | Dashboard | Medio | Bajo | Medir patrones de exploración de datos |
| AN-06 | 🟡 Dashboard de métricas interno | Admin | Medio | Alto | Página `/admin/metrics` con datos de `productMetrics.ts` (el archivo ya existe) |
| AN-07 | 🟢 Funnel de completado de formulario | Pagos | Bajo | Medio | Track de abandono de formulario (onBlur + tiempo + submit) |

---

## SECCIÓN E: Accesibilidad (WCAG AA)

| # | Ítem | Módulo | Impacto | Esfuerzo | Detalle |
|---|------|--------|---------|----------|---------|
| AC-01 | 🔴 `aria-label` en botones de solo ícono | Todos | Crítico | Bajo | Los botones de editar/eliminar (solo SVG) necesitan `aria-label="Editar pago X"`. Algunos tienen `title` pero no `aria-label` |
| AC-02 | 🔴 `<label htmlFor>` explícito en todos los campos | Formularios | Crítico | Bajo | Los labels usan `className="label"` pero no están todos ligados con `htmlFor` al `id` del input |
| AC-03 | 🟠 Focus visible en navegación por teclado | Global | Alto | Medio | Verificar que `focus:ring-2 focus:ring-indigo-500` está en todos los elementos interactivos. El sidebar usa hover pero puede carecer de focus state |
| AC-04 | 🟠 Contraste de texto | Global | Alto | Bajo | `text-indigo-200` sobre `bg-indigo-900` en sidebar: verificar ratio ≥4.5:1. El texto de los dots de color en cards muy pequeños puede no cumplir |
| AC-05 | 🟠 Mensajes de error anunciados a screen readers | Formularios | Alto | Bajo | Agregar `role="alert"` a los banners de error y `aria-describedby` en inputs con error |
| AC-06 | 🟡 Skip link "Ir al contenido principal" | Global | Medio | Bajo | Agregar link invisible visible al focus para saltar la navegación |
| AC-07 | 🟡 `aria-live="polite"` en estados de carga | Todos | Medio | Bajo | Los spinners no anuncian "cargando..." a lectores de pantalla |
| AC-08 | 🟡 Navegación por teclado en gráficas | Dashboard / Recovery | Medio | Alto | Recharts tiene soporte limitado de teclado. Agregar tabla alternativa de datos para cada gráfica |
| AC-09 | 🟡 `role="dialog"` y `aria-modal` en modales | Formularios | Medio | Bajo | El ConfirmDialog y ConfirmModal en Recovery Plan necesitan `role="dialog"`, `aria-labelledby`, `aria-describedby` y trap de foco |
| AC-10 | 🟢 Reducción de movimiento (`prefers-reduced-motion`) | Global | Bajo | Bajo | Las animaciones `animate-spin`, `animate-pulse` deben respetar `prefers-reduced-motion: reduce` |

---

## SECCIÓN F: Riesgos identificados

| # | Riesgo | Severidad | Módulo | Descripción |
|---|--------|-----------|--------|-------------|
| RK-01 | 🔴 **Sin UI de importación** | Crítico | Statements | La importación de estados de cuenta es backend-only. El usuario no puede importar sin ayuda técnica — esto rompe el flujo completo de Estados de Cuenta |
| RK-02 | 🔴 **Fetch sin error handling** | Crítico | Dashboard, Statements | Pantallas en blanco en fallo de red sin mensaje de error ni botón de reintento |
| RK-03 | 🟠 **Carga sin paginación** | Alto | Pagos / Statements | Con muchos registros, el fetch completo de todos los pagos puede ser lento y saturar memoria del cliente |
| RK-04 | 🟠 **Score financiero basado en datos incompletos** | Alto | Recovery Plan | El plan usa inferencia por nombre de categoría para detectar ingresos. Puede clasificar ingresos como gastos si no están categorizados con palabras clave reconocidas |
| RK-05 | 🟠 **Folio generado en cliente** | Medio | Pagos | `generateFolio()` usa `randomBytes` pero se llama en el cliente. Riesgo de colisión si dos usuarios crean un pago en el mismo milisegundo (aunque es app privada/familiar) |
| RK-06 | 🟡 **Solo banco Santander Free Oro** | Medio | Statements | El subtitle dice explícitamente "Movimientos bancarios importados de Santander Free Oro". Si el usuario cambia de banco, el parser puede fallar |
| RK-07 | 🟡 **Sin límite de carga en drag & drop** | Medio | Comprobantes | El límite de 5MB está validado en cliente pero debe validarse también en el backend de upload |
| RK-08 | 🟡 **Dependencia de fechas UTC** | Bajo | Global | `formatDate` extrae componentes UTC del ISO string explícitamente para evitar timezone shift — correcto, pero cualquier futuro código que use `new Date(string)` directamente puede romper fechas en México (UTC-6) |
| RK-09 | 🟢 **Snapshot del score solo en carga de plan** | Bajo | Recovery Plan | El historial de score se registra cuando el usuario visita `/financial/recovery-plan`. Si nunca visita, no hay historial. Considerar snapshot automático mensual vía cron |
| RK-10 | 🟢 **Sin límite de usuarios** | Bajo | Admin | No hay cap visible en el número de usuarios que puede crear el ADMIN — en una app familiar esto es correcto, pero vale documentarlo |

---

## Resumen ejecutivo

| Categoría | Total ítems | 🔴 Críticos | 🟠 Altos |
|-----------|------------|------------|---------|
| Quick Wins | 8 | 2 | 2 |
| UX | 10 | 1 | 4 |
| UI | 10 | 0 | 3 |
| Analytics | 7 | 2 | 2 |
| Accesibilidad | 10 | 2 | 3 |
| Riesgos | 10 | 2 | 3 |
| **Total** | **55** | **9** | **17** |

### Orden de atención recomendado

1. **Sprint 1 — Estabilidad** (Quick Wins críticos + Riesgos críticos)  
   QW-01, QW-02, QW-03, RK-01, RK-02

2. **Sprint 2 — Accesibilidad base** (WCAG bloqueantes)  
   AC-01, AC-02, AC-05, AC-09

3. **Sprint 3 — Analytics** (instrumentación core)  
   AN-01, AN-02, AN-03, AN-04

4. **Sprint 4 — UX clave** (flujos incompletos)  
   UX-01 (UI importación), UX-02 (paginación), UX-04 (mark-paid desde tabla)

5. **Sprint 5 — UI y polish**  
   UI-01 (skeletons), UI-04 (animaciones), UI-05 (color picker)
