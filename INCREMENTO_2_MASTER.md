# INCREMENTO 2: UI Y COMPONENTES — PROMPT MASTER

**Fase:** Interfaz de usuario  
**Duración esperada:** 1 sesión  
**Commit esperado:** `feat(debts): add personal debts UI`  
**Estado previo:** APIs funcionales (Incremento 1 ✅)

---

## 🎯 OBJETIVO

Implementar la interfaz completa del módulo "Deudas y Préstamos" con:

1. **Listado** (`/personal/debts`) — tabla/cards con filtros y KPIs
2. **Detalle** (`/personal/debts/[id]`) — resumen, cuotas, historial, acciones
3. **Formularios** — crear, editar, registrar abono
4. **Sidebar** — agregar enlace en "Mis Finanzas"
5. **Responsive** — funcional desde 375px hasta desktop
6. **Accesibilidad** — WCAG 2.2 (labels, aria-*, focus)
7. **Interacción** — sheets laterales, diálogos, toasts

**No implementar aún:**
- Integración con Mis Pagos
- Integración con Estados de Cuenta
- Integración con Dashboard
- Analytics
- Tests automatizados

---

## 📐 ESTRUCTURA DE RUTAS Y COMPONENTES

### Rutas de Página

```
src/app/(app)/personal/debts/
├── page.tsx                    (Listado + KPIs)
└── [id]/
    └── page.tsx               (Detalle de deuda)
```

### Componentes Reutilizables

```
src/components/personal/debts/
├── DebtFormSheet.tsx          (Crear/editar en sheet)
├── DebtSummaryCards.tsx       (KPIs: saldo, progreso, etc.)
├── DebtListTable.tsx          (Tabla desktop)
├── DebtMobileCard.tsx         (Card individual mobile)
├── DebtProgress.tsx           (Barra de progreso)
├── DebtPaymentSheet.tsx       (Registrar abono)
├── DebtPaymentHistory.tsx     (Historial de pagos)
├── InstallmentTable.tsx       (Cuotas)
└── LinkTransactionModal.tsx   (Asociar movimiento)
```

---

## 🏠 MODIFICACIÓN AL SIDEBAR

**Archivo:** `src/components/layout/Sidebar.tsx`

**Cambio:**

Insertar en array `personalItems` (después de "Mis Pagos"):

```typescript
{
  href: "/personal/debts",
  label: "Deudas y préstamos",
  icon: (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
},
```

**Posición en array:** índice 2 (después de "Mis Pagos")

---

## 📄 PÁGINA: LISTADO (`/personal/debts`)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Header                                                 │
│  ├─ Título: "Deudas y préstamos"                       │
│  ├─ Descripción: "Controla lo que debes..."            │
│  └─ CTA: "+ Nueva deuda o préstamo"                    │
├─────────────────────────────────────────────────────────┤
│  KPIs (StatCard × 6)                                    │
│  ├─ Saldo por pagar                                    │
│  ├─ Saldo por cobrar                                   │
│  ├─ Pago mensual estimado                              │
│  ├─ Próximo vencimiento                                │
│  ├─ Cuotas vencidas                                    │
│  └─ Capital liquidado (año actual)                     │
├─────────────────────────────────────────────────────────┤
│  Tabs (3 pestañas)                                      │
│  ├─ Por pagar                                          │
│  ├─ Por cobrar                                         │
│  └─ Liquidadas                                         │
├─────────────────────────────────────────────────────────┤
│  Filtros + Búsqueda                                     │
│  ├─ Búsqueda por nombre/contraparte                    │
│  ├─ Filtro: Tipo                                       │
│  ├─ Filtro: Estado                                     │
│  ├─ Filtro: Próximo vencimiento (rango)                │
│  └─ Filtro: Tarjeta asociada                           │
├─────────────────────────────────────────────────────────┤
│  Contenido                                              │
│  ├─ Desktop: Tabla (TanStack Table)                    │
│  ├─ Mobile: Cards apiladas                             │
│  └─ Empty State (si sin registros)                     │
└─────────────────────────────────────────────────────────┘
```

### Header

```typescript
<Header
  title="Deudas y préstamos"
  description="Controla lo que debes, lo que te deben y cada pago realizado."
  action={{
    label: "+ Nueva deuda o préstamo",
    onClick: openDebtFormSheet,
  }}
/>
```

### KPIs (StatCard)

**Valores a obtener:** `GET /api/personal/debts/summary`

```
┌─────────────┬─────────────┬──────────────┐
│ Saldo por   │ Saldo por   │ Pago mensual │
│ pagar       │ cobrar      │ estimado     │
│ $45,000.50  │ $12,000.00  │ $3,500.00    │
└─────────────┴─────────────┴──────────────┘
┌─────────────┬──────────────┬──────────────┐
│ Próximo     │ Cuotas       │ Capital pagado
│ vencimiento │ vencidas     │ (año actual)
│ 15 de ago   │ 2            │ $18,500.00
└─────────────┴──────────────┴──────────────┘
```

**Colores:**
- Verde: StatCard background
- Indigo: valores
- Ámbar: si hay vencidas
- Gris: si cero

**Interacción:** Al clickear, navegar a `/personal/debts?tab=...` con filtro preseleccionado

### Tabs

Estados y conteo dinámico:
- **Por pagar** — direction=PAYABLE, status != PAID_OFF
- **Por cobrar** — direction=RECEIVABLE, status != PAID_OFF
- **Liquidadas** — status=PAID_OFF

### Filtros

**Desktop:** Row con inputs/selects
**Mobile:** Botón "Filtrar" → Modal o sheet

**Campos:**
1. Búsqueda (debounced)
2. Tipo (select multi o checkboxes)
3. Estado (select)
4. Próximo vencimiento (date range picker)
5. Tarjeta (select)
6. Botón "Limpiar filtros"

### Tabla (Desktop)

**Librería:** TanStack Table v8 (ya instalada)

**Columnas:**
1. **Nombre** — enlace a detalle
2. **Contraparte** — nombre o "—"
3. **Tipo** — PERSONAL_LOAN / CREDIT_CARD / etc. (badge)
4. **Monto original** — formateado MXN
5. **Saldo pendiente** — formateado MXN, color rojo si alto
6. **Próximo pago** — fecha formato dd/mm/yyyy
7. **Progreso** — barra (capital pagado %)
8. **Estado** — badge (ACTIVE/PAID_OFF/PAUSED/CANCELLED)
9. **Acciones** — menú (ver, editar, …)

**Sorting:** Por nombre, monto, fecha de próximo pago
**Paginación:** 10, 25, 50 por página

### Cards (Mobile 375px+)

Layout vertical apilado:

```
┌─────────────────────────────────┐
│ Tarjeta Azteca                  │
│ Saldo: $7,500.00 / $10,000.00   │
│ ████░░░░░░ 75%                  │
│ Próxima cuota: 15 ago            │
│ Estado: Activa                   │
│                                 │
│  [Ver →]                        │
└─────────────────────────────────┘
```

**Información mínima:**
- Nombre
- Saldo / Original
- Barra de progreso (%)
- Próximo pago
- Estado (badge)
- Botón "Ver"

### Empty States

**Sin registros:**
```
┌─────────────────────────────────┐
│                                 │
│  💰 (icono)                     │
│                                 │
│  Sin deudas ni préstamos        │
│  registrados                    │
│                                 │
│  Registra una obligación para   │
│  controlar su saldo, pagos y    │
│  próximas fechas.               │
│                                 │
│  [Registrar primera deuda]      │
│                                 │
└─────────────────────────────────┘
```

**Sin resultados por filtros:**
```
No hay resultados con los filtros actuales.
[Limpiar filtros]
```

---

## 📋 PÁGINA: DETALLE (`/personal/debts/[id]`)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Header + Acciones                                      │
│  ├─ Título: "Tarjeta Azteca"                           │
│  ├─ Contraparte: "Banco Azteca"                        │
│  ├─ Estado: Activa (badge)                             │
│  ├─ Tipo: Tarjeta de crédito                           │
│  └─ [Editar] [Más opciones ⋮]                          │
├─────────────────────────────────────────────────────────┤
│  Resumen (Cards de datos)                               │
│  ├─ Monto original / Saldo pendiente                    │
│  ├─ Capital pagado / Intereses / Comisiones            │
│  ├─ Próximo vencimiento                                │
│  └─ Barra de progreso grande                           │
├─────────────────────────────────────────────────────────┤
│  Sección 1: Calendario de Cuotas (si aplica)            │
│  ├─ Tabla: # / Fecha / Esperado / Pagado / Estado      │
│  └─ [Generar calendario] (si vacío)                    │
├─────────────────────────────────────────────────────────┤
│  Sección 2: Historial de Pagos                          │
│  ├─ Tabla: Fecha / Monto / Capital / Interés / …       │
│  ├─ [Registrar abono] (botón principal)                │
│  └─ [Editar] / [Eliminar] por fila                     │
├─────────────────────────────────────────────────────────┤
│  Sección 3: Acciones Secundarias                        │
│  ├─ Asociar movimiento bancario                        │
│  ├─ Pausar/Reactivar                                   │
│  └─ Cancelar/Archivar                                  │
└─────────────────────────────────────────────────────────┘
```

### Header

Mostrar:
- Nombre grande (h2)
- Contraparte pequeño (muted)
- Tipo (badge)
- Estado (badge colored)
- Menú "Más opciones" (⋮) con: Editar, Asociar, Pausar, Cancelar

### Resumen (Cards)

**Grid 2 columnas (responsive 1 mobile):**

**Card 1:**
- Monto original: $10,000.00
- Saldo pendiente: $7,500.00

**Card 2:**
- Capital pagado: $2,500.00
- Intereses pagados: $150.00

**Card 3:**
- Comisiones: $50.00
- Penalizaciones: $0.00

**Card 4:**
- Próximo vencimiento: 15 de agosto 2026
- (vacío si PAID_OFF)

**Barra de progreso grande:** Capital pagado / Monto original × 100 (verde)

### Calendario de Cuotas

**Si scheduleMode=FREE:**
```
┌─────────────────────────────┐
│  Esta deuda utiliza        │
│  seguimiento libre y no    │
│  tiene cuotas programadas. │
│                            │
│  [Generar calendario]      │
└─────────────────────────────┘
```

**Si scheduleMode=INSTALLMENTS:**

Tabla TanStack Table:
1. **#** — número secuencia
2. **Fecha** — date formato dd/mm/yyyy
3. **Monto esperado** — moneda
4. **Pagado** — moneda
5. **Saldo cuota** — expectedAmount - totalPaid
6. **Estado** — badge (PENDING/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED)

**Sorting:** Por número (default)

### Historial de Pagos

**Empty state:**
```
Aún no se han registrado abonos.
```

**Tabla TanStack Table:**
1. **Folio** — del PersonalPayment (enlace?)
2. **Fecha** — dd/mm/yyyy
3. **Monto total** — moneda, negrita
4. **Capital** — moneda (reduce saldo)
5. **Interés** — moneda
6. **Comisión** — moneda
7. **Penalización** — moneda
8. **Forma de pago** — badge (CASH/CREDIT_CARD/TRANSFER/…)
9. **Tarjeta** — nombre o "—"
10. **Origen** — badge (Manual / Bancario)
11. **Comprobante** — icono link (futuro)
12. **Acciones** — [Editar] [Eliminar]

**CTA Principal:** Botón grande "Registrar abono" flotante o en header

### Empty State Completo

Si sin cuotas Y sin pagos:
```
┌─────────────────────────────────────┐
│  Deuda registrada pero sin movimientos
│                                     │
│  [Registrar primer abono]           │
└─────────────────────────────────────┘
```

---

## 📝 FORMULARIOS (Sheets Laterales)

### Sheet 1: Crear/Editar Deuda (`DebtFormSheet.tsx`)

**Ancho:** 500px (desktop), 100% - 32px (mobile)
**Posición:** derecha
**Scroll:** contenido
**Close:** botón X, ESC, click fuera

**Primer campo (condicional):**

Si nuevo: "¿Qué deseas registrar?" (radio buttons)
- Una deuda que debo pagar
- Un préstamo que debo cobrar

Si editar: hidden (mantener dirección original)

**Campos (por orden):**

1. **Nombre** — text, requerido, ej. "Crédito Azteca"
2. **Contraparte** — text, opcional, ej. "Banco Azteca"
3. **Tipo** — select, requerido, opciones enum
4. **Monto original** — number, requerido, > 0
5. **Saldo actual** — number, requerido, ≤ monto original
6. **Fecha de inicio** — date picker, requerido
7. **Fecha estimada de liquidación** — date picker, opcional
8. **Tasa anual (opcional)** — number, ≥ 0, decimals
9. **Modalidad** — radio buttons
   - Seguimiento libre
   - Calendario de cuotas
10. **[Si calendario]** Frecuencia — select (MONTHLY, etc.)
11. **[Si calendario]** Monto esperado por cuota — number
12. **[Si calendario]** Número de cuotas (opcional) — number
13. **Tarjeta o cuenta asociada** — select (PersonalCards)
14. **Notas** — textarea, optional
15. **Documento/contrato** — file upload button (futuro)

**Validación:**
- Zod `debtFormSchema`
- mostrar errores under campos
- deshabilitar submit si inválido

**Footer:**
- Botón "Cancelar"
- Botón "Guardar" (spinning en submit)

---

### Sheet 2: Registrar Abono (`DebtPaymentSheet.tsx`)

**Ancho:** 500px
**Contenido:**

1. **Fecha de pago** — date picker, default today
2. **Capital** — number, requerido, ≤ saldo pendiente
3. **Interés** — number, default 0
4. **Comisión** — number, default 0
5. **Penalización** — number, default 0
6. **Total** — display (read-only, suma de arriba)
   - Si suma ≠ suma de inputs → error rojo "Desglose no cuadra"
7. **Cuota relacionada (opcional)** — select (DebtInstallments sin PAID)
8. **Forma de pago** — select, requerido
9. **Tarjeta o cuenta** — select (si forma=CREDIT_CARD|DEBIT_CARD|TRANSFER)
10. **Comprobante** — file upload (futuro)
11. **Notas** — textarea, optional

**Validación:**
- Zod `debtPaymentSchema`
- Invariante: capital + interés + comisión + penalización = total
- Mostrar error si no cuadra

**Footer:**
- [Cancelar] [Registrar abono]

---

### Sheet 3: Generar Cuotas (Modal/Sheet)

Simple form:
1. **Número de cuotas** — number, 1-360
2. **Primera fecha de pago** — date picker
3. **Frecuencia** — select (WEEKLY, MONTHLY, QUARTERLY, etc.)

[Cancelar] [Generar]

---

## 🎨 DISEÑO VISUAL

### Colores (reutilizar sistema actual)

- **Primario:** Indigo-700 (botones, links)
- **Éxito:** Verde-600 (progreso, estado PAID_OFF)
- **Alerta:** Ámbar-500 (próximo, parcial, OVERDUE)
- **Error:** Rojo-600 (vencido, DEFAULTED)
- **Neutral:** Gris-400/500 (cancelado, inactivo)

### Tipografía

- **Titles (h1/h2):** font-bold, text-2xl/xl
- **Subtítulos:** text-sm, text-gray-600
- **Valores:** font-semibold, text-lg/base
- **Labels:** text-sm, font-medium

### Componentes Reutilizables

**Badges (estado):**
```
ACTIVE → bg-green-100 text-green-800
PAID_OFF → bg-emerald-100 text-emerald-800
PAUSED → bg-amber-100 text-amber-800
CANCELLED → bg-gray-100 text-gray-800
DEFAULTED → bg-red-100 text-red-800
OVERDUE → bg-red-100 text-red-800
PENDING → bg-blue-100 text-blue-800
PARTIALLY_PAID → bg-amber-100 text-amber-800
PAID → bg-green-100 text-green-800
```

**Barra de progreso:**
- Altura: 8px
- Fondo: gray-200
- Relleno: green-600
- Valor mostrado: "75%"

**Cards (StatCard ya existe):**
- Reutilizar de componentes/ui/StatCard.tsx
- Icon + label + value

### Responsive

**Breakpoints (Tailwind):**
- sm (640px) — tablets
- md (768px) — tablets grandes
- lg (1024px) — desktop

**Cambios clave:**
- **375px:** mobile full (cards apiladas, fonts -2px)
- **768px:** table + desktop features
- **1024px+:** layout óptimo

**Mobile priorities:**
- Stacked layout
- Larger touch targets (min 44px)
- Simpler filters (modal vs. row)
- Cards en lugar de tablas

---

## ♿ ACCESIBILIDAD (WCAG 2.2)

### Labels y ARIA

Todos los inputs:
```tsx
<label htmlFor="debt-name">Nombre</label>
<input id="debt-name" ... />
```

Errores:
```tsx
<input aria-describedby="name-error" />
<span id="name-error" role="alert" className="text-red-600">
  Mínimo 2 caracteres
</span>
```

Sheets y modales:
```tsx
<dialog role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Registrar abono</h2>
</dialog>
```

Tablas:
```tsx
<th aria-sort="ascending">Fecha</th>
```

Botones de icono:
```tsx
<button aria-label="Más opciones">⋮</button>
```

### Focus

- Focus visible en todos los elementos interactivos
- Orden de tab lógico
- Trap de focus en sheets/modales
- ESC cierra overlays

### Animaciones

Respetar `prefers-reduced-motion`:
```tsx
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

No usar animaciones complejas si habilitado.

### Contraste

- Texto vs. fondo: mínimo WCAG AA (4.5:1 para body, 3:1 para large)
- Verificar con Chrome DevTools

---

## 🔄 INTEGRACIÓN CON APIs

### Fetch y Estado

Usar `fetch` + `useState` + `useEffect` (o SWR si disponible)

**Patrón:**
```typescript
const [debts, setDebts] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  fetch("/api/personal/debts")
    .then(r => r.json())
    .then(data => setDebts(data))
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
}, [/* deps */]);
```

**Estados de UI:**
- `loading` → skeleton o spinner
- `error` → ApiErrorState (component existente)
- `empty` → EmptyState custom
- `success` → mostrar datos

### Manejo de Errores

Usar `react-hot-toast` (ya instalado):
```typescript
toast.error("No se pudo registrar el abono");
toast.success("Deuda creada exitosamente");
```

Mapear códigos HTTP:
- 400 → "Datos inválidos: ..."
- 403 → "No tienes permisos"
- 404 → "Deuda no encontrada"
- 409 → mostrar mensaje específico
- 500 → "Error del servidor"

---

## 📱 RESPONSIVIDAD: PRUEBAS MÍNIMAS

**Desktop (1280px):**
- Tabla completa con 12 columnas
- Sidebar visible
- Widgets sin scroll horizontal

**Tablet (768px):**
- Tabla con scroll horizontal (overflow-x auto)
- Filters en modal
- Cards donde sea necesario

**Mobile (375px):**
- Todos cards apilados
- Fonts legibles (min 14px)
- Touch targets (min 44px)
- No overflow horizontal

---

## ✅ CRITERIOS DE ACEPTACIÓN

Implementación completada cuando:

1. ✅ Listado (`/personal/debts`) funcional con datos reales
2. ✅ Detalle (`/personal/debts/[id]`) muestra deuda completa
3. ✅ Crear deuda → abre sheet → crea en BD → actualiza listado
4. ✅ Editar deuda → precarga datos → actualiza en BD
5. ✅ Registrar abono → abre sheet → suma válida → crea pago → actualiza saldos
6. ✅ Editar/eliminar abono → recalcula saldos en BD
7. ✅ Generar calendario → crea cuotas en BD
8. ✅ Cuotas mostradas con estado correcto
9. ✅ Historial de pagos muestra desglose correcto
10. ✅ Sidebar muestra "Deudas y préstamos" en "Mis Finanzas"
11. ✅ Navegación entre listado y detalle funciona
12. ✅ Filtros aplican correctamente en listado
13. ✅ KPIs muestran valores de API summary
14. ✅ Empty states para sin registros y sin resultados
15. ✅ Responsive: funciona desde 375px hasta 1920px
16. ✅ Accesibilidad: labels, aria-*, focus trap en sheets
17. ✅ Sin errores TypeScript
18. ✅ Build de producción exitoso
19. ✅ Toasts de error y éxito funcionan
20. ✅ Menús y acciones secundarias operativas

---

## 📦 ARCHIVOS A CREAR

```
src/app/(app)/personal/debts/
├── page.tsx                             (Listado)
└── [id]/
    └── page.tsx                         (Detalle)

src/components/personal/debts/
├── DebtFormSheet.tsx                    (Crear/editar)
├── DebtSummaryCards.tsx                 (KPIs)
├── DebtListTable.tsx                    (Tabla desktop)
├── DebtMobileCard.tsx                   (Card mobile)
├── DebtProgress.tsx                     (Barra progreso)
├── DebtPaymentSheet.tsx                 (Registrar abono)
├── DebtPaymentHistory.tsx               (Historial pagos)
├── InstallmentTable.tsx                 (Cuotas)
└── LinkTransactionModal.tsx             (Asociar transacción)
```

---

## 📝 NOTAS IMPORTANTES

1. **No modificar APIs** — todas creadas en Incremento 1
2. **Reutilizar componentes** — Sheet, Modal, StatusBadge, StatCard, Header existentes
3. **Formateo consistente** — usar `formatCurrency()` y `formatDate()` de `src/lib/utils.ts`
4. **Períodos y enums** — importar PERIOD_LABELS, STATUS_LABELS, etc. de utils
5. **TanStack Table** — ya instalado, reutilizar pattern de otras tablas
6. **No instalar nuevas deps** — solo reutilizar ecosystem existente
7. **Commit único** — todo de UI en un solo `feat(debts): add personal debts UI`
8. **No hacer push** — esperar validación antes de enviar a origin

---

## 🚀 ORDEN RECOMENDADO

1. Crear página listado `/personal/debts/page.tsx` (structure basic)
2. Implementar DebtSummaryCards (mostrar KPIs)
3. Implementar DebtListTable (tabla con datos)
4. Implementar DebtMobileCard (cards responsive)
5. Implementar filtros y búsqueda
6. Implementar DebtFormSheet (crear/editar)
7. Crear página detalle `/personal/debts/[id]/page.tsx`
8. Implementar DebtPaymentHistory + acciones
9. Implementar InstallmentTable
10. Implementar DebtPaymentSheet
11. Agregar link en Sidebar
12. Testing responsivo (375px, 768px, 1280px)
13. Testing accesibilidad (labels, focus, aria)
14. Testing de flujos completos (crear → pagar → ver actualizado)
15. Build y verificación final

---

## 🔗 REFERENCIAS

- Documentación completa: `/docs/debts-loans.md`
- APIs: Incremento 1 ✅
- Componentes reutilizables:
  - `Sheet` — `src/components/ui/Sheet.tsx`
  - `Modal` — `src/components/ui/Modal.tsx`
  - `ConfirmDialog` — `src/components/ui/ConfirmDialog.tsx`
  - `StatusBadge` — `src/components/ui/StatusBadge.tsx`
  - `StatCard` — `src/components/ui/StatCard.tsx`
  - `SearchInput` — `src/components/ui/SearchInput.tsx`
  - `Header` — `src/components/layout/Header.tsx`
- Utilidades:
  - `formatCurrency()`, `formatDate()` — `src/lib/utils.ts`
  - Validación — `src/lib/validations/debt.ts`
  - Cálculos — `src/lib/financial/debt-calculations.ts`

---

**Fin del Prompt Master para Incremento 2**

Proceder con: `Actúa como un equipo senior compuesto por... [mismo equipo del Incremento 1] ... Implementa el Incremento 2...`
