import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { QuickQuoteScreen, QUICK_DRAFT_KEY } from '../screens/QuickQuoteScreen';

const rows = [
  { id: 'black', manufacturer: 'Creality', material: 'PLA', color: 'Negro', productName: 'Standard', landedCostGs: 100000, netWeightGrams: 1000, isActive: true },
  { id: 'white', manufacturer: 'Creality', material: 'PLA', color: 'Blanco', productName: 'Hyper', landedCostGs: 132000, netWeightGrams: 1000, isActive: true },
  { id: 'petg', manufacturer: 'Creality', material: 'PETG', color: 'Blanco', productName: 'Standard', landedCostGs: 140000, netWeightGrams: 1000, isActive: true },
  { id: 'other', manufacturer: 'Bambu Lab', material: 'PLA', color: 'Blanco', productName: 'Basic', landedCostGs: 200000, netWeightGrams: 1000, isActive: true },
  { id: 'pearl', manufacturer: 'Sin fabricante', material: 'PLA', color: 'Blanco perlado', productName: 'Edición especial', landedCostGs: 160000, netWeightGrams: 1000, isActive: true },
  { id: 'inactive', manufacturer: 'Creality', material: 'PLA', color: 'Rojo', productName: 'Standard', isActive: false }
];
let writes: { spoolId: string }[];
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); writes = [];
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'black', hours: 1, minutes: 0, totalGrams: 100 }));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).endsWith('/filaments')) writes.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(String(input).endsWith('/filaments') ? rows : { canUsePrice: false, breakdown: null, warnings: [], advancedRequest: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});

it('combines visual brand/material filters and quotes only the exact chosen spool', async () => {
  render(<QuickQuoteScreen />);
  await waitFor(() => expect(writes).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Filamento' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar marca Creality' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar material PLA' }));
  const options = screen.getByRole('group', { name: 'Filamentos disponibles' });
  expect(within(options).getAllByRole('button', { name: /Elegir/ })).toHaveLength(2);
  expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro');
  expect(writes).toHaveLength(1);
  fireEvent.click(within(options).getByRole('button', { name: /Elegir Creality PLA Blanco/ }));
  await waitFor(() => expect(writes.at(-1)?.spoolId).toBe('white'));
  expect(screen.getByLabelText('Filamento')).toHaveTextContent('Hyper');
  expect(screen.getByLabelText('Filamento')).toHaveAttribute('aria-expanded', 'false');
});

it('searches multiple words, brand and accents without changing selection on an empty result', async () => {
  render(<QuickQuoteScreen />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro'));
  fireEvent.click(screen.getByLabelText('Filamento'));
  fireEvent.change(screen.getByLabelText('Buscar filamento'), { target: { value: 'edicion blanco' } });
  const options = screen.getByRole('group', { name: 'Filamentos disponibles' });
  expect(within(options).getAllByRole('button', { name: /Elegir/ })).toHaveLength(1);
  expect(within(options).getByRole('button', { name: /Blanco perlado/ })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Buscar filamento'), { target: { value: 'inexistente' } });
  expect(screen.getByText('No encontramos filamentos con esos filtros.')).toBeInTheDocument();
  expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(within(options).queryByRole('button', { name: /Rojo/ })).not.toBeInTheDocument();
});

it('keeps recently chosen spools as shortcuts and closes with Escape returning focus', async () => {
  const user = userEvent.setup();
  const first = render(<QuickQuoteScreen />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro'));
  await user.click(screen.getByLabelText('Filamento'));
  await user.click(screen.getByRole('button', { name: /Elegir Bambu Lab PLA Blanco/ }));
  first.unmount();
  render(<QuickQuoteScreen />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Bambu Lab'));
  await user.click(screen.getByLabelText('Filamento'));
  expect(screen.getByRole('group', { name: 'Usados recientemente' })).toHaveTextContent('Bambu Lab');
  await user.keyboard('{Escape}');
  expect(screen.getByLabelText('Filamento')).toHaveFocus();
  expect(screen.queryByRole('group', { name: 'Filamentos disponibles' })).not.toBeInTheDocument();
});

it('shows a short initial set for a large catalog and expands without selecting another spool', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(Array.from({ length: 30 }, (_, index) => ({
    ...rows[0], id: index === 0 ? 'black' : `roll-${index}`, color: `Negro ${index}`, productName: `Serie ${index}`
  }))), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'black', hours: 0, minutes: 0, totalGrams: 0 }));
  render(<QuickQuoteScreen />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro 0'));
  fireEvent.click(screen.getByLabelText('Filamento'));
  const options = screen.getByRole('group', { name: 'Filamentos disponibles' });
  expect(within(options).getAllByRole('button')).toHaveLength(6);
  fireEvent.click(screen.getByRole('button', { name: 'Ver más filamentos (24)' }));
  expect(within(options).getAllByRole('button')).toHaveLength(12);
  expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro 0');
});

it('closes the choices when the connection is lost and keeps the selected roll', async () => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  render(<QuickQuoteScreen />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro'));
  fireEvent.click(screen.getByLabelText('Filamento'));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  fireEvent(window, new Event('offline'));
  expect(screen.queryByRole('group', { name: 'Filamentos disponibles' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Filamento')).toBeDisabled();
  expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

it('keeps a known lot visible in the selected roll summary', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(String(input).endsWith('/filaments')
    ? rows.map(row => row.id === 'white' ? { ...row, batchCode: 'W-24' } : row)
    : { canUsePrice: false, breakdown: null, warnings: [], advancedRequest: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  render(<QuickQuoteScreen />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveTextContent('Negro'));
  fireEvent.click(screen.getByLabelText('Filamento'));
  fireEvent.click(screen.getByRole('button', { name: /Elegir Creality PLA Blanco/ }));
  expect(screen.getByLabelText('Filamento')).toHaveTextContent('Lote W-24');
});
