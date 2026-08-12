import { devices, expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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
  requiredNetPriceGs: 74_525.87, minimumMarginPriceGs: 63_879.31, suggestedNetPriceGs: 75_000,
  finalNetSalePriceGs: 75_000, variableSellingFeeGs: 0, netRevenueAfterSellingFeesGs: 75_000,
  revenueAvailableBeforeCostsGs: 75_000, estimatedProfitGs: 30_284.48, achievedMarginPercent: 40.38,
  markupPercent: 67.73, taxGs: 0, customerTotalGs: 75_000, unitCostGs: 44_715.52, unitPriceGs: 75_000,
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
      settings: {
        visibleAppName: 'Calculadora 3D', brandLogo: null, brandDisplayName: null,
        brandContactLine: 'WhatsApp 0981 000 000', clientQuoteNote: 'Hecho especialmente para vos.',
        clientQuoteValidityDays: 7
      },
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

async function openClientQuote(page: Page) {
  await page.goto('/');
  await page.getByLabel('Horas de impresión').fill('5');
  await page.getByLabel('Minutos de impresión').fill('24');
  await page.getByLabel('Gramos totales del slicer').fill('142');
  await expect(page.getByText('Podés cobrar')).toBeVisible();
  await page.getByRole('button', { name: 'Compartir con cliente' }).click();
  return page.getByRole('dialog', { name: 'Compartir con cliente' });
}

async function inspectDownloadedPng(page: Page, download: Download, point = { x: .5, y: .5 }) {
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const encoded = (await readFile(downloadedPath!)).toString('base64');
  return page.evaluate(({ imageBase64, sample }) => new Promise<{ width: number; height: number; pixel: number[] }>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Canvas no disponible.')); return; }
      context.drawImage(image, 0, 0);
      const pixel = Array.from(context.getImageData(
        Math.min(canvas.width - 1, Math.max(0, Math.round(sample.x * canvas.width))),
        Math.min(canvas.height - 1, Math.max(0, Math.round(sample.y * canvas.height))),
        1, 1
      ).data);
      resolve({ width: image.naturalWidth, height: image.naturalHeight, pixel });
    }, { once: true });
    image.addEventListener('error', () => reject(new Error('No se pudo leer el PNG exportado.')), { once: true });
    image.src = `data:image/png;base64,${imageBase64}`;
  }), { imageBase64: encoded, sample: point });
}

async function createModelFixture(page: Page) {
  const fixtureBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 240;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#d600a8'; context.fillRect(0, 0, 240, 240);
    context.fillStyle = '#ffd24a'; context.fillRect(24, 24, 54, 54);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(fixtureBase64, 'base64');
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

test('la cotización para cliente funciona a 360 px sin imagen ni overflow horizontal', async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await mockApi(page);
  const dialog = await openClientQuote(page);

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ctrl+V en Windows')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Pegar del portapapeles' })).toBeVisible();
  await expect(dialog.locator('.client-paste-zone')).toBeFocused();
  const card = dialog.getByTestId('client-quote-card');
  await expect(card).toContainText('Gs. 75.000');
  await expect(card).toContainText('PLA · Negro');
  await expect(card).toContainText('142 g');
  await expect(card).toContainText('5 h 24 min');
  await expect(card).toContainText('CRAF 3D');
  await expect(card).not.toContainText('Calculadora 3D');
  await expect(card).toContainText('Presupuesto personalizado');
  await expect(card.getByTestId('client-quote-contact')).toContainText('WhatsApp 0981 000 000');
  const brandLogo = card.getByLabel('Logo comercial').locator('img');
  await expect(brandLogo).toBeVisible();
  await expect(brandLogo).toHaveJSProperty('naturalWidth', 1080);
  await expect(card.getByRole('img', { name: 'Vista del modelo a imprimir' })).toHaveCount(0);
  const geometry = await page.evaluate(() => {
    const modal = document.querySelector('.client-quote-dialog')!.getBoundingClientRect();
    const preview = document.querySelector('[data-testid="client-quote-card"]') as HTMLElement;
    const previewBounds = preview.getBoundingClientRect();
    return {
      modalLeft: modal.left, modalRight: modal.right, modalHeight: modal.height,
      documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth,
      cardOverflow: preview.scrollWidth > preview.clientWidth,
      cardClientWidth: preview.clientWidth,
      cardScrollWidth: preview.scrollWidth,
      cardWidth: previewBounds.width,
      cardHeight: previewBounds.height,
      cardDisplay: getComputedStyle(preview).display,
      priceFontSize: parseFloat(getComputedStyle(preview.querySelector('.client-quote-price strong')!).fontSize),
      titleFontSize: parseFloat(getComputedStyle(preview.querySelector('.client-quote-intro h3')!).fontSize),
      detailFontSize: parseFloat(getComputedStyle(preview.querySelector('.client-quote-specs dd')!).fontSize),
      headerHeight: preview.querySelector('.client-quote-brand')!.getBoundingClientRect().height,
      priceHeight: preview.querySelector('.client-quote-price')!.getBoundingClientRect().height,
      specsHeight: preview.querySelector('.client-quote-specs')!.getBoundingClientRect().height,
      maxSectionGap: Array.from(preview.children).slice(1).reduce((largest, element, index) => {
        const previous = preview.children[index].getBoundingClientRect();
        const current = element.getBoundingClientRect();
        return Math.max(largest, current.top - previous.bottom);
      }, 0),
      overflowChildren: Array.from(preview.querySelectorAll<HTMLElement>('*')).filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < previewBounds.left - 1 || bounds.right > previewBounds.right + 1;
      }).map(element => ({ tag: element.tagName, className: element.className, text: element.textContent?.slice(0, 40) }))
    };
  });
  expect(geometry.modalLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.modalRight).toBeLessThanOrEqual(360);
  expect(geometry.modalHeight).toBeLessThanOrEqual(800);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.cardOverflow, JSON.stringify(geometry)).toBe(false);
  expect(Math.abs(geometry.cardWidth - geometry.cardHeight)).toBeLessThanOrEqual(1);
  expect(geometry.cardDisplay).toBe('grid');
  expect(geometry.maxSectionGap).toBeLessThan(geometry.cardHeight * .08);
  expect(geometry.priceFontSize).toBeGreaterThan(geometry.titleFontSize);
  expect(geometry.priceFontSize).toBeGreaterThan(geometry.detailFontSize * 2);
  expect(geometry.headerHeight).toBeLessThan(geometry.priceHeight);
  expect(geometry.specsHeight).toBeGreaterThan(geometry.detailFontSize * 2.5);
  expect(geometry.specsHeight).toBeLessThan(geometry.priceHeight);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Descargar PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cotizacion-c3d-.+\.png$/);
  expect(await inspectDownloadedPng(page, download)).toMatchObject({ width: 1080, height: 1080 });
  const exportedHeader = await inspectDownloadedPng(page, download, { x: .5, y: .1 });
  expect(exportedHeader.pixel[0]).toBeGreaterThan(220);
  expect(exportedHeader.pixel[1]).toBeGreaterThan(200);
  expect(exportedHeader.pixel[2]).toBeGreaterThan(170);
  expect(pageErrors).toEqual([]);
});

test('la cotización desktop acepta Ctrl+V y replica la captura en preview y export stage', async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page);
  const dialog = await openClientQuote(page);
  const png = await createModelFixture(page);
  await page.evaluate(encoded => {
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const file = new File([bytes], 'captura-portapapeles.png', { type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
  }, png.toString('base64'));

  await expect(dialog.getByText('Imagen pegada desde el portapapeles.')).toHaveAttribute('role', 'status');
  const previewImage = dialog.getByTestId('client-quote-card').getByRole('img', { name: 'Vista del modelo a imprimir' });
  await expect(previewImage).toBeVisible();
  await expect(previewImage).toHaveJSProperty('naturalWidth', 240);
  const exportImage = dialog.getByTestId('client-quote-export-card').locator('img[alt="Vista del modelo a imprimir"]');
  await expect(exportImage).toHaveCount(1);
  await expect(exportImage).toHaveJSProperty('naturalWidth', 240);

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Descargar PNG' }).click();
  const download = await downloadPromise;
  expect(await inspectDownloadedPng(page, download)).toMatchObject({ width: 1080, height: 1080 });
  expect(pageErrors).toEqual([]);
});

test('la cotización desktop acepta una captura y descarga el PNG como fallback de Web Share', async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  });
  await mockApi(page);
  const dialog = await openClientQuote(page);
  const png = await createModelFixture(page);
  const galleryInput = dialog.getByLabel('Elegir imagen de Fotos o archivos');
  await expect(galleryInput).not.toHaveAttribute('capture');
  await expect(dialog.getByLabel('Tomar foto del modelo')).toHaveAttribute('capture', 'environment');
  await galleryInput.setInputFiles({ name: 'slicer.png', mimeType: 'image/png', buffer: png });
  const previewCard = dialog.getByTestId('client-quote-card');
  const previewImage = previewCard.getByRole('img', { name: 'Vista del modelo a imprimir' });
  await expect(previewImage).toBeVisible();
  await expect(previewImage).toHaveJSProperty('naturalWidth', 240);
  const imageGeometry = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="client-quote-card"]')!.getBoundingClientRect();
    const image = document.querySelector('[data-testid="client-quote-card"] .client-quote-model img')!.getBoundingClientRect();
    return {
      sample: { x: (image.left + image.width / 2 - card.left) / card.width, y: (image.top + image.height / 2 - card.top) / card.height },
      cardWidth: card.width, cardHeight: card.height, imageWidth: image.width, imageHeight: image.height,
      headerHeight: document.querySelector('[data-testid="client-quote-card"] .client-quote-brand')!.getBoundingClientRect().height
    };
  });
  expect(Math.abs(imageGeometry.cardWidth - imageGeometry.cardHeight)).toBeLessThanOrEqual(1);
  expect(imageGeometry.imageWidth).toBeGreaterThan(imageGeometry.cardWidth * .45);
  expect(imageGeometry.imageHeight).toBeGreaterThan(imageGeometry.cardHeight * .35);
  expect(imageGeometry.imageHeight).toBeGreaterThan(imageGeometry.headerHeight * 3);
  const exportGeometry = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="client-quote-export-card"]')!.getBoundingClientRect();
    return {
      card: { top: card.top, bottom: card.bottom, height: card.height },
      children: Array.from(document.querySelector('[data-testid="client-quote-export-card"]')!.children).map(element => {
        const bounds = element.getBoundingClientRect();
        return { className: element.className, top: bounds.top - card.top, bottom: bounds.bottom - card.top, height: bounds.height };
      })
    };
  });
  const exportOverflow = exportGeometry.children.filter(child => child.top < -1 || child.bottom > exportGeometry.card.height + 1);
  expect(exportOverflow, JSON.stringify(exportGeometry)).toEqual([]);

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Compartir imagen' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cotizacion-c3d-.+\.png$/);
  const exported = await inspectDownloadedPng(page, download, imageGeometry.sample);
  expect(exported).toMatchObject({ width: 1080, height: 1080 });
  expect(exported.pixel[0]).toBeGreaterThan(180);
  expect(exported.pixel[1]).toBeLessThan(80);
  expect(exported.pixel[2]).toBeGreaterThan(120);
  expect(exported.pixel[3]).toBeGreaterThan(200);
  await expect(dialog.getByText(/no permite compartir archivos.*Descargamos el PNG/i)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('el contrato iPhone separa Fotos de cámara y permite cargar desde galería', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  try {
    const pageErrors = trackPageErrors(page);
    await mockApi(page);
    const dialog = await openClientQuote(page);
    const galleryInput = dialog.getByLabel('Elegir imagen de Fotos o archivos');
    const cameraInput = dialog.getByLabel('Tomar foto del modelo');
    await expect(galleryInput).toHaveAttribute('accept', 'image/*');
    await expect(galleryInput).not.toHaveAttribute('capture');
    await expect(cameraInput).toHaveAttribute('accept', 'image/*');
    await expect(cameraInput).toHaveAttribute('capture', 'environment');

    const png = await createModelFixture(page);
    await galleryInput.setInputFiles({ name: 'foto-desde-galeria.png', mimeType: 'image/png', buffer: png });
    await expect(dialog.getByTestId('client-quote-card').getByRole('img', { name: 'Vista del modelo a imprimir' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
