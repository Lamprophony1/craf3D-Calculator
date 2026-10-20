import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OrderEditorScreen, OrdersScreen } from '../screens/OrdersScreen';
import { QuoteListScreen } from '../screens/ResourceScreens';
import { ApiError, get, post, put } from '../api/client';
vi.mock('../api/client', async importOriginal => ({ ...await importOriginal<typeof import('../api/client')>(), get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const row = { id: 'order-1', code: 'PED-1', customerReference: 'Ana', description: 'Soporte', quantity: 3,
  totalGs: 100000, status: 'Confirmed', version: 1, position: 2, dueDate: null, quoteId: null, jobId: null, actualCostGs: null };
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState({}, '', '/jobs'); });
it('shows commercial orders and sends a global priority movement with its version', async () => {
  vi.mocked(get).mockResolvedValue({ items: [row], total: 1, draftCount: 2, activeCount: 1 });
  vi.mocked(post).mockResolvedValue(row);
  render(<OrdersScreen />);
  await screen.findByText('Ana');
  fireEvent.click(screen.getByRole('button', { name: 'Poner primero a Ana' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith('/api/orders/order-1/move', { direction: 'first', version: 1 }));
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
});

it('asks to complete a budget before confirmation when its reference is missing', async () => {
  vi.mocked(get).mockResolvedValue({ items: [{ ...row, status: 'Draft', customerReference: null, quoteId: 'quote-1' }], total: 1, draftCount: 1, activeCount: 0 });
  render(<QuoteListScreen />);
  fireEvent.click(await screen.findByRole('button', { name: 'Completar y confirmar' }));
  expect(window.location.pathname).toBe('/quotes/pending/order-1');
  expect(post).not.toHaveBeenCalled();
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
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pedido' }));
  expect(screen.getByText('Ingresá una referencia para confirmar.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Actualizar versión conservando mis datos' })).not.toBeInTheDocument();
});

it('offers a single recovery action for a discarded budget', async () => {
  vi.mocked(get).mockResolvedValue({ ...row, status: 'Discarded' });
  render(<OrderEditorScreen id="order-1" budget />);
  await screen.findByRole('button', { name: 'Recuperar presupuesto' });
  expect(screen.getAllByRole('button', { name: /Recuperar/ })).toHaveLength(1);
});
it('saves pending notes before advancing the status', async () => {
  vi.mocked(get).mockResolvedValue(row);
  vi.mocked(put).mockResolvedValue({ ...row, version: 2, notes: 'Retirar el viernes' });
  vi.mocked(post).mockResolvedValue({ ...row, version: 3, status: 'InProgress', notes: 'Retirar el viernes' });
  render(<OrderEditorScreen id="order-1" />);
  await screen.findByRole('button', { name: 'Iniciar pedido' });
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
  await screen.findByRole('button', { name: 'Guardar cambios' });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(screen.getByLabelText('Notas (opcional)')).toBeDisabled();
  finish({ ...row, version: 2 });
  await waitFor(() => expect(screen.getByLabelText('Notas (opcional)')).toBeEnabled());
});

it('reloads a conflicting version while preserving pending entries', async () => {
  vi.mocked(get).mockResolvedValueOnce(row).mockResolvedValue({ ...row, version: 4, notes: 'Otra pantalla' });
  vi.mocked(put).mockRejectedValueOnce(new ApiError(409, 'Este pedido cambió en otra pantalla.')).mockResolvedValue({ ...row, version: 5, notes: 'Mi nota' });
  render(<OrderEditorScreen id="order-1" />);
  await screen.findByRole('button', { name: 'Guardar cambios' });
  fireEvent.change(screen.getByLabelText('Notas (opcional)'), { target: { value: 'Mi nota' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Actualizar versión conservando mis datos' }));
  await screen.findByText(/Versión actualizada/);
  expect(screen.getByLabelText('Notas (opcional)')).toHaveValue('Mi nota');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(put).toHaveBeenLastCalledWith('/api/orders/order-1', expect.objectContaining({ version: 4, notes: 'Mi nota' })));
});
