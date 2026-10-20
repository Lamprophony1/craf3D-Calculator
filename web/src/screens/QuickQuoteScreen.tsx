import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Plus, RotateCcw, Save, Share2, SlidersHorizontal } from 'lucide-react';
import { get, post } from '../api/client';
import type { Filament, QuickQuotePreviewResponse } from '../api/types';
import { navigate } from '../components/AppShell';
import { PriceWarnings } from '../components/PriceWarnings';
import { formatDecimal, formatPyg } from '../utils/format';
import { buildClientQuoteText } from '../utils/clientQuote';
import { NewFilamentDialog, SaveQuoteDialog } from '../components/QuickQuoteDialogs';
import { ClientQuoteShareDialog } from '../components/ClientQuoteShareDialog';
import { useQuickOrderSession } from '../hooks/useQuickOrderSession';
import { FilamentPicker } from '../components/FilamentPicker';
import type { Order } from '../api/orders';

export const QUICK_DRAFT_KEY = 'printcost.quick-quote-draft.v1';
export const QUICK_TO_ADVANCED_KEY = 'printcost.quick-to-advanced.v1';

interface QuickDraft { spoolId: string; hours: number; minutes: number; totalGrams: number; customerReference?: string; description?: string; }
type QuickField = 'filament' | 'hours' | 'minutes' | 'duration' | 'grams';
const emptyDraft: QuickDraft = { spoolId: '', hours: 0, minutes: 0, totalGrams: 0 };

export const quickQuoteInputKey = (draft: QuickDraft) =>
  `${draft.spoolId}|${draft.hours * 60 + draft.minutes}|${draft.totalGrams}|${draft.customerReference ?? ''}|${draft.description ?? ''}`;

export function restoreQuickDraft(storage: Pick<Storage, 'getItem'> = localStorage): QuickDraft {
  try { return { ...emptyDraft, ...JSON.parse(storage.getItem(QUICK_DRAFT_KEY) ?? '{}') as Partial<QuickDraft> }; }
  catch { return emptyDraft; }
}

export function QuickQuoteScreen({ canSaveOrders = false }: { canSaveOrders?: boolean }) {
  const session = useQuickOrderSession();
  const sessionRef = useRef(session); sessionRef.current = session;
  const [savedOrder, setSavedOrder] = useState<Order | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [draft, setDraft] = useState<QuickDraft>(() => canSaveOrders ? restoreQuickDraft({ getItem: key => sessionStorage.getItem(key) ?? localStorage.getItem(key) }) : restoreQuickDraft());
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [filamentsLoaded, setFilamentsLoaded] = useState(false);
  const [result, setResult] = useState<QuickQuotePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filamentNotice, setFilamentNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [addFilamentOpen, setAddFilamentOpen] = useState(false);
  const [saveQuoteOpen, setSaveQuoteOpen] = useState(false);
  const [shareQuoteOpen, setShareQuoteOpen] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<QuickField, boolean>>>({});
  const requestNumber = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  const hoursInput = useRef<HTMLInputElement>(null);

  draftRef.current = draft;

  const invalidatePreview = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    requestNumber.current += 1;
    setLoading(false);
    setResult(null);
    setSavedOrder(null);
    setShareQuoteOpen(false);
  }, []);
  const updateDraft = useCallback((update: (current: QuickDraft) => QuickDraft, userEdit = true) => {
    if (userEdit) sessionRef.current.start();
    invalidatePreview();
    setDraft(update);
  }, [invalidatePreview]);

  useEffect(() => {
    localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(draft));
    if (canSaveOrders) sessionStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(draft));
  }, [draft, canSaveOrders]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (!online) return;
    setFilamentsLoaded(false);
    setFilamentNotice(null);
    invalidatePreview();
    get<Filament[]>('/api/filaments').then(rows => {
      const active = rows.filter(row => row.isActive);
      setFilaments(active);
      updateDraft(current => {
        const selectedStillExists = active.some(row => row.id === current.spoolId);
        const replacement = selectedStillExists ? current.spoolId : active[0]?.id ?? '';
        if (current.spoolId && !selectedStillExists) {
          setFilamentNotice(active[0]
            ? `El filamento guardado ya no está disponible. Seleccionamos ${active[0].material} ${active[0].color}.`
            : 'El filamento guardado ya no está disponible. Agregá un filamento para continuar.');
        }
        return { ...current, spoolId: replacement };
      }, false);
      setFilamentsLoaded(true);
    }).catch((reason: unknown) => {
      setMessage(reason instanceof Error ? reason.message : 'No pudimos cargar los filamentos.');
      setFilamentsLoaded(false);
    });
  }, [invalidatePreview, online, updateDraft]);

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
  const isValid = filamentsLoaded && Object.keys(validationErrors).length === 0;
  const calculate = useCallback(async () => {
    if (!online) { setMessage('Recuperamos tu borrador. El precio se verificará cuando vuelvas a tener conexión.'); return; }
    if (!isValid) {
      setTouched({ filament: true, hours: true, minutes: true, duration: true, grams: true });
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    const currentRequest = ++requestNumber.current;
    const inputKey = quickQuoteInputKey(draft);
    setLoading(true); setMessage(null); setSaveError(false);
    try {
      const calculation = {
        spoolId: draft.spoolId,
        printDurationMinutes: draft.hours * 60 + draft.minutes,
        totalGrams: draft.totalGrams
      };
      await sessionRef.current.ready();
      const persist = canSaveOrders && sessionRef.current.active.current;
      let preview: QuickQuotePreviewResponse;
      let order: Order | null = null;
      if (persist) {
        const body = { calculation, customerReference: draft.customerReference || null, description: draft.description || null };
        const identity = await sessionRef.current.next(body);
        const saved = await post<{ preview: QuickQuotePreviewResponse; order: Order | null }>('/api/orders/quick', { ...body, ...identity }, { signal: controller.signal });
        preview = saved.preview; order = saved.order;
      } else preview = await post<QuickQuotePreviewResponse>('/api/calculations/quick-quote-preview', calculation, { signal: controller.signal });
      if (currentRequest === requestNumber.current
        && !controller.signal.aborted
        && quickQuoteInputKey(draftRef.current) === inputKey) { setResult(preview); setSavedOrder(order); return { preview, order }; }
    } catch (reason) {
      if (controller.signal.aborted) return;
      if (currentRequest === requestNumber.current) { setSaveError(canSaveOrders); setMessage(reason instanceof Error ? reason.message : 'No pudimos calcular y guardar el presupuesto.'); }
    } finally {
      if (currentRequest === requestNumber.current && quickQuoteInputKey(draftRef.current) === inputKey) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [draft, isValid, online, canSaveOrders]);

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
  const ensureSaved = async () => {
    if (!canSaveOrders || savedOrder) return result;
    sessionRef.current.start();
    const saved = await calculate();
    return saved?.order ? saved.preview : null;
  };
  const shareBudget = async () => { if (await ensureSaved()) setShareQuoteOpen(true); };
  const copyPrice = async (full = false) => {
    if (!result?.canUsePrice || !result.breakdown) return;
    const inputKey = quickQuoteInputKey(draft);
    const authoritative = await ensureSaved();
    if (!authoritative?.canUsePrice || !authoritative.breakdown || inputKey !== quickQuoteInputKey(draftRef.current)) return;
    const text = buildClientQuoteText(authoritative.breakdown.customerTotalGs, full ? draft.customerReference : undefined, full ? draft.description : undefined);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Precio copiado');
    } catch {
      setMessage('No pudimos copiar el precio. Podés intentarlo de nuevo.');
    }
  };
  const startAgain = () => {
    sessionRef.current.reset(); setSavedOrder(null); setSaveError(false);
    updateDraft(() => ({ ...emptyDraft, spoolId: draft.spoolId }));
    setMessage(null); setTouched({});
    window.setTimeout(() => hoursInput.current?.focus(), 0);
  };

  const breakdown = result?.breakdown;
  const selectedFilament = filaments.find(row => row.id === draft.spoolId);
  return <section className="page quick-quote-page">
    <div className="quick-heading">
      <div><h1>¿Cuánto cobrar?</h1><p>Elegí el filamento, cargá el tiempo y los gramos.</p></div>
      <span className={`connection ${online ? 'online' : 'offline'}`}>{online ? 'Conectado' : 'Sin conexión'}</span>
    </div>
    {!online ? <p className="warning" role="status">Tu borrador sigue disponible. No mostramos un precio como verificado hasta reconectar.</p> : null}
    {filamentNotice ? <p className="notice" role="status">{filamentNotice}</p> : null}
    {message ? <p className="notice" role="status">{message}</p> : null}

    <div className="quick-quote-grid">
      <form className="quick-form" aria-label="Datos para cotizar" onSubmit={event => { event.preventDefault(); sessionRef.current.start(); void calculate(); }}>
        {canSaveOrders ? <div className="quick-order-fields"><label>Cliente / referencia<input maxLength={200} value={draft.customerReference ?? ''} placeholder="Nombre, alias o WhatsApp (opcional por ahora)" onChange={e => updateDraft(current => ({ ...current, customerReference: e.target.value }))} /></label>
          <label>Qué se va a imprimir (opcional)<input maxLength={1000} value={draft.description ?? ''} placeholder="Ej.: Soporte para auriculares" onChange={e => updateDraft(current => ({ ...current, description: e.target.value }))} /></label></div> : null}
        <div className="input-group">
          <FilamentPicker filaments={filaments} value={draft.spoolId} loading={!filamentsLoaded && online} disabled={!online}
            error={touched.filament ? validationErrors.filament : undefined}
            onChange={id => { setTouched(current => ({ ...current, filament: true })); updateDraft(current => ({ ...current, spoolId: id })); }} />
          {filamentsLoaded && filaments.length === 0 ? <div className="inline-empty"><strong>Agregá tu primer filamento para empezar a cotizar.</strong></div> : null}
          <button type="button" className="inline-add" onClick={() => setAddFilamentOpen(true)}><Plus size={18} aria-hidden="true" />Agregar filamento</button>
        </div>
        <fieldset className="input-group"><legend>Tiempo de impresión</legend><div className="duration-fields">
          <label htmlFor="quick-hours">Horas<input ref={hoursInput} id="quick-hours" aria-label="Horas de impresión" aria-invalid={Boolean(touched.hours && (validationErrors.hours || validationErrors.duration))} aria-describedby={touched.hours && validationErrors.hours ? 'quick-hours-error' : touched.duration && validationErrors.duration ? 'quick-duration-error' : undefined} type="number" inputMode="numeric" min="0" step="1" value={draft.hours || ''} onChange={event => { setTouched(current => ({ ...current, hours: true, duration: true })); updateDraft(current => ({ ...current, hours: Number(event.target.value) })); }} />{touched.hours && validationErrors.hours ? <small id="quick-hours-error" className="field-error">{validationErrors.hours}</small> : null}</label>
          <label htmlFor="quick-minutes">Minutos<input id="quick-minutes" aria-label="Minutos de impresión" aria-invalid={Boolean(touched.minutes && (validationErrors.minutes || validationErrors.duration))} aria-describedby={touched.minutes && validationErrors.minutes ? 'quick-minutes-error' : touched.duration && validationErrors.duration ? 'quick-duration-error' : undefined} type="number" inputMode="numeric" min="0" max="59" step="1" value={draft.minutes || ''} onChange={event => { setTouched(current => ({ ...current, minutes: true, duration: true })); updateDraft(current => ({ ...current, minutes: Number(event.target.value) })); }} />{touched.minutes && validationErrors.minutes ? <small id="quick-minutes-error" className="field-error">{validationErrors.minutes}</small> : null}</label>
        </div>{touched.duration && validationErrors.duration ? <small id="quick-duration-error" className="field-error">{validationErrors.duration}</small> : null}</fieldset>
        <div className="input-group">
          <label htmlFor="quick-grams">Gramos totales del slicer</label>
          <input id="quick-grams" type="number" inputMode="decimal" min="0.01" step="0.01" aria-invalid={Boolean(touched.grams && validationErrors.grams)} aria-describedby={touched.grams && validationErrors.grams ? 'quick-grams-error' : 'quick-grams-help'} value={draft.totalGrams || ''} onChange={event => { setTouched(current => ({ ...current, grams: true })); updateDraft(current => ({ ...current, totalGrams: Number(event.target.value) })); }} required />
          {touched.grams && validationErrors.grams ? <small id="quick-grams-error" className="field-error">{validationErrors.grams}</small> : null}
          <small id="quick-grams-help">Incluí soportes y purga.</small>
        </div>
        <button type="submit" disabled={loading || !online || !filamentsLoaded}>{loading ? 'Calculando…' : 'Calcular precio'}</button>
        <p className="auto-calc-note">El precio se actualiza automáticamente cuando cambiás un dato.</p>
        {canSaveOrders ? <div className="quick-order-save" role="status">{!online ? 'Pendiente de guardar. Conservamos tus datos en este navegador.' : loading && session.active.current ? 'Calculando y guardando presupuesto…' : saveError ? <><span>No se guardó el presupuesto. </span><button type="button" className="secondary" onClick={() => void calculate()}>Reintentar guardado</button></> : savedOrder ? <>Borrador guardado en Presupuestos · <a href={`/quotes/pending/${savedOrder.id}`} onClick={e => { e.preventDefault(); navigate(`/quotes/pending/${savedOrder.id}`); }}>Abrir presupuesto</a></> : 'Cada cotización se guarda en Presupuestos, pendiente de aceptación.'}</div> : null}
        {!breakdown ? <button type="button" className="quiet" onClick={startAgain}><RotateCcw size={18} aria-hidden="true" />Nuevo cálculo</button> : null}
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
              {result.canUsePrice ? <button type="button" className="share-client-action" disabled={loading || !online} onClick={() => void shareBudget()}><Share2 size={18} aria-hidden="true" />Compartir con cliente</button> : null}
              {canSaveOrders ? <button type="button" className="secondary" disabled={loading || !online} onClick={() => { if (savedOrder) navigate(`/quotes/pending/${savedOrder.id}`); else { sessionRef.current.start(); void calculate(); } }}><Save size={18} aria-hidden="true" />{savedOrder ? 'Ver presupuesto' : 'Guardar presupuesto'}</button> : <button type="button" className="secondary" onClick={() => setSaveQuoteOpen(true)} disabled={loading || !online || !result.advancedRequest}><Save size={18} aria-hidden="true" />Guardar presupuesto</button>}
              {result.canUsePrice ? <button type="button" className="secondary" onClick={() => void copyPrice()}><Clipboard size={18} aria-hidden="true" />Copiar precio</button> : null}
              {canSaveOrders && result.canUsePrice ? <button type="button" className="secondary" disabled={loading || !online} onClick={() => void copyPrice(true)}>Copiar presupuesto</button> : null}
              <button type="button" className="secondary" onClick={openAdvanced} disabled={!result.advancedRequest}><SlidersHorizontal size={18} aria-hidden="true" />Necesito ajustar algo</button>
              <button type="button" className="quiet" onClick={startAgain}><RotateCcw size={18} aria-hidden="true" />Nuevo cálculo</button>
            </div>
          </>}
      </article>
    </div>
    <NewFilamentDialog open={addFilamentOpen} onClose={() => setAddFilamentOpen(false)} onCreated={filament => {
      setFilaments(current => [...current, filament]);
      updateDraft(current => ({ ...current, spoolId: filament.id }));
      setFilamentNotice(null);
      setMessage('Filamento guardado y seleccionado.');
    }} />
    <SaveQuoteDialog open={saveQuoteOpen} advancedRequest={result?.advancedRequest ?? null} onClose={() => setSaveQuoteOpen(false)} onSaved={code => setMessage(`${code} se guardó en Presupuestos como borrador.`)} />
    <ClientQuoteShareDialog
      open={shareQuoteOpen && Boolean(result?.canUsePrice && breakdown && selectedFilament)}
      quote={result?.canUsePrice && breakdown && selectedFilament ? {
        totalGs: breakdown.customerTotalGs,
        customerReference: draft.customerReference,
        description: draft.description,
        material: selectedFilament.material,
        color: selectedFilament.color,
        totalGrams: draft.totalGrams,
        printDurationMinutes: draft.hours * 60 + draft.minutes
      } : null}
      onClose={() => setShareQuoteOpen(false)}
    />
  </section>;
}
