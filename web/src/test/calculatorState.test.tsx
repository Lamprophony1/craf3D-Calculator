import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalculatorScreen, DRAFT_KEY } from '../screens/CalculatorScreen';
import { QuoteAdjustmentScreen } from '../screens/QuoteAdjustmentScreen';
import { QUICK_TO_ADVANCED_KEY } from '../screens/QuickQuoteScreen';
import type { QuotePreviewRequest } from '../api/types';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const breakdown = (total = 75000) => ({
  quantity: 1, numberOfPlates: 1, materialCostGs: 13000, materials: [],
  energy: { totalKWh: 0.3, costGs: 150, effectiveRateGsPerKWh: 500, usedMeasuredKWh: false },
  machine: { hourlyRateGs: 2000, totalOccupiedHours: 3, costGs: 6000, isConfigured: true },
  laborCostGs: 6000, additionalCostGs: 2000, marginBearingAdditionalCostGs: 2000, nonMarginInternalCostGs: 0,
  nonMarginRecoveryChargeGs: 0, customerAdditionalChargeGs: 0, customerPassThroughGs: 0, directCostGs: 27150,
  failureReserveGs: 3000, totalOverheadGs: 1500, fullyLoadedCostGs: 31650, requiredNetPriceGs: total,
  minimumMarginPriceGs: total, suggestedNetPriceGs: total, finalNetSalePriceGs: total,
  variableSellingFeeGs: 0, netRevenueAfterSellingFeesGs: total, revenueAvailableBeforeCostsGs: total,
  estimatedProfitGs: 43350, achievedMarginPercent: 57.8, markupPercent: 136.9, taxGs: 0,
  customerTotalGs: total, unitCostGs: 31650, unitPriceGs: total, warnings: []
});
const preview = (total = 75000) => ({ snapshot: {}, breakdown: breakdown(total), resolvedAssumptions: {}, canUsePrice: true, warnings: [] });
const aggregatePreview = (canUsePrice = true) => {
  const { energy, machine, ...totals } = breakdown(115000);
  return { aggregate: { snapshot: {}, breakdown: { ...totals, energyCostGs: energy.costGs, machineCostGs: machine.costGs, canUsePrice, lineAllocations: [] } }, lines: [], canUsePrice, warnings: [] };
};
const roll = (id: string, manufacturer: string, productName: string, landedCostGs: number) => ({
  id, manufacturer, productName, material: 'PLA', color: 'Blanco', landedCostGs, netWeightGrams: 1000,
  remainingWeightGrams: 1000, isActive: true, purchaseCurrency: 'PYG', purchaseAmount: landedCostGs,
  allocatedShippingGs: 0, allocatedImportFeesGs: 0, allocatedOtherCostsGs: 0, exchangeRateGs: null,
  batchCode: null, purchasedAt: null, supplier: null, isInventoryTracked: false
});
const rolls = [roll('s1', 'Creality', 'Mate', 100000), roll('s2', 'Sunlu', 'Seda', 140000), roll('s3', 'Sunlu', 'Plus', 160000)];
type Pending = { path: string; body: Record<string, unknown>; signal: AbortSignal | null | undefined; resolve: (response: Response) => void; reject: (reason: Error) => void };
let pending: Pending[];
let linkedOrderLookups: string[];
let linkedOrderResponse: () => Response;
let clipboard: ReturnType<typeof vi.fn>;
let share: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  clipboard = vi.fn().mockResolvedValue(undefined); share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ printerId: 'p1', energyProfileId: 'e1', tariffId: 't1', policyId: 'policy', spoolId: 's1', grams: 100, printHours: 3 }));
  pending = [];
  linkedOrderLookups = [];
  linkedOrderResponse = () => json({ id: 'order-1', quoteId: 'quote-1', status: 'Draft' });
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === 'POST' || init?.method === 'PUT') return new Promise<Response>((resolve, reject) => pending.push({ path, body: JSON.parse(String(init.body)), signal: init.signal, resolve, reject }));
    if (path.includes('/api/orders/by-quote/')) {
      linkedOrderLookups.push(path);
      return Promise.resolve(linkedOrderResponse());
    }
    const body = path.endsWith('/api/printers') ? [{ id: 'p1', name: 'Bambu', isActive: true }]
      : path.endsWith('/energy-profiles') ? [{ id: 'e1', name: 'Estándar', averagePrintPowerW: 95 }]
      : path.endsWith('/api/filaments') ? rolls
      : path.endsWith('/api/electricity-tariffs') ? [{ id: 't1', provider: 'ANDE', isActive: true }]
      : path.endsWith('/api/pricing-policies') ? [{ id: 'policy', name: 'Estándar', isDefault: true }] : [];
    return Promise.resolve(json(body));
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function ready(saveAsQuote = false) {
  const view = render(<CalculatorScreen saveAsQuote={saveAsQuote} />);
  await screen.findByRole('option', { name: 'Estándar · 95 W' });
  return view;
}
function calculate() { fireEvent.click(screen.getByRole('button', { name: 'Calcular con el servidor' })); }
async function finish(response: unknown, index = pending.length - 1) { await act(async () => pending[index].resolve(json(response))); }

describe('precio avanzado vigente', () => {
  it('oculta el precio y las acciones inmediatamente al editar una entrada económica', async () => {
    await ready(); calculate(); await finish(preview());
    fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '200' } });
    expect(screen.queryAllByText('Gs. 75.000')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Copiar precio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument();
    expect(clipboard).not.toHaveBeenCalled(); expect(share).not.toHaveBeenCalled();
  });

  it('ignora una respuesta pendiente después de editar y una respuesta fuera de orden', async () => {
    await ready(); calculate();
    fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '200' } });
    expect(screen.getByRole('button', { name: 'Calcular con el servidor' })).toBeEnabled();
    calculate(); await finish(preview(95000), 1); await finish(preview(75000), 0);
    expect(screen.queryAllByText('Gs. 75.000')).toHaveLength(0);
    expect(screen.getAllByText('Gs. 95.000').length).toBeGreaterThan(0);
    expect(pending[0].signal?.aborted).toBe(true);
  });

  it('borra el resultado anterior durante un cálculo y mantiene el error como alerta', async () => {
    await ready(); calculate(); await finish(preview()); calculate();
    expect(screen.queryByRole('button', { name: 'Copiar precio' })).not.toBeInTheDocument();
    await act(async () => pending[1].reject(new Error('El servidor rechazó el cálculo.')));
    expect(screen.getByRole('alert')).toHaveTextContent('El servidor rechazó el cálculo.');
    expect(screen.queryAllByText('Gs. 75.000')).toHaveLength(0);
  });

  it('desconectarse invalida el resultado y descarta una respuesta tardía incluso al reconectar', async () => {
    await ready(); calculate(); await finish(preview()); calculate();
    act(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
    await finish(preview(85000), 1);
    act(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('button', { name: 'Copiar precio' })).not.toBeInTheDocument();
    expect(screen.queryAllByText('Gs. 85.000')).toHaveLength(0);
  });

  it('aborta el cálculo al desmontar la pantalla', async () => {
    const view = await ready(); calculate(); view.unmount();
    expect(pending[0].signal?.aborted).toBe(true);
    await finish(preview());
  });
});

describe('entrada equivalente y presupuesto completo', () => {
  it('agrega platos de un mismo trabajo y guarda las mismas líneas que se calcularon', async () => {
    await ready(true);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar plato' }));
    const plate = screen.getByRole('group', { name: 'Plato 2' });
    expect(screen.queryByRole('button', { name: 'Agregar línea independiente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cotización' })).toBeDisabled();
    expect(within(plate).getByLabelText('Gramos')).toHaveValue(null);
    expect(within(plate).getByLabelText('Gramos')).toHaveFocus();
    expect(within(plate).getByLabelText('Horas de impresión')).toHaveValue(null);
    fireEvent.change(within(plate).getByLabelText('Filamento'), { target: { value: 's2' } });
    fireEvent.change(within(plate).getByLabelText('Gramos'), { target: { value: '70' } });
    fireEvent.change(within(plate).getByLabelText('Horas de impresión'), { target: { value: '2' } });
    calculate();
    expect(pending[0].path).toBe('/api/calculations/quote-aggregate-preview');
    expect(pending[0].body.lines).toMatchObject([
      { isPrintPlate: true, description: 'Plato 1', calculation: { materials: [{ spoolId: 's1', slicerTotalGrams: 100 }] } },
      { isPrintPlate: true, description: 'Plato 2', calculation: { printDurationHours: 2,
        materials: [{ spoolId: 's2', slicerTotalGrams: 70 }], labor: [], additionalCosts: [] } }
    ]);
    await finish(aggregatePreview());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cotización' }));
    expect(pending[1].path).toBe('/api/quotes');
    expect(pending[1].body.lines).toEqual(pending[0].body.lines);
    await finish({ id: 'quote-1', code: 'Q-1' });
  });

  it('mantiene los platos de una revisión cuando ajusta el presupuesto guardado', async () => {
    const order = { id: 'order-plates', code: 'PED-2', quoteId: 'quote-plates', status: 'Draft', version: 7, totalGs: 95000 };
    const calculation = (spoolId: string, grams: number, hours: number) => ({
      printerId: 'p1', energyProfileId: 'e1', electricityTariffId: 't1', pricingPolicyId: 'policy',
      printDurationHours: hours, occupiedPrinterHours: hours,
      materials: [{ spoolId, slicerTotalGrams: grams }], labor: [], additionalCosts: [],
    });
    const source = [
      { description: 'Plato 1', isPrintPlate: true, request: calculation('s1', 102, 3) },
      { description: 'Plato 2', isPrintPlate: true, request: calculation('s2', 53, 2) }
    ];
    const fetchCatalogs = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/api/orders/order-plates')) return Promise.resolve(json(order));
      if (path.endsWith('/api/quotes/quote-plates'))
        return Promise.resolve(json({ status: 'Draft', revisions: [{ revisionNumber: 4, lines: source }] }));
      return fetchCatalogs(input, init);
    }));
    render(<QuoteAdjustmentScreen id={order.id} />);
    const plate = await screen.findByRole('group', { name: 'Plato 2' });
    await within(plate).findByRole('option', { name: 'Estándar · 95 W' });
    expect(within(plate).getByLabelText('Gramos')).toHaveValue(53);
    fireEvent.change(within(plate).getByLabelText('Horas de impresión'), { target: { value: '2.5' } });
    calculate();
    await finish(aggregatePreview());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    expect(pending[1].path).toBe('/api/orders/order-plates/quote-revision');
    expect(pending[1].body).toMatchObject({ version: 7, revisionNumber: 4, lines: [
      { isPrintPlate: true, description: 'Plato 1', calculation: { printDurationHours: 3, materials: [{ spoolId: 's1' }] } },
      { isPrintPlate: true, description: 'Plato 2', calculation: { printDurationHours: 2.5, materials: [{ spoolId: 's2' }] } },
    ] });
    await finish({ ...order, totalGs: 115000, version: 8 });
    expect(await screen.findByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-plates');
  });

  it('ajusta el presupuesto existente con la misma revisión de origen y conserva la configuración de las otras líneas', async () => {
    const calculation: QuotePreviewRequest = {
      printerId: 'p1', energyProfileId: 'e1', electricityTariffId: 't1', pricingPolicyId: 'policy',
      quantity: { quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit' },
      printDurationHours: 3, idleDurationHours: 0, occupiedPrinterHours: 3,
      measuredKWh: null, additionalWarmupKWh: 0, additionalAccessoryKWh: 0,
      materials: [{ spoolId: 's1', slicerTotalGrams: 131.04 }], labor: [], additionalCosts: [],
      fixedSurchargesGs: 0, percentageSurchargePercent: 0, discountGs: 0,
      manualNetPriceGs: null, manualPriceReason: null, acceptZeroMachineRate: false,
      zeroMachineRateReason: null, tax: null, calculationContext: 'QuickQuote', acceptStandardEnergyFallback: true
    };
    const otherLine = { ...calculation, occupiedPrinterHours: 5, discountGs: 1000, materials: [
      { spoolId: 's2', baseGrams: 50, wastePercent: 10 }, { spoolId: 's3', slicerTotalGrams: 35 }
    ] };
    const order = { id: 'order-1', code: 'PED-1', version: 4, customerReference: 'Taller Norte',
      description: 'Guías', totalGs: 95000 };
    const originalDraft = localStorage.getItem(DRAFT_KEY);
    render(<CalculatorScreen saveAsQuote adjustment={{ order, quoteId: 'quote-1', revisionNumber: 2,
      lines: [{ description: 'Guías', calculation }, { description: 'Soporte', calculation: otherLine }] }} />);
    await screen.findByRole('heading', { name: 'Ajustar presupuesto' });
    await screen.findByRole('option', { name: 'Estándar · 95 W' });
    expect(screen.getByText('Taller Norte')).toBeVisible();
    expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(131.04);
    fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Gramos base'), { target: { value: '51' } });
    calculate();
    await finish(aggregatePreview());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajustes' }));
    expect(pending[1].path).toBe('/api/orders/order-1/quote-revision');
    expect(pending[1].body).toMatchObject({ version: 4, revisionNumber: 2, lines: [
      { calculation: { materials: [{ spoolId: 's1', slicerTotalGrams: 150 }] } },
      { calculation: { ...otherLine, materials: [{ ...otherLine.materials[0], baseGrams: 51 }, otherLine.materials[1]] } }
    ] });
    expect(pending[1].body.lines).toEqual(pending[0].body.lines);
    await finish({ ...order, quoteId: 'quote-1', status: 'Draft', version: 5 });
    expect(await screen.findByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-1');
    const savedHeading = screen.getByRole('heading', { name: 'Importe comercial guardado' });
    expect(savedHeading).toHaveFocus();
    const savedResult = savedHeading.closest('article')!;
    expect(savedResult).toHaveTextContent('Gs. 95.000');
    expect(savedResult).not.toHaveTextContent('Gs. 115.000');
    expect(screen.getByRole('link', { name: 'Crear otro presupuesto' })).toHaveAttribute('href', '/quotes/new');
    expect(localStorage.getItem(DRAFT_KEY)).toBe(originalDraft);
  });

  it('acepta las horas exactas importadas de 3h40 en la validación HTML y en el submit de todas las líneas', async () => {
    localStorage.setItem(QUICK_TO_ADVANCED_KEY, JSON.stringify({
      printerId: 'p1', energyProfileId: 'e1', electricityTariffId: 't1', pricingPolicyId: 'policy',
      quantity: { quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit' },
      printDurationHours: 3.6666666666666665, occupiedPrinterHours: 3.6666666666666665,
      materials: [{ spoolId: 's1', slicerTotalGrams: 131.04 }], calculationContext: 'QuickQuote'
    }));
    await ready(true);
    fireEvent.click(screen.getByLabelText('Usar un tiempo ocupado distinto'));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar línea independiente' }));
    const hours = ['Tiempo de impresión (h)', 'Horas ocupadas de máquina', 'Horas de impresión']
      .map(label => screen.getByLabelText(label) as HTMLInputElement);
    expect(hours.map(input => input.validity.stepMismatch)).toEqual([false, false, false]);
    expect(hours.map(input => input.valueAsNumber)).toEqual([3.6666666666666665, 3.6666666666666665, 3.6666666666666665]);
    calculate();
    expect(pending).toHaveLength(1);
    expect(pending[0].body.lines).toMatchObject([
      { calculation: { printDurationHours: 3.6666666666666665, occupiedPrinterHours: 3.6666666666666665 } },
      { calculation: { printDurationHours: 3.6666666666666665, occupiedPrinterHours: 3.6666666666666665 } }
    ]);
    await finish(aggregatePreview());
  });

  it('envía todos los supuestos importados incluidos impuestos y aceptación de máquina sin tarifa', async () => {
    localStorage.setItem(QUICK_TO_ADVANCED_KEY, JSON.stringify({
      printerId: 'p1', energyProfileId: 'e1', electricityTariffId: 't1', pricingPolicyId: 'policy',
      quantity: { quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit' }, printDurationHours: 3,
      occupiedPrinterHours: 3.5, idleDurationHours: 0.25, measuredKWh: null, additionalWarmupKWh: 0.1,
      additionalAccessoryKWh: 0.2, materials: [{ spoolId: 's2', slicerTotalGrams: 131.04 }],
      labor: [{ category: 'Preparar', minutes: 20, hourlyRateGs: 20000, scope: 'FixedPerOrder', repeatOnFailure: true }],
      additionalCosts: [{ description: 'Caja', amountGs: 2000, scope: 'FixedPerOrder', repeatOnFailure: false, isInternalCost: true, participatesInMargin: true }],
      tax: { enabled: true, name: 'IVA', ratePercent: 10, priceIncludesTax: true },
      acceptZeroMachineRate: true, zeroMachineRateReason: 'Aceptado', calculationContext: 'QuickQuote', acceptStandardEnergyFallback: true
    }));
    await ready(); calculate();
    expect(pending[0].body).toMatchObject({ quantity: { quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit' },
      occupiedPrinterHours: 3.5, idleDurationHours: 0.25, measuredKWh: null, additionalWarmupKWh: 0.1, additionalAccessoryKWh: 0.2,
      materials: [{ spoolId: 's2', slicerTotalGrams: 131.04 }], tax: { enabled: true, name: 'IVA', ratePercent: 10, priceIncludesTax: true },
      acceptZeroMachineRate: true, zeroMachineRateReason: 'Aceptado', calculationContext: 'QuickQuote', acceptStandardEnergyFallback: true,
      labor: [{ category: 'Preparar', minutes: 20, hourlyRateGs: 20000, scope: 'FixedPerOrder', repeatOnFailure: true }] });
  });

  it('previsualiza el agregado con las mismas líneas del guardado y copia su total autoritativo', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ printerId: 'p1', energyProfileId: 'e1', tariffId: 't1', policyId: 'policy', spoolId: 's1', grams: 100, printHours: 3,
      laborMinutes: 20, laborRateGs: 20000, additionalCostGs: 2000,
      quoteLines: [{ id: 'l2', description: 'Segunda pieza', spoolId: 's2', grams: 50, printHours: 2 }] }));
    await ready(true); calculate();
    expect(pending[0].path).toBe('/api/calculations/quote-aggregate-preview');
    const lines = pending[0].body.lines as Array<{ calculation: { labor: unknown[]; additionalCosts: unknown[]; printDurationHours: number } }>;
    expect(lines).toHaveLength(2);
    expect(lines[0].calculation.labor).toHaveLength(1); expect(lines[0].calculation.additionalCosts).toHaveLength(1);
    expect(lines[1].calculation).toMatchObject({ labor: [], additionalCosts: [], printDurationHours: 2 });
    await finish(aggregatePreview());
    expect(screen.getAllByText('Gs. 115.000').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar precio' }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith(expect.stringMatching(/Gs\.\s115\.000/)));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cotización' }));
    expect(pending[1].path).toBe('/api/quotes'); expect(pending[1].body.lines).toEqual(pending[0].body.lines);
    await finish({ id: 'quote-1', code: 'Q-1' });
  });

  it('guarda referencia y descripción después del resultado sin recalcular y abre el mismo pendiente', async () => {
    await ready(true); calculate(); await finish(aggregatePreview());
    const fields = screen.getByRole('region', { name: 'Datos para el presupuesto' });
    const result = screen.getByRole('heading', { name: 'Desglose' }).closest('article')!;
    expect(result.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(within(fields).getByLabelText('Cliente / referencia (opcional)'), { target: { value: '  Ana · WhatsApp  ' } });
    fireEvent.change(within(fields).getByLabelText('Qué se va a imprimir (opcional)'), { target: { value: ' Soporte 3D ' } });
    expect(screen.getByRole('button', { name: 'Copiar precio' })).toBeEnabled();
    expect(pending).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cotización' }));
    expect(pending[1].body).toMatchObject({ customerReference: 'Ana · WhatsApp', itemDescription: 'Soporte 3D', customerId: null, lines: pending[0].body.lines });
    await finish({ id: 'quote-1', code: 'Q-1' });
    expect(linkedOrderLookups).toEqual(['/api/orders/by-quote/quote-1']);
    expect(await screen.findByRole('link', { name: 'Abrir presupuesto' })).toHaveAttribute('href', '/quotes/pending/order-1');
  });

  it('conserva el documento guardado tras un fallo de lookup y sólo ofrece otro guardado tras una acción explícita', async () => {
    linkedOrderResponse = () => json({ detail: 'Sin acceso temporal' }, 503);
    await ready(true); calculate(); await finish(aggregatePreview());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cotización' }));
    await finish({ id: 'quote-1', code: 'Q-1' });
    expect(await screen.findByRole('link', { name: 'Abrir documento' })).toHaveAttribute('href', '/quotes/quote-1');
    expect(screen.getByText(/se guardó en Presupuestos/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cotización' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cliente / referencia (opcional)'), { target: { value: 'Otro nombre' } });
    expect(screen.queryByRole('button', { name: 'Guardar cotización' })).not.toBeInTheDocument();
    expect(pending.filter(call => call.path === '/api/quotes')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Preparar otro presupuesto' }));
    expect(screen.getByRole('button', { name: 'Guardar cotización' })).toBeEnabled();
    expect(pending.filter(call => call.path === '/api/quotes')).toHaveLength(1);
  });

  it('usa el preview agregado también para una línea y respeta su bloqueo de precio', async () => {
    await ready(true); calculate(); expect(pending[0].path).toBe('/api/calculations/quote-aggregate-preview');
    await finish(aggregatePreview(false));
    expect(screen.getAllByText('Gs. 115.000').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Copiar precio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument();
  });

  it('editar durante el guardado invalida el precio sin habilitar un guardado duplicado', async () => {
    await ready(true); calculate(); await finish(aggregatePreview());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cotización' }));
    fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '250' } });
    expect(screen.queryByRole('button', { name: 'Copiar precio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    await finish({ id: 'quote-1', code: 'Q-2' });
    expect(await screen.findByRole('link', { name: 'Abrir presupuesto' })).toBeInTheDocument();
  });

  it('distingue marca, variante y costo en los tres selectores sin cambiar IDs', async () => {
    await ready(true); fireEvent.click(screen.getByRole('button', { name: 'Agregar línea independiente' }));
    const selectors = screen.getAllByLabelText(/^Filamento$/).concat(screen.getByLabelText('Segundo filamento (opcional)'));
    expect(selectors).toHaveLength(3);
    for (const select of selectors) {
      const option = within(select).getByRole('option', { name: /Sunlu.*PLA.*Blanco.*Seda.*140/ });
      expect(option).toHaveValue('s2');
      expect(within(select).getByRole('option', { name: /Sunlu.*PLA.*Blanco.*Plus.*160/ })).toHaveValue('s3');
    }
  });
});
