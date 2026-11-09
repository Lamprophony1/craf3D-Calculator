import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { QuoteDetailScreen } from '../screens/ResourceScreens';
import { App } from '../App';
import { QUICK_DRAFT_KEY } from '../screens/QuickQuoteScreen';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
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
  let cancelled = false;
  let resolveFollowUp: ((response: Response) => void) | undefined;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/cancel')) cancelled = true;
    if (cancelled && url.includes('/orders/by-quote/')) {
      return new Promise<Response>(resolve => { resolveFollowUp = resolve; });
    }
    const body = url.includes('/orders/by-quote/') ? {
      id: 'order-1', quoteId: 'quote-1', status: cancelled ? 'Discarded' : 'Draft',
      customerReference: 'Ana Cliente', totalGs: 45000, version: 2
    }
      : url.includes('/filaments') || url.endsWith('/customers') ? []
      : url.includes('/customers/customer-1') ? { id: 'customer-1', name: 'Ana Cliente', phone: '0981 000000', email: 'ana@example.com', isActive: false }
      : url.includes('/settings') ? { settings: { visibleAppName: 'Craf3D' }, readiness: {} }
      : { ...quote, status: cancelled ? 'Cancelled' : quote.status };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  const print = vi.fn();
  vi.stubGlobal('print', print);
  const user = userEvent.setup();

  const { container } = render(<QuoteDetailScreen id="quote-1" />);
  const document = await screen.findByRole('article', { name: 'Cotización imprimible para cliente' });
  const followUp = await screen.findByRole('region', { name: 'Seguimiento del pedido' });
  expect(within(followUp).getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled();
  const documentControls = screen.getByRole('region', { name: 'Documento para el cliente' });
  expect(followUp.compareDocumentPosition(documentControls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(documentControls).getByText('La impresión usa la revisión guardada.')).toBeInTheDocument();
  await screen.findByText('Ana Cliente');
  expect(document).toHaveTextContent('Pieza principal');
  expect(document).toHaveTextContent('Gs. 45.000');
  expect(document).toHaveTextContent('Precio unitario');
  expect(document).toHaveTextContent('Ana Cliente');
  expect(document).toHaveTextContent('Teléfono del cliente');
  expect(document).toHaveTextContent('ana@example.com');
  expect(document).not.toHaveTextContent(/Costo completo|Ganancia|Margen|Markup|Overhead|advertencia/i);
  expect(container.querySelector('pre')).toBeNull();
  await user.click(within(documentControls).getByRole('button', { name: 'Imprimir cotización de cliente' }));
  expect(print).toHaveBeenCalledOnce();
  await user.click(within(documentControls).getByText('Acciones del documento'));
  await user.click(within(documentControls).getByRole('button', { name: 'Cancelar cotización' }));
  await waitFor(() => expect(resolveFollowUp).toBeDefined());
  expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
  await act(async () => resolveFollowUp!(Response.json({ id: 'order-1', quoteId: 'quote-1', status: 'Discarded' })));
  await screen.findByRole('button', { name: 'Ver presupuesto descartado' });
  expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
});

it('imprime y marca lista la revisión guardada sin recalcular', async () => {
  const quote = {
    id: 'quote-draft', code: 'COT-DRAFT', status: 'Draft', createdAt: '2026-08-06T12:00:00Z', updatedAt: '2026-08-06T12:00:00Z',
    validUntil: null, customerId: null, notes: null, terms: null,
    revisions: [{ revisionNumber: 1, createdAt: '2026-08-06T12:00:00Z', lines: [{
      id: 'line-1', description: 'Pieza', request: { printDurationHours: 5, occupiedPrinterHours: 5, materials: [] }, breakdown, canUsePrice: true, warnings: []
    }] }]
  };
  let ready = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/ready') && init?.method === 'POST') ready = true;
    const body = url.includes('/filaments') ? []
      : url.endsWith('/customers') ? [{ id: 'customer-active', name: 'Cliente activo', phone: null, email: null, isActive: true }]
      : url.includes('/settings') ? { settings: { visibleAppName: 'Craf3D' }, readiness: {} }
      : { ...quote, status: ready ? 'ReadyToSend' : quote.status };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  const print = vi.fn();
  vi.stubGlobal('print', print);

  const user = userEvent.setup();
  render(<QuoteDetailScreen id="quote-draft" />);

  const printButton = await screen.findByRole('button', { name: 'Imprimir cotización de cliente' });
  expect(printButton).toBeEnabled();
  expect(screen.getByRole('article', { name: 'Cotización imprimible para cliente' })).toHaveTextContent('Gs. 45.000');
  await user.click(printButton);
  expect(print).toHaveBeenCalledOnce();
  await user.click(screen.getByText('Acciones del documento'));
  expect(screen.getByRole('button', { name: 'Recalcular con costos actuales' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Editar líneas de la cotización' }));
  await user.type(screen.getByLabelText('Cliente / referencia'), 'Edición pendiente');
  expect(screen.queryByRole('button', { name: 'Volver a presupuestos' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Salir de la edición' }));
  expect(screen.queryByLabelText('Cliente / referencia')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Volver a presupuestos' })).toBeEnabled();
  await user.click(screen.getByText('Acciones del documento'));
  await user.click(screen.getByRole('button', { name: 'Marcar cotización lista para enviar' }));
  expect(await screen.findByRole('button', { name: 'Marcar cotización enviada' })).toBeEnabled();
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([input]) => input)).toEqual(['/api/quotes/quote-draft/ready']);
});

it('mantiene las entradas de una edición obsoleta y bloquea el reintento sobre la revisión nueva', async () => {
  const line = { id: 'line-1', description: 'Pieza guardada',
    request: { printDurationHours: 5, occupiedPrinterHours: 5, materials: [] }, breakdown, canUsePrice: true, warnings: [] };
  let revisionNumber = 1;
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      writes.push(JSON.parse(String(init.body)));
      revisionNumber = 2;
      return Response.json({ message: 'El documento tiene otra revisión.' }, { status: 409 });
    }
    const url = String(input);
    if (url.endsWith('/filaments')) return Response.json([]);
    if (url.endsWith('/settings')) return Response.json({ settings: { visibleAppName: 'craf3D' } });
    if (url.includes('/orders/by-quote/')) return Response.json({}, { status: 404 });
    return Response.json({ id: 'quote-draft', code: 'COT-DRAFT', status: 'Draft',
      createdAt: '2026-08-06T12:00:00Z',
      customerReference: revisionNumber === 1 ? '' : 'Referencia nueva del servidor',
      revisions: [{ revisionNumber, lines: [line] }] });
  }));
  const user = userEvent.setup();
  render(<QuoteDetailScreen id="quote-draft" />);
  await user.click(await screen.findByText('Acciones del documento'));
  await user.click(screen.getByRole('button', { name: 'Editar líneas de la cotización' }));
  await user.type(screen.getByLabelText('Cliente / referencia'), 'Mi referencia');
  const save = screen.getByRole('button', { name: 'Guardar revisión del borrador' });
  await user.click(save);
  expect(await screen.findByText(/Revisión 2/)).toBeVisible();
  expect(screen.getByLabelText('Cliente / referencia')).toHaveValue('Mi referencia');
  expect(save).toBeDisabled();
  expect(writes).toEqual([expect.objectContaining({ revisionNumber: 1, customerReference: 'Mi referencia' })]);
});

it('distingue ambos importes y usa el de la revisión solo con una decisión explícita', async () => {
  const quote = {
    id: 'quote-draft', code: 'COT-DRAFT', status: 'Draft', createdAt: '2026-08-06T12:00:00Z',
    revisions: [{ revisionNumber: 2, lines: [{
      id: 'line-1', description: 'Pieza', request: { materials: [] }, breakdown, canUsePrice: true, warnings: []
    }] }]
  };
  const order = { id: 'order-1', quoteId: quote.id, status: 'Draft', customerReference: 'Ana', totalGs: 40000, version: 3 };
  const writes: { path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === 'POST') writes.push({ path, body: JSON.parse(String(init.body)) });
    const body = path.endsWith('/quote-price') ? { ...order, totalGs: 45000, version: 4 }
      : path.endsWith('/status') ? { ...order, totalGs: 45000, version: 5, status: 'Confirmed' }
      : path.includes('/orders/by-quote/') ? order
      : path.endsWith('/filaments') ? []
      : path.endsWith('/settings') ? { settings: {} }
      : quote;
    return Response.json(body);
  });
  vi.stubGlobal('fetch', fetchMock);
  const origin = { href: '/quotes?search=Ana', scrollY: 40, orderId: order.id, control: 'record' };
  window.history.replaceState({ orderListOrigin: origin }, '', '/quotes/quote-draft');
  const user = userEvent.setup();
  render(<QuoteDetailScreen id={quote.id} />);

  const followUp = within(await screen.findByRole('region', { name: 'Seguimiento del pedido' }));
  expect(followUp.getByText('Total del documento')).toBeInTheDocument();
  expect(followUp.getByText('Importe a confirmar')).toBeInTheDocument();
  expect(followUp.getByRole('button', { name: /^Confirmar pedido por Gs\.\s40\.000$/ })).toBeEnabled();
  expect(writes).toEqual([]);

  await user.click(followUp.getByRole('button', { name: 'Usar importe de esta revisión' }));
  const confirm = await followUp.findByRole('button', { name: 'Confirmar pedido' });
  expect(followUp.getByRole('status')).toHaveTextContent('Importe del pedido actualizado.');
  expect(confirm).toHaveFocus();
  await user.click(confirm);
  expect(writes).toEqual([
    { path: '/api/orders/order-1/quote-price', body: { version: 3, revisionNumber: 2 } },
    { path: '/api/orders/order-1/status', body: { version: 4, status: 'Confirmed' } }
  ]);
  expect(window.location.pathname).toBe('/orders/order-1');
  expect(window.history.state).toMatchObject({ orderListOrigin: origin, confirmedOrderId: order.id });
});

it('abre directamente el formulario de confirmación si al documento le falta una referencia', async () => {
  const quote = {
    id: 'quote-draft', code: 'COT-DRAFT', status: 'Draft',
    revisions: [{ revisionNumber: 1, lines: [{
      id: 'line-1', description: 'Pieza', request: { materials: [] }, breakdown, canUsePrice: false, warnings: []
    }] }]
  };
  const order = { id: 'order-1', quoteId: quote.id, status: 'Draft', customerReference: '  ', totalGs: 45000, version: 2 };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = String(input);
    return Response.json(path.includes('/orders/by-quote/') ? order : path.endsWith('/filaments') ? [] : quote);
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(<QuoteDetailScreen id={quote.id} />);

  expect(await screen.findByRole('button', { name: 'Imprimir cotización de cliente' })).toBeDisabled();
  await user.click(await screen.findByRole('button', { name: 'Completar y confirmar' }));
  expect(window.location.pathname + window.location.search).toBe('/quotes/pending/order-1?complete=1');
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
});

it('refresca los importes tras un conflicto sin confirmar ni repetir la escritura', async () => {
  const quote = {
    id: 'quote-draft', code: 'COT-DRAFT', status: 'Draft', createdAt: '2026-08-06T12:00:00Z',
    revisions: [{ revisionNumber: 1, lines: [{
      id: 'line-1', description: 'Pieza', request: { materials: [] }, breakdown, canUsePrice: true, warnings: []
    }] }]
  };
  const order = { id: 'order-1', quoteId: quote.id, status: 'Draft', customerReference: 'Ana', totalGs: 40000, version: 3 };
  let conflict = false;
  let finishWrite: (() => void) | undefined;
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === 'POST') {
      writes.push(JSON.parse(String(init.body)));
      await new Promise<void>(resolve => { finishWrite = resolve; });
      conflict = true;
      return Response.json({ message: 'Este pedido cambió en otra pantalla.' }, { status: 409 });
    }
    const body = path.includes('/orders/by-quote/') ? { ...order, totalGs: conflict ? 42000 : 40000, version: conflict ? 4 : 3 }
      : path.endsWith('/filaments') ? []
      : path.endsWith('/settings') ? { settings: {} }
      : quote;
    return Response.json(body);
  }));
  window.history.replaceState({}, '', '/quotes/quote-draft');
  const user = userEvent.setup();
  render(<QuoteDetailScreen id={quote.id} />);

  const confirm = await screen.findByRole('button', { name: /^Confirmar pedido por Gs\.\s40\.000$/ });
  await user.click(confirm);
  expect(confirm).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Usar importe de esta revisión' })).toBeDisabled();
  await act(async () => finishWrite!());

  expect(await screen.findByRole('alert')).toHaveTextContent('Este pedido cambió en otra pantalla.');
  expect(await screen.findByRole('button', { name: /^Confirmar pedido por Gs\.\s42\.000$/ })).toBeEnabled();
  expect(writes).toEqual([{ status: 'Confirmed', version: 3 }]);
  expect(window.location.pathname).toBe('/quotes/quote-draft');
});

it('una recarga offline abre el shell y el Draft sin crear una sesión ficticia', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'offline', hours: 5, minutes: 24, totalGrams: 142 }));
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

  render(<App />);

  await waitFor(() => expect(screen.getByText('Sin sesión verificada')).toBeInTheDocument());
  expect(screen.getByRole('heading', { name: '¿Cuánto cobrar?' })).toBeInTheDocument();
  expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(142);
});
