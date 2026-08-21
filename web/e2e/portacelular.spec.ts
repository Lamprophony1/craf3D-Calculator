import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const PUBLIC_PATH = '/portacelular';
const MOUNTING_GIF = '/media/portacelular/montaje-portacelular.gif';
const ANTISTRESS_GIF = '/media/portacelular/rueda-antistres.gif';
const MOUNTING_STATIC = '/media/portacelular/montaje-portacelular-static.jpg';
const ANTISTRESS_STATIC = '/media/portacelular/rueda-antistres-static.jpg';
const MOUNTING_ALT = 'Secuencia que muestra cómo abrir el llavero y usarlo como portacelular';
const ANTISTRESS_ALT = 'Secuencia que muestra el movimiento de la ruedita antiestrés';
const INSTAGRAM_URL = 'https://www.instagram.com/craf.3d/';
const WHATSAPP_URL =
  'https://wa.me/595973427508?text=Hola%20CRAF%203D%2C%20vi%20el%20portacelular%20y%20quiero%20consultar%20por%20un%20producto%20personalizado.';

type RuntimeDiagnostics = {
  apiRequests: string[];
  requestPaths: string[];
  pageErrors: string[];
  consoleErrors: string[];
  requestFailures: string[];
  responseFailures: string[];
};

function requestPath(url: string) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function trackRuntime(page: Page): RuntimeDiagnostics {
  const diagnostics: RuntimeDiagnostics = {
    apiRequests: [],
    requestPaths: [],
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    responseFailures: []
  };

  page.on('request', request => {
    const path = requestPath(request.url());
    diagnostics.requestPaths.push(path);
    if (path.startsWith('/api/')) diagnostics.apiRequests.push(`${request.method()} ${path}`);
  });
  page.on('pageerror', error => diagnostics.pageErrors.push(error.stack ?? error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const location = message.location().url ? ` at ${message.location().url}` : '';
    diagnostics.consoleErrors.push(`${message.text()}${location}`);
  });
  page.on('requestfailed', request => {
    diagnostics.requestFailures.push(
      `${request.method()} ${requestPath(request.url())}: ${request.failure()?.errorText ?? 'unknown failure'}`
    );
  });
  page.on('response', response => {
    if (response.status() < 400) return;
    diagnostics.responseFailures.push(
      `${response.status()} ${response.request().method()} ${requestPath(response.url())}`
    );
  });

  return diagnostics;
}

function expectCleanRuntime(diagnostics: RuntimeDiagnostics) {
  expect(diagnostics.pageErrors, 'uncaught page errors').toEqual([]);
  expect(diagnostics.consoleErrors, 'browser console errors').toEqual([]);
  expect(diagnostics.requestFailures, 'failed browser requests').toEqual([]);
  expect(diagnostics.responseFailures, 'HTTP responses with status >= 400').toEqual([]);
}

async function settlePage(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function openPublicPage(page: Page) {
  await page.route('**/api/**', route => {
    const path = requestPath(route.request().url());
    return path.startsWith('/api/') ? route.abort('blockedbyclient') : route.continue();
  });
  await page.goto(PUBLIC_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.public-product-page')).toBeVisible();
  await settlePage(page);
}

async function expectExternalLink(locator: Locator, href: string) {
  await expect(locator).toHaveAttribute('href', href);
  await expect(locator).toHaveAttribute('target', '_blank');
  await expect(locator).toHaveAttribute('rel', /\bnoopener\b/);
  await expect(locator).toHaveAttribute('rel', /\bnoreferrer\b/);
}

async function waitForImage(locator: Locator, label: string) {
  await expect(locator, `${label} should render`).toBeVisible();
  await expect.poll(
    () => locator.evaluate(element => {
      const image = element as HTMLImageElement;
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    }),
    { message: `${label} should load successfully`, timeout: 15_000 }
  ).toBe(true);

  const naturalSize = await locator.evaluate(element => {
    const image = element as HTMLImageElement;
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(naturalSize.width, `${label} natural width`).toBeGreaterThan(0);
  expect(naturalSize.height, `${label} natural height`).toBeGreaterThan(0);
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  expect(geometry.scrollWidth, `${label}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.bodyScrollWidth, `${label}: body overflow ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.clientWidth);
}

async function scrollLocatorToCenter(page: Page, locator: Locator) {
  await locator.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'auto' }));
  await settlePage(page);
}

async function saveScreenshot(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage,
    animations: 'disabled'
  });
}

test('la ruta pública muestra la experiencia compacta, carga ambos GIF y no toca APIs privadas', async ({ page, context }) => {
  const diagnostics = trackRuntime(page);
  await context.clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });
  await openPublicPage(page);

  expect(await context.cookies(), 'la ruta pública se valida explícitamente sin cookies').toEqual([]);

  await expect(page).toHaveTitle('Portacelular 2 en 1 | CRAF 3D');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Aprendé a montar el portacelular personalizado de CRAF 3D y descubrí su ruedita antiestrés.'
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#9f3500');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Tu llavero tiene dos modos' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Abrilo y apoyá tu celular' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Girá la ruedita con el pulgar' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '¿Te gustó? Lo personalizamos para vos.' })).toBeVisible();
  await expect(page.locator('#modo-portacelular')).toHaveCount(1);
  await expect(page.locator('#modo-antistress')).toHaveCount(1);
  await expect(page.locator('.public-product-gif-section')).toHaveCount(2);
  await expect(page.locator('.public-product-gif-frame')).toHaveCount(2);

  const mountingGif = page.getByRole('img', { name: MOUNTING_ALT, exact: true });
  const antistressGif = page.getByRole('img', { name: ANTISTRESS_ALT, exact: true });

  await expect(mountingGif).toHaveAttribute('src', MOUNTING_GIF);
  await expect(mountingGif).toHaveAttribute('width', '600');
  await expect(mountingGif).toHaveAttribute('height', '800');
  await expect(mountingGif).toHaveAttribute('loading', 'eager');
  await expect(mountingGif).toHaveAttribute('decoding', 'async');
  await expect(mountingGif).toHaveAttribute('fetchpriority', 'high');

  await expect(antistressGif).toHaveAttribute('src', ANTISTRESS_GIF);
  await expect(antistressGif).toHaveAttribute('width', '600');
  await expect(antistressGif).toHaveAttribute('height', '800');
  await expect(antistressGif).toHaveAttribute('loading', 'lazy');
  await expect(antistressGif).toHaveAttribute('decoding', 'async');
  await expect(antistressGif).not.toHaveAttribute('fetchpriority', 'high');

  await waitForImage(mountingGif, 'mounting GIF');
  await scrollLocatorToCenter(page, antistressGif);
  await waitForImage(antistressGif, 'antistress GIF');

  await expect(page.locator(`img[src="${MOUNTING_GIF}"]`)).toHaveCount(1);
  await expect(page.locator(`img[src="${ANTISTRESS_GIF}"]`)).toHaveCount(1);
  await expect(page.locator('main img')).toHaveCount(2);
  expect(diagnostics.requestPaths).toContain(MOUNTING_GIF);
  expect(diagnostics.requestPaths).toContain(ANTISTRESS_GIF);

  const details = page.locator('.public-product-gif-section details');
  await expect(details).toHaveCount(2);
  await expect(details.locator('summary')).toHaveText(['Ver pasos en texto', 'Ver pasos en texto']);
  expect(await details.evaluateAll(elements => elements.every(element => !(element as HTMLDetailsElement).open))).toBe(true);

  await expect(page.getByText('Video de montaje en preparación', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Video de la ruedita antiestrés en preparación', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Diseñado para ser distinto', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Personalizable', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Impreso en 3D', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Hecho a medida', { exact: true })).toHaveCount(0);
  await expect(page.locator('.public-product-modes')).toHaveCount(0);
  await expect(page.locator('.public-product-story')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/\btratar\b|\bansiedad\b|\bterapia\b|\bclínico\b/i);

  const headerInstagram = page.locator('.public-product-header').locator(`a[href="${INSTAGRAM_URL}"]`);
  await expect(headerInstagram).toHaveCount(0);

  const cta = page.locator('.public-product-final-cta');
  const whatsapp = cta.getByRole('link', { name: 'Quiero uno personalizado', exact: true });
  const ctaInstagram = cta.getByRole('link', { name: 'Ver más trabajos', exact: true });
  const footerInstagram = page.locator('.public-product-footer').getByRole('link', { name: /@craf\.3d/i });
  await expectExternalLink(whatsapp, WHATSAPP_URL);
  await expectExternalLink(ctaInstagram, INSTAGRAM_URL);
  await expectExternalLink(footerInstagram, INSTAGRAM_URL);
  await expect(page.locator(`a[href="${INSTAGRAM_URL}"]`)).toHaveCount(2);

  await expect(page.locator('.login-page')).toHaveCount(0);
  await expect(page.locator('.app-layout')).toHaveCount(0);
  await expect(page.locator('.app-header')).toHaveCount(0);
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  expect(diagnostics.apiRequests, 'the public route must make zero API requests').toEqual([]);
  expectCleanRuntime(diagnostics);
});

test('movimiento reducido usa primeros fotogramas estáticos y conserva todo el instructivo', async ({ page }) => {
  const diagnostics = trackRuntime(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openPublicPage(page);

  const mountingImage = page.getByRole('img', { name: MOUNTING_ALT });
  const antistressImage = page.getByRole('img', { name: ANTISTRESS_ALT });
  await expect(mountingImage).toHaveAttribute('src', MOUNTING_STATIC);
  await expect(antistressImage).toHaveAttribute('src', ANTISTRESS_STATIC);
  await waitForImage(mountingImage, 'static mounting frame');
  await scrollLocatorToCenter(page, antistressImage);
  await waitForImage(antistressImage, 'static antistress frame');

  const resumeButtons = page.getByRole('button', { name: /Reproducir animación:/ });
  await expect(resumeButtons).toHaveCount(2);
  await expect(resumeButtons.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(resumeButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Ver pasos en texto', { exact: true })).toHaveCount(2);

  expect(diagnostics.requestPaths).toContain(MOUNTING_STATIC);
  expect(diagnostics.requestPaths).toContain(ANTISTRESS_STATIC);
  expect(diagnostics.requestPaths).not.toContain(MOUNTING_GIF);
  expect(diagnostics.requestPaths).not.toContain(ANTISTRESS_GIF);

  await resumeButtons.nth(0).click();
  await expect(mountingImage).toHaveAttribute('src', MOUNTING_GIF);
  await waitForImage(mountingImage, 'explicitly resumed mounting GIF');
  expect(diagnostics.requestPaths).toContain(MOUNTING_GIF);
  expect(diagnostics.requestPaths).not.toContain(ANTISTRESS_GIF);
  expect(diagnostics.apiRequests).toEqual([]);
  expectCleanRuntime(diagnostics);
});

test('390x844 prioriza el primer uso y mantiene la experiencia dentro de 3.6 pantallas', async ({ page }) => {
  const diagnostics = trackRuntime(page);
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await openPublicPage(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await settlePage(page);

  const header = page.locator('.public-product-header');
  const heading = page.getByRole('heading', { level: 1, name: 'Tu llavero tiene dos modos' });
  const mountingGif = page.getByRole('img', { name: MOUNTING_ALT, exact: true });
  const antistressGif = page.getByRole('img', { name: ANTISTRESS_ALT, exact: true });
  const cta = page.locator('.public-product-final-cta');

  await expect(header).toBeVisible();
  await expect(heading).toBeVisible();
  await waitForImage(mountingGif, 'mounting GIF');

  const headerBounds = await header.boundingBox();
  const mountingBounds = await mountingGif.boundingBox();
  const antistressBounds = await antistressGif.boundingBox();
  const ctaBounds = await cta.boundingBox();
  expect(headerBounds, 'compact header bounds').not.toBeNull();
  expect(mountingBounds, 'mounting GIF bounds').not.toBeNull();
  expect(antistressBounds, 'antistress GIF bounds').not.toBeNull();
  expect(ctaBounds, 'commercial CTA bounds').not.toBeNull();

  expect(headerBounds!.height).toBeGreaterThanOrEqual(55.5);
  expect(headerBounds!.height).toBeLessThanOrEqual(64.5);

  const headingMetrics = await heading.evaluate(element => {
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return { height: element.getBoundingClientRect().height, lineHeight };
  });
  expect(Number.isFinite(headingMetrics.lineHeight), 'H1 needs an explicit measurable line-height').toBe(true);
  expect(headingMetrics.height, 'H1 should occupy at most two lines at 390px').toBeLessThanOrEqual(
    headingMetrics.lineHeight * 2.05
  );

  expect(mountingBounds!.y, 'the first GIF must start before vertical pixel 700').toBeLessThan(700);
  const visibleMountingHeight = Math.max(
    0,
    Math.min(mountingBounds!.y + mountingBounds!.height, viewport.height) - Math.max(mountingBounds!.y, 0)
  );
  expect(visibleMountingHeight, 'a meaningful part of the first GIF should be in the first screen').toBeGreaterThanOrEqual(
    mountingBounds!.height * 0.2
  );
  expect(mountingBounds!.width / mountingBounds!.height, 'the first GIF frame should remain 3:4').toBeCloseTo(0.75, 1);

  expect(
    antistressBounds!.y,
    'the second GIF should be reachable after roughly one natural viewport scroll'
  ).toBeLessThanOrEqual(viewport.height * 2);
  expect(ctaBounds!.y, 'the commercial CTA must follow both instructions').toBeGreaterThanOrEqual(
    antistressBounds!.y + antistressBounds!.height
  );

  const lengthMetrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight
  }));
  expect(lengthMetrics.scrollHeight).toBeLessThanOrEqual(lengthMetrics.viewportHeight * 3.6);
  await expectNoHorizontalOverflow(page, '390x844 compact experience');

  await scrollLocatorToCenter(page, antistressGif);
  await waitForImage(antistressGif, 'antistress GIF');
  expect(diagnostics.requestPaths).toContain(MOUNTING_GIF);
  expect(diagnostics.requestPaths).toContain(ANTISTRESS_GIF);
  expect(diagnostics.apiRequests, 'compactness checks must remain independent of APIs').toEqual([]);
  expectCleanRuntime(diagnostics);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 }
]) {
  test(`la página compacta no desborda a ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const diagnostics = trackRuntime(page);
    await page.setViewportSize(viewport);
    await openPublicPage(page);

    await expect(page.locator('.public-product-header')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Tu llavero tiene dos modos' })).toBeVisible();
    await waitForImage(page.getByRole('img', { name: MOUNTING_ALT, exact: true }), 'mounting GIF');
    await expectNoHorizontalOverflow(page, `${viewport.width}x${viewport.height}`);

    const frameRatios = await page.locator('.public-product-gif-frame').evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.width / bounds.height;
    }));
    expect(frameRatios).toHaveLength(2);
    for (const ratio of frameRatios) expect(ratio).toBeCloseTo(0.75, 1);

    expect(diagnostics.apiRequests, 'responsive checks must remain independent of APIs').toEqual([]);
    expectCleanRuntime(diagnostics);
  });
}

test('genera las cinco capturas compactas solicitadas', async ({ page }, testInfo) => {
  const diagnostics = trackRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPublicPage(page);

  const mountingGif = page.getByRole('img', { name: MOUNTING_ALT, exact: true });
  const antistressGif = page.getByRole('img', { name: ANTISTRESS_ALT, exact: true });
  await waitForImage(mountingGif, 'mounting GIF');

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await settlePage(page);
  await saveScreenshot(page, testInfo, 'portacelular-mobile-first-screen');

  await scrollLocatorToCenter(page, mountingGif);
  await saveScreenshot(page, testInfo, 'portacelular-mobile-first-gif');

  await scrollLocatorToCenter(page, antistressGif);
  await waitForImage(antistressGif, 'antistress GIF');
  await saveScreenshot(page, testInfo, 'portacelular-mobile-second-gif');

  await scrollLocatorToCenter(page, page.locator('.public-product-final-cta'));
  await saveScreenshot(page, testInfo, 'portacelular-mobile-cta');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await settlePage(page);
  await saveScreenshot(page, testInfo, 'portacelular-desktop-full', true);

  expect(diagnostics.apiRequests, 'visual QA must not cause API requests').toEqual([]);
  expectCleanRuntime(diagnostics);
});

test('la ruta privada raíz sigue mostrando login sin sesión', async ({ page, context }) => {
  const diagnostics = trackRuntime(page);
  await context.clearCookies();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', async route => {
    const path = requestPath(route.request().url());
    if (!path.startsWith('/api/')) {
      await route.continue();
      return;
    }
    if (path === '/api/auth/login-options') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'user-1', username: 'rafa', displayName: 'Rafa' }])
      });
      return;
    }
    if (path === '/api/auth/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: null }) });
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unexpected private request: ${path}` })
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.login-page')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Calculadora 3D' })).toBeVisible();
  await expect(page.getByLabel('Usuario')).toHaveValue('rafa');
  await expect(page.getByLabel('PIN')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.locator('.public-product-page')).toHaveCount(0);
  await expect(page.locator('.app-layout')).toHaveCount(0);
  expect(await context.cookies(), 'the regression runs without a session cookie').toEqual([]);

  const uniqueApiRequests = [...new Set(diagnostics.apiRequests)].sort();
  expect(uniqueApiRequests, 'only session bootstrap endpoints are allowed before login').toEqual([
    'GET /api/auth/login-options',
    'GET /api/auth/me'
  ]);
  expect(diagnostics.apiRequests.some(request => request.endsWith('/api/auth/login-options'))).toBe(true);
  expect(diagnostics.apiRequests.some(request => request.endsWith('/api/auth/me'))).toBe(true);
  expect(diagnostics.apiRequests.some(request => request.includes('/api/settings'))).toBe(false);
  expectCleanRuntime(diagnostics);
});
