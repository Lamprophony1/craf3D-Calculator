import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { QUICK_DRAFT_KEY, QuickQuoteScreen } from '../screens/QuickQuoteScreen';
import { ClientQuoteCard } from '../components/ClientQuoteCard';
import { buildClientQuoteText } from '../utils/clientQuote';

const preview = { canUsePrice: true, warnings: [], advancedRequest: {}, breakdown: { customerTotalGs: 25000,
  materialCostGs: 10000, energy: { costGs: 100 }, machine: { costGs: 2000 }, laborCostGs: 1000,
  additionalCostGs: 500, failureReserveGs: 100, totalOverheadGs: 200, estimatedProfitGs: 11200,
  fullyLoadedCostGs: 13800, achievedMarginPercent: 44.8, taxGs: 0 } };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
it('updates one quick session, keeps reference text and starts another only on Nuevo cálculo', async () => {
  const writes: Array<{ sessionId: string; sequence: number; customerReference: string }> = [];
  const paths: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input); paths.push(path);
    let body: unknown = preview;
    if (path.endsWith('/filaments')) body = [{ id: 'spool-1', material: 'PLA', color: 'Blanco', productName: 'PLA', isActive: true }];
    if (path.endsWith('/orders/quick')) {
      const request = JSON.parse(String(init?.body)); writes.push(request);
      body = { preview, order: { id: 'order-1', quoteId: 'quote-1', version: writes.length } };
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Blanco'));
  fireEvent.change(screen.getByLabelText('Horas de impresión'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '100' } });
  await screen.findByText('Guardado en Presupuestos');
  expect(screen.queryByRole('button', { name: 'Ver presupuesto' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ajustar este presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-1/adjust');
  const customerInput = screen.getByLabelText('Cliente / referencia');
  expect(screen.getByText('Podés cobrar').compareDocumentPosition(customerInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  customerInput.focus();
  fireEvent.change(customerInput, { target: { value: 'Ana WhatsApp' } });
  expect(customerInput).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Qué se va a imprimir (opcional)'), { target: { value: 'Soporte' } });
  await waitFor(() => expect(writes.at(-1)?.customerReference).toBe('Ana WhatsApp'));
  await screen.findByText('Guardado en Presupuestos');
  expect(screen.getByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-1');
  const writeCount = writes.length;
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '120' } });
  await waitFor(() => expect(writes.length).toBeGreaterThan(writeCount));
  expect(new Set(writes.map(x => x.sessionId)).size).toBe(1);
  expect(writes.at(-1)!.sequence).toBeGreaterThan(writes[0].sequence);
  await screen.findByText('Guardado en Presupuestos');
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo cálculo' }));
  fireEvent.change(screen.getByLabelText('Horas de impresión'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '50' } });
  await waitFor(() => expect(new Set(writes.map(x => x.sessionId)).size).toBe(2));
  expect(paths.some(x => x.includes('/customers'))).toBe(false);
});
it('includes the free reference and optional item in the budget image and complete text', () => {
  render(<ClientQuoteCard data={{ businessName: 'CRAF 3D', logo: null, contactLine: '', note: '', totalGs: 25000,
    material: 'PLA', color: 'Blanco', totalGrams: 100, printDurationMinutes: 120, reference: 'COT-1',
    issuedOn: '20/10/2026', validUntil: '27/10/2026', modelImage: null, customerReference: 'Ana WhatsApp', description: 'Soporte' }} />);
  expect(screen.getByText('Ana WhatsApp')).toBeInTheDocument(); expect(screen.getByText('Soporte')).toBeInTheDocument();
  expect(buildClientQuoteText(25000, 'Ana WhatsApp', 'Soporte')).toContain('Cliente: Ana WhatsApp\nSoporte');
});

it('agrega y quita platos en el mismo pendiente y muestra el precio agregado del servidor', async () => {
  localStorage.setItem('printcost.recent-filaments.v1', JSON.stringify(['spool-2']));
  type PrintPlate = { spoolId: string; printDurationMinutes: number; totalGrams: number };
  const writes: Array<{ sessionId: string; sequence: number; calculation: PrintPlate & { additionalPlates?: PrintPlate[] } }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/filaments')) return Response.json([
      { id: 'spool-1', material: 'PLA', color: 'Blanco', productName: 'PLA', isActive: true },
      { id: 'spool-2', material: 'PETG', color: 'Rojo', productName: 'PETG', isActive: true }
    ]);
    const request = JSON.parse(String(init?.body)) as typeof writes[number];
    writes.push(request);
    const multiple = request.calculation.additionalPlates?.length;
    const price = multiple ? { ...preview, breakdown: null, aggregateBreakdown: {
      ...preview.breakdown, customerTotalGs: 81000, energyCostGs: 200, machineCostGs: 5000
    }, advancedLines: [{ description: 'Plato 1', calculation: {} }, { description: 'Plato 2', calculation: {} }] } : preview;
    return Response.json({ preview: price, order: { id: 'order-1', quoteId: 'quote-1', version: writes.length } });
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Blanco'));
  fireEvent.change(screen.getByLabelText('Horas de impresión'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '100' } });
  await screen.findByText('Guardado en Presupuestos');

  fireEvent.click(screen.getByRole('button', { name: 'Agregar plato' }));
  const second = within(screen.getByRole('group', { name: 'Plato 2' }));
  expect(second.getByLabelText('Filamento')).toHaveTextContent('Blanco');
  expect(second.getByLabelText('Horas de impresión del plato 2')).toHaveFocus();
  expect(second.queryByRole('group', { name: 'Usados recientemente' })).not.toBeInTheDocument();
  expect(screen.queryByText('Gs. 25.000')).not.toBeInTheDocument();
  fireEvent.submit(screen.getByRole('form', { name: 'Datos para cotizar' }));
  expect(second.getByText('El tiempo total debe ser mayor que cero.')).toBeVisible();
  expect(second.getByText('Ingresá una cantidad de gramos mayor que cero.')).toBeVisible();
  expect(writes).toHaveLength(1);

  localStorage.setItem('printcost.recent-filaments.v1', JSON.stringify(['spool-1', 'spool-2']));
  fireEvent.click(second.getByLabelText('Filamento'));
  const recent = within(second.getByRole('group', { name: 'Usados recientemente' }));
  expect(recent.getByRole('button', { name: /Elegir Sin marca PLA Blanco/ })).toBeVisible();
  fireEvent.click(recent.getByRole('button', { name: /Elegir Sin marca PETG Rojo/ }));
  fireEvent.change(second.getByLabelText('Minutos de impresión del plato 2'), { target: { value: '35' } });
  fireEvent.change(second.getByLabelText('Gramos totales del slicer del plato 2'), { target: { value: '45' } });
  expect(await screen.findByText('Gs. 81.000', { selector: 'strong' })).toBeVisible();
  expect(screen.getByText('2 platos · 145 g · 2 h 35 min')).toBeVisible();
  expect(writes.at(-1)?.calculation).toEqual({
    spoolId: 'spool-1', printDurationMinutes: 120, totalGrams: 100,
    additionalPlates: [{ spoolId: 'spool-2', printDurationMinutes: 35, totalGrams: 45 }]
  });
  expect(screen.getByRole('link', { name: 'Ajustar este presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-1/adjust');
  expect(JSON.parse(sessionStorage.getItem(QUICK_DRAFT_KEY)!).additionalPlates).toEqual([
    expect.objectContaining({ spoolId: 'spool-2', hours: 0, minutes: 35, totalGrams: 45 })
  ]);

  fireEvent.click(second.getByRole('button', { name: 'Quitar plato 2' }));
  expect(screen.getByRole('button', { name: 'Agregar plato' })).toHaveFocus();
  expect(await screen.findByText('Gs. 25.000', { selector: 'strong' })).toBeVisible();
  expect(writes.at(-1)?.calculation).toEqual({ spoolId: 'spool-1', printDurationMinutes: 120, totalGrams: 100 });
  expect(new Set(writes.map(write => write.sessionId)).size).toBe(1);
  expect(writes.map(write => write.sequence)).toEqual([1, 2, 3]);
});

it('offers a new calculation after the restored order is closed', async () => {
  sessionStorage.setItem('printcost.quick-order-session.v1', JSON.stringify({ id: 'closed-session', sequence: 1, key: '' }));
  sessionStorage.setItem('printcost.quick-quote-draft.v1', JSON.stringify({ spoolId: 'spool-1', hours: 2, minutes: 0, totalGrams: 100 }));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith('/filaments')
    ? [{ id: 'spool-1', material: 'PLA', color: 'Blanco', productName: 'PLA', isActive: true }]
    : { message: 'El pedido ya fue confirmado.' }), { status: String(input).endsWith('/filaments') ? 200 : 409, headers: { 'Content-Type': 'application/json' } })));
  render(<QuickQuoteScreen canSaveOrders />);
  await screen.findByText('El pedido ya fue confirmado.');
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo cálculo' }));
  expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(null);
});

it('copies the authoritative saved price after a passive preview', async () => {
  localStorage.setItem('printcost.quick-quote-draft.v1', JSON.stringify({ spoolId: 'spool-1', hours: 2, minutes: 0, totalGrams: 100 }));
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.endsWith('/filaments') ? [{ id: 'spool-1', material: 'PLA', color: 'Blanco', productName: 'PLA', isActive: true }]
      : path.endsWith('/orders/quick') ? { preview: { ...preview, breakdown: { ...preview.breakdown, customerTotalGs: 35000 } }, order: { id: 'order-1' } } : preview;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  fireEvent.click(await screen.findByRole('button', { name: 'Copiar precio' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(buildClientQuoteText(35000)));
});
