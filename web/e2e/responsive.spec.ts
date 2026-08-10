import { expect, test, type Page } from '@playwright/test';

const user = { id: 'user-1', username: 'rafa', displayName: 'Rafa', role: 'Owner' };
const filament = {
  id: 'spool-1', manufacturer: 'Test', productName: 'PLA mate', material: 'PLA', color: 'Negro', batchCode: null,
  purchaseCurrency: 'PYG', purchaseAmount: 131_250, exchangeRateGs: null, allocatedShippingGs: 0,
  allocatedImportFeesGs: 0, allocatedOtherCostsGs: 0, landedCostGs: 131_250, netWeightGrams: 1_000,
  remainingWeightGrams: 1_000, purchasedAt: null, supplier: null, isInventoryTracked: false, isActive: true
};
const breakdown = {
  quantity: 1, numberOfPlates: 1, materialCostGs: 18_637.5, materials: [],
  energy: { totalKWh: .513, costGs: 223.42, effectiveRateGsPerKWh: 435.51, usedMeasuredKWh: false },
  machine: { hourlyRateGs: 2_000, totalOccupiedHours: 5.4, costGs: 10_800, isConfigured: true },
  laborCostGs: 6_666.67, additionalCostGs: 2_000, marginBearingAdditionalCostGs: 2_000,
  nonMarginInternalCostGs: 0, nonMarginRecoveryChargeGs: 0, customerAdditionalChargeGs: 0, customerPassThroughGs: 0,
  directCostGs: 38_327.59, failureReserveGs: 4_258.62, totalOverheadGs: 2_129.31, fullyLoadedCostGs: 44_715.52,
  requiredNetPriceGs: 1_490_525.87, minimumMarginPriceGs: 1_479_879.31, suggestedNetPriceGs: 1_500_000,
  finalNetSalePriceGs: 1_500_000, variableSellingFeeGs: 0, netRevenueAfterSellingFeesGs: 1_500_000,
  revenueAvailableBeforeCostsGs: 1_500_000, estimatedProfitGs: 1_455_284.48, achievedMarginPercent: 97.02,
  markupPercent: 3_254.54, taxGs: 0, customerTotalGs: 1_500_000, unitCostGs: 44_715.52, unitPriceGs: 1_500_000,
  warnings: []
};
const simpleSettings = {
  machineHourlyRateGs: 2_000, preparationMinutes: 20, laborHourlyRateGs: 20_000,
  preparationCostGs: 6_666.67, packagingCostGs: 2_000, failureProbabilityPercent: 10,
  overheadPercent: 5, targetMarginPercent: 40, minimumMarginPercent: 30,
  minimumOrderGs: 30_000, roundingIncrementGs: 5_000, averagePrintPowerW: 95,
  electricityRateGsPerKWh: 435.51, printerName: 'Bambu Lab A1', electricityTariffName: 'ANDE',
  isUsingRecommendedDefaults: true, hasAdvancedOverrides: false, advancedOverrideMessages: []
};

function trackPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function mockApi(page: Page) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) { await route.continue(); return; }
    let body: unknown = [];
    if (path === '/api/auth/login-options') body = [{ id: user.id, username: user.username, displayName: user.displayName }];
    else if (path === '/api/auth/me') body = { user };
    else if (path === '/api/settings') body = {
      settings: { visibleAppName: 'Calculadora 3D' },
      readiness: { quickQuoteReady: true }
    };
    else if (path === '/api/pricing/simple-settings') body = simpleSettings;
    else if (path === '/api/filaments') body = [filament];
    else if (path === '/api/calculations/quick-quote-preview') body = {
      breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [],
      advancedRequest: { printerId: 'printer-1', calculationContext: 'QuickQuote', acceptStandardEnergyFallback: false }
    };
    else if (path === '/api/reports/summary') body = { quotes: 0, acceptedQuotes: 0, jobs: 0, completedJobs: 0, realizedProfitGs: 0 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

for (const viewport of [
  { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
  { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }
]) {
  test(`shell y cotización responden a ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await page.setViewportSize(viewport);
    await mockApi(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '¿Cuánto cobrar?' })).toBeVisible();

    const shell = await page.locator('.app-layout').evaluate(element => ({
      display: getComputedStyle(element).display,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    }));
    expect(shell.display).toBe('grid');
    expect(shell.documentWidth).toBeLessThanOrEqual(shell.viewportWidth);
    await expect(page.locator('.right-rail')).toHaveCount(0);
    const geometry = await page.evaluate(() => {
      const header = document.querySelector('.app-header')!.getBoundingClientRect();
      const main = document.querySelector('.app-layout > main')!.getBoundingClientRect();
      const sidebar = document.querySelector('.side-nav')!.getBoundingClientRect();
      return { headerBottom: header.bottom, mainTop: main.top, mainLeft: main.left, mainWidth: main.width, sidebarTop: sidebar.top, sidebarRight: sidebar.right };
    });
    expect(geometry.mainWidth).toBeGreaterThan(0);
    expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.mainTop + 1);
    if (viewport.width <= 1100) {
      await expect(page.locator('.side-nav')).toBeHidden();
      await expect(page.locator('.bottom-nav')).toBeVisible();
    } else {
      await expect(page.locator('.side-nav')).toBeVisible();
      await expect(page.locator('.bottom-nav')).toBeHidden();
      expect(geometry.sidebarRight).toBeLessThanOrEqual(geometry.mainLeft + 1);
      expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.sidebarTop + 1);
    }

    if (viewport.width === 360) {
      await page.getByRole('button', { name: 'Agregar filamento' }).click();
      const addDialog = page.getByRole('dialog', { name: 'Nuevo filamento' });
      const bounds = (await addDialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.height).toBeLessThanOrEqual(viewport.height);
      await page.getByRole('button', { name: 'Cerrar Nuevo filamento' }).click();
    }

    await page.getByLabel('Horas de impresión').fill('5');
    await page.getByLabel('Minutos de impresión').fill('24');
    await page.getByLabel('Gramos totales del slicer').fill('142');
    await expect(page.getByText('Podés cobrar')).toBeVisible();
    const priceFits = await page.locator('.dominant-price strong').evaluate(element => {
      const price = element.getBoundingClientRect();
      const widget = element.closest('.price-widget')!.getBoundingClientRect();
      return price.left >= widget.left && price.right <= widget.right;
    });
    expect(priceFits).toBe(true);
    await page.getByText('Ver cómo se calculó').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    if (viewport.width === 360) {
      await page.getByRole('button', { name: 'Guardar presupuesto' }).click();
      const saveDialog = page.getByRole('dialog', { name: 'Guardar presupuesto' });
      const bounds = (await saveDialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.height).toBeLessThanOrEqual(viewport.height);
      await page.getByRole('button', { name: 'Cerrar Guardar presupuesto' }).click();
    }

    if (viewport.width <= 1100) {
      const trigger = page.getByRole('button', { name: 'Abrir más opciones' });
      await trigger.click();
      const drawer = page.getByRole('dialog', { name: 'Más' });
      await expect(drawer).toBeVisible();
      expect((await drawer.boundingBox())!.width).toBeLessThanOrEqual(viewport.width * .9);
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(trigger).toBeFocused();

      await page.locator('.result-actions button').last().scrollIntoViewIfNeeded();
      const overlap = await page.evaluate(() => {
        const last = document.querySelector('.result-actions button:last-child')?.getBoundingClientRect();
        const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
        return last && nav ? last.bottom > nav.top : true;
      });
      expect(overlap).toBe(false);
    }
    expect(pageErrors).toEqual([]);
  });
}

test('las pantallas secundarias no generan overflow horizontal', async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await mockApi(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const route of ['/quotes', '/jobs', '/filaments', '/settings', '/settings/advanced', '/calculator', '/reports', '/profile']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sizes[0], `${route} at ${viewport.width}px`).toBeLessThanOrEqual(sizes[1]);
    }
  }
  expect(pageErrors).toEqual([]);
});

test('login móvil cabe completo sin una sesión verificada', async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) { await route.continue(); return; }
    if (path === '/api/auth/me') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      return;
    }
    if (path === '/api/auth/login') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user }) });
      return;
    }
    const body = path === '/api/auth/login-options'
      ? [{ id: user.id, username: user.username, displayName: user.displayName }]
      : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sizes[0]).toBeLessThanOrEqual(sizes[1]);
  await expect(page.getByLabel('Usuario')).toBeVisible();
  await expect(page.getByLabel('Usuario')).toHaveValue(user.username);
  await expect(page.getByRole('option', { name: user.displayName })).toHaveCount(1);
  await page.getByLabel('PIN').fill('1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: '¿Cuánto cobrar?' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
