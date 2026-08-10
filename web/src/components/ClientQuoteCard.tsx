import { forwardRef } from 'react';
import { formatPyg } from '../utils/format';
import { brandInitials } from '../utils/brand';

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

export const ClientQuoteCard = forwardRef<HTMLElement, { data: ClientQuoteCardData; exportMode?: boolean }>(
  function ClientQuoteCard({ data, exportMode = false }, ref) {
    const modelVariant = data.modelImage ? ' client-quote-card--with-model' : ' client-quote-card--without-model';
    return <article
      ref={ref}
      className={`client-quote-card${modelVariant}${exportMode ? ' client-quote-card--export' : ''}`}
      aria-label="Cotización visual para cliente"
      data-testid={exportMode ? 'client-quote-export-card' : 'client-quote-card'}
    >
      <header className="client-quote-brand">
        <div className="client-quote-logo" aria-label={data.logo ? 'Logo comercial' : 'Logo comercial alternativo'}>
          {data.logo
            ? <img src={data.logo} alt="" />
            : <span aria-hidden="true">{brandInitials(data.businessName)}</span>}
        </div>
        <div>
          <strong>{data.businessName}</strong>
          <span>Impresión 3D a medida</span>
        </div>
      </header>

      <section className="client-quote-intro">
        <p>Hecho a medida para vos</p>
        <h3>Tu presupuesto de impresión 3D</h3>
      </section>

      <section className="client-quote-price" aria-label="Precio final">
        <span>Precio final</span>
        <strong>{formatPyg(data.totalGs)}</strong>
      </section>

      {data.modelImage ? <figure className="client-quote-model">
        <img src={data.modelImage} alt="Vista del modelo a imprimir" loading="eager" decoding="sync" />
      </figure> : null}

      <dl className="client-quote-specs">
        <div><dt>Material / color</dt><dd>{data.material} · {data.color}</dd></div>
        <div><dt>Peso estimado</dt><dd>{data.totalGrams.toLocaleString('es-PY')} g</dd></div>
        <div><dt>Tiempo estimado</dt><dd>{formatDuration(data.printDurationMinutes)}</dd></div>
      </dl>

      <footer className="client-quote-footer">
        <div className="client-quote-meta">
          <span><b>Ref.</b> {data.reference}</span>
          <span><b>Fecha</b> {data.issuedOn}</span>
          <span><b>Válido hasta</b> {data.validUntil}</span>
        </div>
        <p>{data.note}</p>
        {data.contactLine ? <strong data-testid="client-quote-contact">{data.contactLine}</strong> : null}
      </footer>
    </article>;
  }
);
