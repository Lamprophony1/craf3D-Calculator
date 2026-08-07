import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Plus, RotateCcw, Save, Search, Share2, SlidersHorizontal } from 'lucide-react';
import { get, post } from '../api/client';
import type { Filament, QuickQuotePreviewResponse } from '../api/types';
import { navigate } from '../components/AppShell';
import { PriceWarnings } from '../components/PriceWarnings';
import { formatDecimal, formatPyg } from '../utils/format';
import { buildClientQuoteText } from '../utils/clientQuote';
import { NewFilamentDialog, SaveQuoteDialog } from '../components/QuickQuoteDialogs';

export const QUICK_DRAFT_KEY = 'printcost.quick-quote-draft.v1';
export const QUICK_TO_ADVANCED_KEY = 'printcost.quick-to-advanced.v1';

interface QuickDraft { spoolId: string; hours: number; minutes: number; totalGrams: number; }
type QuickField = 'filament' | 'hours' | 'minutes' | 'duration' | 'grams';
const emptyDraft: QuickDraft = { spoolId: '', hours: 0, minutes: 0, totalGrams: 0 };

export function restoreQuickDraft(storage: Pick<Storage, 'getItem'> = localStorage): QuickDraft {
  try { return { ...emptyDraft, ...JSON.parse(storage.getItem(QUICK_DRAFT_KEY) ?? '{}') as Partial<QuickDraft> }; }
  catch { return emptyDraft; }
}

export function QuickQuoteScreen() {
  const [draft, setDraft] = useState<QuickDraft>(() => restoreQuickDraft());
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [filamentsLoaded, setFilamentsLoaded] = useState(false);
  const [result, setResult] = useState<QuickQuotePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [filamentSearch, setFilamentSearch] = useState('');
  const [addFilamentOpen, setAddFilamentOpen] = useState(false);
  const [saveQuoteOpen, setSaveQuoteOpen] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<QuickField, boolean>>>({});
  const requestNumber = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const hoursInput = useRef<HTMLInputElement>(null);
  const shareApi = Reflect.get(navigator, 'share') as ((data: ShareData) => Promise<void>) | undefined;

  useEffect(() => { localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(draft)); }, [draft]);
  useEffect(() => { setResult(null); }, [draft.spoolId, draft.hours, draft.minutes, draft.totalGrams]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (!online) return;
    get<Filament[]>('/api/filaments').then(rows => {
      const active = rows.filter(row => row.isActive);
      setFilaments(active);
      setDraft(current => ({ ...current, spoolId: current.spoolId || active[0]?.id || '' }));
    }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'No pudimos cargar los filamentos.'))
      .finally(() => setFilamentsLoaded(true));
  }, [online]);

  const validationErrors = useMemo(() => {
    const errors: Partial<Record<QuickField, string>> = {};
    if (!draft.spoolId || (filamentsLoaded && !filaments.some(row => row.id === draft.spoolId && row.isActive)))
      errors.filament = 'Elegí un filamento activo.';
    if (!Number.isFinite(draft.hours) || !Number.isInteger(draft.hours)) errors.hours = 'Ingresá horas completas.';
    else if (draft.hours < 0) errors.hours = 'Las horas no pueden ser negativas.';
    if (!Number.isFinite(draft.minutes) || !Number.isInteger(draft.minutes) || draft.minutes < 0 || draft.minutes > 59)
      errors.minutes = 'Los minutos deben estar entre 0 y 59.';
    if (!errors.hours && !errors.minutes && draft.hours * 60 + draft.minutes <= 0)
      errors.duration = 'El tiempo total debe ser mayor que cero.';
    if (!Number.isFinite(draft.totalGrams) || draft.totalGrams <= 0)
      errors.grams = 'Ingresá una cantidad de gramos mayor que cero.';
    return errors;
  }, [draft, filaments, filamentsLoaded]);
  const isValid = Object.keys(validationErrors).length === 0;
  const calculate = useCallback(async () => {
    if (!online) { setMessage('Recuperamos tu borrador. El precio se verificará cuando vuelvas a tener conexión.'); return; }
    if (!isValid) {
      setTouched({ filament: true, hours: true, minutes: true, duration: true, grams: true });
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    const currentRequest = ++requestNumber.current;
    setLoading(true); setMessage(null);
    try {
      const preview = await post<QuickQuotePreviewResponse>('/api/calculations/quick-quote-preview', {
        spoolId: draft.spoolId,
        printDurationMinutes: draft.hours * 60 + draft.minutes,
        totalGrams: draft.totalGrams
      }, { signal: controller.signal });
      if (currentRequest === requestNumber.current) setResult(preview);
    } catch (reason) {
      if (controller.signal.aborted) return;
      if (currentRequest === requestNumber.current) setMessage(reason instanceof Error ? reason.message : 'No pudimos calcular el precio.');
    } finally { if (currentRequest === requestNumber.current) setLoading(false); }
  }, [draft, isValid, online]);

  useEffect(() => {
    if (!isValid || !online) return;
    const timeout = window.setTimeout(() => void calculate(), 450);
    return () => window.clearTimeout(timeout);
  }, [calculate, isValid, online]);
  useEffect(() => () => activeRequest.current?.abort(), []);

  const openAdvanced = () => {
    if (!result?.advancedRequest) return;
    localStorage.setItem(QUICK_TO_ADVANCED_KEY, JSON.stringify(result.advancedRequest)); navigate('/calculator');
  };
  const copyPrice = async () => {
    if (!result?.canUsePrice || !result.breakdown) return;
    const text = buildClientQuoteText(result.breakdown.customerTotalGs);
    await navigator.clipboard.writeText(text);
    setMessage('Precio copiado');
  };
  const sharePrice = async () => {
    if (!shareApi || !result?.canUsePrice || !result.breakdown) return;
    const text = buildClientQuoteText(result.breakdown.customerTotalGs);
    try {
      await shareApi.call(navigator, { title: 'Presupuesto de impresión 3D', text });
      setMessage('Presupuesto compartido');
    } catch (reason) {
      if ((reason as { name?: string })?.name !== 'AbortError')
        setMessage(reason instanceof Error ? reason.message : 'No pudimos compartir el presupuesto.');
    }
  };
  const startAgain = () => {
    activeRequest.current?.abort();
    setDraft({ ...emptyDraft, spoolId: draft.spoolId });
    setResult(null); setMessage(null); setTouched({});
    window.setTimeout(() => hoursInput.current?.focus(), 0);
  };

  const breakdown = result?.breakdown;
  const normalizedSearch = filamentSearch.trim().toLocaleLowerCase('es');
  const visibleFilaments = filaments.filter(row => !normalizedSearch
    || `${row.material} ${row.color} ${row.productName}`.toLocaleLowerCase('es').includes(normalizedSearch)
    || row.id === draft.spoolId);
  const selectedFilament = filaments.find(row => row.id === draft.spoolId);
  const hasOtherSearchResults = visibleFilaments.some(row => row.id !== draft.spoolId
    && `${row.material} ${row.color} ${row.productName}`.toLocaleLowerCase('es').includes(normalizedSearch));
  return <section className="page quick-quote-page">
    <div className="quick-heading">
      <div><h1>¿Cuánto cobrar?</h1><p>Elegí el filamento, cargá el tiempo y los gramos.</p></div>
      <span className={`connection ${online ? 'online' : 'offline'}`}>{online ? 'Conectado' : 'Sin conexión'}</span>
    </div>
    {!online ? <p className="warning" role="status">Tu borrador sigue disponible. No mostramos un precio como verificado hasta reconectar.</p> : null}
    {message ? <p className="notice" role="status">{message}</p> : null}

    <div className="quick-quote-grid">
      <form className="quick-form" aria-label="Datos para cotizar" onSubmit={event => { event.preventDefault(); void calculate(); }}>
        <div className="input-group">
          <label htmlFor="quick-filament">Filamento</label>
          <div className="filament-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar filamento" type="search" value={filamentSearch} onChange={event => setFilamentSearch(event.target.value)} placeholder="Buscar por material o color" /></div>
          <select id="quick-filament" value={draft.spoolId} aria-invalid={Boolean(touched.filament && validationErrors.filament)} aria-describedby={touched.filament && validationErrors.filament ? 'quick-filament-error' : undefined} onChange={event => { setTouched(current => ({ ...current, filament: true })); setDraft(current => ({ ...current, spoolId: event.target.value })); }} required>
            <option value="">Elegí un filamento</option>
            {visibleFilaments.map(row => <option key={row.id} value={row.id}>{row.material} · {row.color} · {formatPyg(row.landedCostGs / row.netWeightGrams)}/g</option>)}
          </select>
          {touched.filament && validationErrors.filament ? <small id="quick-filament-error" className="field-error">{validationErrors.filament}</small> : null}
          {normalizedSearch && !hasOtherSearchResults && selectedFilament ? <small>No encontramos otros filamentos. Conservamos el seleccionado.</small> : null}
          {filamentsLoaded && filaments.length === 0 ? <div className="inline-empty"><strong>Agregá tu primer filamento para empezar a cotizar.</strong></div> : null}
          <button type="button" className="inline-add" onClick={() => setAddFilamentOpen(true)}><Plus size={18} aria-hidden="true" />Agregar filamento</button>
        </div>
        <fieldset className="input-group"><legend>Tiempo de impresión</legend><div className="duration-fields">
          <label htmlFor="quick-hours">Horas<input ref={hoursInput} id="quick-hours" aria-label="Horas de impresión" aria-invalid={Boolean(touched.hours && (validationErrors.hours || validationErrors.duration))} aria-describedby={touched.hours && validationErrors.hours ? 'quick-hours-error' : touched.duration && validationErrors.duration ? 'quick-duration-error' : undefined} type="number" inputMode="numeric" min="0" step="1" value={draft.hours || ''} onChange={event => { setTouched(current => ({ ...current, hours: true, duration: true })); setDraft(current => ({ ...current, hours: Number(event.target.value) })); }} />{touched.hours && validationErrors.hours ? <small id="quick-hours-error" className="field-error">{validationErrors.hours}</small> : null}</label>
          <label htmlFor="quick-minutes">Minutos<input id="quick-minutes" aria-label="Minutos de impresión" aria-invalid={Boolean(touched.minutes && (validationErrors.minutes || validationErrors.duration))} aria-describedby={touched.minutes && validationErrors.minutes ? 'quick-minutes-error' : touched.duration && validationErrors.duration ? 'quick-duration-error' : undefined} type="number" inputMode="numeric" min="0" max="59" step="1" value={draft.minutes || ''} onChange={event => { setTouched(current => ({ ...current, minutes: true, duration: true })); setDraft(current => ({ ...current, minutes: Number(event.target.value) })); }} />{touched.minutes && validationErrors.minutes ? <small id="quick-minutes-error" className="field-error">{validationErrors.minutes}</small> : null}</label>
        </div>{touched.duration && validationErrors.duration ? <small id="quick-duration-error" className="field-error">{validationErrors.duration}</small> : null}</fieldset>
        <div className="input-group">
          <label htmlFor="quick-grams">Gramos totales del slicer</label>
          <input id="quick-grams" type="number" inputMode="decimal" min="0.01" step="0.01" aria-invalid={Boolean(touched.grams && validationErrors.grams)} aria-describedby={touched.grams && validationErrors.grams ? 'quick-grams-error' : 'quick-grams-help'} value={draft.totalGrams || ''} onChange={event => { setTouched(current => ({ ...current, grams: true })); setDraft(current => ({ ...current, totalGrams: Number(event.target.value) })); }} required />
          {touched.grams && validationErrors.grams ? <small id="quick-grams-error" className="field-error">{validationErrors.grams}</small> : null}
          <small id="quick-grams-help">Incluí soportes y purga.</small>
        </div>
        <button type="submit" disabled={loading || !online}>{loading ? 'Calculando…' : 'Calcular precio'}</button>
        <p className="auto-calc-note">El precio se actualiza automáticamente cuando cambiás un dato.</p>
      </form>

      <article className="price-widget" aria-live="polite" aria-busy={loading}>
        <header><h2>Precio recomendado</h2></header>
        {loading && !breakdown ? <div className="result-empty" role="status"><span className="loading-mark" aria-hidden="true" />Calculando el mejor precio…</div>
          : result && !breakdown ? <div className="result-empty"><h3>No podemos darte un precio todavía</h3><PriceWarnings warnings={result.warnings} /><button type="button" onClick={() => navigate('/settings')}>Revisar ajustes</button></div>
          : !breakdown ? <div className="result-empty"><strong>Completá los tres datos</strong><span>El precio aparecerá acá.</span></div>
          : <>
            {!result.canUsePrice ? <div className="incomplete-heading"><h3>Precio pendiente de revisión</h3><p>Resolvé los avisos antes de compartirlo.</p></div> : null}
            <div className="dominant-price"><span>{result.canUsePrice ? 'Podés cobrar' : 'Estimación'}</span><strong>{formatPyg(breakdown.customerTotalGs)}</strong>{result.canUsePrice ? <small>Ya incluye costos, imprevistos y ganancia.</small> : null}{selectedFilament ? <small>Filamento usado: {selectedFilament.material} · {selectedFilament.color}</small> : null}</div>
            <PriceWarnings warnings={result.warnings} />
            <details className="breakdown-details"><summary>Ver cómo se calculó</summary>
              <dl className="human-breakdown">
                <div><dt>Material</dt><dd>{formatPyg(breakdown.materialCostGs)}</dd></div>
                <div><dt>Impresión</dt><dd>{formatPyg(breakdown.energy.costGs + breakdown.machine.costGs)}</dd></div>
                <div><dt>Preparación</dt><dd>{formatPyg(breakdown.laborCostGs)}</dd></div>
                <div><dt>Embalaje</dt><dd>{formatPyg(breakdown.additionalCostGs)}</dd></div>
                <div><dt>Reserva por posibles fallas</dt><dd>{formatPyg(breakdown.failureReserveGs)}</dd></div>
                <div><dt>Costos generales</dt><dd>{formatPyg(breakdown.totalOverheadGs)}</dd></div>
                <div><dt>Ganancia incluida</dt><dd>{formatPyg(breakdown.estimatedProfitGs)}</dd></div>
                <div className="summary-row"><dt>Total</dt><dd>{formatPyg(breakdown.customerTotalGs)}</dd></div>
              </dl>
              <details className="technical-details"><summary>Detalles técnicos</summary><dl className="human-breakdown">
                <div><dt>Costo completo</dt><dd>{formatPyg(breakdown.fullyLoadedCostGs)}</dd></div>
                <div><dt>Margen estimado</dt><dd>{formatDecimal(breakdown.achievedMarginPercent)}%</dd></div>
                <div><dt>Impuesto</dt><dd>{formatPyg(breakdown.taxGs)}</dd></div>
                {result.warnings.map(warning => <div key={warning.code}><dt>{warning.code}</dt><dd>{warning.blocksPrice ? 'Requiere atención' : 'Informativo'}</dd></div>)}
              </dl></details>
            </details>
            <div className="result-actions">
              <button type="button" onClick={() => setSaveQuoteOpen(true)} disabled={loading || !online || !result.advancedRequest}><Save size={18} aria-hidden="true" />Guardar presupuesto</button>
              {result.canUsePrice ? <button type="button" className="secondary" onClick={() => void copyPrice()}><Clipboard size={18} aria-hidden="true" />Copiar precio</button> : null}
              {result.canUsePrice && shareApi ? <button type="button" className="secondary" onClick={() => void sharePrice()}><Share2 size={18} aria-hidden="true" />Compartir</button> : null}
              <button type="button" className="secondary" onClick={openAdvanced} disabled={!result.advancedRequest}><SlidersHorizontal size={18} aria-hidden="true" />Necesito ajustar algo</button>
              <button type="button" className="quiet" onClick={startAgain}><RotateCcw size={18} aria-hidden="true" />Nuevo cálculo</button>
            </div>
          </>}
      </article>
    </div>
    <NewFilamentDialog open={addFilamentOpen} onClose={() => setAddFilamentOpen(false)} onCreated={filament => {
      setFilaments(current => [...current, filament]);
      setDraft(current => ({ ...current, spoolId: filament.id }));
      setFilamentSearch('');
      setMessage('Filamento guardado y seleccionado.');
    }} />
    <SaveQuoteDialog open={saveQuoteOpen} advancedRequest={result?.advancedRequest ?? null} onClose={() => setSaveQuoteOpen(false)} onSaved={code => setMessage(`${code} se guardó en Presupuestos como borrador.`)} />
  </section>;
}
