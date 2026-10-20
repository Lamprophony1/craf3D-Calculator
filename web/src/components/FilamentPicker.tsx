import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Spool } from 'lucide-react';
import type { Filament } from '../api/types';
import { filamentBrand, filamentMatches, filamentSwatches, filamentVariant, normalizeFilamentText } from '../utils/filaments';
import { formatDecimal } from '../utils/format';

const RECENT_KEY = 'printcost.recent-filaments.v1';
const readRecent = (): string[] => {
  try { const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 5) : []; } catch { return []; }
};
const rate = (row: Filament) => row.landedCostGs > 0 && row.netWeightGrams > 0 ? `Gs. ${formatDecimal(row.landedCostGs / row.netWeightGrams, 2)}/g` : 'Falta definir el costo';
function Swatch({ color }: { color: string }) {
  const values = filamentSwatches(color);
  return <span className="filament-swatch" aria-hidden="true">{values.length ? values.map(value => <span key={value} style={{ backgroundColor: value }} />) : <Spool size={24} />}</span>;
}

export function FilamentPicker({ filaments, value, onChange, loading, disabled, error }: {
  filaments: Filament[]; value: string; onChange: (id: string) => void; loading: boolean; disabled?: boolean; error?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('');
  const [limit, setLimit] = useState(6);
  const [allBrands, setAllBrands] = useState(false);
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => setOpen(false), [value]);
  useEffect(() => { if (disabled || loading) setOpen(false); }, [disabled, loading]);
  const expanded = open && !disabled && !loading;
  const active = filaments.filter(row => row.isActive);
  const selected = active.find(row => row.id === value);
  const matches = (a: string, b: string) => normalizeFilamentText(a) === normalizeFilamentText(b);
  const searched = active.filter(row => filamentMatches(row, query));
  const filtered = searched.filter(row => (!brand || matches(filamentBrand(row), brand)) && (!material || matches(row.material, material)))
    .sort((a, b) => `${filamentBrand(a)} ${a.material} ${a.color} ${a.productName}`.localeCompare(`${filamentBrand(b)} ${b.material} ${b.color} ${b.productName}`, 'es'));
  const unique = (items: string[]) => [...new Map(items.map(item => [normalizeFilamentText(item), item])).values()].sort((a, b) => a.localeCompare(b, 'es'));
  const brands = unique(active.map(filamentBrand));
  const materials = unique(active.map(row => row.material));
  const recentRows = recent.flatMap(key => active.find(row => row.id === key) ?? []).filter(row => open || row.id !== value).slice(0, open ? 3 : 2);
  const clear = () => { setQuery(''); setBrand(''); setMaterial(''); setLimit(6); };
  const choose = (row: Filament) => {
    if (disabled || loading) return;
    const next = [row.id, ...recent.filter(key => key !== row.id)].slice(0, 5);
    setRecent(next); try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* Selection works when persistence is unavailable. */ }
    onChange(row.id); setOpen(false); trigger.current?.focus();
  };
  const option = (row: Filament) => <button type="button" className={`filament-choice${row.id === value ? ' selected' : ''}`} key={row.id} aria-pressed={row.id === value}
    aria-label={`Elegir ${filamentBrand(row)} ${row.material} ${row.color} ${filamentVariant(row)} ${row.batchCode ?? ''}, ${rate(row)}`} onClick={() => choose(row)}>
    <Swatch color={row.color} /><span className="filament-choice-text"><strong>{row.color}</strong><span>{filamentBrand(row)} · {row.material}</span>
      {filamentVariant(row) ? <small>{filamentVariant(row)}</small> : null}<small>{rate(row)}{row.batchCode ? ` · Lote ${row.batchCode}` : ''}</small></span>
    {row.id === value ? <Check size={18} aria-hidden="true" /> : null}
  </button>;
  return <div className="filament-picker" onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <label htmlFor={id}>Filamento</label>
    <button ref={trigger} id={id} type="button" className="filament-trigger" aria-label="Filamento" aria-describedby={`${id}-selection${error ? ` ${id}-error` : ''}`} aria-invalid={Boolean(error)} aria-expanded={expanded} aria-controls={expanded ? `${id}-choices` : undefined}
      disabled={disabled || loading || !active.length} onClick={() => { if (!open) clear(); setOpen(current => !current); }}>
      <Swatch color={selected?.color ?? ''} /><span className="filament-choice-text" id={`${id}-selection`}>{selected ? <><strong>{selected.color}</strong><span>{filamentBrand(selected)} · {selected.material}</span>{filamentVariant(selected) ? <small>{filamentVariant(selected)}</small> : null}<small>{rate(selected)}{selected.batchCode ? ` · Lote ${selected.batchCode}` : ''}</small></> : <strong>{loading ? 'Cargando filamentos…' : value ? 'Filamento guardado' : 'Elegí un filamento'}</strong>}</span>
      <ChevronDown size={20} aria-hidden="true" className={expanded ? 'expanded' : ''} />
    </button>
    {error ? <small id={`${id}-error`} className="field-error">{error}</small> : null}
    {!disabled && !loading && recentRows.length ? <div className="filament-recents" role="group" aria-label="Usados recientemente"><span className="filament-group-label">Usados recientemente</span><div className="filament-options">{recentRows.map(option)}</div></div> : null}
    {expanded ? <div id={`${id}-choices`} className="filament-browser">
      <div className="filament-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar filamento" type="search" placeholder="Marca, material, color o nombre" value={query} onChange={event => { setQuery(event.target.value); setLimit(6); }} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></div>
      {brands.length > 1 ? <div className="filament-facet" role="group" aria-label="Marca"><span className="filament-group-label">Marca</span><div className="filament-filters"><button type="button" className="secondary" aria-pressed={!brand} onClick={() => { setBrand(''); setLimit(6); }}>Todas</button>
        {(allBrands ? brands : brands.slice(0, 6)).map(item => <button key={item} type="button" className="secondary" aria-label={`Filtrar marca ${item}`} aria-pressed={brand === item} onClick={() => { setBrand(current => current === item ? '' : item); setLimit(6); }}>{item}</button>)}
        {brands.length > 6 ? <button type="button" className="quiet" onClick={() => setAllBrands(current => !current)}>{allBrands ? 'Menos marcas' : 'Más marcas'}</button> : null}</div></div> : null}
      {materials.length > 1 ? <div className="filament-facet" role="group" aria-label="Material"><span className="filament-group-label">Material</span><div className="filament-filters"><button type="button" className="secondary" aria-pressed={!material} onClick={() => { setMaterial(''); setLimit(6); }}>Todos</button>
        {materials.map(item => <button type="button" key={item} className="secondary" aria-label={`Filtrar material ${item}`} aria-pressed={material === item} onClick={() => { setMaterial(current => current === item ? '' : item); setLimit(6); }}>{item}</button>)}</div></div> : null}
      <div className="filament-results-heading"><span role="status">{filtered.length} {filtered.length === 1 ? 'filamento' : 'filamentos'}</span>{query || brand || material ? <button type="button" className="quiet" onClick={clear}>Limpiar filtros</button> : null}</div>
      <div className="filament-options" role="group" aria-label="Filamentos disponibles">{filtered.slice(0, limit).map(option)}</div>
      {!filtered.length ? <p className="filament-empty">No encontramos filamentos con esos filtros.</p> : null}
      {filtered.length > limit ? <button type="button" className="secondary filament-show-more" onClick={() => setLimit(current => current + 6)}>Ver más filamentos ({filtered.length - limit})</button> : null}
    </div> : null}
  </div>;
}
