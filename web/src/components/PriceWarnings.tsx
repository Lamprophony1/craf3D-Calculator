import type { PriceWarning } from '../api/types';

export function PriceWarnings({ warnings }: { warnings: PriceWarning[] }) {
  if (warnings.length === 0) return null;
  return <ul className="warning-list" aria-label="Advertencias del precio">{warnings.map(warning =>
    <li key={`${warning.code}-${warning.field ?? ''}`} className={warning.blocksPrice ? 'blocking' : ''}>
      <strong>{warning.code}</strong><span>{warning.message}</span>
      {warning.field ? <small>Campo: {warning.field}</small> : null}
    </li>)}</ul>;
}
