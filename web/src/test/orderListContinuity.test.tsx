import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiError, get, post } from '../api/client';
import type { Order, OrderPage } from '../api/orders';
import { OrdersScreen } from '../screens/OrdersList';
import { orderListReturn } from '../screens/orderListNavigation';

vi.mock('../api/client', async importOriginal => ({
  ...await importOriginal<typeof import('../api/client')>(), get: vi.fn(), post: vi.fn()
}));

const order: Order = {
  id: 'order-1', code: 'PED-1', customerReference: 'Ana', description: 'Soportes', quantity: 3,
  totalGs: 100000, status: 'Confirmed', version: 1, position: 3, orderDate: null, dueDate: null,
  deliveredDate: null, notes: null, historical: false, quoteId: null, jobId: null,
  productionStatus: null, actualCostGs: null, updatedAt: '2026-11-09T12:00:00Z'
};

function result(items: Order[], total = items.length): OrderPage {
  return { items, total, draftCount: 26, activeCount: 30 };
}

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, '', '/jobs');
});

it('opens the exact history search and page encoded in the address', async () => {
  window.history.replaceState({}, '', '/jobs?view=history&search=Ana&page=2');
  vi.mocked(get).mockResolvedValue(result([{ ...order, status: 'Delivered' }], 26));
  render(<OrdersScreen />);

  await screen.findByRole('link', { name: 'Ana' });
  expect(screen.getByRole('button', { name: 'Historial' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('searchbox')).toHaveValue('Ana');
  expect(get).toHaveBeenCalledWith('/api/orders?view=history&search=Ana&skip=25&take=25');
});

it('returns to the same history results and restores the position after the rows load', async () => {
  const href = '/jobs?view=history&search=Ana&page=2';
  window.history.replaceState({}, '', href);
  vi.mocked(get).mockResolvedValue(result([{ ...order, status: 'Delivered' }], 26));
  const readScroll = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(735);
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  try {
    const list = render(<OrdersScreen />);
    fireEvent.click(await screen.findByRole('link', { name: 'Ana' }));
    expect(window.location.pathname).toBe('/orders/order-1');
    const back = orderListReturn('/jobs');
    expect(back.href).toBe(href);
    list.unmount();
    window.history.replaceState(back.state, '', back.href);

    render(<OrdersScreen />);
    const row = await screen.findByRole('link', { name: 'Ana' });
    expect(row).toHaveFocus();
    expect(scrollTo).toHaveBeenCalledWith({ top: 735, behavior: 'instant' });
  } finally {
    readScroll.mockRestore();
    scrollTo.mockRestore();
  }
});

it('normalizes an invalid view and page and ignores an older search response', async () => {
  window.history.replaceState({}, '', '/jobs?view=drafts&page=99999999999999');
  let finishOld!: (page: OrderPage) => void;
  vi.mocked(get).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce(result([{ ...order, id: 'order-2', customerReference: 'Bruno' }]));
  render(<OrdersScreen />);
  expect(window.location.search).toBe('');
  expect(get).toHaveBeenCalledWith('/api/orders?view=active&search=&skip=0&take=25');

  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Bruno' } });
  await screen.findByRole('link', { name: 'Bruno' });
  await act(async () => finishOld(result([order])));
  expect(screen.queryByRole('link', { name: 'Ana' })).not.toBeInTheDocument();
  expect(window.location.search).toBe('?search=Bruno');
});

it('keeps the focused priority handle mounted while refreshing', async () => {
  let finishRefresh!: (page: OrderPage) => void;
  vi.mocked(get).mockResolvedValueOnce(result([order])).mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  vi.mocked(post).mockResolvedValue({ ...order, position: 1, version: 2 });
  render(<OrdersScreen />);

  const handle = await screen.findByRole('button', { name: 'Cambiar prioridad de Ana' });
  handle.focus();
  fireEvent.click(handle);
  fireEvent.change(screen.getByLabelText('Nueva posición'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar prioridad' }));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  expect(handle).toBeInTheDocument();
  expect(handle).toHaveFocus();

  await act(async () => finishRefresh(result([{ ...order, position: 1, version: 2 }])));
  expect(handle).toHaveFocus();
  expect(screen.getByText(/Prioridad actualizada/)).toBeInTheDocument();
});

it('retains the filtered page and points to the global destination when a row moves away', async () => {
  window.history.replaceState({}, '', '/jobs?search=Ana&page=2');
  vi.mocked(get).mockResolvedValueOnce(result([{ ...order, position: 26 }], 26))
    .mockResolvedValueOnce(result([{ ...order, id: 'order-2', customerReference: 'Ana dos', position: 27 }], 26));
  vi.mocked(post).mockResolvedValue({ ...order, position: 1, version: 2 });
  render(<OrdersScreen />);

  const handle = await screen.findByRole('button', { name: 'Cambiar prioridad de Ana' });
  handle.focus();
  fireEvent.click(handle);
  fireEvent.change(screen.getByLabelText('Nueva posición'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar prioridad' }));

  const destination = await screen.findByRole('link', { name: 'Ver en Confirmados' });
  expect(destination).toHaveAttribute('href', '/jobs');
  expect(destination).toHaveFocus();
  expect(window.location.search).toBe('?search=Ana&page=2');
  expect(post).toHaveBeenCalledWith('/api/orders/order-1/move', { direction: 'position', position: 1, version: 1 });
});

it('returns focus to the search when a conflict moves the order out of the page', async () => {
  window.history.replaceState({}, '', '/jobs?page=2');
  vi.mocked(get).mockResolvedValueOnce(result([{ ...order, position: 26 }], 26))
    .mockResolvedValueOnce(result([{ ...order, id: 'order-2', customerReference: 'Bruno', position: 26 }], 26));
  vi.mocked(post).mockRejectedValue(new ApiError(409, 'Cambió la cola.'));
  render(<OrdersScreen />);

  const handle = await screen.findByRole('button', { name: 'Cambiar prioridad de Ana' });
  handle.focus();
  fireEvent.click(handle);
  fireEvent.change(screen.getByLabelText('Nueva posición'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar prioridad' }));

  await screen.findByRole('link', { name: 'Bruno' });
  expect(screen.getByRole('alert')).toHaveTextContent('Cambió la cola.');
  expect(screen.getByRole('searchbox')).toHaveFocus();
});

it('keeps the discarded search and links to the recovered budget in Pendientes', async () => {
  window.history.replaceState({}, '', '/quotes?view=discarded&search=Ana');
  vi.mocked(get).mockResolvedValueOnce(result([{ ...order, status: 'Discarded' }])).mockResolvedValueOnce(result([]));
  vi.mocked(post).mockResolvedValue({ ...order, status: 'Draft', version: 2 });
  render(<OrdersScreen area="quotes" />);

  const recover = await screen.findByRole('button', { name: 'Recuperar presupuesto' });
  recover.focus();
  fireEvent.click(recover);

  const destination = await screen.findByRole('link', { name: 'Ver en Pendientes' });
  expect(destination).toHaveAttribute('href', '/quotes?search=PED-1');
  await waitFor(() => expect(destination).toHaveFocus());
  expect(screen.getByRole('searchbox')).toHaveValue('Ana');
  expect(window.location.search).toBe('?view=discarded&search=Ana');
  expect(post).toHaveBeenCalledWith('/api/orders/order-1/status', { status: 'Draft', version: 1 });
});
