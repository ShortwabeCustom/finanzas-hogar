# 02 — Flujos Principales

---

## FLUJO 1: Login

**Trigger:** Usuario accede a cualquier URL protegida (middleware redirige a `/login`).

```
[/login]
  └─ 1. Usuario ve pantalla con degradado indigo-950→indigo-800
  └─ 2. Ve logo casa + "Finanzas del Hogar" + "Control financiero inteligente"
  └─ 3. Introduce email → validación Zod en cliente
  └─ 4. Introduce contraseña → validación Zod en cliente
  └─ 5. Submit → signIn("credentials", {redirect: false})
       ├─ [OK] → router.push("/dashboard") + router.refresh()
       └─ [Error] → banner rojo "Credenciales incorrectas. Verifica tu email y contraseña."
```

**Microcopy actual:**
- Label email: "Correo electrónico" · placeholder: "usuario@ejemplo.com"
- Label contraseña: "Contraseña" · placeholder: "••••••••"
- Botón: "Iniciar sesión" / "Iniciando sesión..." (loading)
- Error genérico: "Credenciales incorrectas. Verifica tu email y contraseña."

**Gaps detectados:**
- No hay enlace de "¿Olvidaste tu contraseña?"
- No hay registro de nuevos usuarios (es app privada, correcto por diseño)
- El estado de error no menciona qué campo falló → opcionalmente es intencional por seguridad

---

## FLUJO 2: Dashboard del Hogar

**Ruta:** `/dashboard`

```
[Carga inicial]
  └─ Spinner (w-10 h-10 border-4 indigo-200/indigo-600 rounded-full)
  └─ fetch("/api/dashboard?from=&to=&granularity=") → setData()

[Filtro de tiempo] (toolbar sticky superior)
  ├─ Por día     → input[type=date]
  ├─ Por semana  → input[type=week]
  ├─ Por mes     → input[type=month]
  ├─ Por año     → input[type=number] (default: año actual)
  └─ Rango       → 2x input[type=date] (desde / hasta)

[KPIs — 6 StatCards en grid 1→2→3→6 columnas]
  Total pagos · Pagado en periodo · Fondos disponibles
  Dinero recibido · Pagos pendientes · Pagos vencidos

[Gráfica de flujo — BarChart]
  Etiqueta dinámica: Flujo diario / semanal / mensual
  Bars: Gastado (#ef4444) vs Recibido (#06b6d4)

[Gastos por categoría — Treemap]
  Cada categoría = rectángulo de color indexado
  Label visible si width>90 && height>34

[Gastos por forma de pago — BarChart horizontal]
  Colores por método: CASH=#22c55e, CREDIT_CARD=#6366f1,
  DEBIT_CARD=#3b82f6, TRANSFER=#f59e0b, CHECK=#8b5cf6

[Próximos vencimientos — lista con urgencia]
  Verde → >5 días · Ámbar → 3-5 días · Rojo → ≤2 días
  Badge dinámico: "Hoy" / "Mañana" / "N días"

[Alertas de despensa — panel lateral]
  Stock bajo (bg-red-100) · Por caducar (bg-amber-100) · "Todo en orden ✓"

[Últimos pagos — tabla (desktop) / cards (mobile)]
  Columns: Folio · Nombre · Categoría (dot color) · Monto · Estado · Fecha
```

**Estado vacío:** `<p className="text-gray-400 text-sm text-center py-8">Sin datos</p>`

---

## FLUJO 3: Pagos del Hogar

**Ruta:** `/payments`

```
[Listado con filtros]
  ├─ Búsqueda por texto (nombre, folio)
  ├─ Filtro categoría (select)
  ├─ Filtro estado (PENDING/PAID/OVERDUE/CANCELLED)
  └─ Filtro forma de pago

[Acción primaria]
  Botón "+ Nuevo pago" → abre Sheet lateral

[Sheet: Crear/Editar pago]
  Campos: Nombre* · Concepto* · Monto* · Categoría* · Período
          Estado · Forma de pago · Tarjeta asociada (condicional)
          Fecha vencimiento · Fecha de pago
          Comprobante (drag-and-drop + click, JPG/PNG/PDF ≤5MB)
          Notas

[Validación en tiempo real]
  Zod schema → mensajes bajo cada campo en xs text-red-600

[Tabla desktop / Cards mobile]
  Columns: Folio · Nombre + Concepto · Categoría · Monto · Estado · Forma/Tarjeta · Vencimiento · Acciones (Editar/Eliminar)

[Eliminar]
  ConfirmDialog: "¿Eliminar el pago X? Esta acción no se puede deshacer."
  Botones: Cancelar / Eliminar (destructivo)

[Footer tabla]
  "N pagos — Total: $X,XXX.XX"
```

---

## FLUJO 4: Categorías

**Ruta:** `/categories`

```
[Grid de categorías con color dot]
  Cada categoría muestra: nombre, color, ícono asociado

[Crear categoría]
  Sheet → campos: Nombre · Color (color picker) · Ícono (selector)

[Editar / Eliminar]
  Inline en cada card — confirmar eliminación si tiene pagos asociados
```

*(La página actual no fue leída en detalle; inferida de la API y patrones del resto de módulos.)*

---

## FLUJO 5: Tarjetas y Cuentas Personales

**Ruta:** `/personal/cards`

```
[Grid de cards bancarias — 1→2→3→4 columnas]
  Cada card muestra:
    - Iniciales del banco con color corporativo (BBVA=#004990, Nu=#820ad1, etc.)
    - Badge tipo: Crédito (purple) / Débito (sky) / Cuenta bancaria (green)
    - •••• XXXX (últimos 4 dígitos, fuente monospace)
    - Para crédito: "Corte: Xº" (indigo) + "Límite pago: Xº" (green)
    - N pagos asociados
    - Hover: aparecen botones Desactivar/Editar/Eliminar

[Estado activo/inactivo]
  Tarjeta inactiva → opacity-60
  Toggle activo ↔ inactivo sin confirmación

[Crear medio de pago]
  Sheet → selección de tipo primero:
    CREDIT_CARD → muestra campos closingDay + dueDay
    DEBIT_CARD / BANK_ACCOUNT → oculta esos campos
  Banco: input con datalist (autocompletado de 12 bancos)

[Empty state]
  Ícono tarjeta + "Sin medios de pago registrados" + CTA "Agregar primer medio de pago"

[Relación con Pagos]
  Al eliminar tarjeta → mensaje: "Los pagos asociados perderán la referencia, pero no se eliminarán"
```

---

## FLUJO 6: Pagos Personales (CRUD + filtros)

**Ruta:** `/personal/payments`

```
[Filtros — 4 columnas en desktop, 1 en móvil]
  Búsqueda texto · Categoría · Estado · Forma de pago

[Tabla desktop]
  Folio (mono indigo) · Nombre+Concepto · Categoría (dot) · Monto
  Estado (StatusBadge) · Forma / Tarjeta asociada (•••• XXXX en indigo)
  Vencimiento · Acciones

[Cards mobile]
  Nombre + importe arriba · Categoría + estado + vencimiento debajo
  Folio izquierda · Editar/Eliminar derecha (íconos)

[Footer con totales]
  "N pagos — $X,XXX.XX"

[Nuevo pago — Sheet md]
  Mismos campos que /payments pero en contexto personal
  Campo especial: selector de tarjeta asociada (solo si método = CC/DC/Transferencia)
  Si no hay tarjetas: aviso contextual con link a /personal/cards

[Comprobante]
  Zona drag-and-drop + click
  Preview si imagen · PDF ícono rojo si .pdf
  Eliminar comprobante → botón X
  Límite: 5MB, formatos: JPG/PNG/PDF
```

---

## FLUJO 7: Estados de Cuenta Bancarios

**Ruta:** `/personal/statements`

```
[Layout split — 1/4 lista de períodos + 3/4 transacciones]

[Panel izquierdo: lista de períodos]
  Cada ítem: mes/año (capitalize) + Cargos (rojo) / Abonos (verde)
  Seleccionado: border-indigo-500 bg-indigo-50
  Al cambiar: resetea filtros y carga transacciones del período

[Panel derecho: 4 KPI mini-cards]
  Período · Transacciones · Total cargos (red) · Total abonos (green)

[Filtros]
  Input búsqueda descripción · Select: Todos / Solo cargos / Solo abonos
  Label cuenta: "[Banco] [Producto] •••• XXXX"

[Tabla desktop]
  Fecha · Descripción (truncate) · Referencia (mono indigo) · Cargo (red) · Abono (green) · Saldo

[Cards mobile]
  Descripción + fecha · Cargo/Abono alineado derecha
  Referencia en mono indigo debajo

[Footer tabla]
  "N movimientos — Total: −$X,XXX / +$X,XXX"

[Empty state principal]
  "Importa estados de cuenta para verlos aquí"
  (la importación real se realiza vía proceso interno/API)
```

---

## FLUJO 8: Importación de Documentos (Estados de Cuenta)

**Ruta:** `/api/internal/upload` + `/api/financial/sync`

```
[Proceso backend — sin UI directa visible en el código]
  1. Upload de PDF vía POST /api/internal/upload (autenticación interna)
  2. Parser extrae: cuenta, período, transacciones, saldos
  3. POST /api/financial/sync → sincroniza con base de datos
  4. Resultado visible en /personal/statements

[UI de feedback]
  Los estados de cuenta aparecen en el panel izquierdo de /personal/statements
  Si no hay datos: empty state con instrucción de importar

[Gaps UX]
  No hay UI de importación directa para el usuario final
  El proceso es manual/administrativo
  No hay indicador de progreso ni historial de importaciones visibles
```

---

## FLUJO 9: Plan de Recuperación Financiera

**Ruta:** `/financial/recovery-plan`

```
[Controles de análisis]
  Toggle: "Analizar últimos: 1 mes / 3 meses / 6 meses"
  Cambio → recarga automática del plan

[Score financiero — widget completo]
  Número 0-100 · Label (Crítico/Ajustado/Estable/Saludable) · Trend (↑↓→—)
  Barra de progreso coloreada
  Desglose: Flujo libre /40 · Deuda vencida /35 · Urgencia /25
  Badge de estado con dot de color

[Evolución del score — LineChart]
  Línea indigo · Dots coloreados por rango
  Bandas de fondo por rango (verde/azul/amarillo/naranja/rojo)
  Requiere ≥2 meses de datos; empty state si menos

[6 KPI Cards]
  Ingreso mensual prom. · Egreso mensual prom.
  Total vencido (red si >0) · Total pendiente (yellow)
  Flujo libre (red si negativo) · Capacidad de pago (indigo)

[Gráficas — 2 BarCharts en grid]
  Ingreso vs Egreso mensual (cyan vs orange)
  Deuda por urgencia: Vencido (red) / Pendiente (amber) / Próx. 7 días (purple)

[Proyección 3 meses — AreaChart]
  Área roja: deuda restante decreciente
  Área verde: pagos acumulados crecientes
  ReferenceLine al mes donde deuda = 0
  Mensaje: "Quedarías al corriente en N meses"

[Insights y alertas — grid 2 columnas]
  risk (⚠ rojo) · warning (! ámbar) · opportunity (↑ esmeralda) · info (i azul)
  Cada insight: título + mensaje + "→ Acción sugerida"

[Plan de pagos — tabla ordenable]
  Headers clicables: Prioridad · Monto · Fecha límite
  Badge de prioridad 1-5 (rojo→ámbar→amarillo)
  Acción recomendada: badge de color ("Pagar de inmediato" red / "Pagar esta semana" amber / "Programar pago" blue)
  Filas vencidas: fondo bg-red-50/50

[Marcar como pagado — CTA por fila]
  Botón esmeralda "✓ Marcar pagado" → ConfirmModal
  Modal muestra: nombre · monto · fecha límite · fecha de pago (hoy)
  Confirmar → PATCH /api/personal/payments/[id]/mark-paid → recarga plan

[Qué recortar — grid de sugerencias]
  Categoría · Gasto mensual · Reducción sugerida (−$X) · Razón
  Badge "Reducible" en esmeralda

[Empty state]
  "No hay información suficiente..." → invitación a registrar datos
```

---

## FLUJO 10: Consulta de Insights Financieros

**Integrado dentro del Plan de Recuperación (`/financial/recovery-plan`)**

```
[Tipos de insight generados por el backend]
  risk        → riesgo real (deuda alta, flujo negativo)
  warning     → advertencia (ratio deuda/ingreso elevado)
  opportunity → oportunidad (ahorro posible, capacidad libre)
  info        → información neutral (datos parciales, sugerencias)

[Estructura de cada insight]
  type · title · message · suggestedAction

[Visualización]
  Grid 2 columnas en desktop · 1 columna en mobile
  Borde coloreado + background suave + ícono en círculo blanco

[Interacción]
  Solo lectura — sin acciones directas desde el insight
  Acción sugerida en texto italic "→ texto"
```
