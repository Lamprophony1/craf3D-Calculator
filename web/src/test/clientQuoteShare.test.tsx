import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toPng } from 'html-to-image';
import { ClientQuoteCard, type ClientQuoteCardData } from '../components/ClientQuoteCard';
import { ClientQuoteShareDialog } from '../components/ClientQuoteShareDialog';
import { QuickQuoteScreen } from '../screens/QuickQuoteScreen';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));

const quote = { totalGs: 75_000, material: 'PLA', color: 'Negro mate', totalGrams: 142, printDurationMinutes: 324 };
const settings = {
  id: 'settings-1', visibleAppName: 'Calculadora 3D', timeZone: 'America/Asuncion', productionHostname: null,
  taxEnabled: false, taxName: null, taxRatePercent: 0, priceIncludesTax: false,
  defaultPrinterId: 'printer-1', defaultEnergyProfileId: 'energy-1', defaultElectricityTariffId: 'tariff-1',
  defaultPricingPolicyId: 'policy-1', defaultQuickSetupMinutes: 20, defaultQuickPackagingCostGs: 2_000,
  brandLogo: null, brandDisplayName: 'Taller Craf3D', brandContactLine: 'WhatsApp 0981 000 000',
  clientQuoteNote: 'Hecho especialmente para vos.', clientQuoteValidityDays: 7
};
const cardData: ClientQuoteCardData = {
  businessName: 'Taller Craf3D', logo: null, contactLine: 'WhatsApp 0981 000 000',
  note: 'Hecho especialmente para vos.', totalGs: 75_000, material: 'PLA', color: 'Negro mate',
  totalGrams: 142, printDurationMinutes: 324, reference: 'C3D-260810-TEST', issuedOn: '10/08/2026',
  validUntil: '17/08/2026', modelImage: null
};

function settingsResponse(custom = settings) {
  return new Response(JSON.stringify({ settings: custom, readiness: {} }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

const filament = {
  id: 'spool-1', manufacturer: 'Test', productName: 'PLA mate', material: 'PLA', color: 'Negro mate', batchCode: null,
  purchaseCurrency: 'PYG', purchaseAmount: 131_250, exchangeRateGs: null, allocatedShippingGs: 0,
  allocatedImportFeesGs: 0, allocatedOtherCostsGs: 0, landedCostGs: 131_250, netWeightGrams: 1_000,
  remainingWeightGrams: 1_000, purchasedAt: null, supplier: null, isInventoryTracked: false, isActive: true
};
const breakdown = {
  quantity: 1, numberOfPlates: 1, materialCostGs: 18_637.5, materials: [],
  energy: { totalKWh: .513, costGs: 223.42, effectiveRateGsPerKWh: 435.51, usedMeasuredKWh: false },
  machine: { hourlyRateGs: 2_000, totalOccupiedHours: 5.4, costGs: 10_800, isConfigured: true },
  laborCostGs: 6_666.67, additionalCostGs: 2_000, marginBearingAdditionalCostGs: 2_000,
  nonMarginInternalCostGs: 0, nonMarginRecoveryChargeGs: 0, customerAdditionalChargeGs: 0,
  customerPassThroughGs: 0, directCostGs: 38_327.59, failureReserveGs: 4_258.62, totalOverheadGs: 2_129.31,
  fullyLoadedCostGs: 44_715.52, requiredNetPriceGs: 74_525.87, minimumMarginPriceGs: 63_879.31,
  suggestedNetPriceGs: 75_000, finalNetSalePriceGs: 75_000, variableSellingFeeGs: 0,
  netRevenueAfterSellingFeesGs: 75_000, revenueAvailableBeforeCostsGs: 75_000, estimatedProfitGs: 30_284.48,
  achievedMarginPercent: 40.38, markupPercent: 67.73, taxGs: 0, customerTotalGs: 75_000,
  unitCostGs: 44_715.52, unitPriceGs: 75_000, warnings: []
};

async function renderUsableQuickQuote(canUsePrice = true) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.endsWith('/api/filaments')) return new Response(JSON.stringify([filament]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (path.endsWith('/api/settings')) return settingsResponse();
    return new Response(JSON.stringify({
      breakdown, resolvedAssumptions: null, canUsePrice,
      warnings: canUsePrice ? [] : [{ code: 'MISSING_COST', message: 'Falta un costo.', blocksPrice: true }],
      advancedRequest: { printerId: 'printer-1' }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  const user = userEvent.setup();
  render(<QuickQuoteScreen />);
  await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveValue('spool-1'));
  await user.type(screen.getByLabelText('Horas de impresión'), '5');
  await user.type(screen.getByLabelText('Minutos de impresión'), '24');
  await user.type(screen.getByLabelText('Gramos totales del slicer'), '142');
  await screen.findByText(canUsePrice ? 'Podés cobrar' : 'Precio pendiente de revisión', {}, { timeout: 1_500 });
  return user;
}

describe('cotización visual para cliente', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:quote') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.mocked(toPng).mockReset().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('muestra el CTA únicamente cuando el precio es utilizable', async () => {
    await renderUsableQuickQuote(false);
    expect(screen.queryByRole('button', { name: 'Compartir con cliente' })).not.toBeInTheDocument();
  });

  it('abre el modal y refleja exactamente la cotización rápida vigente', async () => {
    const user = await renderUsableQuickQuote();
    await user.click(screen.getByRole('button', { name: 'Compartir con cliente' }));

    expect(await screen.findByRole('dialog', { name: 'Compartir con cliente' })).toBeInTheDocument();
    const card = screen.getByTestId('client-quote-card');
    expect(within(card).getByText('Gs. 75.000')).toBeInTheDocument();
    expect(within(card).getByText('PLA · Negro mate')).toBeInTheDocument();
    expect(within(card).getByText('142 g')).toBeInTheDocument();
    expect(within(card).getByText('5 h 24 min')).toBeInTheDocument();
  });

  it('renderiza una tarjeta profesional sin imagen y no expone métricas internas', () => {
    render(<ClientQuoteCard data={{ ...cardData, contactLine: '' }} />);
    const card = screen.getByTestId('client-quote-card');
    expect(within(card).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Cotización de impresión 3D');
    expect(within(card).queryByTestId('client-quote-contact')).not.toBeInTheDocument();
    expect(card.textContent).not.toMatch(/costo completo|ganancia|margen|overhead|reserva por posibles fallas/i);
  });

  it('incorpora y permite quitar una imagen local del slicer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settingsResponse()));
    const user = userEvent.setup();
    render(<ClientQuoteShareDialog open quote={quote} onClose={vi.fn()} />);
    const input = await screen.findByLabelText('Imagen del modelo');
    await user.upload(input, new File(['slicer'], 'slicer.png', { type: 'image/png' }));

    expect(await within(screen.getByTestId('client-quote-card')).findByRole('img', { name: 'Vista del modelo a imprimir' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar imagen' }));
    expect(within(screen.getByTestId('client-quote-card')).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
  });

  it('usa iniciales elegantes cuando no existe un logo configurado', () => {
    render(<ClientQuoteCard data={cardData} />);
    const fallback = screen.getByLabelText('Logo comercial alternativo');
    expect(fallback).toHaveTextContent('TC');
    expect(within(fallback).queryByRole('img')).not.toBeInTheDocument();
  });

  it('exporta el nodo fijo de 1080 por 1350 mediante html-to-image', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settingsResponse()));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ClientQuoteShareDialog open quote={quote} onClose={vi.fn()} />);
    const download = await screen.findByRole('button', { name: 'Descargar PNG' });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);

    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    expect(toPng).toHaveBeenCalledWith(screen.getByTestId('client-quote-export-card'), expect.objectContaining({ width: 1080, height: 1350, pixelRatio: 1 }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  });

  it('comparte un File PNG con Web Share API cuando el dispositivo lo admite', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settingsResponse()));
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => undefined);
    const canShare = vi.fn(() => true);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    render(<ClientQuoteShareDialog open quote={quote} onClose={vi.fn()} />);
    const shareButton = await screen.findByRole('button', { name: 'Compartir imagen' });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0][0] as ShareData;
    expect(payload.files).toHaveLength(1);
    expect(payload.files?.[0]).toBeInstanceOf(File);
    expect(payload.files?.[0].type).toBe('image/png');
    expect(payload.files?.[0].name).toMatch(/^cotizacion-c3d-.+\.png$/);
  });

  it('descarga automáticamente el PNG cuando Web Share no admite archivos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settingsResponse()));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ClientQuoteShareDialog open quote={quote} onClose={vi.fn()} />);
    const shareButton = await screen.findByRole('button', { name: 'Compartir imagen' });
    await waitFor(() => expect(shareButton).toBeEnabled());
    fireEvent.click(shareButton);

    expect(await screen.findByText(/no permite compartir archivos.*Descargamos el PNG/i)).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
  });
});
