import { test as setup } from '@playwright/test';

const AUTH_FILE = 'tests/e2e/.auth/user.json';

setup('authenticate', async ({ page, context }) => {
  // Intentar login con credenciales de test
  await page.goto('/login');

  // Completar formulario de login
  await page.fill('input[type="email"]', 'alexis@hogar.com');
  await page.fill('input[type="password"]', 'admin123');

  // Click en botón Iniciar sesión (varios selectores posibles)
  try {
    await page.click('button:has-text("Iniciar sesión")');
  } catch {
    // Si no encuentra con has-text, buscar por atributo o tipo
    const buttons = page.locator('button[type="submit"]');
    await buttons.first().click();
  }

  // Esperar a que se autentique
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {
    console.warn('Dashboard redirect timeout - continuando...');
  });

  // Guardar el estado de autenticación
  await context.storageState({ path: AUTH_FILE });
});
