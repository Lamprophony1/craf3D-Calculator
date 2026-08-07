import type { PriceWarning } from '../api/types';

export function PriceWarnings({ warnings }: { warnings: PriceWarning[] }) {
  if (warnings.length === 0) return null;
  return <ul className="warning-list" aria-label="Advertencias del precio">{warnings.map(warning =>
    <li key={`${warning.code}-${warning.field ?? ''}`} className={warning.blocksPrice ? 'blocking' : ''}>
      <span className="warning-message">{warning.message}</span>
      <small>Código: {warning.code}{warning.field ? ` · Campo: ${warning.field}` : ''}</small>
    </li>)}</ul>;
}
