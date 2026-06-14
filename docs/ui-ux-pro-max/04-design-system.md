# 04 — Design System Financiero

> Documentación del sistema de diseño real extraído del código fuente + propuesta de tokens semánticos estandarizados.

---

## 1. Tokens de Color Semántico

### Paleta base (Tailwind/CSS)

| Token semántico | Color actual | Tailwind class | Hex | Uso |
|----------------|--------------|----------------|-----|-----|
| `brand-primary` | Indigo 600 | `indigo-600` | `#4f46e5` | Botón primario, active nav, spinner |
| `brand-dark` | Indigo 900 | `indigo-900` | `#1e1b4b` | Sidebar background |
| `brand-medium` | Indigo 700 | `indigo-700` | `#3730a3` | Nav activo, hover |
| `brand-light` | Indigo 100 | `indigo-100` | `#e0e7ff` | Icon background KPI |
| `brand-accent` | Indigo 400 | `indigo-400` | `#818cf8` | Logo/avatar background |
| `surface-card` | White | `white` | `#ffffff` | Cards, modales |
| `surface-muted` | Gray 50 | `gray-50` | `#f9fafb` | Table headers, fondos sutiles |
| `border-default` | Gray 100–200 | `gray-100/200` | — | Bordes de cards y filas |
| `text-primary` | Gray 900 | `gray-900` | `#111827` | Títulos, valores principales |
| `text-secondary` | Gray 500 | `gray-500` | `#6b7280` | Subtítulos, metadatos |
| `text-muted` | Gray 400 | `gray-400` | `#9ca3af` | Placeholders, hints |

### Colores de estado financiero

| Estado | Label UI | Background | Text | Border | Dot | Uso |
|--------|----------|-----------|------|--------|-----|-----|
| `PAID` | Pagado | `green-100` | `green-800` | — | `green-500` | StatusBadge, confirmaciones |
| `PENDING` | Pendiente | `yellow-100` | `yellow-800` | — | `yellow-500` | StatusBadge, alertas suaves |
| `OVERDUE` | Vencido | `red-100` | `red-800` | `red-200` | `red-500` | StatusBadge, filas destacadas |
| `CANCELLED` | Cancelado | `gray-100` | `gray-600` | — | `gray-400` | StatusBadge |

### Colores de riesgo financiero

| Estado | Score | Background | Text | Dot |
|--------|-------|-----------|------|-----|
| `critical` | < 25 | `red-100` | `red-800` | `red-500` |
| `tight` | 25–44 | `amber-100` | `amber-800` | `amber-500` |
| `stable` | 45–64 | `blue-100` | `blue-800` | `blue-500` |
| `healthy` | ≥ 65 | `green-100` | `green-800` | `green-500` |
| `unknown` | — | `gray-100` | `gray-600` | `gray-400` |

### Colores de urgencia de vencimientos

| Días restantes | Colores |
|----------------|---------|
| ≤ 2 días | bg-red-50 · border-red-100 · dot-red-400 · badge-red-100/700 · date-red-700 |
| 3–5 días | bg-amber-50 · border-amber-100 · dot-amber-400 · badge-amber-100/700 · date-amber-700 |
| > 5 días | bg-green-50 · border-green-100 · dot-green-400 · badge-green-100/700 · date-green-700 |

### Colores de forma de pago (charts)

| Método | Color | Hex |
|--------|-------|-----|
| CASH | `#22c55e` | Verde |
| CREDIT_CARD | `#6366f1` | Indigo |
| DEBIT_CARD | `#3b82f6` | Azul |
| TRANSFER | `#f59e0b` | Ámbar |
| CHECK | `#8b5cf6` | Violeta |
| OTHER | `#94a3b8` | Gris azulado |

---

## 2. Tipografía

| Nivel | Elemento | Clase Tailwind | Tamaño | Peso | Uso |
|-------|----------|----------------|--------|------|-----|
| H1 | Título de página | `text-2xl font-bold text-gray-900` | 24px | 700 | Títulos de sección |
| H2 | Subtítulo de card | `text-base font-semibold text-gray-900` | 16px | 600 | Headers de charts, secciones |
| H2 lg | Sección plan | `text-lg font-semibold text-gray-900` | 18px | 600 | Secciones del plan de recuperación |
| Label | Etiqueta de campo | `text-sm font-medium text-gray-700` (`.label`) | 14px | 500 | Labels de formulario |
| Body | Texto de datos | `text-sm text-gray-900` | 14px | 400 | Contenido de tabla |
| Meta | Metadatos | `text-xs text-gray-500` | 12px | 400 | Subtítulos, folio, fechas |
| Folio | Código referencia | `font-mono text-xs text-indigo-700` | 12px | 400 | Folios PAG-AAMM-XXXX |
| KPI valor | Número principal | `text-2xl font-bold text-gray-900` | 24px | 700 | StatCard valor |
| Score | Score 0-100 | `text-4xl font-black tabular-nums` | 36px | 900 | Score financiero |

---

## 3. Componentes UI documentados

### StatCard
```
Superficie: white card (shadow, rounded-xl)
Layout: flex row — contenido izquierda + ícono derecha
  Contenido: label (sm/500/gray-500) + valor (2xl/bold/gray-900) + subtitle (sm/gray-500) + trend (xs/green-600 o red-600)
  Ícono: p-3 rounded-xl con iconBg (bg-indigo-100 default)
Tamaño: variable según grid (xl:w-auto)
```

### StatusBadge
```
Base: rounded-full px-2.5 py-0.5 text-xs font-medium
PAID:      bg-green-100  text-green-800
PENDING:   bg-yellow-100 text-yellow-800
OVERDUE:   bg-red-100    text-red-800
CANCELLED: bg-gray-100   text-gray-600
```

### Sheet (drawer lateral)
```
Posición: fixed right-0, z-50, slide desde derecha
Tamaño: sm=max-w-md, md=max-w-lg (prop size)
Overlay: bg-black/50 backdrop
Header: título + botón X
Body: scrollable overflow-y-auto max-h-[75vh]
```

### ConfirmDialog
```
Modal centrado: max-w-md p-6
Ícono de advertencia (rojo) + título + mensaje descriptivo
Botones: Cancelar (btn-secondary) + Acción destructiva (rojo)
Loading: botón deshabilitado con spinner
```

### Formulario de pago
```
Grid 2 columnas (1 en móvil)
Campos full-width: Nombre, Concepto, Tarjeta asociada, Fechas, Comprobante, Notas
Campos half-width: Monto, Categoría, Período, Estado, Forma de pago
Validación inline bajo cada campo (xs text-red-600)
Footer: Cancelar · Limpiar campos · Guardar/Actualizar
```

### Zona de comprobante (drag & drop)
```
Estado vacío: border-dashed border-2 border-gray-200 bg-gray-50
  Hover: border-indigo-300 bg-indigo-50/40
  DragOver: border-indigo-400 bg-indigo-50
  Uploading: spinner indigo + "Subiendo..."
Estado con archivo:
  Imagen: miniatura 40x40 + nombre + link target="_blank" + botón X
  PDF: ícono rojo + nombre + link + botón X
Error: xs text-red-600 debajo de la zona
```

---

## 4. Cards de módulos financieros

### Card bancaria (Mis Tarjetas)
```
p-5 card rounded-xl
  Header: logo circular (color banco) + banco/nombre + badge tipo
  Body: •••• XXXX en fuente mono bold lg tracking-widest sobre bg-gray-50
  Para crédito: grid 2 cols — Corte (indigo) + Límite pago (green)
  Footer: "N pagos asociados" + botones de acción (visible en hover)
  Inactiva: opacity-60
```

### Card de período (Estados de cuenta)
```
w-full rounded-xl border px-4 py-3
  Seleccionado: border-indigo-500 bg-indigo-50 shadow-sm
  Normal: border-gray-200 hover:border-indigo-300
  Mes/año capitalize en semibold
  Cargos ↑ en rojo · Abonos ↓ en verde
```

### Insight card (Plan de recuperación)
```
card p-5 border [color border] [color bg]
  Ícono en círculo blanco w-7 h-7 shadow-sm (⚠/!/↑/i)
  Título semibold con color del tipo
  Mensaje en texto gray-700
  Acción italic en gray-500 con "→"
```

---

## 5. Charts (Recharts)

### BarChart - Flujo mensual
```
Bars: Gastado (#ef4444 rojo) + Recibido (#06b6d4 cyan)
XAxis: label mes/semana/día · YAxis: `$Xk` formatter
CartesianGrid: strokeDasharray="3 3"
Tooltip: formatCurrency
radius: [4,4,0,0]
```

### Treemap - Gastos por categoría
```
Custom content: rect + text label (si width>90 && height>34)
Colores: paleta indexada de 20 colores + hash por nombre como fallback
Stroke: #ffffff 2px entre celdas
Label: text white 12px bold
```

### BarChart horizontal - Por forma de pago
```
layout="vertical" · Cell por método con color específico
YAxis width=120 · XAxis: `$Xk` formatter
radius: [0,4,4,0]
```

### AreaChart - Proyección deuda
```
2 áreas: remainingDebt (rojo degradado) + cumulativePaid (verde degradado)
gradients: linearGradient x1=0 y1=0 x2=0 y2=1
ReferenceLine vertical cuando deuda=0 (verde punteado)
Dots coloreados en cada punto
```

### LineChart - Evolución score
```
Línea indigo #6366f1 strokeWidth=2.5
Dots: ScoreDot componente custom coloreado por rango
ReferenceAreas: 5 bandas por rango (verde/azul/amarillo/naranja/rojo)
Domain Y: [0, 100] · XAxis: mes abreviado + año 2 dígitos
```

### BarChart - Ingreso vs Egreso / Deuda por urgencia
```
barSize=56 (overview) · barSize=44 (deuda)
Cell individual por barra con color fijo
radius: [6,6,0,0]
```

---

## 6. Badges de prioridad (Plan de recuperación)

| Prioridad | BG | Text |
|-----------|-----|------|
| 1 | `bg-red-600` | `text-white` |
| 2 | `bg-red-500` | `text-white` |
| 3 | `bg-amber-500` | `text-white` |
| 4 | `bg-amber-400` | `text-white` |
| 5 | `bg-yellow-400` | `text-gray-900` |

---

## 7. Empty States

| Módulo | Ícono SVG | Título | Subtítulo | CTA |
|--------|-----------|--------|-----------|-----|
| Pagos (sin resultados) | Billete strokeWidth=1.5 | "Sin pagos registrados" | "Crea tu primer pago" | "+ Nuevo pago" |
| Pagos (con filtros) | Billete | "Sin pagos" | "No hay resultados con los filtros actuales" | — |
| Tarjetas | Tarjeta strokeWidth=1.5 | "Sin medios de pago registrados" | "Registra tus tarjetas..." | "+ Agregar primer medio de pago" |
| Estados de cuenta | Documento strokeWidth=1.5 | "Sin estados de cuenta" | "Importa estados de cuenta para verlos aquí" | — |
| Plan recuperación | Barras documento | — | "No hay información suficiente..." | — |
| Transacciones | — | — | "Sin movimientos con estos filtros" | — |
| Despensa alertas | — | — | "Todo en orden ✓" | — |
| Vencimientos dashboard | — | — | "No hay vencimientos próximos en los siguientes 15 días" | — |

---

## 8. Toasts y notificaciones en línea

La app actual **no usa un sistema de toast/snackbar**. Los mensajes de feedback son:

| Tipo | Implementación |
|------|----------------|
| Error global | Banner `bg-red-50 border-red-200` sobre la tabla con botón Cerrar |
| Error de campo | `<p className="text-xs text-red-600">` bajo cada input |
| Éxito inline | `<span className="text-xs text-emerald-600 animate-pulse">✓ Pago marcado como pagado</span>` |
| Advertencia contextual | Card ámbar con ícono info dentro de formulario |

**Propuesta:** Implementar un sistema de toast con posicionamiento top-right para feedback de acciones CRUD (éxito/error), sin bloquear la UI.

---

## 9. Responsive behavior

| Breakpoint | Comportamiento |
|------------|----------------|
| `< sm (< 640px)` | Sidebar oculto (overlay), KPI grid 1col, cards en lugar de tabla, filtros 1col |
| `sm (≥ 640px)` | Tabla desktop aparece, filtros 2col |
| `md (≥ 768px)` | Sidebar visible colapsable, header con hamburguesa desaparece |
| `lg (≥ 1024px)` | KPI grid 3col, charts lado a lado (grid-cols-2), split panel statements |
| `xl (≥ 1280px)` | KPI grid 6col (dashboard y recovery plan) |

---

## 10. Formularios — Campos estándar

Todos los formularios usan la clase `.input` y `.label` (definidas globalmente en CSS):

```css
/* Inferidas del uso en el código */
.label  → text-sm font-medium text-gray-700 block mb-1
.input  → border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent
.card   → bg-white rounded-xl shadow-sm border border-gray-100
.btn-primary   → bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700
.btn-secondary → border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50
```
