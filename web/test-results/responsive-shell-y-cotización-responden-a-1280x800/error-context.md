# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> shell y cotización responden a 1280x800
- Location: e2e\responsive.spec.ts:48:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '¿Cuánto cobrar?' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: '¿Cuánto cobrar?' })

```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | 
  3   | const user = { id: 'user-1', username: 'rafa', displayName: 'Rafa', role: 'Owner' };
  4   | const filament = {
  5   |   id: 'spool-1', manufacturer: 'Test', productName: 'PLA mate', material: 'PLA', color: 'Negro', batchCode: null,
  6   |   purchaseCurrency: 'PYG', purchaseAmount: 131_250, exchangeRateGs: null, allocatedShippingGs: 0,
  7   |   allocatedImportFeesGs: 0, allocatedOtherCostsGs: 0, landedCostGs: 131_250, netWeightGrams: 1_000,
  8   |   remainingWeightGrams: 1_000, purchasedAt: null, supplier: null, isInventoryTracked: false, isActive: true
  9   | };
  10  | const breakdown = {
  11  |   quantity: 1, numberOfPlates: 1, materialCostGs: 18_637.5, materials: [],
  12  |   energy: { totalKWh: .513, costGs: 223.42, effectiveRateGsPerKWh: 435.51, usedMeasuredKWh: false },
  13  |   machine: { hourlyRateGs: 2_000, totalOccupiedHours: 5.4, costGs: 10_800, isConfigured: true },
  14  |   laborCostGs: 6_666.67, additionalCostGs: 2_000, marginBearingAdditionalCostGs: 2_000,
  15  |   nonMarginInternalCostGs: 0, nonMarginRecoveryChargeGs: 0, customerAdditionalChargeGs: 0, customerPassThroughGs: 0,
  16  |   directCostGs: 38_327.59, failureReserveGs: 4_258.62, totalOverheadGs: 2_129.31, fullyLoadedCostGs: 44_715.52,
  17  |   requiredNetPriceGs: 74_525.87, minimumMarginPriceGs: 63_879.31, suggestedNetPriceGs: 75_000,
  18  |   finalNetSalePriceGs: 75_000, variableSellingFeeGs: 0, netRevenueAfterSellingFeesGs: 75_000,
  19  |   revenueAvailableBeforeCostsGs: 75_000, estimatedProfitGs: 30_284.48, achievedMarginPercent: 40.38,
  20  |   markupPercent: 67.73, taxGs: 0, customerTotalGs: 75_000, unitCostGs: 44_715.52, unitPriceGs: 75_000,
  21  |   warnings: []
  22  | };
  23  | 
  24  | async function mockApi(page: Page) {
  25  |   await page.route('**/api/**', async route => {
  26  |     const path = new URL(route.request().url()).pathname;
  27  |     let body: unknown = [];
  28  |     if (path === '/api/auth/login-options') body = [{ id: user.id, username: user.username, displayName: user.displayName }];
  29  |     else if (path === '/api/auth/me') body = { user };
  30  |     else if (path === '/api/settings') body = {
  31  |       settings: { visibleAppName: 'Calculadora 3D' },
  32  |       readiness: { quickQuoteReady: true }
  33  |     };
  34  |     else if (path === '/api/filaments') body = [filament];
  35  |     else if (path === '/api/calculations/quick-quote-preview') body = {
  36  |       breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [],
  37  |       advancedRequest: { printerId: 'printer-1', calculationContext: 'QuickQuote', acceptStandardEnergyFallback: false }
  38  |     };
  39  |     else if (path === '/api/reports/summary') body = { quotes: 0, acceptedQuotes: 0, jobs: 0, completedJobs: 0, realizedProfitGs: 0 };
  40  |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  41  |   });
  42  | }
  43  | 
  44  | for (const viewport of [
  45  |   { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
  46  |   { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }
  47  | ]) {
  48  |   test(`shell y cotización responden a ${viewport.width}x${viewport.height}`, async ({ page }) => {
  49  |     await page.setViewportSize(viewport);
  50  |     await mockApi(page);
  51  |     await page.goto('/');
> 52  |     await expect(page.getByRole('heading', { name: '¿Cuánto cobrar?' })).toBeVisible();
      |                                                                          ^ Error: expect(locator).toBeVisible() failed
  53  | 
  54  |     const shell = await page.locator('.app-layout').evaluate(element => ({
  55  |       display: getComputedStyle(element).display,
  56  |       documentWidth: document.documentElement.scrollWidth,
  57  |       viewportWidth: document.documentElement.clientWidth
  58  |     }));
  59  |     expect(shell.display).toBe('grid');
  60  |     expect(shell.documentWidth).toBeLessThanOrEqual(shell.viewportWidth);
  61  |     await expect(page.locator('.right-rail')).toHaveCount(0);
  62  |     if (viewport.width <= 1100) {
  63  |       await expect(page.locator('.side-nav')).toBeHidden();
  64  |       await expect(page.locator('.bottom-nav')).toBeVisible();
  65  |     } else {
  66  |       await expect(page.locator('.side-nav')).toBeVisible();
  67  |       await expect(page.locator('.bottom-nav')).toBeHidden();
  68  |     }
  69  | 
  70  |     await page.getByLabel('Horas de impresión').fill('5');
  71  |     await page.getByLabel('Minutos de impresión').fill('24');
  72  |     await page.getByLabel('Gramos totales del slicer').fill('142');
  73  |     await expect(page.getByText('Podés cobrar')).toBeVisible();
  74  |     const priceFits = await page.locator('.dominant-price strong').evaluate(element => {
  75  |       const price = element.getBoundingClientRect();
  76  |       const widget = element.closest('.price-widget')!.getBoundingClientRect();
  77  |       return price.left >= widget.left && price.right <= widget.right;
  78  |     });
  79  |     expect(priceFits).toBe(true);
  80  | 
  81  |     if (viewport.width <= 1100) {
  82  |       const trigger = page.getByRole('button', { name: 'Abrir más opciones' });
  83  |       await trigger.click();
  84  |       const drawer = page.getByRole('dialog', { name: 'Más' });
  85  |       await expect(drawer).toBeVisible();
  86  |       expect((await drawer.boundingBox())!.width).toBeLessThanOrEqual(viewport.width * .9);
  87  |       await page.keyboard.press('Escape');
  88  |       await expect(drawer).toBeHidden();
  89  |       await expect(trigger).toBeFocused();
  90  | 
  91  |       await page.locator('.result-actions button').last().scrollIntoViewIfNeeded();
  92  |       const overlap = await page.evaluate(() => {
  93  |         const last = document.querySelector('.result-actions button:last-child')?.getBoundingClientRect();
  94  |         const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
  95  |         return last && nav ? last.bottom > nav.top : true;
  96  |       });
  97  |       expect(overlap).toBe(false);
  98  |     }
  99  |   });
  100 | }
  101 | 
  102 | test('las pantallas secundarias no generan overflow horizontal', async ({ page }) => {
  103 |   await page.setViewportSize({ width: 390, height: 844 });
  104 |   await mockApi(page);
  105 |   for (const route of ['/quotes', '/jobs', '/filaments', '/settings', '/settings/advanced', '/calculator', '/reports', '/profile']) {
  106 |     await page.goto(route);
  107 |     await expect(page.locator('h1')).toBeVisible();
  108 |     const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  109 |     expect(sizes[0], route).toBeLessThanOrEqual(sizes[1]);
  110 |   }
  111 | });
  112 | 
```