import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardScreen } from '../screens/DashboardScreen';

const noSales = { salesGs: 0, realizedProfitGs: 0, orderCount: 0, pricedOrderCount: 0, costedOrderCount: 0 };
const settings = () => Response.json({ readiness: { quickQuoteReady: true } });

afterEach(() => vi.unstubAllGlobals());

it('muestra los importes entregados, la cobertura real y las ganancias mensuales por año', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/settings') ? settings() : Response.json({
    currentMonth: '2026-03',
    totals: { salesGs: 210_000, realizedProfitGs: -12_500, orderCount: 5, pricedOrderCount: 3, costedOrderCount: 2 },
    months: [
      { month: '2025-12', salesGs: 60_000, realizedProfitGs: 0, orderCount: 1, pricedOrderCount: 1, costedOrderCount: 0 },
      { month: '2026-01', salesGs: 50_000, realizedProfitGs: 0, orderCount: 1, pricedOrderCount: 1, costedOrderCount: 1 },
      { month: '2026-03', salesGs: 100_000, realizedProfitGs: -12_500, orderCount: 2, pricedOrderCount: 1, costedOrderCount: 1 }
    ],
    undated: { ...noSales, orderCount: 1 }
  })));
  render(<DashboardScreen />);

  const totals = await screen.findByRole('region', { name: 'Resultado acumulado' });
  expect(within(totals).getByText('Ventas entregadas')).toBeVisible();
  expect(within(totals).getByText('Gs. 210.000')).toBeVisible();
  expect(within(totals).getByText(/5 pedidos entregados.*2 sin importe/)).toBeVisible();
  expect(within(totals).getByText(/2 de 5 entregas con costos reales/)).toBeVisible();
  expect(screen.getByText(/1 pedido sin fecha de entrega/)).toBeVisible();

  const march = screen.getByRole('row', { name: /marzo/i });
  expect(within(march).getByText(/12\.500/)).toHaveTextContent(/[-−]/);
  expect(within(march).getByText('1 de 2 con costos')).toBeVisible();
  expect(within(screen.getByRole('row', { name: /enero/i })).getByText('Gs. 0')).toBeVisible();
  expect(screen.queryByRole('row', { name: /abril/i })).not.toBeInTheDocument();

  fireEvent.change(screen.getByRole('combobox', { name: 'Año' }), { target: { value: '2025' } });
  const december = screen.getByRole('row', { name: /diciembre/i });
  expect(within(december).getByText('Gs. 60.000')).toBeVisible();
  expect(within(december).getByText('Sin calcular')).toBeVisible();
});

it('distingue la falta de costos reales y permite volver a cargar las ventas', async () => {
  let attempts = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/settings')) return settings();
    if (++attempts === 1) return Response.json({ message: 'Error temporal' }, { status: 503 });
    return Response.json({ currentMonth: '2026-03', totals: noSales, months: [], undated: noSales });
  }));
  render(<DashboardScreen />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Error temporal');
  fireEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
  const totals = await screen.findByRole('region', { name: 'Resultado acumulado' });
  expect(within(totals).getByText('Gs. 0')).toBeVisible();
  expect(within(totals).getByText('Sin calcular')).toBeVisible();
  expect(screen.getByText('Todavía no hay entregas con fecha en este año.')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
