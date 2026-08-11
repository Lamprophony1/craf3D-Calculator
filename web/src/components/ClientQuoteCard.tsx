import { forwardRef, useEffect, useState } from 'react';
import { Clock, MessageCircle, Palette, Weight } from 'lucide-react';
import { formatPyg } from '../utils/format';

export interface ClientQuoteCardData {
  businessName: string;
  logo: string | null;
  contactLine: string;
  note: string;
  totalGs: number;
  material: string;
  color: string;
  totalGrams: number;
  printDurationMinutes: number;
  reference: string;
  issuedOn: string;
  validUntil: string;
  modelImage: string | null;
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function BrandFallbackMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path d="M24 4 42 14 24 24 6 14 24 4Z" />
    <path d="m6 23 18 10 18-10M6 32l18 10 18-10" />
  </svg>;
}

export const ClientQuoteCard = forwardRef<HTMLElement, { data: ClientQuoteCardData; exportMode?: boolean }>(
  function ClientQuoteCard({ data, exportMode = false }, ref) {
    const [logoFailed, setLogoFailed] = useState(false);
    useEffect(() => setLogoFailed(false), [data.logo]);
    const showLogo = Boolean(data.logo) && !logoFailed;
    const modelVariant = data.modelImage ? ' client-quote-card--with-model' : ' client-quote-card--without-model';
    return <article
      ref={ref}
      className={`client-quote-card${modelVariant}${exportMode ? ' client-quote-card--export' : ''}`}
      aria-label="Cotización visual para cliente"
      data-testid={exportMode ? 'client-quote-export-card' : 'client-quote-card'}
    >
      <header className="client-quote-brand">
        <div className={`client-quote-logo${showLogo ? '' : ' client-quote-logo--fallback'}`} aria-label={showLogo ? 'Logo comercial' : 'Marca gráfica alternativa'}>
          {showLogo
            ? <img src={data.logo!} alt="" loading="eager" decoding="sync" onError={() => setLogoFailed(true)} />
            : <BrandFallbackMark />}
        </div>
        <div className="client-quote-brand-copy">
          <strong>{data.businessName}</strong>
          <span>Impresión 3D a medida</span>
        </div>
      </header>

      <section className="client-quote-intro">
        <h3>Presupuesto personalizado</h3>
      </section>

      <section className="client-quote-price" aria-label="Precio final">
        <span>Precio final</span>
        <strong>{formatPyg(data.totalGs)}</strong>
      </section>

      {data.modelImage ? <figure className="client-quote-model">
        <img src={data.modelImage} alt="Vista del modelo a imprimir" loading="eager" decoding="sync" />
      </figure> : null}

      <dl className="client-quote-specs">
        <div><dt><Palette aria-hidden="true" /><span>Material / color</span></dt><dd>{data.material} · {data.color}</dd></div>
        <div><dt><Weight aria-hidden="true" /><span>Peso estimado</span></dt><dd>{data.totalGrams.toLocaleString('es-PY')} g</dd></div>
        <div><dt><Clock aria-hidden="true" /><span>Tiempo estimado</span></dt><dd>{formatDuration(data.printDurationMinutes)}</dd></div>
      </dl>

      <footer className="client-quote-footer">
        <div className="client-quote-meta">
          <span><b>Ref.</b> {data.reference}</span>
          <span><b>Fecha</b> {data.issuedOn}</span>
          <span><b>Válido hasta</b> {data.validUntil}</span>
        </div>
        <div className="client-quote-footer-bottom">
          <p>{data.note}</p>
          {data.contactLine ? <strong data-testid="client-quote-contact"><MessageCircle aria-hidden="true" />{data.contactLine}</strong> : null}
        </div>
      </footer>
    </article>;
  }
);
