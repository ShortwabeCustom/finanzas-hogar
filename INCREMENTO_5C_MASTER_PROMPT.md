# INCREMENTO 5C: E2E TESTS + QA MANUAL + VALIDACIÓN PRE-DEPLOY
**Fecha:** 2026-08-06  
**Basado en:** Completar INCREMENTO 5 (A+B finalizados)  
**Habilidades Requeridas:** qa-test-planner (E2E tests) + testing  
**Duración estimada:** 1 sesión (1-2 horas)

---

## 🎯 OBJETIVO GENERAL

Validar que todos los flujos de INCREMENTO 5 funcionen correctamente con:
- ✅ **3 Test Suites E2E** (Playwright) — Import + Pagination + Analytics
- ✅ **QA Manual Checklist** — 10 criterios antes de deploy
- ✅ **Performance Baseline** — Verificar tiempos de respuesta
- ✅ **Accesibilidad WCAG AA** — Import wizard accessible

**Resultado esperado:** Branch lista para producción con cobertura E2E completa.

---

## 📋 SECCIÓN 8: E2E TESTS (PLAYWRIGHT)

### **8.1 Test Suite: Import Workflow**

```typescript
// tests/e2e/import-statements.spec.ts

test('Importar estado de cuenta Santander con PDF', async ({ page, context }) => {
  // Precondiciones:
  // - Usuario autenticado (alexis.pro_sk8@hotmail.com / password)
  // - Al menos 1 cuenta personal vinculada
  // - PDF fixture: tests/fixtures/sample-santander-checking.pdf (42 transacciones)

  // 1. Login
  await page.goto('/login');
  await page.fill('input[name="email"]', 'alexis.pro_sk8@hotmail.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button:has-text("Entrar")');
  await page.waitForURL('/dashboard');

  // 2. Navegar a import
  await page.goto('/personal/statements/import');
  await expect(page.locator('h1')).toContainText('Importar Estado de Cuenta');

  // 3. Paso 1: Seleccionar banco
  await page.click('button:has-text("Santander")');
  await expect(page.locator('button:has-text("Siguiente")')).toBeEnabled();
  await page.click('button:has-text("Siguiente")');

  // 4. Paso 2: Subir PDF (drag & drop)
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('tests/fixtures/sample-santander-checking.pdf');
  await expect(page.locator('text=sample-santander-checking.pdf')).toBeVisible();

  // 5. Esperar preview (polling)
  await page.waitForTimeout(1000); // Dar tiempo al servidor
  await expect(page.locator('text=Santander')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=42 transacción')).toBeVisible();

  // 6. Paso 3: Revisar datos
  const stepLabel = page.locator('text=Paso 3');
  await expect(stepLabel).toBeVisible();
  
  // Selector de cuenta
  const accountSelect = page.locator('select');
  await accountSelect.selectOption({ index: 1 }); // Seleccionar primera cuenta
  await expect(page.locator('button:has-text("Confirmar")')).toBeEnabled();

  // 7. Confirmar importación
  await page.click('button:has-text("Confirmar")');

  // 8. Paso 4: Resultado
  await expect(page.locator('text=¡Importación exitosa!')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=42 transacciones importadas')).toBeVisible();

  // 9. Verificar en statements
  await page.click('button:has-text("Ver transacciones")');
  await page.waitForURL('/personal/statements');
  // Verificar que hay transacciones visibles
  await expect(page.locator('text=Santander').first()).toBeVisible();
});
```

### **8.2 Test Suite: Pagination**

```typescript
// tests/e2e/pagination.spec.ts

test('Paginar tabla de pagos con cursor-based pagination', async ({ page }) => {
  // 1. Login y navegar
  await page.goto('/login');
  await page.fill('input[name="email"]', 'alexis.pro_sk8@hotmail.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button:has-text("Entrar")');
  await page.goto('/payments');

  // 2. Verificar carga inicial
  const rows = page.locator('table tbody tr');
  const initialCount = await rows.count();
  expect(initialCount).toBeLessThanOrEqual(20);

  // 3. Buscar botón "Cargar más" o scroll
  const loadMoreButton = page.locator('button:has-text("Cargar más")');
  const isVisible = await loadMoreButton.isVisible().catch(() => false);

  if (isVisible) {
    const initialIds = await rows.allTextContents();
    await loadMoreButton.click();
    
    // Esperar nuevas filas sin reload
    await page.waitForTimeout(500);
    const newRows = page.locator('table tbody tr');
    const newCount = await newRows.count();
    
    expect(newCount).toBeGreaterThan(initialCount);
    
    // Verificar que no hay duplicados (cursor funciona)
    const newIds = await newRows.allTextContents();
    const overlap = initialIds.filter(id => newIds.includes(id));
    expect(overlap.length).toBe(0);
  }
});
```

### **8.3 Test Suite: Analytics**

```typescript
// tests/e2e/analytics.spec.ts

test('Trackear evento payment_created en GA4', async ({ page, context }) => {
  // Monitorear gtag calls
  const gtagCalls: any[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('dataLayer')) {
      gtagCalls.push(msg.text());
    }
  });

  // 1. Login
  await page.goto('/login');
  await page.fill('input[name="email"]', 'alexis.pro_sk8@hotmail.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button:has-text("Entrar")');

  // 2. Crear un pago
  await page.goto('/payments');
  await page.click('button:has-text("Nuevo Pago")');
  
  // Rellenar formulario
  await page.fill('input[name="name"]', 'Test Payment');
  await page.fill('input[name="amount"]', '1000');
  await page.click('button:has-text("Guardar")');

  // 3. Verificar en Network (gtag event)
  // Alternativa: verificar window.gtag en console
  await page.evaluate(() => {
    const gtag = (window as any).gtag;
    if (gtag) {
      console.log('✓ gtag is loaded');
    }
  });

  // Esperar confirmación
  await page.waitForTimeout(1000);
  
  // Validar que no hay errores
  await expect(page.locator('text=Error')).not.toBeVisible();
});
```

---

## 📋 SECCIÓN 9: QA MANUAL CHECKLIST

**Antes de mergear a main y deployar:**

### **Import Wizard**
- [ ] **Paso 1:** Seleccionar 6 bancos (Auto, Santander, BBVA, Scotiabank, BCI, Otro) — botón "Siguiente" se habilita
- [ ] **Paso 2:** Drag & drop PDF → acepta Santander.pdf, rechaza .txt, muestra error si > 5MB
- [ ] **Paso 2:** Progress bar sube durante procesamiento (30% → 100%)
- [ ] **Paso 3:** Preview muestra transacciones (mínimo 5), selector de cuenta funciona
- [ ] **Paso 3:** Merge toggle visible, mensaje explicativo presente
- [ ] **Paso 4:** Resultado exitoso muestra count, error muestra mensaje claro
- [ ] **Paso 4:** Botones "Ver transacciones" y "Cerrar" funcionan

### **Paginación**
- [ ] Tabla de /payments carga máximo 20 items inicialmente
- [ ] Botón "Cargar más" visible si hay más datos
- [ ] Click "Cargar más" agrega nuevas filas sin reload (SPA transition)
- [ ] No hay duplicados entre páginas (cursor-based funciona)
- [ ] URL no cambia durante paginación (client-side)

### **Skeleton Screens**
- [ ] StatCard loading muestra SkeletonCard (gris animado)
- [ ] Tabla loading muestra SkeletonTable (5 filas grises)
- [ ] **Sin layout shift** — elementos mantienen tamaño durante skeleton → carga
- [ ] Duración < 2s en conexión normal

### **Metadata**
- [ ] Tab title "/dashboard" → "Dashboard | Finanzas del Hogar"
- [ ] Tab title "/payments" → "Pagos Generales | Finanzas del Hogar"
- [ ] Tab title "/personal/payments" → "Mis Pagos | Finanzas del Hogar"
- [ ] Tab title "/personal/statements" → "Estados de Cuenta | Finanzas del Hogar"
- [ ] Tab title "/personal/debts" → "Deudas y Préstamos | Finanzas del Hogar"
- [ ] Tab title "/categories" → "Categorías | Finanzas del Hogar"
- [ ] Tab title "/personal/statements/import" → "Importar Estado de Cuenta | Finanzas del Hogar"

### **Analytics (GA4)**
- [ ] Google Analytics cargar en Network → gtag.js (200 OK)
- [ ] Crear pago → evento payment_created registrado en GA4 console
- [ ] Página cambio → evento page_view automático
- [ ] Sin errores 403 ni CORS en gtag

### **Mobile (iPhone SE — 375px)**
- [ ] Import wizard responsive: botones se apilan en móvil
- [ ] Tabla statements horizontal scroll en móvil
- [ ] Skeleton cards visible (no overflow)
- [ ] StepIndicator muestra "Paso X de 4" en móvil

### **Error Handling**
- [ ] PDF corrupto → mensaje claro "No se pudo procesar"
- [ ] Cuenta no existente → "Cuenta no encontrada"
- [ ] Timeout > 30s → "Timeout procesando archivo"
- [ ] Sin conexión → error network visible
- [ ] Todos los errores incluyen botón "Intentar de nuevo"

### **Performance**
- [ ] Import PDF 3MB completa en < 5 segundos
- [ ] Paginación "Cargar más" responde en < 500ms
- [ ] Navegación entre pasos (1→2→3→4) sin lag
- [ ] Network requests: importId POST (< 200ms), status polling GET (< 100ms), confirm POST (< 1s)

### **Accesibilidad (WCAG AA)**
- [ ] Import wizard tiene `aria-label` en botones principales
- [ ] Paso 1: BankSelector radio buttons accesibles (tab, enter)
- [ ] Paso 2: Drag & drop tiene fallback input[type="file"]
- [ ] Paso 3: Select cuenta tiene label asociado
- [ ] Focus visible (outline/border) en todos los botones
- [ ] Colores: contrast ratio mínimo 4.5:1 (texto/fondo)
- [ ] Sin trampas de teclado (tab order lógico)

---

## 🚀 COMANDOS PARA EJECUTAR

```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: E2E tests
npm run test:e2e

# O individual
npm run test:e2e -- tests/e2e/import-statements.spec.ts
npm run test:e2e -- tests/e2e/pagination.spec.ts
npm run test:e2e -- tests/e2e/analytics.spec.ts

# Coverage
npm run test:e2e:coverage

# Build check
npm run build
npm run type-check
```

---

## 📊 CRITERIOS DE ÉXITO

| Métrica | Target | Pass? |
|---------|--------|-------|
| E2E tests passing | 3/3 (100%) | |
| QA checklist | 50/50 (100%) | |
| Build clean | ✓ | |
| TypeScript | 0 errors | |
| Lighthouse (mobile) | >= 80 | |
| Accesibilidad (axe) | 0 críticos | |

---

## 📝 FIXTURES NECESARIOS

**Crear en `tests/fixtures/`:**

- `sample-santander-checking.pdf` — 42 transacciones, período 2026-07
  - Puede ser un PDF real o mock (pdfkit generado)
  - Requiere: fecha, descripción, monto (débito/crédito), saldo

---

## 🎓 NOTAS

- **Playwright:** Ya configurado en `playwright.config.ts`
- **Bases de datos de test:** Usar `.env.test` con DB temporal
- **Auth:** Fixture sesión NextAuth (cookies/JWT) reusable
- **Fixtures PDF:** Si falta sample-santander.pdf, generarlo con `npm run generate:fixtures`
- **Timeout polling:** 30 segundos máximo (reajustar si servidor lento)

---

## 🔄 FLUJO DE EJECUCIÓN

1. **Setup:** Clonar fixtures, preparar DB de test
2. **Run E2E:** 3 suites en paralelo (Chrome/Firefox/Safari)
3. **QA Manual:** Checklist de 50 items (30-40 min manual)
4. **Performance:** Lighthouse audit + Network inspector
5. **Accesibilidad:** axe-core scan + manual keyboard nav
6. **Report:** Consolidar resultados → INCREMENTO 5 COMPLETADO

---

**PRÓXIMO INCREMENTO:** INCREMENTO 6 — Features nuevas (si aplica) o productividad UI refinements.

