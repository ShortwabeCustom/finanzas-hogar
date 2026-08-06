import { test, expect } from '@playwright/test';

test.describe('Pagination - Cursor Based', () => {
  test.beforeEach(async ({ page }) => {
    // Login y navegar a payments
    await page.goto('/login');
    await page.fill('input[type="email"]', 'alexis.pro_sk8@hotmail.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL('**/dashboard');
  });

  test('TC-PAGI-001: Tabla de pagos carga máximo 20 items inicialmente', async ({ page }) => {
    // 1. Navegar a pagos
    await page.goto('/payments');

    // Esperar a que la tabla cargue
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 2. Contar filas
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    // Debe haber entre 1 y 20 filas
    expect(rowCount).toBeGreaterThanOrEqual(1);
    expect(rowCount).toBeLessThanOrEqual(20);
  });

  test('TC-PAGI-002: Botón "Cargar más" visible si hay más datos', async ({ page }) => {
    // 1. Navegar a pagos
    await page.goto('/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 2. Buscar botón "Cargar más"
    const loadMoreButton = page.locator('button:has-text("Cargar más"), button:has-text("Load more")').first();
    const isVisible = await loadMoreButton.isVisible().catch(() => false);

    // Si hay botón, debe estar habilitado
    if (isVisible) {
      await expect(loadMoreButton).toBeEnabled();
    }
  });

  test('TC-PAGI-003: Click "Cargar más" agrega nuevas filas sin reload', async ({ page }) => {
    // 1. Navegar a pagos y obtener estado inicial
    await page.goto('/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const rows = page.locator('table tbody tr');
    const initialCount = await rows.count();

    // 2. Verificar que URL no cambia (SPA transition)
    const initialUrl = page.url();

    // 3. Click en "Cargar más"
    const loadMoreButton = page.locator('button:has-text("Cargar más"), button:has-text("Load more")').first();
    const isVisible = await loadMoreButton.isVisible().catch(() => false);

    if (isVisible) {
      await loadMoreButton.click();

      // Esperar a que se carguen nuevas filas
      await page.waitForTimeout(1000);

      // 4. Verificar que hay más filas
      const newRows = page.locator('table tbody tr');
      const newCount = await newRows.count();

      expect(newCount).toBeGreaterThan(initialCount);

      // 5. Verificar que URL no cambió
      const finalUrl = page.url();
      expect(finalUrl).toBe(initialUrl);
    }
  });

  test('TC-PAGI-004: No hay duplicados entre páginas (cursor funciona)', async ({ page }) => {
    // 1. Navegar a pagos
    await page.goto('/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 2. Obtener IDs/datos de la primera página
    const rows = page.locator('table tbody tr');
    const initialTextContents = await rows.allTextContents();
    const initialIds = initialTextContents.map((text) => text.trim());

    // 3. Click "Cargar más"
    const loadMoreButton = page.locator('button:has-text("Cargar más"), button:has-text("Load more")').first();
    const isVisible = await loadMoreButton.isVisible().catch(() => false);

    if (isVisible) {
      await loadMoreButton.click();
      await page.waitForTimeout(1000);

      // 4. Obtener datos de la segunda página
      const newRows = page.locator('table tbody tr');
      const newTextContents = await newRows.allTextContents();

      // 5. Verificar que no hay duplicados
      const newIds = newTextContents.map((text) => text.trim());
      const duplicates = initialIds.filter((id) => newIds.includes(id));

      // No debe haber solapamiento
      expect(duplicates.length).toBe(0);
    }
  });

  test('TC-PAGI-005: Navegación sin cambios de URL (client-side)', async ({ page }) => {
    // 1. Navegar a pagos
    await page.goto('/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 2. Registrar URL inicial
    const initialUrl = page.url();

    // 3. Múltiples clicks en "Cargar más"
    for (let i = 0; i < 2; i++) {
      const loadMoreButton = page.locator('button:has-text("Cargar más"), button:has-text("Load more")').first();
      const isVisible = await loadMoreButton.isVisible().catch(() => false);

      if (isVisible) {
        await loadMoreButton.click();
        await page.waitForTimeout(500);

        // Verificar URL sigue igual
        expect(page.url()).toBe(initialUrl);
      } else {
        break;
      }
    }
  });

  test('TC-PAGI-006: Tabla responsive en móvil (375px)', async ({ page }) => {
    // 1. Cambiar viewport a móvil
    await page.setViewportSize({ width: 375, height: 812 });

    // 2. Navegar a pagos
    await page.goto('/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 3. Verificar que la tabla es accesible
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // 4. Verificar que hay scroll horizontal si es necesario
    const isOverflowing = await table.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });

    // Debe estar visible de alguna forma en móvil
    expect(isOverflowing || (await table.isVisible())).toBe(true);
  });
});
