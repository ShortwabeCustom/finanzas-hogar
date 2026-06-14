# 03 — Matriz de Módulos

> Cada módulo documentado con: usuario objetivo · problema que resuelve · datos usados · acción principal · estado vacío · error state · KPI de éxito.

---

## Módulo 1: Login

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Cualquier usuario registrado (ADMIN / EDITOR / VIEWER) |
| **Problema que resuelve** | Acceso seguro y privado a los datos financieros del hogar |
| **Datos usados** | email + password → NextAuth credentials provider |
| **Acción principal** | "Iniciar sesión" (submit del formulario) |
| **Estado vacío** | N/A — la pantalla de login es el estado inicial |
| **Error state** | Banner rojo: "Credenciales incorrectas. Verifica tu email y contraseña." |
| **KPI de éxito** | `login_success` (tasa de conversión del formulario; % de sesiones completadas) |

---

## Módulo 2: Dashboard Hogar (`/dashboard`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Admin / miembro del hogar que quiere una vista general rápida |
| **Problema que resuelve** | Entender el estado financiero del hogar de un vistazo, sin necesidad de revisar cada módulo |
| **Datos usados** | Todos los pagos del hogar · despensa · filtro de fecha flexible |
| **Acción principal** | Cambiar filtro de tiempo (selector de período) para explorar distintos rangos |
| **Estado vacío** | `"Sin datos"` por sección (gráficas) · `"No hay vencimientos próximos..."` · `"Todo en orden ✓"` |
| **Error state** | Spinner infinito si fetch falla sin catch (GAP: falta manejo de error de red) |
| **KPI de éxito** | `dashboard_view` · Tiempo promedio en página · Interacciones con filtro de tiempo |

---

## Módulo 3: Pagos del Hogar (`/payments`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Admin / Editor que registra gastos compartidos del hogar |
| **Problema que resuelve** | Centralizar todos los gastos del hogar con categorización, estado y comprobante |
| **Datos usados** | Pagos · categorías globales · tarjetas personales · comprobantes subidos |
| **Acción principal** | "+ Nuevo pago" → Sheet → guardar |
| **Estado vacío** | Ícono billete + "Sin pagos registrados" / "No hay resultados con los filtros actuales" |
| **Error state** | Banner rojo en Sheet: "Error al guardar" con botón Cerrar |
| **KPI de éxito** | `payment_created` · Tasa de completado del formulario · # pagos con comprobante |

---

## Módulo 4: Categorías (`/categories`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Admin que organiza el sistema de clasificación financiero |
| **Problema que resuelve** | Crear vocabulario compartido para clasificar gastos y visualizarlos en gráficas |
| **Datos usados** | Nombre + color + ícono de categoría · conteo de pagos asociados |
| **Acción principal** | Crear categoría con nombre y color |
| **Estado vacío** | Sin categorías = los selects en pagos estarán vacíos (GAP UX: sin guía) |
| **Error state** | Implícito (inferido del patrón: banner rojo + mensaje) |
| **KPI de éxito** | # categorías creadas · distribución de pagos por categoría |

---

## Módulo 5: Despensa (`/pantry`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Admin / miembro que gestiona inventario del hogar |
| **Problema que resuelve** | Prevenir agotamiento de productos y pérdida por caducidad |
| **Datos usados** | Items de despensa · cantidad · unidad · fecha de caducidad · historial de compras |
| **Acción principal** | Registrar producto / registrar compra |
| **Estado vacío** | `"Todo en orden ✓"` en el panel de alertas del dashboard |
| **Error state** | Inferido del patrón general |
| **KPI de éxito** | # alertas de stock bajo generadas · # productos por caducar atendidos |

---

## Módulo 6: Mis Tarjetas y Cuentas (`/personal/cards`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Individuo que quiere ligar sus medios de pago a sus pagos personales |
| **Problema que resuelve** | Tener trazabilidad de qué tarjeta pagó qué gasto; recordar fechas de corte/límite |
| **Datos usados** | bankName · cardName · last4Digits · paymentSourceType · closingDay · dueDay · active |
| **Acción principal** | "+ Agregar medio de pago" → Sheet |
| **Estado vacío** | "Sin medios de pago registrados" + ícono tarjeta + CTA primario |
| **Error state** | Banner rojo inline: "Error al guardar" / "Error al eliminar" |
| **KPI de éxito** | # tarjetas registradas · # pagos con tarjeta asociada |

---

## Módulo 7: Mis Pagos Personales (`/personal/payments`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Individuo que gestiona sus gastos personales separados del hogar |
| **Problema que resuelve** | Tener registro propio de deudas, suscripciones y pagos recurrentes personales |
| **Datos usados** | Pagos personales · categorías personales · tarjetas · comprobantes · período · estado |
| **Acción principal** | "+ Nuevo pago" → Sheet |
| **Estado vacío** | Ícono billete + "Sin pagos personales" / "Crea tu primer pago personal" |
| **Error state** | Banner rojo encima de tabla con botón "Cerrar" |
| **KPI de éxito** | `payment_created` · # pagos con comprobante adjunto · # pagos marcados pagados |

---

## Módulo 8: Estados de Cuenta (`/personal/statements`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Individuo que importa y revisa su estado de cuenta bancario (Santander Free Oro) |
| **Problema que resuelve** | Ver movimientos bancarios reales, comparar cargos vs abonos por período |
| **Datos usados** | BankStatement (período, saldos, totales) · BankTransaction (fecha, descripción, referencia, cargo, abono, saldo) |
| **Acción principal** | Seleccionar período en panel izquierdo + filtrar transacciones |
| **Estado vacío principal** | "Sin estados de cuenta" + "Importa estados de cuenta para verlos aquí" |
| **Estado vacío en transacciones** | "Sin movimientos con estos filtros" |
| **Error state** | Spinner infinito sin fallback (GAP) |
| **KPI de éxito** | `statement_import_success` · # períodos importados · # transacciones categorizadas |

---

## Módulo 9: Plan de Recuperación (`/financial/recovery-plan`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | Individuo con pagos vencidos o pendientes que quiere un plan de acción claro |
| **Problema que resuelve** | Priorizar qué pagar primero dado el flujo libre disponible; proyectar cuándo quedarás al corriente |
| **Datos usados** | Pagos personales (status, monto, vencimiento) · estados de cuenta (ingresos/egresos) · score financiero · snapshots históricos |
| **Acción principal** | "Marcar pagado" → ConfirmModal → PATCH mark-paid |
| **Estado vacío** | "No hay información suficiente..." + guía para registrar datos |
| **Error state** | Banner rojo + botón "Reintentar" (fetch con .catch capturado) |
| **KPI de éxito** | `recovery_plan_viewed` · `payment_marked_paid` · mejora de score mes a mes · # insights consultados |

---

## Módulo 10: Usuarios (`/users`)

| Campo | Detalle |
|-------|---------|
| **Usuario objetivo** | ADMIN del sistema |
| **Problema que resuelve** | Controlar quién tiene acceso a la plataforma y con qué permisos |
| **Datos usados** | name · email · role (ADMIN/EDITOR/VIEWER) · createdAt |
| **Acción principal** | Crear / editar usuario con asignación de rol |
| **Estado vacío** | Sin usuarios registrados (improbable en uso real) |
| **Error state** | Inferido del patrón |
| **KPI de éxito** | # usuarios activos · distribución de roles |

---

## Resumen de patrones UX transversales

| Patrón | Implementación actual |
|--------|----------------------|
| **Carga** | Spinner circular indigo `animate-spin` centrado |
| **Acciones CRUD** | Sheet lateral para crear/editar; ConfirmDialog modal para eliminar |
| **Vacío** | Ícono SVG gris + mensaje + CTA cuando es el primer ítem |
| **Error inline** | Banner rojo `bg-red-50 border-red-200` con botón "Cerrar" |
| **Tabla responsive** | `hidden sm:block` (desktop) + `sm:hidden` (mobile cards) |
| **Validación** | Zod en cliente + React Hook Form; mensajes bajo cada campo en `xs text-red-600` |
| **Confirmación destructiva** | ConfirmDialog con texto claro de consecuencia + botón destructivo |
| **Totales en tabla** | `<tfoot>` con suma de monto + conteo de registros |
