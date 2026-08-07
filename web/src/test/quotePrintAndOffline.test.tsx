import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { QuoteDetailScreen } from '../screens/ResourceScreens';
import { App } from '../App';
import { QUICK_DRAFT_KEY } from '../screens/QuickQuoteScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

const breakdown = {
  quantity: 1, numberOfPlates: 1, materialCostGs: 10000, materials: [{ spoolId: 'spool-1', costPerGramGs: 100, totalChargeableGrams: 100, costGs: 10000 }],
  energy: { totalKWh: 0.5, costGs: 250, effectiveRateGsPerKWh: 500, usedMeasuredKWh: false },
  machine: { hourlyRateGs: 2000, totalOccupiedHours: 5, costGs: 10000, isConfigured: true }, laborCostGs: 2000,
  additionalCostGs: 1000, marginBearingAdditionalCostGs: 1000, nonMarginInternalCostGs: 0, nonMarginRecoveryChargeGs: 0, customerAdditionalChargeGs: 0,
  customerPassThroughGs: 0, directCostGs: 23250, failureReserveGs: 1000, totalOverheadGs: 1000, fullyLoadedCostGs: 25250,
  requiredNetPriceGs: 42083, minimumMarginPriceGs: 36071, suggestedNetPriceGs: 45000, finalNetSalePriceGs: 45000,
  variableSellingFeeGs: 0, netRevenueAfterSellingFeesGs: 45000, revenueAvailableBeforeCostsGs: 45000,
  estimatedProfitGs: 19750, achievedMarginPercent: 43.89, markupPercent: 78.22, taxGs: 0, customerTotalGs: 45000,
  unitCostGs: 25250, unitPriceGs: 45000, warnings: []
};

it('renderiza una cotización imprimible legible y conserva el contenido principal al imprimir', async () => {
  const quote = {
    id: 'quote-1', code: 'COT-2026-0001', status: 'Calculated', createdAt: '2026-08-06T12:00:00Z', updatedAt: '2026-08-06T12:00:00Z',
    validUntil: null, customerId: 'customer-1', notes: 'Entregar en caja', terms: 'Validez sujeta a stock',
    revisions: [{ revisionNumber: 1, createdAt: '2026-08-06T12:00:00Z', lines: [{
      id: 'line-1', description: 'Pieza principal', request: { printDurationHours: 5, occupiedPrinterHours: 5, materials: [{ spoolId: 'spool-1', slicerTotalGrams: 100 }] },
      breakdown, canUsePrice: true, warnings: []
    }] }]
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/filaments') || url.endsWith('/customers') ? []
      : url.includes('/customers/customer-1') ? { id: 'customer-1', name: 'Ana Cliente', phone: '0981 000000', email: 'ana@example.com', isActive: false }
      : url.includes('/settings') ? { settings: { visibleAppName: 'Craf3D' }, readiness: {} }
      : quote;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  const print = vi.fn();
  vi.stubGlobal('print', print);
  const user = userEvent.setup();

  const { container } = render(<QuoteDetailScreen id="quote-1" />);
  const document = await screen.findByRole('article', { name: 'Cotización imprimible para cliente' });
  await screen.findByText('Ana Cliente');
  expect(document).toHaveTextContent('Pieza principal');
  expect(document).toHaveTextContent('Gs. 45.000');
  expect(document).toHaveTextContent('Precio unitario');
  expect(document).toHaveTextContent('Ana Cliente');
  expect(document).toHaveTextContent('Teléfono del cliente');
  expect(document).toHaveTextContent('ana@example.com');
  expect(document).not.toHaveTextContent(/Costo completo|Ganancia|Margen|Markup|Overhead|advertencia/i);
  expect(container.querySelector('pre')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Imprimir cotización de cliente' }));
  expect(print).toHaveBeenCalledOnce();
});

it('bloquea la impresión de cliente mientras la cotización sea Draft', async () => {
  const quote = {
    id: 'quote-draft', code: 'COT-DRAFT', status: 'Draft', createdAt: '2026-08-06T12:00:00Z', updatedAt: '2026-08-06T12:00:00Z',
    validUntil: null, customerId: null, notes: null, terms: null,
    revisions: [{ revisionNumber: 1, createdAt: '2026-08-06T12:00:00Z', lines: [{
      id: 'line-1', description: 'Pieza', request: { printDurationHours: 5, occupiedPrinterHours: 5, materials: [] }, breakdown, canUsePrice: true, warnings: []
    }] }]
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/filaments') ? []
      : url.endsWith('/customers') ? [{ id: 'customer-active', name: 'Cliente activo', phone: null, email: null, isActive: true }]
      : url.includes('/settings') ? { settings: { visibleAppName: 'Craf3D' }, readiness: {} }
      : quote;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));

  const user = userEvent.setup();
  render(<QuoteDetailScreen id="quote-draft" />);

  expect(await screen.findByRole('button', { name: 'Imprimir cotización de cliente' })).toBeDisabled();
  expect(screen.getByText(/no se puede imprimir mientras la cotización sea Draft/i)).toBeInTheDocument();
  expect(screen.queryByRole('article', { name: 'Cotización imprimible para cliente' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Editar entradas' }));
  expect(screen.getByRole('option', { name: 'Cliente activo' })).toBeInTheDocument();
});

it('una recarga offline abre el shell y el Draft sin crear una sesión ficticia', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'offline', hours: 5, minutes: 24, totalGrams: 142 }));
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

  render(<App />);

  await waitFor(() => expect(screen.getByText('Sin sesión verificada')).toBeInTheDocument());
  expect(screen.getByRole('heading', { name: 'Cotización rápida' })).toBeInTheDocument();
  expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(142);
});
