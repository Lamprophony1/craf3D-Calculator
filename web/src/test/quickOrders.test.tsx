import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { QuickQuoteScreen } from '../screens/QuickQuoteScreen';
import { ClientQuoteCard } from '../components/ClientQuoteCard';
import { buildClientQuoteText } from '../utils/clientQuote';

const preview = { canUsePrice: true, warnings: [], advancedRequest: {}, breakdown: { customerTotalGs: 25000,
  materialCostGs: 10000, energy: { costGs: 100 }, machine: { costGs: 2000 }, laborCostGs: 1000,
  additionalCostGs: 500, failureReserveGs: 100, totalOverheadGs: 200, estimatedProfitGs: 11200,
  fullyLoadedCostGs: 13800, achievedMarginPercent: 44.8, taxGs: 0 } };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
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
  fireEvent.change(screen.getByLabelText('Cliente / referencia'), { target: { value: 'Ana WhatsApp' } });
  fireEvent.change(screen.getByLabelText('Qué se va a imprimir (opcional)'), { target: { value: 'Soporte' } });
  fireEvent.change(screen.getByLabelText('Horas de impresión'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '100' } });
  await screen.findByText(/Borrador guardado/);
  expect(screen.getByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-1');
  expect(writes[0].customerReference).toBe('Ana WhatsApp');
  fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '120' } });
  await waitFor(() => expect(writes.length).toBeGreaterThanOrEqual(2));
  expect(new Set(writes.map(x => x.sessionId)).size).toBe(1);
  expect(writes.at(-1)!.sequence).toBeGreaterThan(writes[0].sequence);
  await screen.findByText(/Borrador guardado/);
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
