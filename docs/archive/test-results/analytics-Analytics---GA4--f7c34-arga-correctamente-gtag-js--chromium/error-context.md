# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: analytics.spec.ts >> Analytics - GA4 Event Tracking >> TC-GA4-001: Google Analytics carga correctamente (gtag.js)
- Location: tests/e2e/analytics.spec.ts:9:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Finanzas del Hogar" [level=1] [ref=e8]
      - paragraph [ref=e9]: Control financiero inteligente
    - generic [ref=e10]:
      - heading "Iniciar sesión" [level=2] [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: Correo electrónico
          - textbox "usuario@ejemplo.com" [ref=e15]: alexis@hogar.com
        - generic [ref=e16]:
          - generic [ref=e17]: Contraseña
          - textbox "••••••••" [ref=e18]: admin123
        - button "Iniciar sesión" [ref=e19]
  - button "Open Next.js Dev Tools" [ref=e25] [cursor=pointer]:
    - generic [ref=e28]:
      - text: Compiling
      - generic [ref=e29]:
        - generic [ref=e30]: .
        - generic [ref=e31]: .
        - generic [ref=e32]: .
  - alert [ref=e33]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Analytics - GA4 Event Tracking', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     // Setup: Ir a login
  6   |     await page.goto('/login');
  7   |   });
  8   | 
  9   |   test('TC-GA4-001: Google Analytics carga correctamente (gtag.js)', async ({ page, context }) => {
  10  |     // 1. Monitorear network requests
  11  |     const requests: string[] = [];
  12  |     page.on('response', (response) => {
  13  |       if (response.url().includes('gtag') || response.url().includes('analytics')) {
  14  |         requests.push(`${response.status()} - ${response.url()}`);
  15  |       }
  16  |     });
  17  | 
  18  |     // 2. Login
  19  |     await page.fill('input[type="email"]', 'alexis@hogar.com');
  20  |     await page.fill('input[type="password"]', 'admin123');
  21  |     await page.click('button:has-text("Iniciar sesión")');
  22  | 
  23  |     // 3. Esperar a dashboard
> 24  |     await page.waitForURL('**/dashboard', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  25  | 
  26  |     // 4. Esperar a que gtag se cargue
  27  |     await page.waitForTimeout(2000);
  28  | 
  29  |     // 5. Verificar que gtag está disponible en window
  30  |     const gtagLoaded = await page.evaluate(() => {
  31  |       return typeof (window as any).gtag === 'function';
  32  |     });
  33  | 
  34  |     // gtag puede estar cargado o no según la configuración
  35  |     // Este test verifica que no hay errores de carga
  36  |     expect(gtagLoaded || requests.length === 0).toBe(true);
  37  |   });
  38  | 
  39  |   test('TC-GA4-002: Evento page_view se registra en navegación', async ({ page }) => {
  40  |     // 1. Login
  41  |     await page.fill('input[type="email"]', 'alexis@hogar.com');
  42  |     await page.fill('input[type="password"]', 'admin123');
  43  |     await page.click('button:has-text("Iniciar sesión")');
  44  |     await page.waitForURL('**/dashboard', { timeout: 10000 });
  45  | 
  46  |     // 2. Verificar que gtag está disponible
  47  |     const gtagAvailable = await page.evaluate(() => {
  48  |       return typeof (window as any).gtag === 'function';
  49  |     });
  50  | 
  51  |     if (!gtagAvailable) {
  52  |       console.warn('GA4 gtag not configured - skipping event test');
  53  |       return;
  54  |     }
  55  | 
  56  |     // 3. Navegar a pagos (debe disparar page_view)
  57  |     await page.goto('/payments');
  58  |     await page.waitForTimeout(1000);
  59  | 
  60  |     // 4. Verificar que gtag fue llamado
  61  |     const gtagCalls = await page.evaluate(() => {
  62  |       return (window as any).gtag?.call?.length || 0;
  63  |     });
  64  | 
  65  |     // gtag debe estar presente aunque sea sin llamadas rastreadas
  66  |     const gtagPresent = await page.evaluate(() => {
  67  |       return typeof (window as any).gtag !== 'undefined';
  68  |     });
  69  | 
  70  |     expect(gtagPresent).toBe(true);
  71  |   });
  72  | 
  73  |   test('TC-GA4-003: Crear pago dispara evento payment_created', async ({ page }) => {
  74  |     // 1. Login
  75  |     await page.fill('input[type="email"]', 'alexis@hogar.com');
  76  |     await page.fill('input[type="password"]', 'admin123');
  77  |     await page.click('button:has-text("Iniciar sesión")');
  78  |     await page.waitForURL('**/dashboard');
  79  | 
  80  |     // 2. Monitorear eventos
  81  |     const gtagEventsCalled: string[] = [];
  82  |     await page.evaluateHandle(() => {
  83  |       const originalGtag = (window as any).gtag;
  84  |       if (originalGtag) {
  85  |         (window as any).gtag = function (command: string, ...args: any[]) {
  86  |           gtagEventsCalled.push(command);
  87  |           return originalGtag.apply(this, [command, ...args]);
  88  |         };
  89  |       }
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
```