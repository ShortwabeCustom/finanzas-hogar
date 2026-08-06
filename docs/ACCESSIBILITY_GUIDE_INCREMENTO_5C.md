# ♿ GUÍA DE ACCESIBILIDAD - INCREMENTO 5C
**WCAG 2.1 Level AA Compliance**  
**Fecha:** 2026-08-06  

---

## 📋 RESUMEN EJECUTIVO

Este documento describe las validaciones de accesibilidad WCAG AA para el Import Wizard de INCREMENTO 5C.

**Normas aplicables:**
- ✅ WCAG 2.1 Level AA (Recomendado)
- ✅ EN 301 549 (Directiva Europea)
- ✅ ADA (Accessibility for Americans)
- ✅ AODA (Canadá)

---

## 🎯 CRITERIOS WCAG AA (Críticos)

### 1. Perceivable (Perceptible)

#### 1.1 Text Alternatives
- [ ] **TC-A1.1.1:** Todos los `<img>` tienen `alt` text
- [ ] **TC-A1.1.1:** Icon buttons tienen `aria-label` o `title`
- [ ] **TC-A1.1.1:** SVG icons tienen `<title>` o `aria-label`

**Aplicable a Import Wizard:**
```html
<!-- ✅ Correcto -->
<button aria-label="Seleccionar banco Santander">
  <img src="santander-logo.png" alt="Santander" />
</button>

<!-- ❌ Incorrecto -->
<button><img src="santander-logo.png" /></button>
```

#### 1.4 Distinguishable
- [ ] **TC-A1.4.3:** Contraste 4.5:1 (texto normal)
- [ ] **TC-A1.4.3:** Contraste 3:1 (texto grande, UI components)
- [ ] **TC-A1.4.5:** Errores no comunican solo por color
- [ ] **TC-A1.4.11:** Focus indicator visible (mín. 2px)

**Aplicable a Import Wizard:**
```css
/* ✅ Correcto */
button:focus-visible {
  outline: 2px solid #0066FF;
  outline-offset: 2px;
}

button {
  background: #0066FF; /* Contraste 4.5:1+ vs texto blanco */
  color: #FFFFFF;
}

/* ❌ Incorrecto */
button:focus {
  outline: none; /* Trap - no focus visible */
}

.error {
  color: #FF0000; /* Solo color, confuso para color-blind */
}
```

---

### 2. Operable (Operativo)

#### 2.1 Keyboard Accessible
- [ ] **TC-A2.1.1:** Todos los controles operables con teclado
- [ ] **TC-A2.1.1:** No hay "keyboard trap"
- [ ] **TC-A2.1.2:** Tab order lógico (izq→dcha, arriba→abajo)
- [ ] **TC-A2.1.3:** ESC cierra modals/dialogs

**Aplicable a Import Wizard:**

```html
<!-- ✅ Paso 1: Tab order correcto -->
<form>
  <fieldset>
    <legend>Selecciona un banco</legend>
    
    <!-- Tab 1 -->
    <input type="radio" id="banco-santander" name="banco" />
    <label for="banco-santander">Santander</label>
    
    <!-- Tab 2 -->
    <input type="radio" id="banco-bbva" name="banco" />
    <label for="banco-bbva">BBVA</label>
    
    <!-- Tab 3 -->
    <button type="button">Siguiente</button>
  </fieldset>
</form>

<!-- ✅ Paso 2: Keyboard fallback para drag & drop -->
<form>
  <label for="pdf-upload">Cargar PDF</label>
  <input type="file" id="pdf-upload" name="pdf" accept=".pdf" />
  <p>O arrastra el archivo aquí</p>
</form>

<!-- ✅ Modal con ESC key -->
<dialog id="import-dialog" open>
  <form method="dialog">
    <!-- Contenido -->
    <button type="submit" name="result">Cerrar</button>
  </form>
</dialog>
```

**Script para ESC:**
```javascript
const dialog = document.querySelector('#import-dialog');
dialog.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    dialog.close();
  }
});
```

#### 2.4 Navigable
- [ ] **TC-A2.4.3:** Focus visible en botones/links
- [ ] **TC-A2.4.5:** Múltiples formas de llegar a contenido
- [ ] **TC-A2.4.7:** Focus visible (outline/border)
- [ ] **TC-A2.4.8:** Purpose of link is clear

**Aplicable a Import Wizard:**
```html
<!-- ✅ Links descriptivos -->
<a href="/personal/statements/import">
  Importar Estado de Cuenta
</a>

<!-- ❌ Links genéricos -->
<a href="/personal/statements/import">Click aquí</a>
```

---

### 3. Understandable (Comprensible)

#### 3.1 Readable
- [ ] **TC-A3.1.1:** Idioma de página definido en `<html lang="es">`
- [ ] **TC-A3.1.1:** Cambios de idioma marcados con `lang` attribute

```html
<!-- ✅ Correcto -->
<html lang="es">
  <body>
    <p>Bienvenido</p>
    <p lang="en">Welcome</p>
  </body>
</html>
```

#### 3.2 Predictable
- [ ] **TC-A3.2.2:** Cambio de contexto solo por user action
- [ ] **TC-A3.2.2:** No auto-submit en change
- [ ] **TC-A3.2.4:** Etiquetas consistentes

```html
<!-- ✅ Correcto - Select no auto-submit -->
<select id="account" name="account">
  <option value="">Selecciona cuenta...</option>
  <option value="1">Cuenta Corriente</option>
</select>
<button type="submit">Siguiente</button>

<!-- ❌ Incorrecto - Auto-submit on change -->
<select id="account" name="account" onchange="submit()">
  ...
</select>
```

#### 3.3 Input Assistance
- [ ] **TC-A3.3.1:** Errores identificados claramente
- [ ] **TC-A3.3.2:** Mensaje error descriptivo (no solo rojo)
- [ ] **TC-A3.3.3:** Sugerencias para corrección
- [ ] **TC-A3.3.4:** Confirmación antes de eliminar/cambiar

```html
<!-- ✅ Correcto - Error descriptivo y accesible -->
<label for="pdf-upload">Cargar PDF</label>
<input type="file" id="pdf-upload" name="pdf" accept=".pdf" aria-describedby="pdf-error" />
<div id="pdf-error" role="alert" aria-live="polite" class="text-red-600 mt-1">
  ⚠️ El archivo debe ser PDF y menor a 5MB (tu archivo: 8MB)
</div>

<!-- ❌ Incorrecto - Solo color rojo -->
<input type="file" id="pdf-upload" />
<p style="color: red;">Error</p>
```

---

## 🎯 WCAG 2.1 LEVEL AA CHECKLIST

| # | Criterio | Técnica | Aplicable | Status |
|---|----------|---------|-----------|--------|
| 1.1.1 | Non-text Content | alt, aria-label | Logos, Icons | ⏳ |
| 1.4.3 | Contrast (Minimum) | 4.5:1 ratio | Texto/Botones | ⏳ |
| 1.4.11 | Non-text Contrast | 3:1 ratio | Bordes, Iconos | ⏳ |
| 2.1.1 | Keyboard | Tab, Enter, Escape | Todos controles | ⏳ |
| 2.1.2 | No Keyboard Trap | ESC funciona | Modals | ⏳ |
| 2.4.3 | Focus Order | Tab order lógico | Formularios | ⏳ |
| 2.4.7 | Focus Visible | outline: 2px | Botones/Inputs | ⏳ |
| 3.1.1 | Language of Page | lang="es" | HTML root | ⏳ |
| 3.2.2 | On Input | No auto-submit | Selects | ⏳ |
| 3.3.1 | Error Identification | aria-describedby | Validación | ⏳ |
| 3.3.2 | Labels or Instructions | `<label>` | Inputs | ⏳ |
| 3.3.3 | Error Suggestion | Mensaje help | Errores | ⏳ |
| 4.1.1 | Parsing | Semántica HTML | Todo | ⏳ |
| 4.1.2 | Name, Role, Value | ARIA roles | Custom UI | ⏳ |
| 4.1.3 | Status Messages | aria-live | Alerts | ⏳ |

---

## 🔧 CÓMO VERIFICAR ACCESIBILIDAD

### 1. Keyboard-Only Testing
```
1. Desconectar mouse
2. Navegar página solo con Tab/Shift+Tab
3. Activar controles con Enter/Space
4. Cerrar dialogs con ESC
5. Acceder a todas funcionalidades
```

**Pasos para Import Wizard:**
- [ ] Tab: Llega a cada banco (radio buttons)
- [ ] Tab: Llega a botón "Siguiente"
- [ ] Tab: Llega a input file (o zona drag & drop)
- [ ] Tab: Llega a selector cuenta
- [ ] Tab: Llega a botón "Confirmar"
- [ ] Tab: Llega a botón "Cerrar"

### 2. Focus Visible Testing
```
1. Presionar Tab repetidamente
2. Verificar que hay outline/border visible en cada elemento
3. El outline debe tener alto contraste (2px mín.)
4. No debe desaparecer
```

**Debug con DevTools:**
```javascript
// En console:
document.querySelectorAll('button, input, select, a').forEach(el => {
  console.log('Element:', el.textContent || el.value);
  const computed = getComputedStyle(el, ':focus-visible');
  console.log('Focus visible:', computed.outline);
});
```

### 3. Contrast Ratio Testing
```
1. Usar Chrome DevTools → Elements → Accessibility tab
2. Verificar "Color contrast" en cada elemento
3. Must be >= 4.5:1 for normal text
4. Must be >= 3:1 for UI components
```

**Tool Online:** https://webaim.org/resources/contrastchecker/

### 4. Color Blindness Testing
```
1. Desactivar colores (ChromeVox o similar)
2. Verificar que mensajes de error son comprensibles sin rojo
3. Usar múltiples señales (ícono + texto, no solo color)
```

**Ejemplo correcto:**
```html
<!-- ✅ Múltiples señales -->
<div class="text-red-600 bg-red-50 rounded-md p-4 border-l-4 border-red-600">
  <strong>⚠️ Error:</strong> El PDF debe ser menor a 5MB
</div>
```

### 5. Automated Testing: axe-core
```bash
# En navegador
npx axe-core <URL>

# En Playwright
npm install --save-dev @axe-core/playwright

// En test
import { injectAxe, checkA11y } from 'axe-playwright';

test('accessibility', async ({ page }) => {
  await page.goto('/personal/statements/import');
  await injectAxe(page);
  await checkA11y(page);
});
```

---

## 📋 COMPONENTES & ACCESIBILIDAD

### BankSelector (Radio Buttons)
```html
<!-- ✅ Accesible -->
<fieldset>
  <legend>Selecciona un banco</legend>
  
  <div>
    <input type="radio" id="banco-1" name="banco" value="santander" />
    <label for="banco-1">
      <img src="santander.png" alt="Santander" />
    </label>
  </div>
  
  <div>
    <input type="radio" id="banco-2" name="banco" value="bbva" />
    <label for="banco-2">
      <img src="bbva.png" alt="BBVA" />
    </label>
  </div>
</fieldset>
```

**Keyboard:** Arrow keys navegan entre opciones

### PdfUploadZone (Drag & Drop)
```html
<!-- ✅ Accesible con fallback -->
<div class="drop-zone" role="button" aria-label="Carga un PDF o arrastra aquí">
  <p>Arrastra aquí</p>
  <input type="file" accept=".pdf" id="pdf-input" hidden />
  <label for="pdf-input">O haz clic para seleccionar</label>
</div>

<script>
// Drag & drop accesible
const dropZone = document.querySelector('.drop-zone');
dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  // Procesar...
});

// Fallback: input[type="file"] siempre disponible
</script>
```

### StepIndicator (Progress)
```html
<!-- ✅ Accesible -->
<div role="progressbar" aria-valuenow="2" aria-valuemin="1" aria-valuemax="4" aria-label="Paso 2 de 4">
  <div class="progress-item" aria-current="step">Paso 2</div>
  <div class="progress-item">Paso 3</div>
  <div class="progress-item">Paso 4</div>
</div>
```

### Form Select (Selector Cuenta)
```html
<!-- ✅ Accesible -->
<div>
  <label for="account-select">Selecciona la cuenta a importar:</label>
  <select id="account-select" name="account" required aria-describedby="account-help">
    <option value="">-- Selecciona --</option>
    <option value="1">Cuenta Corriente (1234****)</option>
    <option value="2">Cuenta Ahorros (5678****)</option>
  </select>
  <p id="account-help" class="text-sm text-gray-600">
    Las transacciones se importarán a esta cuenta
  </p>
</div>
```

---

## 🚀 HERRAMIENTAS RECOMENDADAS

| Herramienta | Tipo | Uso |
|-------------|------|-----|
| [axe DevTools](https://www.deque.com/axe/devtools/) | Browser Extension | Testing rápido |
| [WAVE](https://wave.webaim.org/) | Web App | Validación visual |
| [Lighthouse](https://developers.google.com/web/tools/lighthouse) | DevTools | Score general |
| [ChromeVox](https://support.google.com/chromebook/answer/7031755) | Screen Reader | Testing completo |
| [Color Contrast Checker](https://webaim.org/resources/contrastchecker/) | Web App | Validar ratios |
| [NVDA](https://www.nvaccess.org/) | Screen Reader | Testing profundo |

---

## ✅ CHECKLIST FINAL WCAG AA

```
ANTES DE DEPLOY:

Keyboard Navigation:
☐ Tab navega a todos los controles
☐ No hay keyboard trap
☐ Tab order es lógico
☐ ESC cierra dialogs

Focus Visible:
☐ Todos los elementos tienen focus outline
☐ Outline es visible (2px mín.)
☐ Outline tiene contraste 3:1

Color & Contrast:
☐ Texto normal: 4.5:1+
☐ UI components: 3:1+
☐ Errores: múltiples señales (no solo color)

Labels & ARIA:
☐ Inputs tienen <label> o aria-label
☐ Buttons tienen aria-label si necesario
☐ Iconos tienen title o alt

Status Messages:
☐ Errores: aria-describedby + aria-live="polite"
☐ Alerts: role="alert" + aria-live="assertive"
☐ Loading: aria-busy="true"

Form Validation:
☐ Errores descriptivos (no genéricos)
☐ Sugerencias para corregir
☐ Lang attribute en HTML

Tested With:
☐ Keyboard only
☐ Screen reader (NVDA/ChromeVox)
☐ Zoom 200%
☐ Color blindness simulator
☐ axe-core scan (0 violations)
```

---

**RESPONSABLE:** QA Team  
**ÚLTIMA ACTUALIZACIÓN:** 2026-08-06  
**ESTADO:** GUÍA ACTIVA
