import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Spool } from 'lucide-react';
import type { Filament } from '../api/types';
import { filamentBrand, filamentSwatches, filamentVariant, normalizeFilamentText } from '../utils/filaments';
import { formatDecimal } from '../utils/format';

const RECENT_KEY = 'printcost.recent-filaments.v1';
const readRecent = (fallback: string[] = []): string[] => {
  try { const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 5) : []; } catch { return fallback; }
};
const rate = (row: Filament) => row.landedCostGs > 0 && row.netWeightGrams > 0 ? `Gs. ${formatDecimal(row.landedCostGs / row.netWeightGrams, 2)}/g` : 'Falta definir el costo';
function Swatch({ color }: { color: string }) {
  const values = filamentSwatches(color);
  return <span className="filament-swatch" aria-hidden="true">{values.length ? values.map(value => <span key={value} style={{ backgroundColor: value }} />) : <Spool size={24} />}</span>;
}

export function FilamentPicker({ filaments, value, onChange, loading, disabled, error, hideRecentWhenClosed }: {
  filaments: Filament[]; value: string; onChange: (id: string) => void; loading: boolean; disabled?: boolean; error?: string;
  hideRecentWhenClosed?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('');
  const [limit, setLimit] = useState(6);
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => setOpen(false), [value]);
  useEffect(() => { if (disabled || loading) setOpen(false); }, [disabled, loading]);
  const expanded = open && !disabled && !loading;
  const active = filaments.filter(row => row.isActive);
  const selected = active.find(row => row.id === value);
  const matches = (a: string, b: string) => normalizeFilamentText(a) === normalizeFilamentText(b);
  const filtered = active.filter(row => (!brand || matches(filamentBrand(row), brand)) && (!material || matches(row.material, material)))
    .sort((a, b) => `${filamentBrand(a)} ${a.material} ${a.color} ${a.productName}`.localeCompare(`${filamentBrand(b)} ${b.material} ${b.color} ${b.productName}`, 'es'));
  const unique = (items: string[]) => [...new Map(items.map(item => [normalizeFilamentText(item), item])).values()].sort((a, b) => a.localeCompare(b, 'es'));
  const brands = unique(active.map(filamentBrand));
  const materials = unique(active.map(row => row.material));
  const recentRows = recent.flatMap(key => active.find(row => row.id === key) ?? []).filter(row => open || row.id !== value).slice(0, open ? 3 : 2);
  const clear = () => { setBrand(''); setMaterial(''); setLimit(6); };
  const choose = (row: Filament) => {
    if (disabled || loading) return;
    const next = [row.id, ...readRecent(recent).filter(key => key !== row.id)].slice(0, 5);
    setRecent(next); try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* Selection works when persistence is unavailable. */ }
    onChange(row.id); setOpen(false); trigger.current?.focus();
  };
  const option = (row: Filament) => <button type="button" className={`filament-choice${row.id === value ? ' selected' : ''}`} key={row.id} aria-pressed={row.id === value}
    aria-label={`Elegir ${filamentBrand(row)} ${row.material} ${row.color} ${filamentVariant(row)} ${row.batchCode ?? ''}, ${rate(row)}`} onClick={() => choose(row)}>
    <span className="filament-choice-title"><Swatch color={row.color} /><strong>{row.color}</strong>{row.id === value ? <Check size={14} aria-hidden="true" /> : null}</span>
    <span className="filament-choice-text"><span>{filamentBrand(row)} · {row.material}</span>
      {filamentVariant(row) ? <small>{filamentVariant(row)}</small> : null}<small>{rate(row)}{row.batchCode ? ` · Lote ${row.batchCode}` : ''}</small></span>
  </button>;
  const recentOptions = recentRows.length ? <div className="filament-recents" role="group" aria-label="Usados recientemente">
    <span className="filament-group-label">Usados recientemente</span>
    <div className="filament-options">{recentRows.map(option)}</div>
  </div> : null;
  return <div className="filament-picker" onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <label htmlFor={id}>Filamento</label>
    <button ref={trigger} id={id} type="button" className="filament-trigger" aria-label="Filamento" aria-describedby={`${id}-selection${error ? ` ${id}-error` : ''}`} aria-invalid={Boolean(error)} aria-expanded={expanded} aria-controls={expanded ? `${id}-choices` : undefined}
      disabled={disabled || loading || !active.length} onClick={() => {
        if (!open) { clear(); setRecent(readRecent(recent)); }
        setOpen(current => !current);
      }}>
      <Swatch color={selected?.color ?? ''} /><span className="filament-choice-text" id={`${id}-selection`}>{selected ? <><strong>{selected.color}</strong><span>{filamentBrand(selected)} · {selected.material}</span>{filamentVariant(selected) ? <small>{filamentVariant(selected)}</small> : null}<small>{rate(selected)}{selected.batchCode ? ` · Lote ${selected.batchCode}` : ''}</small></> : <strong>{loading ? 'Cargando filamentos…' : value ? 'Filamento guardado' : 'Elegí un filamento'}</strong>}</span>
      <ChevronDown size={20} aria-hidden="true" className={expanded ? 'expanded' : ''} />
    </button>
    {error ? <small id={`${id}-error`} className="field-error">{error}</small> : null}
    {!expanded && !disabled && !loading && !hideRecentWhenClosed ? recentOptions : null}
    {expanded ? <div id={`${id}-choices`} className="filament-browser">
      {brands.length > 1 || materials.length > 1 ? <div className="filament-filters">
        {brands.length > 1 ? <label>Marca<select value={brand} onChange={event => { setBrand(event.target.value); setLimit(6); }}>
          <option value="">Todas</option>{brands.map(item => <option key={item} value={item}>{item}</option>)}
        </select></label> : null}
        {materials.length > 1 ? <label>Material<select value={material} onChange={event => { setMaterial(event.target.value); setLimit(6); }}>
          <option value="">Todos</option>{materials.map(item => <option key={item} value={item}>{item}</option>)}
        </select></label> : null}
      </div> : null}
      <span className="filament-result-count" role="status">{filtered.length} {filtered.length === 1 ? 'filamento' : 'filamentos'}</span>
      <div className="filament-options" role="group" aria-label="Filamentos disponibles">{filtered.slice(0, limit).map(option)}</div>
      {!filtered.length ? <p className="filament-empty">No encontramos filamentos con esos filtros.</p> : null}
      {filtered.length > limit ? <button type="button" className="secondary filament-show-more" onClick={() => setLimit(current => current + 6)}>Ver más filamentos ({filtered.length - limit})</button> : null}
      {brand || material ? <button type="button" className="quiet filament-clear" onClick={clear}>Limpiar filtros</button> : recentOptions}
    </div> : null}
  </div>;
}
