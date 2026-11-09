import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OrderEditorScreen, OrdersScreen } from '../screens/OrdersScreen';
import { QuoteListScreen } from '../screens/ResourceScreens';
import { ApiError, get, post, put } from '../api/client';
vi.mock('../api/client', async importOriginal => ({ ...await importOriginal<typeof import('../api/client')>(), get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const row = { id: 'order-1', code: 'PED-1', customerReference: 'Ana', description: 'Soporte', quantity: 3,
  totalGs: 100000, status: 'Confirmed', version: 1, position: 2, dueDate: null, quoteId: null, jobId: null, actualCostGs: null };
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState({}, '', '/jobs'); });
it('shows the global rank and moves directly to the requested priority', async () => {
  vi.mocked(get).mockResolvedValue({ items: [row], total: 1, draftCount: 2, activeCount: 3 });
  vi.mocked(post).mockResolvedValue({ ...row, position: 1 });
  render(<OrdersScreen />);
  await screen.findByText('Ana');
  expect(screen.getByText('2', { selector: '.order-rank-number' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar prioridad de Ana' }));
  fireEvent.change(screen.getByLabelText('Nueva posición'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar prioridad' }));
  await waitFor(() => expect(post).toHaveBeenCalledExactlyOnceWith('/api/orders/order-1/move', { direction: 'position', position: 1, version: 1 }));
  expect(screen.queryByRole('button', { name: /Borradores|Descartados/ })).not.toBeInTheDocument();
});
it('creates a manually priced order without requesting a calculation or customer registry', async () => {
  vi.mocked(post).mockResolvedValue(row);
  render(<OrderEditorScreen />);
  expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Cliente / referencia'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Importe total acordado (Gs.)'), { target: { value: '100000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear pedido' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ customerReference: 'Ana', quantity: 3, totalGs: 100000, status: 'Confirmed' })));
  expect(get).not.toHaveBeenCalled();
});

it('uses Presupuestos as the pending acceptance inbox and confirms its existing order', async () => {
  const pending = { ...row, status: 'Draft', quoteId: 'quote-1' };
  vi.mocked(get).mockResolvedValue({ items: [pending], total: 1, draftCount: 1, activeCount: 0 });
  vi.mocked(post).mockResolvedValue({ ...pending, status: 'Confirmed', version: 2 });
  render(<QuoteListScreen />);
  await screen.findByText('Ana');
  expect(get).toHaveBeenCalledWith(expect.stringContaining('view=drafts'));
  expect(screen.getByRole('button', { name: /Pendientes/ })).toHaveTextContent('1');
  expect(screen.getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/quotes/pending/order-1');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/orders/order-1/status', { status: 'Confirmed', version: 1 }));
  expect(screen.getByText(/Pedido confirmado/)).toBeInTheDocument();
  expect(window.history.state.confirmedOrderId).toBe('order-1');
});

it('asks to complete a budget before confirmation when its reference is missing', async () => {
  window.history.replaceState({}, '', '/quotes?search=Soporte');
  vi.mocked(get).mockResolvedValue({ items: [{ ...row, status: 'Draft', customerReference: null, quoteId: 'quote-1' }], total: 1, draftCount: 1, activeCount: 0 });
  render(<QuoteListScreen />);
  const complete = await screen.findByRole('button', { name: 'Completar y confirmar' });
  expect(screen.getByText('Falta cliente o referencia')).toBeVisible();
  fireEvent.click(complete);
  expect(window.location.pathname).toBe('/quotes/pending/order-1');
  expect(window.location.search).toBe('?complete=1');
  expect(window.history.state.orderListOrigin.href).toBe('/quotes?search=Soporte');
  expect(post).not.toHaveBeenCalled();
});

it('opens the missing reference and confirms in the same form, using the version saved before retry', async () => {
  window.history.replaceState({}, '', '/quotes/pending/order-1?complete=1');
  const draft = { ...row, status: 'Draft', customerReference: null, quoteId: 'quote-1' };
  const saved = { ...draft, customerReference: 'Ana', version: 2 };
  vi.mocked(get).mockResolvedValue(draft);
  vi.mocked(put).mockResolvedValue(saved);
  vi.mocked(post).mockRejectedValueOnce(new ApiError(503, 'Servicio temporalmente ocupado.'))
    .mockResolvedValueOnce({ ...saved, status: 'Confirmed', version: 3 });
  render(<OrderEditorScreen id="order-1" budget />);

  const reference = await screen.findByRole('textbox', { name: 'Cliente / referencia' });
  expect(reference).toHaveFocus();
  expect(screen.queryByRole('spinbutton', { name: 'Importe presupuestado (Gs.)' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Notas (opcional)' })).not.toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Confirmar pedido' });
  expect(confirm.closest('form')).toContainElement(reference);
  fireEvent.click(confirm);
  expect(await screen.findByText('Ingresá una referencia para confirmar.')).toBeVisible();
  expect(screen.queryByText('Indicá el importe total.')).not.toBeInTheDocument();
  expect(put).not.toHaveBeenCalled();

  fireEvent.change(reference, { target: { value: 'Ana' } });
  fireEvent.click(confirm);
  expect(await screen.findByRole('alert')).toHaveTextContent('Los cambios se guardaron');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  await waitFor(() => expect(window.location.pathname).toBe('/orders/order-1'));
  expect(put).toHaveBeenCalledExactlyOnceWith('/api/orders/order-1', expect.objectContaining({ version: 1, customerReference: 'Ana', totalGs: 100000 }));
  expect(post).toHaveBeenNthCalledWith(1, '/api/orders/order-1/status', { status: 'Confirmed', version: 2 });
  expect(post).toHaveBeenNthCalledWith(2, '/api/orders/order-1/status', { status: 'Confirmed', version: 2 });
  expect(window.history.state.confirmedOrderId).toBe('order-1');
});

it('keeps the budget pending when saving the missing amount for later', async () => {
  window.history.replaceState({}, '', '/quotes/pending/order-1?complete=1');
  const draft = { ...row, status: 'Draft', totalGs: null, quoteId: 'quote-1' };
  vi.mocked(get).mockResolvedValue(draft);
  vi.mocked(put).mockResolvedValue({ ...draft, totalGs: 0, version: 2 });
  render(<OrderEditorScreen id="order-1" budget />);

  const total = await screen.findByRole('spinbutton', { name: 'Importe presupuestado (Gs.)' });
  expect(total).toHaveFocus();
  expect(screen.queryByRole('textbox', { name: 'Cliente / referencia' })).not.toBeInTheDocument();
  fireEvent.change(total, { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar para después' }));
  await screen.findByText('Cambios guardados.');
  expect(put).toHaveBeenCalledExactlyOnceWith('/api/orders/order-1', expect.objectContaining({ status: 'Draft', totalGs: 0 }));
  expect(post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Editar datos' })).toHaveFocus();
});

it('announces the confirmed order with focus and keeps the route back to the original search', async () => {
  const origin = { href: '/quotes?search=Ana', scrollY: 125, orderId: row.id };
  window.history.replaceState({ confirmedOrderId: row.id, orderListOrigin: origin }, '', '/orders/order-1');
  vi.mocked(get).mockResolvedValue(row);
  render(<OrderEditorScreen id="order-1" />);

  expect(await screen.findByRole('heading', { name: 'Ana' })).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent('Pedido confirmado.');
  expect(screen.getByRole('link', { name: 'Ver en Confirmados' })).toHaveAttribute('href', '/jobs?search=PED-1');
  fireEvent.click(screen.getByRole('button', { name: 'Volver a presupuestos' }));
  expect(window.location.pathname).toBe('/quotes');
  expect(window.location.search).toBe('?search=Ana');
  expect(window.history.state.orderListRestore.scrollY).toBe(125);
});

it('submitting a direct order with the keyboard creates a confirmed order', async () => {
  vi.mocked(post).mockResolvedValue(row);
  const { container } = render(<OrderEditorScreen />);
  fireEvent.change(screen.getByLabelText('Cliente / referencia'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Importe total acordado (Gs.)'), { target: { value: '100000' } });
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ status: 'Confirmed' })));
});

it('shows missing confirmation data without suggesting a version conflict', async () => {
  vi.mocked(get).mockResolvedValue({ ...row, customerReference: null, status: 'Draft' });
  render(<OrderEditorScreen id="order-1" budget />);
  fireEvent.click(await screen.findByRole('button', { name: 'Completar y confirmar' }));
  expect(screen.getByRole('textbox', { name: 'Cliente / referencia' })).toHaveFocus();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(screen.getByText('Ingresá una referencia para confirmar.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Actualizar versión conservando mis datos' })).not.toBeInTheDocument();
});

it('offers a single recovery action for a discarded budget', async () => {
  vi.mocked(get).mockResolvedValue({ ...row, status: 'Discarded' });
  render(<OrderEditorScreen id="order-1" budget />);
  await screen.findByRole('button', { name: 'Recuperar presupuesto' });
  expect(screen.getAllByRole('button', { name: /Recuperar/ })).toHaveLength(1);
});

it('can confirm a historical budget with unknown commercial data', async () => {
  const draft = { ...row, status: 'Draft', historical: true, customerReference: null, totalGs: null };
  vi.mocked(get).mockResolvedValue(draft);
  vi.mocked(post).mockResolvedValue({ ...draft, status: 'Confirmed', version: 2 });
  render(<OrderEditorScreen id="order-1" budget />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/orders/order-1/status', { status: 'Confirmed', version: 1 }));
  expect(put).not.toHaveBeenCalled();
});
it('saves pending notes before advancing the status', async () => {
  vi.mocked(get).mockResolvedValue(row);
  vi.mocked(put).mockResolvedValue({ ...row, version: 2, notes: 'Retirar el viernes' });
  vi.mocked(post).mockResolvedValue({ ...row, version: 3, status: 'InProgress', notes: 'Retirar el viernes' });
  render(<OrderEditorScreen id="order-1" />);
  await screen.findByRole('button', { name: 'Iniciar pedido' });
  fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
  fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Retirar el viernes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar pedido' }));
  await waitFor(() => expect(put).toHaveBeenCalledWith('/api/orders/order-1', expect.objectContaining({ notes: 'Retirar el viernes' })));
  expect(post).toHaveBeenCalledWith('/api/orders/order-1/status', { status: 'InProgress', version: 2 });
});

it('prevents editing while a save response is pending', async () => {
  vi.mocked(get).mockResolvedValue(row);
  let finish!: (value: unknown) => void;
  vi.mocked(put).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<OrderEditorScreen id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar datos' }));
  fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Mi nota' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(screen.getByLabelText('Notas (opcional)')).toBeDisabled();
  finish({ ...row, version: 2, notes: 'Mi nota' });
  await screen.findByText('Cambios guardados.');
});

it('reloads a conflicting version while preserving pending entries', async () => {
  vi.mocked(get).mockResolvedValueOnce(row).mockResolvedValue({ ...row, version: 4, notes: 'Otra pantalla' });
  vi.mocked(put).mockRejectedValueOnce(new ApiError(409, 'Este pedido cambió en otra pantalla.')).mockResolvedValue({ ...row, version: 5, notes: 'Mi nota' });
  render(<OrderEditorScreen id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar datos' }));
  fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Mi nota' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Actualizar versión conservando mis datos' }));
  await screen.findByText(/Versión actualizada/);
  expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Mi nota');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(put).toHaveBeenLastCalledWith('/api/orders/order-1', expect.objectContaining({ version: 4, notes: 'Mi nota' })));
});

it('retries confirmation with the saved version after only the transition fails', async () => {
  const draft = { ...row, status: 'Draft', version: 1 };
  const saved = { ...draft, notes: 'Retirar el viernes', version: 2 };
  vi.mocked(get).mockResolvedValue(draft);
  vi.mocked(put).mockResolvedValue(saved);
  vi.mocked(post).mockRejectedValueOnce(new ApiError(503, 'Servicio temporalmente ocupado.'))
    .mockResolvedValueOnce({ ...saved, status: 'Confirmed', version: 3 });
  render(<OrderEditorScreen id="order-1" budget />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar datos' }));
  fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Retirar el viernes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Los cambios se guardaron');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
  await waitFor(() => expect(window.location.pathname).toBe('/orders/order-1'));
  expect(put).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenNthCalledWith(1, '/api/orders/order-1/status', { status: 'Confirmed', version: 2 });
  expect(post).toHaveBeenNthCalledWith(2, '/api/orders/order-1/status', { status: 'Confirmed', version: 2 });
});

it('protects a pending edit and saves it before leaving when requested', async () => {
  window.history.replaceState({}, '', '/orders/order-1');
  vi.mocked(get).mockResolvedValue(row);
  vi.mocked(put).mockResolvedValue({ ...row, version: 2, notes: 'Mi nota' });
  render(<OrderEditorScreen id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar datos' }));
  fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Mi nota' } });
  fireEvent.click(screen.getByRole('button', { name: 'Volver a pedidos' }));
  expect(screen.getByRole('dialog', { name: 'Cambios sin guardar' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/orders/order-1');
  expect(put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Mi nota');
  fireEvent.click(screen.getByRole('button', { name: 'Volver a pedidos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }));
  await waitFor(() => expect(window.location.pathname).toBe('/jobs'));
  expect(put).toHaveBeenCalledWith('/api/orders/order-1', expect.objectContaining({ notes: 'Mi nota', version: 1 }));
});

it('requires a second decision before cancelling a confirmed order', async () => {
  vi.mocked(get).mockResolvedValue(row);
  vi.mocked(post).mockResolvedValue({ ...row, status: 'Cancelled', version: 2 });
  render(<OrderEditorScreen id="order-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido' }));
  expect(screen.getByRole('dialog', { name: 'Cancelar pedido' })).toHaveTextContent('Ana');
  expect(post).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
  await screen.findByText('El pedido está en el Historial.');
  expect(post).toHaveBeenCalledExactlyOnceWith('/api/orders/order-1/status', { status: 'Cancelled', version: 1 });
  expect(put).not.toHaveBeenCalled();
});
