# 📋 QA CHECKLIST - INCREMENTO 5C
**Fecha de QA:** 2026-08-06  
**Tester:** [Nombre]  
**Build:** [Versión]  
**Environment:** [Dev/Staging/Prod]  

---

## ✅ IMPORT WIZARD (7 items)

### 1. Paso 1: Seleccionar Banco
- [ ] **1.1** Botón "Auto" visible y seleccionable
- [ ] **1.2** Botón "Santander" visible y seleccionable
- [ ] **1.3** Botón "BBVA" visible y seleccionable
- [ ] **1.4** Botón "Scotiabank" visible y seleccionable
- [ ] **1.5** Botón "BCI" visible y seleccionable
- [ ] **1.6** Botón "Otro" visible y seleccionable
- [ ] **1.7** Botón "Siguiente" se habilita cuando se selecciona un banco
- [ ] **1.8** Indicador visual muestra que el banco fue seleccionado

### 2. Paso 2: Subir PDF
- [ ] **2.1** Zona de drag & drop visible
- [ ] **2.2** Input file (`<input type="file">`) funciona
- [ ] **2.3** Acepta archivos .pdf
- [ ] **2.4** Rechaza archivos .txt (si está implementado)
- [ ] **2.5** Rechaza archivos > 5MB con mensaje de error
- [ ] **2.6** Progress bar visible durante procesamiento
- [ ] **2.7** Progress bar va de 30% → 100%
- [ ] **2.8** Nombre del archivo muestra correctamente después de carga

### 3. Paso 3: Preview y Selector de Cuenta
- [ ] **3.1** Tabla de preview muestra transacciones (mín. 5 filas)
- [ ] **3.2** Columnas: Fecha, Descripción, Monto, Saldo
- [ ] **3.3** Selector de cuenta (`<select>`) visible
- [ ] **3.4** Selector tiene label asociado
- [ ] **3.5** Selector tiene opciones (mín. 2)
- [ ] **3.6** Toggle "Merge" visible
- [ ] **3.7** Mensaje explicativo del merge presente
- [ ] **3.8** Botón "Confirmar" se habilita cuando todo es válido
- [ ] **3.9** Botón "Atrás" funciona (vuelve a paso 2)

### 4. Paso 4: Resultado
- [ ] **4.1** Resultado exitoso muestra "¡Importación exitosa!"
- [ ] **4.2** Muestra count de transacciones importadas
- [ ] **4.3** Botón "Ver transacciones" visible y funciona
- [ ] **4.4** Botón "Cerrar" visible y cierra el wizard
- [ ] **4.5** Error muestra mensaje claro
- [ ] **4.6** Error incluye botón "Intentar de nuevo"
- [ ] **4.7** Spinner desaparece cuando completado

---

## 📄 PAGINACIÓN (5 items)

- [ ] **5.1** Tabla `/payments` carga máximo 20 items inicialmente
- [ ] **5.2** Botón "Cargar más" visible cuando hay más datos
- [ ] **5.3** Click "Cargar más" agrega filas sin reload (SPA)
- [ ] **5.4** No hay duplicados entre página 1 y 2
- [ ] **5.5** URL no cambia durante paginación (client-side)
- [ ] **5.6** Última página: botón "Cargar más" desaparece

---

## 💀 SKELETON SCREENS (3 items)

- [ ] **6.1** StatCard loading muestra SkeletonCard (gris animado)
- [ ] **6.2** Tabla loading muestra SkeletonTable (5 filas grises)
- [ ] **6.3** Sin layout shift: elementos mantienen tamaño
- [ ] **6.4** Duración < 2s en conexión normal

---

## 📝 METADATA & TAB TITLES (7 items)

- [ ] **7.1** Tab title `/dashboard` = "Dashboard | Finanzas del Hogar"
- [ ] **7.2** Tab title `/payments` = "Pagos Generales | Finanzas del Hogar"
- [ ] **7.3** Tab title `/personal/payments` = "Mis Pagos | Finanzas del Hogar"
- [ ] **7.4** Tab title `/personal/statements` = "Estados de Cuenta | Finanzas del Hogar"
- [ ] **7.5** Tab title `/personal/debts` = "Deudas y Préstamos | Finanzas del Hogar"
- [ ] **7.6** Tab title `/categories` = "Categorías | Finanzas del Hogar"
- [ ] **7.7** Tab title `/personal/statements/import` = "Importar Estado de Cuenta | Finanzas del Hogar"

---

## 📊 ANALYTICS GA4 (4 items)

- [ ] **8.1** Network tab: gtag.js se carga (200 OK)
- [ ] **8.2** Crear pago → evento `payment_created` en GA4 console
- [ ] **8.3** Cambio de página → evento `page_view` automático
- [ ] **8.4** Sin errores 403 ni CORS en gtag

---

## 📱 MOBILE (iPhone SE - 375px) (4 items)

- [ ] **9.1** Import wizard: botones se apilan en móvil
- [ ] **9.2** Botones tienen padding/spacing adecuado en móvil
- [ ] **9.3** Tabla statements: horizontal scroll visible en móvil
- [ ] **9.4** SkeletonCards: no overflow en móvil
- [ ] **9.5** StepIndicator: "Paso X de 4" visible en móvil

---

## ⚠️ ERROR HANDLING (5 items)

- [ ] **10.1** PDF corrupto → "No se pudo procesar" (mensaje claro)
- [ ] **10.2** Cuenta no existente → "Cuenta no encontrada"
- [ ] **10.3** Timeout > 30s → "Timeout procesando archivo"
- [ ] **10.4** Sin conexión → error network visible
- [ ] **10.5** Todos los errores incluyen botón "Intentar de nuevo"

---

## ⚡ PERFORMANCE (4 items)

- [ ] **11.1** Import PDF 3MB completa en < 5s
- [ ] **11.2** Paginación "Cargar más" responde en < 500ms
- [ ] **11.3** Navegación entre pasos (1→2→3→4) sin lag
- [ ] **11.4** Network: importId POST (< 200ms), status GET (< 100ms), confirm POST (< 1s)

---

## ♿ ACCESIBILIDAD WCAG AA (9 items)

### Keyboard Navigation
- [ ] **12.1** Import wizard: tab navega entre botones/inputs
- [ ] **12.2** Enter activa botón seleccionado
- [ ] **12.3** Paso 1: radio buttons accesibles con Tab+Arrow
- [ ] **12.4** Tab order es lógico (izq→dcha, arriba→abajo)

### Focus Visible
- [ ] **12.5** Todos los botones tienen outline/border focus visible
- [ ] **12.6** Focus trap si hay modal (ESC cierra)

### Color & Contrast
- [ ] **12.7** Contraste mínimo 4.5:1 en texto/fondo
- [ ] **12.8** Errores no se comunican solo por color

### Aria Labels
- [ ] **12.9** Botones tienen `aria-label` descriptivo
- [ ] **12.10** Selector cuenta tiene `<label>` asociado
- [ ] **12.11** Drag & drop: fallback a input[type="file"]

---

## 🏗️ BUILD & TYPES (3 items)

- [ ] **13.1** Build completa sin errores: `npm run build`
- [ ] **13.2** TypeScript sin errores: `npm run type-check`
- [ ] **13.3** Linting pasa: `npm run lint`

---

## 📊 LIGHTHOUSE AUDIT (3 items)

- [ ] **14.1** Lighthouse Mobile score >= 80
- [ ] **14.2** Performance >= 75
- [ ] **14.3** Accessibility >= 90

---

## 🔍 AXE ACCESSIBILITY SCAN (2 items)

- [ ] **15.1** axe-core scan: 0 críticos
- [ ] **15.2** axe-core scan: 0 serios

---

## 📊 RESUMEN

| Sección | Total | ✅ Pass | ❌ Fail | 🚫 Blocked |
|---------|-------|--------|--------|-----------|
| Import Wizard | 8 | | | |
| Paginación | 6 | | | |
| Skeleton Screens | 4 | | | |
| Metadata | 7 | | | |
| Analytics GA4 | 4 | | | |
| Mobile | 5 | | | |
| Error Handling | 5 | | | |
| Performance | 4 | | | |
| Accesibilidad | 11 | | | |
| Build & Types | 3 | | | |
| Lighthouse | 3 | | | |
| AXE | 2 | | | |
| **TOTAL** | **62** | | | |

---

## 🎯 CRITERIOS DE ÉXITO

- ✅ **Pass Rate:** >= 95% (60/62 items)
- ✅ **0 Critical/Severity 1 bugs** bloqueadores
- ✅ **Build:** Clean (sin errores TypeScript)
- ✅ **E2E Tests:** 3/3 passing
- ✅ **Lighthouse:** Mobile >= 80

---

## 📝 NOTAS

**Bugs encontrados:**
```
BUG-001: [Descripción]
- Severidad: [Critical/High/Medium/Low]
- Pasos para reproducir: [...]
- Impacto: [...]

BUG-002: [...]
```

**Observaciones:**
```
[Notas generales del tester]
```

**Signature:**
- Tester: ___________________
- Fecha: 2026-08-06
- Hora inicio: ____ Hora fin: ____
- Tiempo total: ____ min

---

**Estado Final:** [ ] PASS | [ ] FAIL  
**Recomendación:** [ ] Deploy | [ ] Fix & Retest
