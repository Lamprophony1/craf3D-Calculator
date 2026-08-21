import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const PUBLIC_PATH = '/portacelular';
const INSTAGRAM_URL = 'https://www.instagram.com/craf.3d/';
const WHATSAPP_URL =
  'https://wa.me/595973427508?text=Hola%20CRAF%203D%2C%20vi%20el%20portacelular%20y%20quiero%20consultar%20por%20un%20producto%20personalizado.';
const MOUNTING_PLACEHOLDER = 'Video de montaje en preparación';
const ANTISTRESS_PLACEHOLDER = 'Video de la ruedita antiestrés en preparación';

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
  await page.goto(PUBLIC_PATH, { waitUntil: 'networkidle' });
  await expect(page.locator('.public-product-page')).toBeVisible();
  await settlePage(page);
}

async function expectExternalLink(locator: Locator, href: string) {
  await expect(locator).toHaveAttribute('href', href);
  await expect(locator).toHaveAttribute('target', '_blank');
  await expect(locator).toHaveAttribute('rel', 'noopener noreferrer');
}

async function expectInFirstViewport(
  locator: Locator,
  viewportHeight: number,
  label: string,
  minimumVisible: number | 'all' = 'all'
) {
  await expect(locator, `${label} should render`).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds, `${label} should have layout bounds`).not.toBeNull();
  const visibleHeight = Math.max(
    0,
    Math.min(bounds!.y + bounds!.height, viewportHeight) - Math.max(bounds!.y, 0)
  );
  const requiredHeight = minimumVisible === 'all' ? bounds!.height - 1 : minimumVisible;
  expect(visibleHeight, `${label} should intersect the first viewport`).toBeGreaterThanOrEqual(requiredHeight);
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

async function scrollSectionToTop(page: Page, selector: string) {
  await page.locator(selector).evaluate(element => element.scrollIntoView({ block: 'start' }));
  await settlePage(page);
}

async function saveScreenshot(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage,
    animations: 'disabled'
  });
}

test('la ruta pública es estática, completa y no toca ninguna API privada', async ({ page, context }) => {
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

  await expect(page.getByRole('heading', {
    level: 1,
    name: 'De llavero a portacelular. Y todavía tiene un truco más.'
  })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Montalo en segundos' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'También es una ruedita antiestrés' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Diseñado para ser distinto' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '¿Querés uno personalizado?' })).toBeVisible();

  await expect(page.getByRole('link', { name: 'Ver cómo funciona' })).toHaveAttribute('href', '#modo-portacelular');
  await expect(page.getByRole('link', { name: 'Conocer CRAF 3D' })).toHaveAttribute('href', '#marca-craf3d');

  const mountingPlaceholder = page.getByRole('img', { name: MOUNTING_PLACEHOLDER, exact: true });
  const antistressPlaceholder = page.getByRole('img', { name: ANTISTRESS_PLACEHOLDER, exact: true });
  await expect(mountingPlaceholder).toBeVisible();
  await expect(antistressPlaceholder).toBeVisible();
  await expect(page.getByText(MOUNTING_PLACEHOLDER, { exact: true })).toBeVisible();
  await expect(page.getByText(ANTISTRESS_PLACEHOLDER, { exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  expect(
    diagnostics.requestPaths.filter(path => path.startsWith('/media/portacelular/') || /\.(?:mp4|webm)(?:\?|$)/i.test(path)),
    'unconfigured media must never be requested'
  ).toEqual([]);

  await expect(page.getByRole('heading', { level: 3, name: 'Ver instrucciones en texto' })).toHaveCount(2);
  await expect(page.getByText('Abrí el soporte.', { exact: true })).toBeVisible();
  await expect(page.getByText('Girala suavemente a tu ritmo.', { exact: true })).toBeVisible();

  const logo = page.getByRole('img', { name: 'Logo de CRAF 3D', exact: true });
  await expect(logo).toHaveCount(1);
  await expect(logo).toHaveAttribute('src', '/branding/logo-master.jpg');
  await expect(logo).toHaveJSProperty('naturalWidth', 1080);
  await expect(logo).toHaveJSProperty('naturalHeight', 1080);
  const logoState = await logo.evaluate(image => {
    const element = image as HTMLImageElement;
    return {
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight
    };
  });
  expect(logoState).toEqual({ complete: true, naturalWidth: 1080, naturalHeight: 1080 });
  const brokenImages = await page.locator('img').evaluateAll(images => images
    .filter(image => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0)
    .map(image => (image as HTMLImageElement).src));
  expect(brokenImages, 'all configured images should load').toEqual([]);

  const whatsapp = page.getByRole('link', { name: 'Consultar por WhatsApp' });
  await expect(whatsapp).toBeVisible();
  await expectExternalLink(whatsapp, WHATSAPP_URL);
  await expect(whatsapp).toHaveAttribute('href', /595973427508/);
  await expect(whatsapp).toHaveAttribute('href', /Hola%20CRAF%203D/);

  const instagramLinks = page.locator(`a[href="${INSTAGRAM_URL}"]`);
  await expect(instagramLinks).toHaveCount(3);
  for (let index = 0; index < await instagramLinks.count(); index += 1) {
    await expectExternalLink(instagramLinks.nth(index), INSTAGRAM_URL);
  }
  await expect(page.getByRole('link', { name: 'Ver más trabajos en Instagram' })).toBeVisible();

  await expect(page.locator('.login-page')).toHaveCount(0);
  await expect(page.locator('.app-layout')).toHaveCount(0);
  await expect(page.locator('.app-header')).toHaveCount(0);
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  await expect(page.getByText(/Leonardo|cumpleaños|superhéroe/i)).toHaveCount(0);
  expect(diagnostics.apiRequests, 'the public route must make zero API requests').toEqual([]);
  expectCleanRuntime(diagnostics);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 }
]) {
  test(`la página pública no desborda a ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const diagnostics = trackRuntime(page);
    await page.setViewportSize(viewport);
    await openPublicPage(page);

    await expectNoHorizontalOverflow(page, `${viewport.width}x${viewport.height}`);
    if (viewport.width <= 390) {
      await expectInFirstViewport(page.getByRole('img', { name: 'Logo de CRAF 3D' }), viewport.height, 'brand logo');
      await expectInFirstViewport(page.getByRole('heading', { level: 1 }), viewport.height, 'hero heading');
      await expectInFirstViewport(
        page.getByText('Mirá cómo montarlo en segundos y descubrí su ruedita antiestrés.', { exact: true }),
        viewport.height,
        'hero explanation'
      );
      await expectInFirstViewport(page.getByRole('link', { name: 'Ver cómo funciona' }), viewport.height, 'primary CTA');
      await expectInFirstViewport(page.locator('.public-product-hero-visual'), viewport.height, 'product visual', 24);
    }

    expect(diagnostics.apiRequests, 'responsive checks must remain independent of APIs').toEqual([]);
    expectCleanRuntime(diagnostics);
  });
}

test('genera las cinco capturas de QA solicitadas', async ({ page }, testInfo) => {
  const diagnostics = trackRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openPublicPage(page);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await settlePage(page);
  await saveScreenshot(page, testInfo, 'portacelular-mobile-hero');

  await scrollSectionToTop(page, '#modo-portacelular');
  await saveScreenshot(page, testInfo, 'portacelular-mobile-montaje');

  await scrollSectionToTop(page, '#modo-antistress');
  await saveScreenshot(page, testInfo, 'portacelular-mobile-antistress');

  await scrollSectionToTop(page, '.public-product-final-cta');
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

  await page.goto('/', { waitUntil: 'networkidle' });
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
