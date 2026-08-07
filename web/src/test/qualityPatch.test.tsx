import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickQuoteScreen } from '../screens/QuickQuoteScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AppShell } from '../components/AppShell';
import { buildClientQuoteText } from '../utils/clientQuote';

const filament = { id: 'spool-1', material: 'PLA Matte', color: 'Negro', remainingWeightGrams: 900, isActive: true };
const warning = { code: 'DEFAULT_PRINTER_REQUIRED', message: 'Falta la impresora predeterminada.', field: 'defaultPrinterId', blocksPrice: true };
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
const breakdown = {
  quantity: 1, numberOfPlates: 1, materialCostGs: 10_000, materials: [],
  energy: { totalKWh: 1, costGs: 500, effectiveRateGsPerKWh: 500, usedMeasuredKWh: false },
  machine: { hourlyRateGs: 0, totalOccupiedHours: 5.4, costGs: 0, isConfigured: false },
  laborCostGs: 0, additionalCostGs: 0, marginBearingAdditionalCostGs: 0, nonMarginInternalCostGs: 0,
  nonMarginRecoveryChargeGs: 0, customerAdditionalChargeGs: 0, customerPassThroughGs: 0, directCostGs: 10_500,
  failureReserveGs: 0, totalOverheadGs: 0, fullyLoadedCostGs: 10_500, requiredNetPriceGs: 17_500,
  minimumMarginPriceGs: 15_000, suggestedNetPriceGs: 20_000, finalNetSalePriceGs: 20_000,
  variableSellingFeeGs: 0, netRevenueAfterSellingFeesGs: 20_000, revenueAvailableBeforeCostsGs: 20_000,
  estimatedProfitGs: 9_500, achievedMarginPercent: 47.5, markupPercent: 90.48, taxGs: 0,
  customerTotalGs: 20_000, unitCostGs: 10_500, unitPriceGs: 20_000, warnings: []
};

async function completeQuickForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: /PLA Matte/ });
  await user.type(screen.getByLabelText('Horas de impresión'), '5');
  await user.type(screen.getByLabelText('Minutos de impresión'), '24');
  await user.type(screen.getByLabelText('Gramos totales del slicer'), '142');
  await user.click(screen.getByRole('button', { name: 'Calcular precio' }));
}

describe('estados de la cotización rápida', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
    else Reflect.deleteProperty(navigator, 'share');
  });

  it('muestra warnings y acceso a configuración cuando no hay breakdown', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown: null, resolvedAssumptions: null, canUsePrice: false, warnings: [warning], advancedRequest: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);

    expect(await screen.findByRole('heading', { name: 'No podemos darte un precio todavía' })).toBeInTheDocument();
    expect(screen.getByText(warning.message)).toBeInTheDocument();
    expect(screen.queryByText(warning.code)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar ajustes' })).toBeInTheDocument();
    expect(screen.queryByText('Podés cobrar')).not.toBeInTheDocument();
  });

  it('muestra un estado de cálculo mientras espera al servidor', async () => {
    let resolvePreview!: (response: Response) => void;
    const pendingPreview = new Promise<Response>(resolve => { resolvePreview = resolve; });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => String(input).includes('/filaments')
      ? Promise.resolve(new Response(JSON.stringify([filament]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      : pendingPreview));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);

    expect(screen.getByText('Calculando el mejor precio…')).toHaveAttribute('role', 'status');
    resolvePreview(new Response(JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [], advancedRequest: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    expect(await screen.findByText('Podés cobrar')).toBeInTheDocument();
    expect(screen.getByText('Filamento usado: PLA Matte · Negro')).toBeInTheDocument();
  });

  it('marca como incompleta una referencia con breakdown y no permite compartir', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: false, warnings: [warning], advancedRequest: { printerId: 'p' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);

    expect(await screen.findByRole('heading', { name: 'Precio pendiente de revisión' })).toBeInTheDocument();
    expect(screen.getByText('Resolvé los avisos antes de compartirlo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar presupuesto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar precio' })).not.toBeInTheDocument();
  });

  it('prioriza precio, costo, ganancia y margen cuando el precio es utilizable', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [], advancedRequest: { printerId: 'p' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);

    expect(await screen.findByText('Podés cobrar')).toBeInTheDocument();
    const details = screen.getByText('Ver cómo se calculó').closest('details');
    expect(details).not.toHaveAttribute('open');
    await user.click(screen.getByText('Ver cómo se calculó'));
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('Ganancia incluida')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Detalles técnicos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar presupuesto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar precio' })).toBeInTheDocument();
  });

  it('separa copiar de compartir y expone al cliente únicamente el total utilizable', async () => {
    const writeText = vi.fn(async () => undefined);
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [], advancedRequest: { printerId: 'p' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);
    await screen.findByText('Podés cobrar');

    await user.click(screen.getByRole('button', { name: 'Copiar precio' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(buildClientQuoteText(20_000)));
    expect(share).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: buildClientQuoteText(20_000) })));
    expect(await screen.findByText('Presupuesto compartido')).toBeInTheDocument();

    share.mockRejectedValueOnce(Object.assign(new Error('El usuario canceló'), { name: 'AbortError' }));
    await user.click(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('El usuario canceló')).not.toBeInTheDocument();
  });

  it('informa un error humano cuando el portapapeles falla y permite reintentar', async () => {
    const writeText = vi.fn()
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [], advancedRequest: { printerId: 'p' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);
    await screen.findByText('Podés cobrar');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const copy = screen.getByRole('button', { name: 'Copiar precio' });
    await user.click(copy);
    expect(await screen.findByText('No pudimos copiar el precio. Podés intentarlo de nuevo.')).toBeInTheDocument();
    expect(screen.queryByText('Precio copiado')).not.toBeInTheDocument();
    expect(screen.getAllByText('Gs. 20.000').length).toBeGreaterThan(0);

    await user.click(copy);
    expect(await screen.findByText('Precio copiado')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(2);
  });
});

it('el resumen para cliente contiene solo el total', () => {
  const text = buildClientQuoteText(110_000);
  expect(text).toMatch(/Cotización de impresión 3D: Gs\.\s110\.000/);
  expect(text).not.toMatch(/costo|ganancia|margen|markup|overhead/i);
});

it('el CTA del resumen abre la cotización rápida', async () => {
  window.history.replaceState({}, '', '/dashboard');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input).includes('/settings')
      ? { readiness: { quickQuoteReady: true } }
      : { quotes: 0, acceptedQuotes: 0, jobs: 0, completedJobs: 0, actualProductionCostGs: 0, realizedProfitGs: 12_345 }
  ), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  const user = userEvent.setup();
  render(<DashboardScreen />);

  await user.click(await screen.findByRole('button', { name: 'Cotizar ahora' }));
  expect(window.location.pathname).toBe('/');
  expect(screen.getByText('Gs. 12.345')).toBeInTheDocument();
});

it('el resumen muestra solo readiness canónico aunque el API entregue aliases legacy', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input).includes('/settings')
      ? { readiness: { quickQuoteReady: false, defaultPrinterConfigured: false, defaultPrinterMachineCostConfigured: false, printerCostConfigured: false } }
      : { quotes: 0, acceptedQuotes: 0, jobs: 0, completedJobs: 0, actualProductionCostGs: 0, realizedProfitGs: 0 }
  ), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  const user = userEvent.setup();
  render(<DashboardScreen />);

  await user.click(await screen.findByText('Ver detalles técnicos'));
  const pending = screen.getAllByRole('listitem');
  expect(pending).toHaveLength(1);
  expect(within(pending[0]).getByText('Impresora predeterminada y costo horario utilizables')).toBeInTheDocument();
});

it('la navegación móvil expone cuatro acciones y el menú Más es accesible', async () => {
  const user = userEvent.setup();
  render(<AppShell user={{ id: 'u', username: 'rafa', displayName: 'Rafa', role: 'Owner' }} path="/" appName="Craf3D" onLogout={vi.fn()}><p>Contenido</p></AppShell>);
  const nav = screen.getByRole('navigation', { name: 'Navegación móvil' });
  expect(within(nav).getAllByRole('link')).toHaveLength(3);
  const more = within(nav).getByRole('button', { name: 'Abrir más opciones' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  await user.click(more);
  expect(more).toHaveAttribute('aria-expanded', 'true');
  const dialog = screen.getByRole('dialog', { name: 'Más' });
  expect(within(dialog).getByRole('link', { name: /Pedidos/ })).toBeInTheDocument();
  expect(within(dialog).getByRole('link', { name: /Configuración avanzada/ })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
