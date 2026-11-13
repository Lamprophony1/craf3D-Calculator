import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

it('repite un plato con sus valores del slicer y agrega sólo el plato distinto', async () => {
  type Plate = { spoolId: string; printDurationMinutes: number; totalGrams: number; repetitions?: number };
  const writes: Array<{ sessionId: string; calculation: Plate & { additionalPlates?: Plate[] } }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/filaments')) return Response.json([
      { id: 'spool-1', material: 'PLA', color: 'Blanco', productName: 'PLA', isActive: true }
    ]);
    writes.push(JSON.parse(String(init?.body)));
    return Response.json({ preview: { ...preview, breakdown: null,
      aggregateBreakdown: { ...preview.breakdown, energyCostGs: 100, machineCostGs: 2000 },
      advancedLines: [{ description: 'Plato 1', isPrintPlate: true, calculation: {} }] },
      order: { id: 'order-1', quoteId: 'quote-1', version: writes.length } });
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Blanco'));
  const repetitions = screen.getByRole('spinbutton', { name: 'Cantidad' });
  expect(repetitions).toHaveValue(1);
  fireEvent.change(screen.getByLabelText('Horas de impresión'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '90' } });
  fireEvent.change(repetitions, { target: { value: '0' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Datos para cotizar' }));
  expect(repetitions).toHaveFocus();
  expect(repetitions).toHaveAttribute('aria-invalid', 'true');
  expect(writes).toHaveLength(0);

  fireEvent.change(repetitions, { target: { value: '3' } });
  expect(await screen.findByText('3 platos · 270 g · 12 h')).toBeVisible();
  expect(writes.at(-1)?.calculation).toEqual({ spoolId: 'spool-1', printDurationMinutes: 240, totalGrams: 90, repetitions: 3 });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar plato' }));
  const second = within(screen.getByRole('group', { name: 'Plato 2' }));
  expect(second.getByRole('spinbutton', { name: 'Cantidad del plato 2' })).toHaveValue(1);
  fireEvent.change(second.getByLabelText('Horas de impresión del plato 2'), { target: { value: '1' } });
  fireEvent.change(second.getByLabelText('Minutos de impresión del plato 2'), { target: { value: '15' } });
  fireEvent.change(second.getByLabelText('Gramos totales del slicer del plato 2'), { target: { value: '45' } });
  expect(await screen.findByText('4 platos · 315 g · 13 h 15 min')).toBeVisible();
  expect(writes.at(-1)?.calculation.additionalPlates).toEqual([{ spoolId: 'spool-1', printDurationMinutes: 75, totalGrams: 45 }]);
  expect(new Set(writes.map(write => write.sessionId)).size).toBe(1);
  expect(screen.getByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-1');
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

it('retoma automáticamente los tres platos y conserva la sesión nueva al reintentar una respuesta perdida', async () => {
  const draft = {
    spoolId: 'spool-1', hours: 2, minutes: 52, totalGrams: 63.75, repetitions: 1,
    customerReference: 'Ana', description: 'Tres piezas', additionalPlates: [
      { id: 'plate-2', spoolId: 'spool-2', hours: 1, minutes: 12, totalGrams: 45, repetitions: 3 },
      { id: 'plate-3', spoolId: 'spool-1', hours: 0, minutes: 35, totalGrams: 20, repetitions: 2 }
    ]
  };
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(draft));
  const writes: Array<{ sessionId: string; sequence: number }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/filaments')) return Response.json([
      { id: 'spool-1', material: 'PLA', color: 'Blanco', isActive: true },
      { id: 'spool-2', material: 'PETG', color: 'Rojo', isActive: true }
    ]);
    if (!path.endsWith('/orders/quick')) return Response.json(preview);
    writes.push(JSON.parse(String(init?.body)));
    if (writes.length === 1) return Response.json({
      message: 'Este borrador ya se confirmó o descartó. Iniciá un nuevo cálculo.', code: 'quick_session_closed'
    }, { status: 409 });
    if (writes.length === 2) throw new TypeError('Se perdió la respuesta de guardado.');
    return Response.json({ preview, order: { id: 'new-order', quoteId: 'new-quote' } });
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  await screen.findByText('Gs. 25.000', { selector: 'strong' });
  fireEvent.submit(screen.getByRole('form', { name: 'Datos para cotizar' }));
  const retry = await screen.findByRole('button', { name: 'Reintentar guardado' });
  expect(JSON.parse(sessionStorage.getItem(QUICK_DRAFT_KEY)!)).toEqual(draft);
  expect(writes[1].sessionId).not.toBe(writes[0].sessionId);
  expect(writes[1].sequence).toBe(1);
  expect(writes[1]).toEqual({ ...writes[0], sessionId: writes[1].sessionId, sequence: 1 });
  fireEvent.click(retry);
  await screen.findByText('Guardado en Presupuestos');
  expect(writes).toHaveLength(3);
  expect(writes[2]).toEqual(writes[1]);
  expect(screen.getByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/new-order');
  expect(screen.getByLabelText('Gramos totales del slicer del plato 3')).toHaveValue(20);
  expect(screen.getByLabelText('Cliente / referencia')).toHaveValue('Ana');
  expect(screen.getByLabelText('Qué se va a imprimir (opcional)')).toHaveValue('Tres piezas');
});

it('desvincula la sesión cerrada de otro trabajo al regresar y guarda solo cuando se edita', async () => {
  const writes: Array<{ sessionId: string; calculation: { totalGrams: number } }> = [];
  let previousSession: string | undefined;
  let closed = false;
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'spool-1', hours: 2, minutes: 52, totalGrams: 63.75 }));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/filaments')) return Response.json([{ id: 'spool-1', material: 'PLA', color: 'Blanco', isActive: true }]);
    if (!path.endsWith('/orders/quick')) return Response.json(preview);
    const body = JSON.parse(String(init?.body));
    writes.push(body);
    if (closed && body.sessionId === previousSession) return Response.json({
      message: 'Este borrador ya se confirmó o descartó. Iniciá un nuevo cálculo.', code: 'quick_session_closed'
    }, { status: 409 });
    return Response.json({ preview, order: { id: closed ? 'new-order' : 'old-order' } });
  }));
  const firstVisit = render(<QuickQuoteScreen canSaveOrders />);
  await screen.findByText('Gs. 25.000', { selector: 'strong' });
  fireEvent.submit(screen.getByRole('form', { name: 'Datos para cotizar' }));
  await screen.findByText('Guardado en Presupuestos');
  previousSession = writes[0].sessionId;
  firstVisit.unmount();
  closed = true;

  render(<QuickQuoteScreen canSaveOrders />);
  await screen.findByText('Gs. 25.000', { selector: 'strong' });
  expect(writes).toHaveLength(2);
  expect(sessionStorage.getItem('printcost.quick-order-session.v1')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reintentar guardado' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(63.75);

  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '80' } });
  await screen.findByText('Guardado en Presupuestos');
  expect(writes).toHaveLength(3);
  expect(writes[2].sessionId).not.toBe(previousSession);
  expect(writes[2].calculation.totalGrams).toBe(80);
  expect(screen.getByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/new-order');
});

it('limita la recuperación automática a una sesión nueva por intento', async () => {
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'spool-1', hours: 2, minutes: 0, totalGrams: 100 }));
  const sessions: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/filaments')) return Response.json([{ id: 'spool-1', material: 'PLA', color: 'Blanco', isActive: true }]);
    if (!path.endsWith('/orders/quick')) return Response.json(preview);
    sessions.push(JSON.parse(String(init?.body)).sessionId);
    return Response.json({ message: 'Sesión cerrada.', code: 'quick_session_closed' }, { status: 409 });
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  await screen.findByText('Gs. 25.000', { selector: 'strong' });
  fireEvent.submit(screen.getByRole('form', { name: 'Datos para cotizar' }));
  await screen.findByText('No pudimos retomar el guardado. Conservamos todos tus platos. Reintentá guardar el presupuesto.');
  expect(sessions).toHaveLength(2);
  expect(sessions[1]).not.toBe(sessions[0]);
  expect(screen.getByRole('button', { name: 'Reintentar guardado' })).toBeEnabled();
});

it('ignora un conflicto tardío de sesión cuando ya guardó una edición más reciente', async () => {
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'spool-1', hours: 2, minutes: 0, totalGrams: 100 }));
  const sessions: string[] = [];
  let finishOldRequest!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/filaments')) return Promise.resolve(Response.json([{ id: 'spool-1', material: 'PLA', color: 'Blanco', isActive: true }]));
    if (!path.endsWith('/orders/quick')) return Promise.resolve(Response.json(preview));
    sessions.push(JSON.parse(String(init?.body)).sessionId);
    if (sessions.length === 1) return new Promise<Response>(resolve => { finishOldRequest = resolve; });
    return Promise.resolve(Response.json({ preview, order: { id: 'latest-order' } }));
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  await screen.findByText('Gs. 25.000', { selector: 'strong' });
  fireEvent.submit(screen.getByRole('form', { name: 'Datos para cotizar' }));
  await waitFor(() => expect(sessions).toHaveLength(1));
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '120' } });
  await screen.findByText('Guardado en Presupuestos');
  await act(async () => {
    finishOldRequest(Response.json({ message: 'Sesión cerrada.', code: 'quick_session_closed' }, { status: 409 }));
  });
  await waitFor(() => expect(screen.getByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/latest-order'));
  expect(sessions).toHaveLength(2);
  expect(sessions[1]).toBe(sessions[0]);
  expect(JSON.parse(sessionStorage.getItem('printcost.quick-order-session.v1')!).id).toBe(sessions[1]);
});

it('reintenta otros conflictos sin ofrecer crear otra sesión', async () => {
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'spool-1', hours: 2, minutes: 0, totalGrams: 100 }));
  const sessions: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/filaments')) return Response.json([{ id: 'spool-1', material: 'PLA', color: 'Blanco', isActive: true }]);
    if (!path.endsWith('/orders/quick')) return Response.json(preview);
    sessions.push(JSON.parse(String(init?.body)).sessionId);
    return Response.json({ message: 'La cotización recibida es anterior a la versión guardada.' }, { status: 409 });
  }));
  render(<QuickQuoteScreen canSaveOrders />);
  await screen.findByText('Gs. 25.000', { selector: 'strong' });
  fireEvent.submit(screen.getByRole('form', { name: 'Datos para cotizar' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar guardado' }));
  await waitFor(() => expect(sessions).toHaveLength(2));
  expect(sessions[1]).toBe(sessions[0]);
  expect(screen.queryByRole('button', { name: 'Guardar como nuevo presupuesto' })).not.toBeInTheDocument();
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
