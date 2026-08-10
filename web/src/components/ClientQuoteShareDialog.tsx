import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Share2, Trash2 } from 'lucide-react';
import { get } from '../api/client';
import type { ApplicationSettings, SettingsResponse } from '../api/types';
import { useClientQuoteImageExport } from '../hooks/useClientQuoteImageExport';
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
const MAX_MODEL_IMAGE_BYTES = 8 * 1024 * 1024;

function localDate(value: Date) {
  return new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

function quoteReference(date: Date) {
  const parts = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    .map((part, index) => index ? String(part).padStart(2, '0') : String(part).slice(-2));
  return `C3D-${parts.slice(0, 3).join('')}-${parts.slice(3).join('')}`;
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No pudimos leer la imagen.')));
    reader.addEventListener('error', () => reject(new Error('No pudimos leer la imagen.')));
    reader.readAsDataURL(file);
  });
}

export function ClientQuoteShareDialog({ open, quote, onClose }: {
  open: boolean;
  quote: ShareableQuickQuote | null;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [brandingReady, setBrandingReady] = useState(false);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [issuedAt, setIssuedAt] = useState(() => new Date());
  const exportCardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    setIssuedAt(new Date());
    setModelImage(null);
    setImageError(null);
    setBrandingReady(false);
    let cancelled = false;
    get<SettingsResponse>('/api/settings')
      .then(response => { if (!cancelled) setSettings(response?.settings ?? null); })
      .catch(() => { if (!cancelled) setSettings(null); })
      .finally(() => { if (!cancelled) setBrandingReady(true); });
    return () => { cancelled = true; };
  }, [open]);

  const cardData = useMemo<ClientQuoteCardData | null>(() => {
    if (!quote) return null;
    const validityDays = settings?.clientQuoteValidityDays && settings.clientQuoteValidityDays > 0
      ? settings.clientQuoteValidityDays : 7;
    const validUntil = new Date(issuedAt);
    validUntil.setDate(validUntil.getDate() + validityDays);
    return {
      businessName: settings?.brandDisplayName?.trim() || settings?.visibleAppName?.trim() || 'Calculadora 3D',
      logo: settings?.brandLogo || null,
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
  const busy = ['exporting', 'sharing', 'downloading'].includes(exportImage.status);

  const chooseImage = async (file: File | undefined) => {
    setImageError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImageError('Elegí un archivo de imagen.'); return; }
    if (file.size > MAX_MODEL_IMAGE_BYTES) { setImageError('La imagen del modelo no puede superar 8 MB.'); return; }
    try { setModelImage(await readImage(file)); }
    catch (reason) { setImageError(reason instanceof Error ? reason.message : 'No pudimos leer la imagen.'); }
  };

  return <ModalDialog
    open={open}
    className="client-quote-dialog"
    title="Compartir con cliente"
    description="Prepará una imagen clara con el precio y los datos esenciales del trabajo."
    onClose={onClose}
    footer={<>
      <button type="button" onClick={() => void exportImage.share()} disabled={busy || !cardData || !brandingReady}>
        <Share2 size={18} aria-hidden="true" />{exportImage.status === 'exporting' ? 'Generando PNG…' : exportImage.status === 'sharing' ? 'Abriendo opciones…' : 'Compartir imagen'}
      </button>
      <button type="button" className="secondary" onClick={() => void exportImage.download()} disabled={busy || !cardData || !brandingReady}>
        <Download size={18} aria-hidden="true" />{exportImage.status === 'downloading' ? 'Descargando…' : 'Descargar PNG'}
      </button>
      <button type="button" className="secondary" onClick={onClose} disabled={busy}>Cerrar</button>
    </>}
  >
    {cardData ? <div className="client-quote-share-layout">
      <div className="client-quote-preview"><ClientQuoteCard data={cardData} /></div>
      <aside className="client-quote-controls" aria-label="Opciones de la imagen">
        <h3>Imagen del modelo</h3>
        <p>Opcional. Podés elegir una captura del slicer o tomar una foto. Solo se usa en esta vista y no se guarda.</p>
        {!brandingReady ? <p role="status">Cargando identidad comercial…</p> : null}
        <label className="client-image-picker">
          <ImagePlus size={20} aria-hidden="true" />
          <span>{modelImage ? 'Cambiar imagen' : 'Agregar imagen'}</span>
          <input
            data-autofocus
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Imagen del modelo"
            onChange={event => { void chooseImage(event.target.files?.[0]); event.target.value = ''; }}
          />
        </label>
        {modelImage ? <button type="button" className="secondary remove-client-image" onClick={() => setModelImage(null)}>
          <Trash2 size={18} aria-hidden="true" />Quitar imagen
        </button> : null}
        {imageError ? <p className="error" role="alert">{imageError}</p> : null}
        {exportImage.feedback ? <p className={exportImage.feedback.type === 'error' ? 'error' : 'success'} role={exportImage.feedback.type === 'error' ? 'alert' : 'status'}>{exportImage.feedback.message}</p> : null}
      </aside>
      <div className="client-quote-export-stage" aria-hidden="true">
        <ClientQuoteCard ref={exportCardRef} data={cardData} exportMode />
      </div>
    </div> : null}
  </ModalDialog>;
}
