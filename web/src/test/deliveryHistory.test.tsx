import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DeliveryHistoryScreen } from '../screens/DeliveryHistoryScreen';

const today = '2026-11-10';
const missing = {
  id: 'order-1', code: 'PED-001', customerReference: 'Lucía', description: 'Soporte para monitor', version: 1,
  deliveredDate: null, salesGs: 50_000, manualActualCostGs: null, productionActualCostGs: null,
  hasProductionResult: false, realizedProfitGs: null
};
const complete = { ...missing, id: 'order-2', code: 'PED-002', customerReference: 'Mateo', deliveredDate: '2026-10-01',
  manualActualCostGs: 20_000, realizedProfitGs: 30_000 };
const report = (items: unknown[]) => Response.json({ today, items });
const row = (code: string) => screen.getByRole('form', { name: `Pedido ${code}` });

afterEach(() => vi.unstubAllGlobals());

it('guarda primero la fecha y luego un costo real de cero sin perder el pedido', async () => {
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method !== 'PUT') return report([missing, complete]);
    const data = JSON.parse(String(init.body));
    writes.push(data);
    return Response.json({ ...missing, ...data, version: data.version + 1, realizedProfitGs: data.manualActualCostGs === 0 ? 50_000 : null });
  }));
  render(<DeliveryHistoryScreen />);
  await screen.findByRole('form', { name: 'Pedido PED-001' });
  expect(screen.queryByRole('form', { name: 'Pedido PED-002' })).not.toBeInTheDocument();
  const date = within(row('PED-001')).getByLabelText('Fecha de entrega');
  fireEvent.change(date, { target: { value: '2026-11-11' } });
  fireEvent.submit(row('PED-001'));
  expect(within(row('PED-001')).getByRole('alert')).toHaveTextContent(/hoy/);
  expect(writes).toEqual([]);
  fireEvent.change(date, { target: { value: '2026-10-09' } });
  fireEvent.click(within(row('PED-001')).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(writes).toEqual([{ version: 1, deliveredDate: '2026-10-09', manualActualCostGs: null }]));
  const cost = within(row('PED-001')).getByLabelText('Costo real total (Gs.)');
  await waitFor(() => expect(cost).toBeEnabled());
  fireEvent.change(cost, { target: { value: '-1' } });
  fireEvent.submit(row('PED-001'));
  expect(within(row('PED-001')).getByRole('alert')).toHaveTextContent(/cero o más/);
  expect(writes).toHaveLength(1);
  fireEvent.change(cost, { target: { value: '0' } });
  fireEvent.click(within(row('PED-001')).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Pedido PED-001' })).not.toBeInTheDocument());
  expect(writes[1]).toEqual({ version: 2, deliveredDate: '2026-10-09', manualActualCostGs: 0 });
  fireEvent.click(screen.getByRole('button', { name: /^Todos/ }));
  expect(within(row('PED-001')).getByLabelText('Costo real total (Gs.)')).toHaveValue(0);
  expect(within(row('PED-001')).getAllByText('Gs. 50.000')).toHaveLength(2);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mateo' } });
  expect(screen.queryByRole('form', { name: 'Pedido PED-001' })).not.toBeInTheDocument();
  expect(row('PED-002')).toBeInTheDocument();
});

it('mantiene el cierre de producción y enlaza la ficha de un pedido sin importe', async () => {
  const locked = { ...missing, hasProductionResult: true, productionActualCostGs: 15_000, realizedProfitGs: 30_000 };
  const noAmount = { ...complete, salesGs: null, realizedProfitGs: null };
  vi.stubGlobal('fetch', vi.fn(async () => report([locked, noAmount])));
  render(<DeliveryHistoryScreen />);
  await screen.findByRole('form', { name: 'Pedido PED-001' });
  expect(within(row('PED-001')).getByLabelText('Fecha de entrega')).toBeEnabled();
  expect(within(row('PED-001')).queryByRole('spinbutton', { name: 'Costo real total (Gs.)' })).not.toBeInTheDocument();
  expect(within(row('PED-001')).getByText('Cierre de producción')).toBeVisible();
  expect(within(row('PED-002')).getByText('Sin importe')).toBeVisible();
  expect(within(row('PED-002')).getByRole('link', { name: 'Ver pedido' })).toHaveAttribute('href', '/orders/order-2');
});

it('recupera una fila desactualizada sin perder los cambios de otras filas', async () => {
  const another = { ...missing, id: 'order-2', code: 'PED-002' };
  const fresh = { ...missing, deliveredDate: '2026-09-10', manualActualCostGs: 22_000, realizedProfitGs: 28_000, version: 2 };
  const writes: unknown[] = [];
  let reads = 0;
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method !== 'PUT') return report([++reads === 1 ? missing : fresh, another]);
    const data = JSON.parse(String(init.body));
    writes.push(data);
    if (data.version === 1) return Response.json({ message: 'El pedido cambió.' }, { status: 409 });
    return Response.json({ ...fresh, ...data, version: 3, realizedProfitGs: 25_000 });
  }));
  render(<DeliveryHistoryScreen />);
  await screen.findByRole('form', { name: 'Pedido PED-001' });
  fireEvent.change(within(row('PED-002')).getByLabelText('Costo real total (Gs.)'), { target: { value: '20000' } });
  fireEvent.change(within(row('PED-001')).getByLabelText('Costo real total (Gs.)'), { target: { value: '25000' } });
  fireEvent.click(within(row('PED-001')).getByRole('button', { name: 'Guardar' }));
  fireEvent.click(await within(row('PED-001')).findByRole('button', { name: 'Actualizar fila' }));
  await waitFor(() => expect(within(row('PED-001')).getByLabelText('Fecha de entrega')).toHaveValue('2026-09-10'));
  expect(within(row('PED-001')).getByLabelText('Costo real total (Gs.)')).toHaveValue(25_000);
  expect(within(row('PED-002')).getByLabelText('Costo real total (Gs.)')).toHaveValue(20_000);
  fireEvent.click(within(row('PED-001')).getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(writes[1]).toEqual({ version: 2, deliveredDate: '2026-09-10', manualActualCostGs: 25_000 }));
});

it('protege un borrador al volver al Resumen', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => report([missing])));
  render(<DeliveryHistoryScreen />);
  await screen.findByRole('form', { name: 'Pedido PED-001' });
  const date = within(row('PED-001')).getByLabelText('Fecha de entrega');
  fireEvent.change(date, { target: { value: '2026-10-09' } });
  fireEvent.click(screen.getByRole('link', { name: 'Volver al Resumen' }));
  const dialog = screen.getByRole('dialog', { name: 'Cambios sin guardar' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Seguir editando' }));
  expect(dialog).not.toBeInTheDocument();
  expect(date).toHaveValue('2026-10-09');
});
