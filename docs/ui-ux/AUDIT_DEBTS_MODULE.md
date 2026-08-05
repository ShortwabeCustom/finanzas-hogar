# Auditoría Módulo Deudas y Préstamos

**Fecha:** 2026-08-05  
**Sesión:** Iteración de Mejora UX/Accesibilidad  
**Estado:** 🔄 EN PROGRESO

---

## 📋 Diagnóstico Ejecutivo

| Área | Problema | Severidad | Fuente |
|------|----------|-----------|--------|
| **Filtros** | Solapamiento visual en móvil/tablet | 🔴 ALTA | `page.tsx:221` |
| **Etiquetas** | Enums técnicos expuestos al usuario | 🔴 ALTA | Múltiples componentes |
| **Progreso** | Color verde en cualquier progreso | 🔴 ALTA | `DebtProgress.tsx:20` |
| **Current Principal** | Inconsistencia: $0 pagado pero 100% completo | 🔴 ALTA | Data/Cálculo |
| **Formularios** | Errores Zod JSON sin traducción | 🔴 ALTA | `DebtFormSheet.tsx:136` |
| **Comprobante** | Campo de subida faltante en abonos | 🟡 MEDIA | `DebtPaymentSheet.tsx` |
| **Accesibilidad** | Faltan aria-labels y focus states | 🟡 MEDIA | Múltiples componentes |
| **Responsive** | Tabla sin fallback para móvil | 🟡 MEDIA | `DebtListTable.tsx` |

---

## 1️⃣ Filtros Superpuestos (Línea 221)

### 🔍 Causa Raíz
```tsx
// PROBLEMA: 4 columnas en lg causará colapso
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
  <SearchInput ... />
  <select ... /> {/* "Todos los estados" */}
</div>
```

**En breakpoint `lg` (1024px):**
- Contenedor tiene 4 columnas
- SearchInput: 1 columna (flexible)
- Select: 1 columna
- Quedan 2 vacías
- Si SearchInput es `w-full`, invade al select

### ✅ Solución
Usar grid explícito con `minmax()`:
```tsx
<div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_auto] gap-3">
  <SearchInput className="min-w-0" /> {/* Input flexible */}
  <select className="w-full" />          {/* Select fijo */}
  {showClearBtn && <button />}            {/* Clear opcional */}
</div>
```

### 📍 Archivos Afectados
- `src/app/(app)/personal/debts/page.tsx`

---

## 2️⃣ Falta Diccionario de Etiquetas

### 🔍 Ubicaciones Técnicas
```tsx
// PROBLEMA: Expone enums como "PERSONAL_LOAN" al usuario
<span>{debt.type}</span>

// Solución: Usar mapa centralizado
<span>{DEBT_TYPE_LABELS[debt.type]}</span>
```

### 📦 Enums Faltantes o Distribuidos
| Enum | Ubicación Actual | Solución |
|------|------------------|----------|
| `DebtType` | `DebtListTable.tsx:29` | Centralizar |
| `DebtStatus` | `DebtListTable.tsx:48` | Centralizar |
| `DebtDirection` | **FALTA** | Crear |
| `DebtScheduleMode` | **FALTA** | Crear |
| `DebtInstallmentStatus` | **FALTA** | Crear |

### ✅ Solución
Crear `src/lib/financial/debt-labels.ts` con:
- `DEBT_TYPE_LABELS`
- `STATUS_LABELS`
- `DIRECTION_LABELS`
- `SCHEDULE_MODE_LABELS`
- `INSTALLMENT_STATUS_LABELS`

### 📍 Archivos Afectados
- `src/app/(app)/personal/debts/page.tsx:176`
- `src/components/personal/debts/DebtListTable.tsx:94`
- `src/components/personal/debts/DebtPaymentHistory.tsx`
- `src/components/personal/debts/InstallmentTable.tsx`

---

## 3️⃣ Color del Progreso Incorrecto

### 🔍 Causa Raíz
```tsx
// PROBLEMA: Siempre usa emerald-600 (verde)
<div className="bg-emerald-600 h-full ..." />
```

**Regla Financiera:**
- **0%:** Gris (sin progreso)
- **1-99%:** Indigo (en progreso)
- **100%:** Verde (completado)

### ✅ Solución
```tsx
const getProgressColor = (progress: number): string => {
  if (progress === 0) return "bg-gray-300";
  if (progress === 100) return "bg-emerald-600";
  return "bg-indigo-600";
};
```

**Nota:** No usar verde para $0 pagado, aunque el porcentaje sea erróneo.

### 📍 Archivos Afectados
- `src/components/personal/debts/DebtProgress.tsx:20`

### 🧪 Casos de Prueba
```
Deuda: $18,359 original, $0 pagado
✓ Progreso: 0%
✓ Color: Gris
✗ NO verde (aunque status sea PAID_OFF)
```

---

## 4️⃣ Inconsistencia de currentPrincipal

### 🔍 Síntoma
Captura muestra:
```
Monto original:    $18,359.00
Capital pagado:    $0.00
Saldo pendiente:   $0.00  ← ¡INCONSISTENTE!
Progreso:          100%   ← ¡INCONSISTENTE!
```

### 🔎 Investigación Requerida
1. **Creación de deuda:**
   - ¿Se inicializa `currentPrincipal = originalPrincipal`?
   - ¿O se asigna como NULL y causa cálculo erróneo?

2. **Serialización Decimal → number:**
   - ¿`.toNumber()` se llama correctamente?
   - ¿Hay pérdida de precisión?

3. **Cálculo del progreso:**
   - Fórmula: `principalPaid / originalPrincipal * 100`
   - Si `principalPaid = 0`, ¿por qué resultado es 100?

4. **Resumen de API:**
   - ¿El endpoint `/api/personal/debts/summary` calcula correctamente?

### ✅ Solución Temporal (UI)
Mientras se corrige backend:
```tsx
// NO mostrar 100% si principalPaid === 0
if (principalPaid === 0 && originalPrincipal > 0) {
  progress = 0; // Forzar 0%
  color = "bg-gray-300";
}
```

### 🚨 Escalamiento Backend
**Crear:** `docs/backend/BACKEND_HANDOFF_DEBTS.md`

Incluir:
1. Consulta de diagnóstico (SQL o Prisma)
2. Registros afectados
3. Estrategia de corrección
4. Script de migración (si aplica)

### 📍 Archivos Afectados
- `src/components/personal/debts/DebtProgress.tsx`
- `src/app/(app)/personal/debts/[id]/page.tsx`
- Backend: API response

---

## 5️⃣ Errores Zod Técnicos en Formularios

### 🔍 Causa Raíz
```tsx
// PROBLEMA: Zod arroja JSON técnico al usuario
try {
  const validData = debtFormSchema.parse(payload);
} catch (err) {
  // Error contiene estructura Zod completa
  const zodError = err as any;
  zodError.errors?.forEach((e: any) => {
    newErrors[e.path[0]] = e.message; // Ej: "Fecha inválida"
  });
}
```

### 📍 Ubicaciones
- `src/components/personal/debts/DebtFormSheet.tsx:136`
- `src/components/personal/debts/DebtPaymentSheet.tsx:131`

### ⚠️ Problema Específico: Fechas
```tsx
// DebtFormSheet.tsx:94
startDate: data.startDate  // Valor: "2026-08-04"

// Schema valida:
startDate: z.string().date("Fecha inválida")

// Si formato es incorrecto → error genérico
// Usuario no sabe qué corregir
```

### ✅ Solución
1. **Helper para fechas:**
```tsx
// src/lib/forms/date-helpers.ts
export const toDateInputValue = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  // Si es string ISO, retornar yyyy-MM-dd
  return String(value).split("T")[0];
};

export const fromDateInputValue = (value: string): string | null => {
  if (!value) return null;
  // Validar formato yyyy-MM-dd
  const match = value.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? value : null;
};
```

2. **Mensajes de usuario:**
```tsx
// NO: "Fecha inválida"
// SÍ: "Ingresa una fecha válida en formato DD/MM/YYYY"
```

3. **Scroll y focus:**
```tsx
// Al error, scroll al primer campo problemático
const firstError = Object.keys(errors)[0];
const element = document.getElementById(firstError);
element?.scrollIntoView({ behavior: "smooth", block: "center" });
element?.focus();
```

### 🧪 Caso de Prueba
```
1. Crear deuda
2. Seleccionar startDate actual
3. Guardar
4. Editar deuda
5. Verificar: startDate aparece correctamente en input[type="date"]
6. NO debe mostrar error Zod JSON
```

---

## 6️⃣ Comprobante Faltante en Abonos

### 🔍 Estado Actual
- `DebtPaymentSheet.tsx` no tiene campo de comprobante
- PersonalPayment puede tener URL de comprobante
- Pero DebtPayment no lo vincula

### 📦 Componentes Existentes a Reutilizar
1. **Upload:** `/api/upload` (existe)
2. **Validación:** Zod schema (existente)
3. **UI:** Componente de drag-drop (verificar si existe)

### ✅ Solución
1. **Agregar campo opcional al schema:**
```tsx
// src/lib/validations/debt.ts
export const debtPaymentSchema = z.object({
  // ... campos existentes
  receiptUrl: z.string().url("URL inválida").optional().nullable(),
});
```

2. **UI en DebtPaymentSheet:**
```tsx
{/* Comprobante (opcional) */}
<div>
  <label>Comprobante (opcional)</label>
  <FileUpload
    onUpload={(url) => setFormData(prev => ({ ...prev, receiptUrl: url }))}
    maxSize={5 * 1024 * 1024} // 5 MB
    accept=".pdf,.jpg,.jpeg,.png"
  />
</div>
```

3. **Persistencia:**
   - DebtPayment → PersonalPayment.receipt (si existe campo)
   - O crear campo nuevo en DebtPayment

### 📍 Archivos Afectados
- `src/components/personal/debts/DebtPaymentSheet.tsx`
- `src/lib/validations/debt.ts`
- API endpoint `/api/personal/debts/[id]/payments` (POST)

### 🧪 Caso de Prueba
```
1. Registrar abono
2. Adjuntar PDF/JPG válido
3. Verificar subida completa
4. Guardar abono
5. Verificar: Comprobante aparece en historial con "Ver" link
6. Intentar subir archivo > 5 MB → Bloquear con mensaje claro
```

---

## 7️⃣ Accesibilidad

### 🔍 Problemas Encontrados

| Elemento | Problema | Solución |
|----------|----------|----------|
| Botones solo icono | Sin aria-label | Agregar `aria-label="Más opciones"` |
| Filtro de estado | Sin label | Vincular con `<label htmlFor>` |
| Barra de progreso | Sin role | Agregar `role="progressbar"` + aria-* |
| Errores de formulario | Sin aria-live | Agregar `role="alert"` |
| Select/Input | Sin aria-describedby | Enlazar con error text |
| Tabla sin mobile | Scroll oculto | Agregar hint: "Desliza horizontalmente" |

### ✅ Implementación

```tsx
// Progreso con accessibility
<div
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={progress}
  aria-label={`Progreso de pago: ${progress}%`}
  className="w-full bg-gray-200 rounded-full h-3"
>
  <div
    className={`h-full rounded-full transition-all ${getProgressColor(progress)}`}
    style={{ width: `${progress}%` }}
  />
</div>
```

### 📍 Archivos Afectados
- Todos los componentes de deudas
- Especialmente filtros y tablas

---

## 8️⃣ Responsive Móvil

### 🔍 Problema
Tabla en `DebtListTable.tsx` oculta en móvil con `hidden md:block`.
No hay fallback visual para pantallas < 768px.

### ✅ Solución
Agregar `DebtMobileCard` o view alternativa con:
- Nombre (link)
- Contraparte
- Tipo (badge)
- Saldo (moneda)
- Progreso (barra)
- Acción (link "Ver")

### 📍 Archivos Afectados
- `src/components/personal/debts/DebtMobileCard.tsx` (ya existe, verificar)
- `src/app/(app)/personal/debts/page.tsx:298`

---

## 📊 Matriz de Dependencias

```
┌─────────────────────────────────────────┐
│ 1. Diccionario de Etiquetas (debt-labels.ts)
│    ↓
├─→ DebtListTable (usar labels)
├─→ DebtProgress (usar labels)
├─→ DebtFormSheet (usar labels)
├─→ InstallmentTable (usar labels)
└─→ DebtPaymentHistory (usar labels)

┌─────────────────────────────────────────┐
│ 2. Color Progreso Correcto
│    (DebtProgress.tsx)
│    ↓
├─→ DebtListTable (usar colores correctos)
└─→ Detalle de deuda (mostrar colores)

┌─────────────────────────────────────────┐
│ 3. Arreglar Filtros (page.tsx:221)
│    Cambiar grid a [minmax(0,1fr)_220px_auto]

┌─────────────────────────────────────────┐
│ 4. Backend Handoff
│    Investigar currentPrincipal inconsistencia
│    (BLOQUEADOR para validación datos)

┌─────────────────────────────────────────┐
│ 5. Helpers de Fechas (date-helpers.ts)
│    ↓
├─→ DebtFormSheet (uso en input[type="date"])
└─→ DebtPaymentSheet (uso en input[type="date"])

┌─────────────────────────────────────────┐
│ 6. Comprobante en Abonos
│    DebtPaymentSheet + validations/debt.ts
│    ↓
└─→ Mostrar en DebtPaymentHistory

┌─────────────────────────────────────────┐
│ 7. Accesibilidad (múltiples componentes)
│    Aplicar después de cambios principales
```

---

## 🎯 Plan de Implementación

### **Fase 1: Fundación (Sin Regresión)**
- [ ] Crear `debt-labels.ts` (diccionario centralizado)
- [ ] Crear `date-helpers.ts` (manejo de fechas)
- [ ] Reemplazar enums técnicos en todos los componentes

### **Fase 2: Correcciones Críticas**
- [ ] Arreglar filtros (grid layout)
- [ ] Arreglar color progreso (0%, 1-99%, 100%)
- [ ] Mejorar manejo de errores Zod (mensajes amigos)

### **Fase 3: Mejoras UX**
- [ ] Agregar comprobante a abonos
- [ ] Mejorar accesibilidad (aria-labels, focus)
- [ ] Optimizar responsive (revisar mobile card)

### **Fase 4: Validación**
- [ ] Tests unitarios de cálculos
- [ ] E2E: flujo completo (crear → registrar abono → pagar)
- [ ] Validación responsive (375px, 768px, 1024px, 1440px)

---

## 🚨 Riesgos y Mitigación

| Riesgo | Impacto | Mitigation |
|--------|---------|-----------|
| Cambios en diccionario afectan otros módulos | ALTO | Buscar usos de enums antes de cambiar |
| Cambio de color regresa deudas existentes mal | ALTO | **Ojo:** No es regresión visual, es corrección |
| Currentprincipal inconsistente bloqueará | ALTO | Implementar UI fix temporal mientras backend |
| Zod errors rompen UX actual | BAJO | Ya está roto, mejora es bienvenida |

---

## ✅ Criterios de Aceptación

1. **Filtros:** Sin superposición en 375px, 768px, 1024px, 1440px
2. **Etiquetas:** Cero enums técnicos expuestos al usuario
3. **Progreso:** 0% = gris, 1-99% = indigo, 100% = verde
4. **Formularios:** Errores en español, cerca del campo, scroll automático
5. **Comprobante:** Se sube, valida, persiste, aparece en historial
6. **Accesibilidad:** WCAG AA mínimo (contraste, focus, aria)
7. **Responsive:** Tabla con fallback móvil, sin scroll horizontal
8. **Tests:** Casos 1-11 del brief (deuda, abono, progreso, etc.)

---

## 📚 Referencias

- **Documentación deudas:** `/docs/debts-loans.md`
- **UI/UX Pro Max:** Búsquedas fintech, accessibility, responsive
- **Incremento 3:** Integraciones (payments, statements, dashboard)

