import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ClipboardPaste, Download, Images, LoaderCircle, Share2, Trash2 } from 'lucide-react';
import { get } from '../api/client';
import type { ApplicationSettings, SettingsResponse } from '../api/types';
import { useClientQuoteImageExport } from '../hooks/useClientQuoteImageExport';
import { DEFAULT_CLIENT_BRAND_LOGO } from '../utils/brand';
import { prepareModelImage } from '../utils/modelImage';
import { ClientQuoteCard, type ClientQuoteCardData } from './ClientQuoteCard';
import { ModalDialog } from './ModalDialog';

export interface ShareableQuickQuote {
  totalGs: number;
  material: string;
  color: string;
  totalGrams: number;
  printDurationMinutes: number;
}

const DEFAULT_NOTE = 'Incluye material, tiempo de impresión y preparación.';
type ModelImageSource = 'file' | 'camera' | 'paste';
type ImageFeedback = { type: 'success' | 'error' | 'status'; message: string };

function localDate(value: Date) {
  return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

function quoteReference(date: Date) {
  const parts = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    .map((part, index) => index ? String(part).padStart(2, '0') : String(part).slice(-2));
  return `C3D-${parts.slice(0, 3).join('')}-${parts.slice(3).join('')}`;
}

export function ClientQuoteShareDialog({ open, quote, onClose }: {
  open: boolean;
  quote: ShareableQuickQuote | null;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [brandingReady, setBrandingReady] = useState(false);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [imageFeedback, setImageFeedback] = useState<ImageFeedback | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [issuedAt, setIssuedAt] = useState(() => new Date());
  const exportCardRef = useRef<HTMLElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageRequestRef = useRef(0);

  const applyModelImageFile = useCallback(async (file: File, source: ModelImageSource) => {
    const request = ++imageRequestRef.current;
    setImageProcessing(true);
    setImageFeedback({ type: 'status', message: 'Preparando imagen…' });
    try {
      const preparedImage = await prepareModelImage(file);
      if (request !== imageRequestRef.current) return;
      setModelImage(preparedImage);
      setImageFeedback({
        type: 'success',
        message: source === 'paste'
          ? 'Imagen pegada desde el portapapeles.'
          : source === 'camera' ? 'Foto lista para usar.' : 'Imagen lista para usar.'
      });
    } catch (reason) {
      if (request !== imageRequestRef.current) return;
      setImageFeedback({
        type: 'error',
        message: reason instanceof Error
          ? reason.message
          : 'No pudimos procesar esa imagen. Probá con una captura PNG o JPG.'
      });
    } finally {
      if (request === imageRequestRef.current) setImageProcessing(false);
    }
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    const clipboardRequest = ++imageRequestRef.current;
    setImageFeedback(null);
    if (!navigator.clipboard?.read) {
      setImageProcessing(false);
      if (clipboardRequest === imageRequestRef.current)
        setImageFeedback({ type: 'error', message: 'Presioná Ctrl+V dentro de esta ventana para pegar la captura.' });
      return;
    }
    setImageProcessing(true);
    setImageFeedback({ type: 'status', message: 'Leyendo portapapeles…' });
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        if (clipboardRequest !== imageRequestRef.current) return;
        const subtype = imageType.split('/')[1]?.toLocaleLowerCase('en') ?? 'png';
        const extension = subtype === 'jpeg' ? 'jpg' : ['png', 'jpg', 'webp', 'heic', 'heif'].includes(subtype) ? subtype : 'png';
        await applyModelImageFile(new File([blob], `captura-portapapeles.${extension}`, { type: imageType }), 'paste');
        return;
      }
      if (clipboardRequest === imageRequestRef.current) {
        setImageProcessing(false);
        setImageFeedback({ type: 'error', message: 'No encontramos una imagen en el portapapeles.' });
      }
    } catch (reason) {
      if (clipboardRequest !== imageRequestRef.current) return;
      const name = (reason as { name?: string })?.name ?? '';
      setImageProcessing(false);
      setImageFeedback({
        type: 'error',
        message: name === 'NotAllowedError' || name === 'SecurityError'
          ? 'El navegador no permitió leer el portapapeles. Presioná Ctrl+V dentro de esta ventana.'
          : 'No pudimos leer el portapapeles. Presioná Ctrl+V para pegar la captura.'
      });
    }
  }, [applyModelImageFile]);

  useEffect(() => {
    if (!open) return;
    setIssuedAt(new Date());
    setBrandingReady(false);
    let cancelled = false;
    get<SettingsResponse>('/api/settings')
      .then(response => { if (!cancelled) setSettings(response?.settings ?? null); })
      .catch(() => { if (!cancelled) setSettings(null); })
      .finally(() => { if (!cancelled) setBrandingReady(true); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    imageRequestRef.current += 1;
    setModelImage(null);
    setImageFeedback(null);
    setImageProcessing(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editingText = (target instanceof HTMLInputElement && target.type !== 'file')
        || target instanceof HTMLTextAreaElement
        || Boolean(target?.isContentEditable);
      if (editingText) return;

      const imageItem = Array.from(event.clipboardData?.items ?? [])
        .find(item => item.kind === 'file' && item.type.startsWith('image/'));
      const file = imageItem?.getAsFile()
        ?? Array.from(event.clipboardData?.files ?? []).find(candidate => candidate.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      void applyModelImageFile(file, 'paste');
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, applyModelImageFile]);

  const cardData = useMemo<ClientQuoteCardData | null>(() => {
    if (!quote) return null;
    const validityDays = settings?.clientQuoteValidityDays && settings.clientQuoteValidityDays > 0
      ? settings.clientQuoteValidityDays : 7;
    const validUntil = new Date(issuedAt);
    validUntil.setDate(validUntil.getDate() + validityDays);
    return {
      businessName: settings?.brandDisplayName?.trim() || 'CRAF 3D',
      logo: settings?.brandLogo || DEFAULT_CLIENT_BRAND_LOGO,
      contactLine: settings?.brandContactLine?.trim() || '',
      note: settings?.clientQuoteNote?.trim() || DEFAULT_NOTE,
      totalGs: quote.totalGs,
      material: quote.material,
      color: quote.color,
      totalGrams: quote.totalGrams,
      printDurationMinutes: quote.printDurationMinutes,
      reference: quoteReference(issuedAt),
      issuedOn: localDate(issuedAt),
      validUntil: localDate(validUntil),
      modelImage
    };
  }, [issuedAt, modelImage, quote, settings]);
  const filename = cardData ? `cotizacion-${cardData.reference.toLocaleLowerCase('es')}.png` : 'cotizacion-3d.png';
  const exportImage = useClientQuoteImageExport(exportCardRef, filename, open && Boolean(cardData));
  const exportBusy = ['exporting', 'sharing', 'downloading'].includes(exportImage.status);
  const actionBusy = exportBusy || imageProcessing;

  const clearModelImage = () => {
    imageRequestRef.current += 1;
    setModelImage(null);
    setImageFeedback(null);
    setImageProcessing(false);
  };

  return <ModalDialog
    open={open}
    className="client-quote-dialog"
    title="Compartir con cliente"
    description="Tu presupuesto cuadrado, listo para enviar por WhatsApp."
    onClose={onClose}
    footer={<>
      <button type="button" onClick={() => void exportImage.share()} disabled={actionBusy || !cardData || !brandingReady}>
        <Share2 size={18} aria-hidden="true" />{exportImage.status === 'exporting' ? 'Generando PNG…' : exportImage.status === 'sharing' ? 'Abriendo opciones…' : 'Compartir imagen'}
      </button>
      <button type="button" className="secondary" onClick={() => void exportImage.download()} disabled={actionBusy || !cardData || !brandingReady}>
        <Download size={18} aria-hidden="true" />{exportImage.status === 'downloading' ? 'Descargando…' : 'Descargar PNG'}
      </button>
      <button type="button" className="secondary" onClick={onClose} disabled={exportBusy}>Cerrar</button>
    </>}
  >
    {cardData ? <div className="client-quote-share-layout">
      <div className="client-quote-preview"><ClientQuoteCard data={cardData} /></div>
      <aside className="client-quote-controls" aria-label="Opciones de la imagen" aria-busy={imageProcessing}>
        <h3>Imagen del modelo</h3>
        <p>Opcional. Pegá una captura, elegí una imagen o tomá una foto. Solo se usa en esta vista y no se guarda.</p>
        {!brandingReady ? <p role="status">Cargando identidad comercial…</p> : null}
        <div className="client-paste-zone" tabIndex={0} data-autofocus>
          <ClipboardPaste size={22} aria-hidden="true" />
          <span><strong>Pegá una captura aquí</strong><small>Ctrl+V en Windows</small></span>
        </div>
        <div className="client-image-actions">
          <button type="button" className="secondary client-gallery-action" disabled={actionBusy} onClick={() => galleryInputRef.current?.click()}>
            <Images size={18} aria-hidden="true" />Elegir de Fotos o archivos
          </button>
          <input
            ref={galleryInputRef}
            hidden
            disabled={actionBusy}
            type="file"
            accept="image/*"
            aria-label="Elegir imagen de Fotos o archivos"
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              if (file) void applyModelImageFile(file, 'file');
              event.currentTarget.value = '';
            }}
          />
          <button type="button" className="secondary client-camera-action" disabled={actionBusy} onClick={() => cameraInputRef.current?.click()}>
            <Camera size={18} aria-hidden="true" />Tomar foto
          </button>
          <input
            ref={cameraInputRef}
            hidden
            disabled={actionBusy}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Tomar foto del modelo"
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              if (file) void applyModelImageFile(file, 'camera');
              event.currentTarget.value = '';
            }}
          />
          <button type="button" className="secondary client-clipboard-action" disabled={actionBusy} onClick={() => void pasteFromClipboard()}>
            <ClipboardPaste size={18} aria-hidden="true" />Pegar del portapapeles
          </button>
        </div>
        <p className="client-quote-desktop-help">También podés copiar una captura y presionar Ctrl+V.</p>
        {modelImage ? <button type="button" className="secondary remove-client-image" disabled={actionBusy} onClick={clearModelImage}>
          <Trash2 size={18} aria-hidden="true" />Quitar imagen
        </button> : null}
        {imageFeedback ? <p
          className={imageFeedback.type === 'error' ? 'error' : imageFeedback.type === 'success' ? 'success' : ''}
          role={imageFeedback.type === 'error' ? 'alert' : 'status'}
        >{imageFeedback.type === 'status' ? <LoaderCircle size={16} aria-hidden="true" /> : null}{imageFeedback.message}</p> : null}
        {exportImage.feedback ? <p className={exportImage.feedback.type === 'error' ? 'error' : 'success'} role={exportImage.feedback.type === 'error' ? 'alert' : 'status'}>{exportImage.feedback.message}</p> : null}
      </aside>
      <div className="client-quote-export-stage" aria-hidden="true">
        <ClientQuoteCard ref={exportCardRef} data={cardData} exportMode />
      </div>
    </div> : null}
  </ModalDialog>;
}
