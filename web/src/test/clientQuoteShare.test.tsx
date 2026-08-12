import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toPng } from 'html-to-image';
import { ClientQuoteCard, type ClientQuoteCardData } from '../components/ClientQuoteCard';
import { ClientQuoteShareDialog } from '../components/ClientQuoteShareDialog';
import { QuickQuoteScreen } from '../screens/QuickQuoteScreen';
import { prepareModelImage } from '../utils/modelImage';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
vi.mock('../utils/modelImage', () => ({ prepareModelImage: vi.fn() }));

const quote = { totalGs: 75_000, material: 'PLA', color: 'Negro mate', totalGrams: 142, printDurationMinutes: 324 };
const settings = {
  id: 'settings-1', visibleAppName: 'Calculadora 3D', timeZone: 'America/Asuncion', productionHostname: null,
  taxEnabled: false, taxName: null, taxRatePercent: 0, priceIncludesTax: false,
  defaultPrinterId: 'printer-1', defaultEnergyProfileId: 'energy-1', defaultElectricityTariffId: 'tariff-1',
  defaultPricingPolicyId: 'policy-1', defaultQuickSetupMinutes: 20, defaultQuickPackagingCostGs: 2_000,
  brandLogo: null, brandDisplayName: null, brandContactLine: 'WhatsApp 0981 000 000',
  clientQuoteNote: 'Hecho especialmente para vos.', clientQuoteValidityDays: 7
};
const cardData: ClientQuoteCardData = {
  businessName: 'CRAF 3D', logo: null, contactLine: 'WhatsApp 0981 000 000',
  note: 'Hecho especialmente para vos.', totalGs: 75_000, material: 'PLA', color: 'Negro mate',
  totalGrams: 142, printDurationMinutes: 324, reference: 'C3D-260810-TEST', issuedOn: '10/08/2026',
  validUntil: '17/08/2026', modelImage: null
};

function settingsResponse(custom = settings) {
  return new Response(JSON.stringify({ settings: custom, readiness: {} }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

function markImagesLoaded(root: HTMLElement = document.body) {
  root.querySelectorAll('img').forEach(image => {
    Object.defineProperties(image, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 1080 },
      naturalHeight: { configurable: true, value: 1080 },
      decode: { configurable: true, value: vi.fn(async () => undefined) }
    });
  });
}

function dispatchPaste(file?: File, target: Element | Window | Document = window) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: file ? [{ kind: 'file', type: file.type, getAsFile: () => file }] : [],
      files: file ? [file] : []
    }
  });
  const preventDefault = vi.spyOn(event, 'preventDefault');
  fireEvent(target, event);
  return preventDefault;
}

async function renderShareDialog(onClose = vi.fn()) {
  vi.stubGlobal('fetch', vi.fn(async () => settingsResponse()));
  const rendered = render(<ClientQuoteShareDialog open quote={quote} onClose={onClose} />);
  await screen.findByRole('dialog', { name: 'Compartir con cliente' });
  return rendered;
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
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:quote') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.mocked(toPng).mockReset().mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
    vi.mocked(prepareModelImage).mockReset().mockImplementation(async file => `data:image/png;base64,${file.name || 'clipboard'}`);
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
    expect(within(card).getByText('CRAF 3D')).toBeInTheDocument();
    expect(within(card).queryByText('Calculadora 3D')).not.toBeInTheDocument();
    expect(within(card).getByLabelText('Logo comercial').querySelector('img')).toHaveAttribute('src', '/branding/logo-master.jpg');
    expect(within(card).getByTestId('client-quote-contact')).toHaveTextContent('WhatsApp 0981 000 000');
  });

  it('renderiza una tarjeta profesional sin imagen y no expone métricas internas', () => {
    render(<ClientQuoteCard data={{ ...cardData, contactLine: '' }} />);
    const card = screen.getByTestId('client-quote-card');
    expect(within(card).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Presupuesto personalizado');
    expect(card).toHaveClass('client-quote-card--without-model');
    expect(within(card).queryByTestId('client-quote-contact')).not.toBeInTheDocument();
    expect(card.textContent).not.toMatch(/costo completo|ganancia|margen|overhead|reserva por posibles fallas/i);
  });

  it('incorpora y permite quitar una imagen local del slicer', async () => {
    const user = userEvent.setup();
    await renderShareDialog();
    const input = screen.getByLabelText('Elegir imagen de Fotos o archivos');
    await user.upload(input, new File(['slicer'], 'slicer.png', { type: 'image/png' }));

    expect(await within(screen.getByTestId('client-quote-card')).findByRole('img', { name: 'Vista del modelo a imprimir' })).toBeInTheDocument();
    expect(input).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Quitar imagen' }));
    expect(within(screen.getByTestId('client-quote-card')).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
  });

  it('separa el selector de Fotos/Archivos de la cámara', async () => {
    const user = userEvent.setup();
    await renderShareDialog();
    const gallery = screen.getByLabelText('Elegir imagen de Fotos o archivos');
    const camera = screen.getByLabelText('Tomar foto del modelo');
    expect(gallery).toHaveAttribute('accept', 'image/*');
    expect(gallery).not.toHaveAttribute('capture');
    expect(camera).toHaveAttribute('accept', 'image/*');
    expect(camera).toHaveAttribute('capture', 'environment');
    expect(screen.getByText('Pegá una captura aquí').closest('.client-paste-zone')).toHaveAttribute('data-autofocus');
    await user.upload(camera, new File(['camera'], 'foto.jpg', { type: 'image/jpeg' }));
    expect(camera).toHaveValue('');
    expect(prepareModelImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'foto.jpg' }));
  });

  it('muestra el límite de 8 MB sin incorporar una imagen', async () => {
    vi.mocked(prepareModelImage).mockRejectedValueOnce(new Error('La imagen del modelo no puede superar 8 MB.'));
    const user = userEvent.setup();
    await renderShareDialog();
    await user.upload(screen.getByLabelText('Elegir imagen de Fotos o archivos'), new File(['large'], 'grande.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La imagen del modelo no puede superar 8 MB.');
    expect(within(screen.getByTestId('client-quote-card')).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
  });

  it('rechaza un formato no procesable sin dejar preview ni export vacíos', async () => {
    vi.mocked(prepareModelImage).mockRejectedValueOnce(new Error('No pudimos procesar esa imagen. Probá con una captura PNG o JPG.'));
    await renderShareDialog();
    dispatchPaste(new File(['broken'], 'captura.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos procesar esa imagen. Probá con una captura PNG o JPG.');
    expect(within(screen.getByTestId('client-quote-card')).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
    expect(screen.getByTestId('client-quote-export-card').querySelector('img[alt="Vista del modelo a imprimir"]')).not.toBeInTheDocument();
  });

  it('procesa Ctrl+V, actualiza preview y export stage y anuncia el éxito', async () => {
    await renderShareDialog();
    const file = new File(['clipboard'], 'captura.png', { type: 'image/png' });
    const preventDefault = dispatchPaste(file);

    expect(await screen.findByText('Imagen pegada desde el portapapeles.')).toHaveAttribute('role', 'status');
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(prepareModelImage).toHaveBeenCalledWith(file);
    expect(within(screen.getByTestId('client-quote-card')).getByRole('img', { name: 'Vista del modelo a imprimir' })).toHaveAttribute('src', 'data:image/png;base64,captura.png');
    expect(screen.getByTestId('client-quote-export-card').querySelector('img[alt="Vista del modelo a imprimir"]')).toHaveAttribute('src', 'data:image/png;base64,captura.png');
  });

  it('no intercepta texto pegado ni un paste sin imagen', async () => {
    await renderShareDialog();
    const editable = document.createElement('input');
    document.body.append(editable);
    const editablePaste = dispatchPaste(new File(['image'], 'captura.png', { type: 'image/png' }), editable);
    const textPaste = dispatchPaste();

    expect(editablePaste).not.toHaveBeenCalled();
    expect(textPaste).not.toHaveBeenCalled();
    expect(prepareModelImage).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('client-quote-card')).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
    editable.remove();
  });

  it('lee la primera imagen disponible mediante Clipboard API', async () => {
    const read = vi.fn(async () => [{
      types: ['text/plain', 'image/png'],
      getType: vi.fn(async (type: string) => new Blob([type], { type }))
    }]);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read } });
    await renderShareDialog();
    await user.click(screen.getByRole('button', { name: 'Pegar del portapapeles' }));

    expect(await screen.findByText('Imagen pegada desde el portapapeles.')).toBeInTheDocument();
    expect(read).toHaveBeenCalledOnce();
    const [file] = vi.mocked(prepareModelImage).mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(file).toMatchObject({ name: 'captura-portapapeles.png', type: 'image/png' });
  });

  it('bloquea las acciones mientras espera la lectura del portapapeles', async () => {
    let resolveRead!: (items: ClipboardItems) => void;
    const read = vi.fn(() => new Promise<ClipboardItems>(resolve => { resolveRead = resolve; }));
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read } });
    await renderShareDialog();
    await user.click(screen.getByRole('button', { name: 'Pegar del portapapeles' }));

    expect(screen.getByRole('status')).toHaveTextContent('Leyendo portapapeles…');
    expect(screen.getByRole('button', { name: 'Compartir imagen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar PNG' })).toBeDisabled();
    resolveRead([]);
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos una imagen en el portapapeles.');
    expect(screen.getByRole('button', { name: 'Compartir imagen' })).toBeEnabled();
  });

  it('explica el paste manual cuando Clipboard API no contiene una imagen o no está disponible', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: vi.fn(async () => [{ types: ['text/plain'], getType: vi.fn() }]) } });
    await renderShareDialog();
    await user.click(screen.getByRole('button', { name: 'Pegar del portapapeles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos una imagen en el portapapeles.');

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await user.click(screen.getByRole('button', { name: 'Pegar del portapapeles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Presioná Ctrl+V dentro de esta ventana');
  });

  it('indica usar Ctrl+V cuando el navegador rechaza el permiso', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: vi.fn(async () => { throw denied; }) } });
    await renderShareDialog();
    await user.click(screen.getByRole('button', { name: 'Pegar del portapapeles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El navegador no permitió leer el portapapeles. Presioná Ctrl+V');
  });

  it('reemplaza la imagen anterior cuando se pega una segunda captura', async () => {
    await renderShareDialog();
    dispatchPaste(new File(['first'], 'primera.png', { type: 'image/png' }));
    await waitFor(() => expect(within(screen.getByTestId('client-quote-card')).getByRole('img', { name: 'Vista del modelo a imprimir' })).toHaveAttribute('src', 'data:image/png;base64,primera.png'));
    dispatchPaste(new File(['second'], 'segunda.png', { type: 'image/png' }));
    await waitFor(() => expect(within(screen.getByTestId('client-quote-card')).getByRole('img', { name: 'Vista del modelo a imprimir' })).toHaveAttribute('src', 'data:image/png;base64,segunda.png'));
  });

  it('conserva solo el último resultado si dos imágenes se procesan fuera de orden', async () => {
    let resolveFirst!: (image: string) => void;
    vi.mocked(prepareModelImage)
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce('data:image/png;base64,segunda');
    await renderShareDialog();
    dispatchPaste(new File(['first'], 'primera.png', { type: 'image/png' }));
    expect(screen.getByRole('button', { name: 'Compartir imagen' })).toBeDisabled();
    dispatchPaste(new File(['second'], 'segunda.png', { type: 'image/png' }));
    await waitFor(() => expect(within(screen.getByTestId('client-quote-card')).getByRole('img', { name: 'Vista del modelo a imprimir' })).toHaveAttribute('src', 'data:image/png;base64,segunda'));

    resolveFirst('data:image/png;base64,primera-tardia');
    await waitFor(() => expect(within(screen.getByTestId('client-quote-card')).getByRole('img', { name: 'Vista del modelo a imprimir' })).toHaveAttribute('src', 'data:image/png;base64,segunda'));
    expect(screen.getByRole('button', { name: 'Compartir imagen' })).toBeEnabled();
  });

  it('elimina el listener y el estado temporal al cerrar', async () => {
    const rendered = await renderShareDialog();
    dispatchPaste(new File(['first'], 'primera.png', { type: 'image/png' }));
    await screen.findByText('Imagen pegada desde el portapapeles.');
    rendered.rerender(<ClientQuoteShareDialog open={false} quote={quote} onClose={vi.fn()} />);
    const callsBeforeClosedPaste = vi.mocked(prepareModelImage).mock.calls.length;
    dispatchPaste(new File(['second'], 'segunda.png', { type: 'image/png' }));
    expect(prepareModelImage).toHaveBeenCalledTimes(callsBeforeClosedPaste);

    rendered.rerender(<ClientQuoteShareDialog open quote={quote} onClose={vi.fn()} />);
    const reopenedCard = await screen.findByTestId('client-quote-card');
    expect(within(reopenedCard).queryByRole('img', { name: 'Vista del modelo a imprimir' })).not.toBeInTheDocument();
    expect(screen.queryByText('Imagen pegada desde el portapapeles.')).not.toBeInTheDocument();
  });

  it('usa una marca gráfica completa cuando el logo real no está disponible', () => {
    render(<ClientQuoteCard data={cardData} />);
    const fallback = screen.getByLabelText('Marca gráfica alternativa');
    expect(fallback.querySelector('svg')).toBeInTheDocument();
    expect(within(fallback).queryByRole('img')).not.toBeInTheDocument();
  });

  it('prioriza el logo comercial configurado', () => {
    const configuredLogo = 'data:image/png;base64,aW1hZ2Vu';
    render(<ClientQuoteCard data={{ ...cardData, logo: configuredLogo }} />);
    expect(screen.getByLabelText('Logo comercial').querySelector('img')).toHaveAttribute('src', configuredLogo);
    expect(screen.queryByLabelText('Marca gráfica alternativa')).not.toBeInTheDocument();
  });

  it('recupera una marca gráfica elegante si el logo configurado no carga', () => {
    render(<ClientQuoteCard data={{ ...cardData, logo: '/logo-inexistente.png' }} />);
    fireEvent.error(screen.getByLabelText('Logo comercial').querySelector('img')!);
    expect(screen.getByLabelText('Marca gráfica alternativa').querySelector('svg')).toBeInTheDocument();
  });

  it('exporta el nodo fijo cuadrado de 1080 por 1080 mediante html-to-image', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settingsResponse()));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ClientQuoteShareDialog open quote={quote} onClose={vi.fn()} />);
    const download = await screen.findByRole('button', { name: 'Descargar PNG' });
    await waitFor(() => expect(download).toBeEnabled());
    markImagesLoaded(screen.getByTestId('client-quote-export-card'));
    fireEvent.click(download);

    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    expect(toPng).toHaveBeenCalledWith(screen.getByTestId('client-quote-export-card'), expect.objectContaining({ width: 1080, height: 1080, pixelRatio: 1 }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  });

  it('usa el mismo contenido principal en preview y exportación', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => settingsResponse()));
    render(<ClientQuoteShareDialog open quote={quote} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Descargar PNG' })).toBeEnabled());

    for (const card of [screen.getByTestId('client-quote-card'), screen.getByTestId('client-quote-export-card')]) {
      expect(card).toHaveTextContent('CRAF 3D');
      expect(card).toHaveTextContent('Gs. 75.000');
      expect(card).toHaveTextContent('PLA · Negro mate');
      expect(card).toHaveTextContent(/Ref\. C3D-\d+/);
      expect(card).toHaveTextContent('Hecho especialmente para vos.');
      expect(within(card).getByTestId('client-quote-contact')).toHaveTextContent('WhatsApp 0981 000 000');
      expect(card).not.toHaveTextContent('Calculadora 3D');
    }
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
    markImagesLoaded(screen.getByTestId('client-quote-export-card'));
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
    markImagesLoaded(screen.getByTestId('client-quote-export-card'));
    fireEvent.click(shareButton);

    expect(await screen.findByText(/no permite compartir archivos.*Descargamos el PNG/i)).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
  });
});
