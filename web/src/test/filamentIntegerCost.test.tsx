import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { NewFilamentDialog } from '../components/QuickQuoteDialogs';

afterEach(() => vi.unstubAllGlobals());

it('permite guardar el costo entero real del rollo sin agregar centavos', async () => {
  const created = { id: 'new-spool', material: 'PLA', color: 'Gris perla', landedCostGs: 140000, netWeightGrams: 1000 };
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    writes.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(created), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  const onCreated = vi.fn();
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<NewFilamentDialog open onCreated={onCreated} onClose={onClose} />);
  await user.type(screen.getByLabelText('Color o nombre'), 'Gris perla');
  await user.type(screen.getByLabelText('Costo total del rollo en Gs.'), '140000');
  await user.click(screen.getByRole('button', { name: 'Guardar filamento' }));

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
  expect(writes).toEqual([{ material: 'PLA', displayName: 'Gris perla', landedCostGs: 140000, netWeightGrams: 1000 }]);
  expect(onClose).toHaveBeenCalledOnce();
});

it.each(['0', '-1'])('rechaza un costo no positivo de %s y conserva las entradas', async value => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(<NewFilamentDialog open onCreated={vi.fn()} onClose={vi.fn()} />);
  await user.type(screen.getByLabelText('Color o nombre'), 'Gris perla');
  await user.type(screen.getByLabelText('Costo total del rollo en Gs.'), value);
  await user.click(screen.getByRole('button', { name: 'Guardar filamento' }));
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Color o nombre')).toHaveValue('Gris perla');
});
