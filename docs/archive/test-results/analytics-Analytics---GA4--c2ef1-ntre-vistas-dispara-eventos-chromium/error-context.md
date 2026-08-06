# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: analytics.spec.ts >> Analytics - GA4 Event Tracking >> TC-GA4-006: Navegación entre vistas dispara eventos
- Location: tests/e2e/analytics.spec.ts:179:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:4100/payments", waiting until "load"

```

# Test source

```ts
  90  |     });
  91  | 
  92  |     // 3. Navegar a pagos y crear uno
  93  |     await page.goto('/payments');
  94  | 
  95  |     // Buscar botón "Nuevo Pago" o similar
  96  |     const newPaymentButton = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")').first();
  97  |     const isVisible = await newPaymentButton.isVisible().catch(() => false);
  98  | 
  99  |     if (isVisible) {
  100 |       await newPaymentButton.click();
  101 |       await page.waitForTimeout(500);
  102 | 
  103 |       // Buscar campos del formulario
  104 |       const nameInput = page.locator('input[name="name"], input[placeholder*="nombre" i], input[placeholder*="name" i]').first();
  105 |       const amountInput = page.locator('input[name="amount"], input[placeholder*="monto" i], input[placeholder*="amount" i]').first();
  106 | 
  107 |       const hasForm = await nameInput.isVisible().catch(() => false);
  108 | 
  109 |       if (hasForm) {
  110 |         // Llenar formulario
  111 |         await nameInput.fill('Test Payment E2E');
  112 |         await amountInput.fill('500');
  113 | 
  114 |         // Buscar botón guardar
  115 |         const saveButton = page.locator('button:has-text("Guardar"), button:has-text("Confirmar")').first();
  116 |         if (await saveButton.isVisible().catch(() => false)) {
  117 |           await saveButton.click();
  118 |           await page.waitForTimeout(1000);
  119 |         }
  120 |       }
  121 |     }
  122 | 
  123 |     // 4. Verificar que no hay errores
  124 |     const errors = page.locator('text=Error, text=error').first();
  125 |     const hasError = await errors.isVisible().catch(() => false);
  126 | 
  127 |     expect(!hasError).toBe(true);
  128 |   });
  129 | 
  130 |   test('TC-GA4-004: Sin errores CORS en gtag', async ({ page }) => {
  131 |     // 1. Monitorear errores de red
  132 |     const corsErrors: string[] = [];
  133 | 
  134 |     page.on('response', (response) => {
  135 |       if ((response.status() === 403 || response.status() === 401) &&
  136 |           (response.url().includes('gtag') || response.url().includes('analytics'))) {
  137 |         corsErrors.push(`${response.status()} - ${response.url()}`);
  138 |       }
  139 |     });
  140 | 
  141 |     // 2. Login y navegar
  142 |     await page.fill('input[type="email"]', 'alexis@hogar.com');
  143 |     await page.fill('input[type="password"]', 'admin123');
  144 |     await page.click('button:has-text("Iniciar sesión")');
  145 |     await page.waitForURL('**/dashboard');
  146 | 
  147 |     // 3. Navegar entre páginas
  148 |     await page.goto('/payments');
  149 |     await page.waitForTimeout(1000);
  150 |     await page.goto('/dashboard');
  151 |     await page.waitForTimeout(1000);
  152 | 
  153 |     // 4. Verificar que no hay errores CORS
  154 |     expect(corsErrors.length).toBe(0);
  155 |   });
  156 | 
  157 |   test('TC-GA4-005: DataLayer está disponible', async ({ page }) => {
  158 |     // 1. Login
  159 |     await page.fill('input[type="email"]', 'alexis@hogar.com');
  160 |     await page.fill('input[type="password"]', 'admin123');
  161 |     await page.click('button:has-text("Iniciar sesión")');
  162 |     await page.waitForURL('**/dashboard');
  163 | 
  164 |     // 2. Verificar window.dataLayer
  165 |     const dataLayerAvailable = await page.evaluate(() => {
  166 |       return Array.isArray((window as any).dataLayer);
  167 |     });
  168 | 
  169 |     // Si gtag está configurado, dataLayer debe existir
  170 |     const gtagAvailable = await page.evaluate(() => {
  171 |       return typeof (window as any).gtag === 'function';
  172 |     });
  173 | 
  174 |     if (gtagAvailable) {
  175 |       expect(dataLayerAvailable).toBe(true);
  176 |     }
  177 |   });
  178 | 
  179 |   test('TC-GA4-006: Navegación entre vistas dispara eventos', async ({ page }) => {
  180 |     // 1. Login
  181 |     await page.fill('input[type="email"]', 'alexis@hogar.com');
  182 |     await page.fill('input[type="password"]', 'admin123');
  183 |     await page.click('button:has-text("Iniciar sesión")');
  184 |     await page.waitForURL('**/dashboard');
  185 | 
  186 |     // 2. Navegar por varias páginas y verificar que no hay errores
  187 |     const pages = ['/dashboard', '/payments', '/personal/debts', '/categories'];
  188 | 
  189 |     for (const path of pages) {
> 190 |       await page.goto(path);
      |                  ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  191 |       await page.waitForTimeout(500);
  192 | 
  193 |       // Verificar que no hay errores JavaScript
  194 |       const logs = await page.evaluate(() => {
  195 |         return (window as any).__logs || [];
  196 |       });
  197 | 
  198 |       // Página debe estar visible
  199 |       const isVisible = await page.locator('main, [role="main"]').isVisible().catch(() => false);
  200 |       expect(isVisible || (await page.locator('body').isVisible())).toBe(true);
  201 |     }
  202 |   });
  203 | });
  204 | 
```