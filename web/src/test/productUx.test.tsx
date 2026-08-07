import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/AppShell';
import { QuickQuoteScreen } from '../screens/QuickQuoteScreen';
import { JobListScreen, QuoteListScreen } from '../screens/ResourceScreens';
import { AdvancedSettingsScreen, SimpleSettingsScreen } from '../screens/SimpleSettingsScreen';

const json = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
});

const filament = {
  id: 'spool-1', manufacturer: 'Test', productName: 'Negro mate', material: 'PLA', color: 'Negro', batchCode: null,
  purchaseCurrency: 'PYG', purchaseAmount: 131_250, exchangeRateGs: null, allocatedShippingGs: 0,
  allocatedImportFeesGs: 0, allocatedOtherCostsGs: 0, landedCostGs: 131_250, netWeightGrams: 1_000,
  remainingWeightGrams: 1_000, purchasedAt: null, supplier: null, isInventoryTracked: false, isActive: true
};

const breakdown = {
  quantity: 1, numberOfPlates: 1, materialCostGs: 18_637.5, materials: [],
  energy: { totalKWh: .51, costGs: 222, effectiveRateGsPerKWh: 435.51, usedMeasuredKWh: false },
  machine: { hourlyRateGs: 2_000, totalOccupiedHours: 5.4, costGs: 10_800, isConfigured: true },
  laborCostGs: 6_666.67, additionalCostGs: 2_000, marginBearingAdditionalCostGs: 2_000,
  nonMarginInternalCostGs: 0, nonMarginRecoveryChargeGs: 0, customerAdditionalChargeGs: 0, customerPassThroughGs: 0,
  directCostGs: 38_326.17, failureReserveGs: 4_258.46, totalOverheadGs: 2_129.23, fullyLoadedCostGs: 44_713.86,
  requiredNetPriceGs: 74_523.1, minimumMarginPriceGs: 63_876.94, suggestedNetPriceGs: 75_000,
  finalNetSalePriceGs: 75_000, variableSellingFeeGs: 0, netRevenueAfterSellingFeesGs: 75_000,
  revenueAvailableBeforeCostsGs: 75_000, estimatedProfitGs: 30_286.14, achievedMarginPercent: 40.38,
  markupPercent: 67.74, taxGs: 0, customerTotalGs: 75_000, unitCostGs: 44_713.86, unitPriceGs: 75_000, warnings: []
};

const preview = { breakdown, resolvedAssumptions: null, canUsePrice: true, warnings: [], advancedRequest: { printerId: 'printer-1' } };

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('flujo cotidiano de cotización', () => {
  it('calcula automáticamente con debounce sin lanzar resultados intermedios', async () => {
    let previewCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/filaments')) return json([filament]);
      previewCalls += 1;
      return json(preview);
    }));
    render(<QuickQuoteScreen />);
    await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveValue(filament.id));

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Horas de impresión'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Minutos de impresión'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '142' } });

    await act(async () => { vi.advanceTimersByTime(449); });
    expect(previewCalls).toBe(0);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(previewCalls).toBe(1);
  });

  it('un nuevo cálculo limpia cantidades, conserva el filamento y enfoca horas', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/api/filaments') ? json([filament]) : json(preview)));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveValue(filament.id));
    await user.type(screen.getByLabelText('Horas de impresión'), '5');
    await user.type(screen.getByLabelText('Minutos de impresión'), '24');
    await user.type(screen.getByLabelText('Gramos totales del slicer'), '142');
    await user.click(screen.getByRole('button', { name: 'Calcular precio' }));
    await screen.findByText('Podés cobrar');

    await user.click(screen.getByRole('button', { name: 'Nuevo cálculo' }));
    expect(screen.getByLabelText('Filamento')).toHaveValue(filament.id);
    expect(screen.getByLabelText('Horas de impresión')).toHaveValue(null);
    expect(screen.getByLabelText('Minutos de impresión')).toHaveValue(null);
    expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(null);
    await waitFor(() => expect(screen.getByLabelText('Horas de impresión')).toHaveFocus());
  });

  it('agrega un filamento en un diálogo simple, lo selecciona y devuelve el foco', async () => {
    const created = { ...filament, id: 'spool-2', color: 'Rojo', productName: 'Rojo' };
    let createBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        createBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return json(created);
      }
      return json([filament]);
    }));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await screen.findByRole('option', { name: /PLA · Negro/ });
    const trigger = screen.getByRole('button', { name: 'Agregar filamento' });

    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Nuevo filamento' })).toBeInTheDocument();
    expect(screen.getByLabelText('Peso neto del rollo en gramos')).toHaveValue(1_000);
    expect(screen.queryByText(/inventario/i)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    await user.type(screen.getByLabelText('Color o nombre'), 'Rojo');
    await user.type(screen.getByLabelText('Costo total del rollo en Gs.'), '131250');
    fireEvent.submit(document.getElementById('new-filament-form')!);
    await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveValue(created.id));
    expect(createBody).toEqual({
      material: 'PLA',
      displayName: 'Rojo',
      landedCostGs: 131_250,
      netWeightGrams: 1_000
    });
  });

  it('guarda el cálculo desde un diálogo sin exponer campos técnicos', async () => {
    let quoteBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/filaments')) return json([filament]);
      if (url.endsWith('/api/customers')) return json([]);
      if (url.endsWith('/api/quotes') && init?.method === 'POST') {
        quoteBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return json({ code: 'COT-2026-0001' });
      }
      return json(preview);
    }));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveValue(filament.id));
    await user.type(screen.getByLabelText('Horas de impresión'), '5');
    await user.type(screen.getByLabelText('Minutos de impresión'), '24');
    await user.type(screen.getByLabelText('Gramos totales del slicer'), '142');
    await user.click(screen.getByRole('button', { name: 'Calcular precio' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar presupuesto' }));

    const dialog = screen.getByRole('dialog', { name: 'Guardar presupuesto' });
    expect(within(dialog).getByLabelText('Cliente')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Descripción')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nota')).toBeInTheDocument();
    expect(within(dialog).queryByText(/impresora|política|tarifa/i)).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Descripción'), 'Soporte de pared');
    await user.type(within(dialog).getByLabelText('Nota'), 'Entregar el viernes');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar presupuesto' }));
    expect(await screen.findByText(/se guardó en Presupuestos como borrador/i)).toBeInTheDocument();
    expect(quoteBody).toMatchObject({
      notes: 'Entregar el viernes',
      lines: [{ description: 'Soporte de pared' }]
    });
  });
});

it('la navegación principal contiene solo las cinco secciones cotidianas', () => {
  render(<AppShell user={{ id: 'u', username: 'rafa', displayName: 'Rafa', role: 'Owner' }} path="/" appName="Craf3D" onLogout={vi.fn()}><p>Contenido</p></AppShell>);
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
  expect(within(nav).getAllByRole('link').map(link => link.textContent)).toEqual(['Cotizar', 'Presupuestos', 'Pedidos', 'Filamentos', 'Ajustes']);
  expect(within(nav).queryByText(/calculadora avanzada|dashboard|reportes|auditoría/i)).not.toBeInTheDocument();
  expect(screen.queryByText('TypeUI')).not.toBeInTheDocument();
});

it('el layout móvil limita el ancho y distribuye cuatro acciones sin overflow', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
  render(<AppShell user={{ id: 'u', username: 'clari', displayName: 'Clari', role: 'User' }} path="/" appName="Craf3D" onLogout={vi.fn()}><p>Contenido</p></AppShell>);
  const mobileNav = screen.getByRole('navigation', { name: 'Navegación móvil' });
  expect(mobileNav.children).toHaveLength(4);
  expect(within(mobileNav).getAllByRole('link')).toHaveLength(3);
  expect(within(mobileNav).getByRole('button', { name: 'Abrir más opciones' })).toBeInTheDocument();
});

it('Ajustes usa lenguaje humano, datos resueltos y confirma antes de restaurar', async () => {
  const settings = {
    machineHourlyRateGs: 2_000, preparationMinutes: 20, laborHourlyRateGs: 20_000, preparationCostGs: 6_666.67,
    packagingCostGs: 2_000, failureProbabilityPercent: 10, overheadPercent: 5, targetMarginPercent: 40,
    minimumMarginPercent: 30, minimumOrderGs: 30_000, roundingIncrementGs: 5_000, averagePrintPowerW: 95,
    electricityRateGsPerKWh: 435.51, printerName: 'Bambu Lab A1', electricityTariffName: 'ANDE', isUsingRecommendedDefaults: true
  };
  let restoreCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/api/pricing/simple-settings/restore-recommended') && init?.method === 'POST') { restoreCalls += 1; return json(settings); }
    if (String(input).endsWith('/api/filaments')) return json([]);
    return json(settings);
  }));
  const user = userEvent.setup();
  render(<SimpleSettingsScreen />);
  await screen.findByText('Cubre desgaste, mantenimiento y recuperación del equipo.');
  expect(screen.getByRole('heading', { name: 'Ajustes de precio' })).toBeInTheDocument();
  expect(screen.getByText('Datos técnicos automáticos')).toBeInTheDocument();
  expect(screen.getByText('Bambu Lab A1')).toBeInTheDocument();
  const restoreTrigger = screen.getByRole('button', { name: 'Restaurar valores recomendados' });
  await user.click(restoreTrigger);
  expect(restoreCalls).toBe(0);
  const dialog = screen.getByRole('dialog', { name: '¿Restaurar ajustes recomendados?' });
  await user.click(within(dialog).getByRole('button', { name: 'Sí, restaurar' }));
  await waitFor(() => expect(restoreCalls).toBe(1));
});

it('Ajustes calcula la preparación en vivo y avisa cuando hay overrides avanzados', async () => {
  const settings = {
    machineHourlyRateGs: 2_000, preparationMinutes: 20, laborHourlyRateGs: 20_000, preparationCostGs: 6_666.67,
    packagingCostGs: 2_000, failureProbabilityPercent: 10, overheadPercent: 5, targetMarginPercent: 40,
    minimumMarginPercent: 30, minimumOrderGs: 30_000, roundingIncrementGs: 5_000, averagePrintPowerW: 95,
    electricityRateGsPerKWh: 435.51, printerName: 'Bambu Lab A1', electricityTariffName: 'ANDE',
    isUsingRecommendedDefaults: false, hasAdvancedOverrides: true,
    advancedOverrideMessages: ['Hay un impuesto activo.', 'Hay una comisión variable activa.']
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/api/filaments') ? json([]) : json(settings)));
  render(<SimpleSettingsScreen />);

  expect(await screen.findByText('Hay configuraciones avanzadas modificando estos precios.')).toBeInTheDocument();
  expect(screen.getByText('Hay un impuesto activo.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('spinbutton', { name: /Preparación/ }), { target: { value: '30' } });
  expect(screen.getByText('Gs. 10.000')).toBeInTheDocument();
  const technical = screen.getByRole('heading', { name: 'Datos técnicos automáticos' }).closest('section')!;
  expect(within(technical).queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(within(technical).getByRole('button', { name: 'Abrir configuración avanzada' })).toBeInTheDocument();
});

it('la configuración avanzada conserva los accesos técnicos esperados', () => {
  render(<AdvancedSettingsScreen />);
  const expected = [
    ['Cálculo avanzado', '/calculator'],
    ['Presupuesto completo', '/quotes/new'],
    ['Reportes', '/reports'],
    ['Resumen', '/dashboard'],
    ['Filamentos avanzados', '/settings/advanced/filaments']
  ];
  for (const [name, href] of expected)
    expect(screen.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href);
});

it('los estados de presupuesto se muestran en español', async () => {
  const statuses = ['Draft', 'Calculated', 'ReadyToSend', 'Sent', 'Accepted', 'Rejected', 'Expired', 'ConvertedToJob', 'Cancelled'];
  vi.stubGlobal('fetch', vi.fn(async () => json(statuses.map((status, index) => ({
    id: `q-${index}`, code: `COT-${index}`, status, createdAt: '2026-08-07T12:00:00Z', revisionNumber: 1, totalGs: 75_000, customerId: null
  })))));
  render(<QuoteListScreen />);
  for (const label of ['Borrador', 'Calculado', 'Listo para enviar', 'Enviado', 'Aceptado', 'Rechazado', 'Vencido', 'Convertido en pedido', 'Cancelado'])
    expect(await screen.findByText(label)).toBeInTheDocument();
  expect(screen.queryByText('Draft')).not.toBeInTheDocument();
});

it('los listados priorizan descripción, cliente y total de venta al cliente', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('/jobs')
    ? json([{
      id: 'job-1', code: 'JOB-1', description: 'Maceta bicolor', customerName: 'Ana Cliente', status: 'Completed',
      createdAt: '2026-08-07T12:00:00Z', estimatedCustomerTotalGs: 75_000, actualCustomerTotalGs: 82_000,
      estimatedCostGs: 45_000, actualCostGs: 48_000
    }])
    : json([{
      id: 'quote-1', code: 'COT-1', description: 'Soporte de pared', customerName: 'Ana Cliente', status: 'Draft',
      createdAt: '2026-08-07T12:00:00Z', revisionNumber: 2, totalGs: 75_000, customerId: 'customer-1'
    }])));

  const quoteView = render(<QuoteListScreen />);
  expect(await screen.findByText('Soporte de pared')).toBeInTheDocument();
  expect(screen.getByText('Ana Cliente')).toBeInTheDocument();
  quoteView.unmount();

  render(<JobListScreen />);
  expect(await screen.findByText('Maceta bicolor')).toBeInTheDocument();
  expect(screen.getByText('Gs. 82.000')).toBeInTheDocument();
  expect(screen.queryByText('Gs. 48.000')).not.toBeInTheDocument();
});
