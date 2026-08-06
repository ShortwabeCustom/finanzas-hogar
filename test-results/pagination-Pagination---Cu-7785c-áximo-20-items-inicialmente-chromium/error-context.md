# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pagination.spec.ts >> Pagination - Cursor Based >> TC-PAGI-001: Tabla de pagos carga máximo 20 items inicialmente
- Location: tests/e2e/pagination.spec.ts:13:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Entrar")')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Finanzas del Hogar" [level=1] [ref=e8]
      - paragraph [ref=e9]: Control financiero inteligente
    - generic [ref=e10]:
      - heading "Iniciar sesión" [level=2] [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: Correo electrónico
          - textbox "usuario@ejemplo.com" [ref=e15]: alexis.pro_sk8@hotmail.com
        - generic [ref=e16]:
          - generic [ref=e17]: Contraseña
          - textbox "••••••••" [active] [ref=e18]: password
        - button "Iniciar sesión" [ref=e19]
  - alert [ref=e20]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Pagination - Cursor Based', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     // Login y navegar a payments
  6   |     await page.goto('/login');
  7   |     await page.fill('input[type="email"]', 'alexis.pro_sk8@hotmail.com');
  8   |     await page.fill('input[type="password"]', 'password');
> 9   |     await page.click('button:has-text("Entrar")');
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  10  |     await page.waitForURL('**/dashboard');
  11  |   });
  12  | 
  13  |   test('TC-PAGI-001: Tabla de pagos carga máximo 20 items inicialmente', async ({ page }) => {
  14  |     // 1. Navegar a pagos
  15  |     await page.goto('/payments');
  16  | 
  17  |     // Esperar a que la tabla cargue
  18  |     await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  19  | 
  20  |     // 2. Contar filas
  21  |     const rows = page.locator('table tbody tr');
  22  |     const rowCount = await rows.count();
  23  | 
  24  |     // Debe haber entre 1 y 20 filas
  25  |     expect(rowCount).toBeGreaterThanOrEqual(1);
  26  |     expect(rowCount).toBeLessThanOrEqual(20);
  27  |   });
  28  | 
  29  |   test('TC-PAGI-002: Botón "Cargar más" visible si hay más datos', async ({ page }) => {
  30  |     // 1. Navegar a pagos
  31  |     await page.goto('/payments');
  32  |     await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  33  | 
  34  |     // 2. Buscar botón "Cargar más"
  35  |     const loadMoreButton = page.locator('button:has-text("Cargar más"), button:has-text("Load more")').first();
  36  |     const isVisible = await loadMoreButton.isVisible().catch(() => false);
  37  | 
  38  |     // Si hay botón, debe estar habilitado
  39  |     if (isVisible) {
  40  |       await expect(loadMoreButton).toBeEnabled();
  41  |     }
  42  |   });
  43  | 
  44  |   test('TC-PAGI-003: Click "Cargar más" agrega nuevas filas sin reload', async ({ page }) => {
  45  |     // 1. Navegar a pagos y obtener estado inicial
  46  |     await page.goto('/payments');
  47  |     await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  48  | 
  49  |     const rows = page.locator('table tbody tr');
  50  |     const initialCount = await rows.count();
  51  | 
  52  |     // 2. Verificar que URL no cambia (SPA transition)
  53  |     const initialUrl = page.url();
  54  | 
  55  |     // 3. Click en "Cargar más"
  56  |     const loadMoreButton = page.locator('button:has-text("Cargar más"), button:has-text("Load more")').first();
  57  |     const isVisible = await loadMoreButton.isVisible().catch(() => false);
  58  | 
  59  |     if (isVisible) {
  60  |       await loadMoreButton.click();
  61  | 
  62  |       // Esperar a que se carguen nuevas filas
  63  |       await page.waitForTimeout(1000);
  64  | 
  65  |       // 4. Verificar que hay más filas
  66  |       const newRows = page.locator('table tbody tr');
  67  |       const newCount = await newRows.count();
  68  | 
  69  |       expect(newCount).toBeGreaterThan(initialCount);
  70  | 
  71  |       // 5. Verificar que URL no cambió
  72  |       const finalUrl = page.url();
  73  |       expect(finalUrl).toBe(initialUrl);
  74  |     }
  75  |   });
  76  | 
  77  |   test('TC-PAGI-004: No hay duplicados entre páginas (cursor funciona)', async ({ page }) => {
  78  |     // 1. Navegar a pagos
  79  |     await page.goto('/payments');
  80  |     await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  81  | 
  82  |     // 2. Obtener IDs/datos de la primera página
  83  |     const rows = page.locator('table tbody tr');
  84  |     const initialTextContents = await rows.allTextContents();
  85  |     const initialIds = initialTextContents.map((text) => text.trim());
  86  | 
  87  |     // 3. Click "Cargar más"
  88  |     const loadMoreButton = page.locator('button:has-text("Cargar más"), button:has-text("Load more")').first();
  89  |     const isVisible = await loadMoreButton.isVisible().catch(() => false);
  90  | 
  91  |     if (isVisible) {
  92  |       await loadMoreButton.click();
  93  |       await page.waitForTimeout(1000);
  94  | 
  95  |       // 4. Obtener datos de la segunda página
  96  |       const newRows = page.locator('table tbody tr');
  97  |       const newTextContents = await newRows.allTextContents();
  98  | 
  99  |       // 5. Verificar que no hay duplicados
  100 |       const newIds = newTextContents.map((text) => text.trim());
  101 |       const duplicates = initialIds.filter((id) => newIds.includes(id));
  102 | 
  103 |       // No debe haber solapamiento
  104 |       expect(duplicates.length).toBe(0);
  105 |     }
  106 |   });
  107 | 
  108 |   test('TC-PAGI-005: Navegación sin cambios de URL (client-side)', async ({ page }) => {
  109 |     // 1. Navegar a pagos
```