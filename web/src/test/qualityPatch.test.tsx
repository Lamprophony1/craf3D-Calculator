import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickQuoteScreen } from '../screens/QuickQuoteScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AppShell } from '../components/AppShell';
import { buildClientQuoteText } from '../utils/clientQuote';

const filament = { id: 'spool-1', material: 'PLA Matte', color: 'Negro', remainingWeightGrams: 900, isActive: true };
const warning = { code: 'DEFAULT_PRINTER_REQUIRED', message: 'Falta la impresora predeterminada.', field: 'defaultPrinterId', blocksPrice: true };
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
  afterEach(() => vi.unstubAllGlobals());

  it('muestra warnings y acceso a configuración cuando no hay breakdown', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown: null, resolvedAssumptions: null, canUsePrice: false, warnings: [warning], advancedRequest: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);

    expect(await screen.findByRole('heading', { name: 'No se puede calcular todavía' })).toBeInTheDocument();
    expect(screen.getByText(warning.message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir a Configuración general' })).toBeInTheDocument();
    expect(screen.queryByText('Precio sugerido')).not.toBeInTheDocument();
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

    expect(screen.getByText('Calculando con el servidor…')).toHaveAttribute('role', 'status');
    resolvePreview(new Response(JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [], advancedRequest: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    expect(await screen.findByText('Precio sugerido')).toBeInTheDocument();
  });

  it('marca como incompleta una referencia con breakdown y no permite compartir', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: false, warnings: [warning], advancedRequest: { printerId: 'p' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);

    expect(await screen.findByRole('heading', { name: 'ESTIMACIÓN INCOMPLETA' })).toBeInTheDocument();
    expect(screen.getByText('No utilizar como precio de venta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar borrador incompleto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar o compartir' })).not.toBeInTheDocument();
  });

  it('prioriza precio, costo, ganancia y margen cuando el precio es utilizable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('/filaments') ? JSON.stringify([filament]) : JSON.stringify({ breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [], advancedRequest: { printerId: 'p' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await completeQuickForm(user);

    expect(await screen.findByText('Precio sugerido')).toBeInTheDocument();
    expect(screen.getByText('Costo completo')).toBeInTheDocument();
    expect(screen.getByText('Ganancia')).toBeInTheDocument();
    expect(screen.getByText('Margen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar como cotización' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar o compartir' })).toBeInTheDocument();
  });
});

it('el resumen para cliente contiene solo el total', () => {
  const text = buildClientQuoteText(110_000);
  expect(text).toMatch(/Cotización de impresión 3D: Gs\.\s110\.000/);
  expect(text).not.toMatch(/costo|ganancia|margen|markup|overhead/i);
});

it('el CTA del panel abre la cotización completa', async () => {
  window.history.replaceState({}, '', '/dashboard');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input).includes('/settings')
      ? { readiness: { quickQuoteReady: true } }
      : { quotes: 0, acceptedQuotes: 0, jobs: 0, completedJobs: 0, actualProductionCostGs: 0 }
  ), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  const user = userEvent.setup();
  render(<DashboardScreen />);

  await user.click(await screen.findByRole('button', { name: 'Nueva cotización' }));
  expect(window.location.pathname).toBe('/quotes/new');
});

it('la navegación móvil expone cinco accesos y el menú Más es accesible', async () => {
  const user = userEvent.setup();
  render(<AppShell user={{ id: 'u', username: 'rafa', displayName: 'Rafa', role: 'Owner' }} path="/" appName="Craf3D" onLogout={vi.fn()}><p>Contenido</p></AppShell>);
  const nav = screen.getByRole('navigation', { name: 'Navegación móvil' });
  expect(within(nav).getAllByRole('link')).toHaveLength(4);
  const more = within(nav).getByRole('button', { name: 'Abrir más opciones' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  await user.click(more);
  expect(more).toHaveAttribute('aria-expanded', 'true');
  const dialog = screen.getByRole('dialog', { name: 'Más opciones' });
  expect(within(dialog).getByRole('link', { name: /Trabajos/ })).toBeInTheDocument();
  expect(within(dialog).getByRole('link', { name: /Configuración general/ })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
