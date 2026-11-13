import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Plus, RotateCcw, Save, Share2, SlidersHorizontal } from 'lucide-react';
import { ApiError, get, post } from '../api/client';
import type { Filament, QuickQuotePreviewResponse } from '../api/types';
import { navigate } from '../components/AppShell';
import { PriceWarnings } from '../components/PriceWarnings';
import { formatDecimal, formatPrintDuration, formatPyg } from '../utils/format';
import { buildClientQuoteText } from '../utils/clientQuote';
import { NewFilamentDialog, SaveQuoteDialog } from '../components/QuickQuoteDialogs';
import { ClientQuoteShareDialog } from '../components/ClientQuoteShareDialog';
import { useQuickOrderSession } from '../hooks/useQuickOrderSession';
import { FilamentPicker } from '../components/FilamentPicker';
import type { Order } from '../api/orders';

export const QUICK_DRAFT_KEY = 'printcost.quick-quote-draft.v1';
export const QUICK_TO_ADVANCED_KEY = 'printcost.quick-to-advanced.v1';

interface QuickPlate { spoolId: string; hours: number; minutes: number; totalGrams: number; repetitions: number | null; }
interface AddedPlate extends QuickPlate { id: string; }
interface QuickDraft extends QuickPlate { additionalPlates: AddedPlate[]; customerReference?: string; description?: string; }
type QuickField = 'filament' | 'hours' | 'minutes' | 'duration' | 'grams' | 'repetitions';
type PlateErrors = Partial<Record<QuickField, string>>;
type PlateTouched = Partial<Record<QuickField, boolean>>;
const emptyPlate: QuickPlate = { spoolId: '', hours: 0, minutes: 0, totalGrams: 0, repetitions: 1 };
const emptyDraft: QuickDraft = { ...emptyPlate, additionalPlates: [] };
const firstPlate = 'first';
const maxRepetitions = 2_147_483_647;
const platePrefix = (id: string) => id === firstPlate ? 'quick' : `quick-plate-${id}`;
const printMinutes = (plate: QuickPlate) => plate.hours * 60 + plate.minutes;
const toCalculation = (plate: QuickPlate) => ({
  spoolId: plate.spoolId, printDurationMinutes: printMinutes(plate), totalGrams: plate.totalGrams,
  ...(plate.repetitions !== null && plate.repetitions !== 1 ? { repetitions: plate.repetitions } : {})
});
const quoteCalculation = (draft: QuickDraft) => ({
  ...toCalculation(draft),
  ...(draft.additionalPlates.length ? { additionalPlates: draft.additionalPlates.map(toCalculation) } : {})
});

export const quickQuoteInputKey = (draft: QuickDraft) =>
  JSON.stringify([quoteCalculation(draft), draft.customerReference ?? '', draft.description ?? '']);

export function restoreQuickDraft(storage: Pick<Storage, 'getItem'> = localStorage): QuickDraft {
  try {
    const restored = JSON.parse(storage.getItem(QUICK_DRAFT_KEY) ?? '{}') as Partial<QuickDraft>;
    const ids = new Set([firstPlate]);
    const additionalPlates = Array.isArray(restored.additionalPlates)
      ? restored.additionalPlates.filter(plate => plate && typeof plate === 'object').map(plate => {
        const id = typeof plate.id === 'string' && plate.id && !ids.has(plate.id) ? plate.id : crypto.randomUUID();
        ids.add(id);
        return { ...emptyPlate, ...plate, id };
      })
      : [];
    return { ...emptyDraft, ...restored, additionalPlates };
  }
  catch { return emptyDraft; }
}

function validatePlate(plate: QuickPlate, activeIds: Set<string>, filamentsLoaded: boolean) {
  const errors: PlateErrors = {};
  if (!plate.spoolId || (filamentsLoaded && !activeIds.has(plate.spoolId)))
    errors.filament = 'Elegí un filamento activo.';
  if (!Number.isInteger(plate.hours)) errors.hours = 'Ingresá horas completas.';
  else if (plate.hours < 0) errors.hours = 'Las horas no pueden ser negativas.';
  if (!Number.isInteger(plate.minutes) || plate.minutes < 0 || plate.minutes > 59)
    errors.minutes = 'Los minutos deben estar entre 0 y 59.';
  if (!errors.hours && !errors.minutes) {
    const duration = printMinutes(plate);
    if (duration <= 0) errors.duration = 'El tiempo total debe ser mayor que cero.';
    else if (duration > 2_147_483_647) errors.duration = 'El tiempo de impresión es demasiado largo.';
  }
  if (!Number.isFinite(plate.totalGrams) || plate.totalGrams <= 0)
    errors.grams = 'Ingresá una cantidad de gramos mayor que cero.';
  if (plate.repetitions === null || !Number.isInteger(plate.repetitions) || plate.repetitions < 1)
    errors.repetitions = 'Ingresá un número entero mayor que cero.';
  else if (plate.repetitions > maxRepetitions)
    errors.repetitions = 'La cantidad de este plato es demasiado alta.';
  return errors;
}

function QuickPlateFields({ plate, id, number, filaments, filamentsLoaded, online, touched = {}, errors,
  onEdit, onAddFilament }: {
  plate: QuickPlate; id: string; number: number; filaments: Filament[]; filamentsLoaded: boolean; online: boolean;
  touched?: PlateTouched; errors: PlateErrors; onEdit: (field: QuickField, patch: Partial<QuickPlate>) => void;
  onAddFilament?: () => void;
}) {
  const prefix = platePrefix(id);
  const suffix = number > 1 ? ` del plato ${number}` : '';
  const durationError = touched.duration && errors.duration;
  const hoursError = touched.hours && errors.hours;
  const minutesError = touched.minutes && errors.minutes;
  const gramsError = touched.grams && errors.grams;
  const repetitionsError = touched.repetitions && errors.repetitions;
  return <>
    <div className="plate-heading">
      <h2 id={`${prefix}-heading`}>Plato {number}</h2>
      <label className="plate-repetition-count">Cantidad
        <input id={`${prefix}-repetitions`} aria-label={`Cantidad${suffix}`} type="number" inputMode="numeric"
          min="1" max={maxRepetitions} step="1" value={plate.repetitions ?? ''} required
          aria-invalid={Boolean(repetitionsError)} aria-describedby={repetitionsError ? `${prefix}-repetitions-error` : undefined}
          onChange={event => onEdit('repetitions', { repetitions: event.target.value === '' ? null : Number(event.target.value) })} />
      </label>
    </div>
    {repetitionsError ? <small id={`${prefix}-repetitions-error`} className="field-error">{repetitionsError}</small> : null}
    <div className="input-group" id={`${prefix}-filament`}>
      <FilamentPicker filaments={filaments} value={plate.spoolId} loading={!filamentsLoaded && online} disabled={!online} hideRecentWhenClosed={number > 1}
        error={touched.filament ? errors.filament : undefined} onChange={spoolId => onEdit('filament', { spoolId })} />
      {onAddFilament && filamentsLoaded && filaments.length === 0 ? <div className="inline-empty"><strong>Agregá tu primer filamento para empezar a cotizar.</strong></div> : null}
      {onAddFilament ? <button type="button" className="inline-add" onClick={onAddFilament}><Plus size={18} aria-hidden="true" />Agregar filamento</button> : null}
    </div>
    <fieldset className="input-group">
      <legend>Tiempo de impresión</legend>
      <div className="duration-fields">
        <label htmlFor={`${prefix}-hours`}>Horas
          <input id={`${prefix}-hours`} aria-label={`Horas de impresión${suffix}`} aria-invalid={Boolean(hoursError || durationError)}
            aria-describedby={hoursError ? `${prefix}-hours-error` : durationError ? `${prefix}-duration-error` : undefined}
            type="number" inputMode="numeric" min="0" step="1" value={plate.hours || ''}
            onChange={event => onEdit('hours', { hours: Number(event.target.value) })} />
          {hoursError ? <small id={`${prefix}-hours-error`} className="field-error">{hoursError}</small> : null}
        </label>
        <label htmlFor={`${prefix}-minutes`}>Minutos
          <input id={`${prefix}-minutes`} aria-label={`Minutos de impresión${suffix}`} aria-invalid={Boolean(minutesError || durationError)}
            aria-describedby={minutesError ? `${prefix}-minutes-error` : durationError ? `${prefix}-duration-error` : undefined}
            type="number" inputMode="numeric" min="0" max="59" step="1" value={plate.minutes || ''}
            onChange={event => onEdit('minutes', { minutes: Number(event.target.value) })} />
          {minutesError ? <small id={`${prefix}-minutes-error`} className="field-error">{minutesError}</small> : null}
        </label>
      </div>
      {durationError ? <small id={`${prefix}-duration-error`} className="field-error">{durationError}</small> : null}
    </fieldset>
    <div className="input-group">
      <label htmlFor={`${prefix}-grams`}>Gramos totales del slicer</label>
      <input id={`${prefix}-grams`} aria-label={`Gramos totales del slicer${suffix}`} type="number" inputMode="decimal"
        min="0.01" step="0.01" aria-invalid={Boolean(gramsError)}
        aria-describedby={gramsError ? `${prefix}-grams-error` : `${prefix}-grams-help`} value={plate.totalGrams || ''}
        onChange={event => onEdit('grams', { totalGrams: Number(event.target.value) })} required />
      {gramsError ? <small id={`${prefix}-grams-error`} className="field-error">{gramsError}</small> : null}
      <small id={`${prefix}-grams-help`}>Por plato, con soportes y purga.</small>
    </div>
  </>;
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
  const [touched, setTouched] = useState<Record<string, PlateTouched>>({});
  const requestNumber = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  const focusAfterPlateChange = useRef<string | null>(null);

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
    if (userEdit) {
      sessionRef.current.start();
      setSaveError(false);
      setMessage(null);
    }
    invalidatePreview();
    setDraft(update);
  }, [invalidatePreview]);

  useLayoutEffect(() => {
    const id = focusAfterPlateChange.current;
    if (id) document.getElementById(id)?.focus();
    focusAfterPlateChange.current = null;
  }, [draft.additionalPlates]);

  function editPlate(id: string, field: QuickField, patch: Partial<QuickPlate>) {
    setTouched(current => ({
      ...current,
      [id]: { ...current[id], [field]: true, ...(field === 'hours' || field === 'minutes' ? { duration: true } : {}) }
    }));
    updateDraft(current => id === firstPlate ? { ...current, ...patch } : {
      ...current, additionalPlates: current.additionalPlates.map(plate => plate.id === id ? { ...plate, ...patch } : plate)
    });
  }

  function addPlate() {
    const id = crypto.randomUUID();
    focusAfterPlateChange.current = `${platePrefix(id)}-hours`;
    updateDraft(current => ({
      ...current, additionalPlates: [...current.additionalPlates, { ...emptyPlate, id, spoolId: current.spoolId }]
    }));
  }

  function removePlate(id: string) {
    focusAfterPlateChange.current = 'quick-add-plate';
    setTouched(current => {
      const remaining = { ...current };
      delete remaining[id];
      return remaining;
    });
    updateDraft(current => ({ ...current, additionalPlates: current.additionalPlates.filter(plate => plate.id !== id) }));
  }

  useEffect(() => {
    localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(draft));
    if (canSaveOrders) sessionStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(draft));
  }, [draft, canSaveOrders]);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) invalidatePreview();
    };
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [invalidatePreview]);
  useEffect(() => {
    if (!online) return;
    setFilamentsLoaded(false);
    setFilamentNotice(null);
    invalidatePreview();
    let currentCatalog = true;
    get<Filament[]>('/api/filaments').then(rows => {
      if (!currentCatalog) return;
      const active = rows.filter(row => row.isActive);
      const activeIds = new Set(active.map(row => row.id));
      setFilaments(active);
      updateDraft(current => {
        const notices: string[] = [];
        function resolveSpool(spoolId: string, suffix = '') {
          if (activeIds.has(spoolId)) return spoolId;
          if (spoolId) notices.push(`El filamento guardado${suffix} ya no está disponible. ${active[0]
            ? `Seleccionamos ${active[0].material} ${active[0].color}.`
            : 'Agregá un filamento para continuar.'}`);
          return active[0]?.id ?? '';
        }
        const spoolId = resolveSpool(current.spoolId);
        const additionalPlates = current.additionalPlates.map((plate, index) => ({
          ...plate, spoolId: resolveSpool(plate.spoolId, ` del plato ${index + 2}`)
        }));
        setFilamentNotice(notices.length ? notices.join(' ') : null);
        return { ...current, spoolId, additionalPlates };
      }, false);
      setFilamentsLoaded(true);
    }).catch((reason: unknown) => {
      if (!currentCatalog) return;
      setMessage(reason instanceof Error ? reason.message : 'No pudimos cargar los filamentos.');
      setFilamentsLoaded(false);
    });
    return () => { currentCatalog = false; };
  }, [invalidatePreview, online, updateDraft]);

  const validationErrors = useMemo(() => {
    const active = new Set(filaments.map(row => row.id));
    return new Map([
      [firstPlate, validatePlate(draft, active, filamentsLoaded)],
      ...draft.additionalPlates.map(plate => [plate.id, validatePlate(plate, active, filamentsLoaded)] as const)
    ]);
  }, [draft, filaments, filamentsLoaded]);
  const firstInvalid = [...validationErrors].find(([, errors]) => Object.keys(errors).length);
  const isValid = filamentsLoaded && !firstInvalid;
  const calculate = useCallback(async () => {
    if (!online || !navigator.onLine) { setMessage('Recuperamos tu borrador. El precio se verificará cuando vuelvas a tener conexión.'); return; }
    if (!isValid) {
      const allTouched = { filament: true, hours: true, minutes: true, duration: true, grams: true, repetitions: true };
      setTouched(Object.fromEntries([firstPlate, ...draft.additionalPlates.map(plate => plate.id)].map(id => [id, allTouched])));
      if (firstInvalid) {
        const [id, errors] = firstInvalid;
        const field = errors.filament ? 'filament' : errors.hours || errors.duration ? 'hours' : errors.minutes ? 'minutes' : errors.grams ? 'grams' : 'repetitions';
        const input = document.getElementById(`${platePrefix(id)}-${field}`);
        (field === 'filament' ? input?.querySelector('button') : input)?.focus();
      }
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    const currentRequest = ++requestNumber.current;
    const inputKey = quickQuoteInputKey(draft);
    setLoading(true); setMessage(null); setSaveError(false);
    try {
      const calculation = quoteCalculation(draft);
      await sessionRef.current.ready();
      const persist = canSaveOrders && sessionRef.current.active.current;
      let preview: QuickQuotePreviewResponse;
      let order: Order | null = null;
      if (persist) {
        const body = { calculation, customerReference: draft.customerReference || null, description: draft.description || null };
        const save = async () => {
          const identity = await sessionRef.current.next(body);
          return post<{ preview: QuickQuotePreviewResponse; order: Order | null }>('/api/orders/quick', { ...body, ...identity }, { signal: controller.signal });
        };
        let saved;
        try {
          saved = await save();
        } catch (reason) {
          if (!(reason instanceof ApiError && reason.status === 409 && reason.code === 'quick_session_closed')
            || controller.signal.aborted || currentRequest !== requestNumber.current) throw reason;
          const edited = sessionRef.current.edited.current;
          sessionRef.current.reset();
          if (edited) {
            sessionRef.current.start();
            saved = await save();
          } else {
            saved = { preview: await post<QuickQuotePreviewResponse>('/api/calculations/quick-quote-preview', calculation, { signal: controller.signal }), order: null };
          }
        }
        preview = saved.preview; order = saved.order;
      } else preview = await post<QuickQuotePreviewResponse>('/api/calculations/quick-quote-preview', calculation, { signal: controller.signal });
      if (currentRequest === requestNumber.current
        && !controller.signal.aborted
        && quickQuoteInputKey(draftRef.current) === inputKey) { setResult(preview); setSavedOrder(order); return { preview, order }; }
    } catch (reason) {
      if (controller.signal.aborted) return;
      if (currentRequest === requestNumber.current) {
        const closed = reason instanceof ApiError && reason.status === 409 && reason.code === 'quick_session_closed';
        setSaveError(canSaveOrders);
        setMessage(closed
          ? 'No pudimos retomar el guardado. Conservamos todos tus platos. Reintentá guardar el presupuesto.'
          : reason instanceof Error ? reason.message : 'No pudimos calcular y guardar el presupuesto.');
      }
    } finally {
      if (currentRequest === requestNumber.current && quickQuoteInputKey(draftRef.current) === inputKey) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [draft, isValid, firstInvalid, online, canSaveOrders]);

  useEffect(() => {
    if (!isValid || !online) return;
    const timeout = window.setTimeout(() => void calculate(), 450);
    return () => window.clearTimeout(timeout);
  }, [calculate, isValid, online]);
  useEffect(() => () => activeRequest.current?.abort(), []);

  const openAdvanced = async () => {
    if (result?.advancedLines?.length) {
      if (canSaveOrders && result.canUsePrice) {
        sessionRef.current.start();
        const saved = await calculate();
        if (saved?.order) navigate(`/quotes/pending/${encodeURIComponent(saved.order.id)}/adjust`);
      } else {
        localStorage.setItem(QUICK_TO_ADVANCED_KEY, JSON.stringify({ lines: result.advancedLines }));
        navigate('/quotes/new');
      }
      return;
    }
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
    if (!result?.canUsePrice || !(result.aggregateBreakdown ?? result.breakdown)) return;
    const inputKey = quickQuoteInputKey(draft);
    const authoritative = await ensureSaved();
    const authoritativeBreakdown = authoritative?.aggregateBreakdown ?? authoritative?.breakdown;
    if (!authoritative?.canUsePrice || !authoritativeBreakdown || inputKey !== quickQuoteInputKey(draftRef.current)) return;
    const text = buildClientQuoteText(authoritativeBreakdown.customerTotalGs, full ? draft.customerReference : undefined, full ? draft.description : undefined);
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
    window.setTimeout(() => document.getElementById('quick-hours')?.focus(), 0);
  };

  const breakdown = result?.aggregateBreakdown ?? result?.breakdown;
  const selectedFilament = filaments.find(row => row.id === draft.spoolId);
  const hasAdditionalPlates = draft.additionalPlates.length > 0;
  const { plateCount, totalGrams, totalMinutes } = [draft, ...draft.additionalPlates].reduce((totals, plate) => {
    const repetitions = plate.repetitions ?? 0;
    return { plateCount: totals.plateCount + repetitions, totalGrams: totals.totalGrams + plate.totalGrams * repetitions,
      totalMinutes: totals.totalMinutes + printMinutes(plate) * repetitions };
  }, { plateCount: 0, totalGrams: 0, totalMinutes: 0 });
  const differentFilaments = hasAdditionalPlates && draft.additionalPlates.some(plate => {
    const filament = filaments.find(row => row.id === plate.spoolId);
    return filament?.material !== selectedFilament?.material || filament?.color !== selectedFilament?.color;
  });
  const materialSummary = differentFilaments ? 'Varios filamentos' : undefined;
  const canContinue = Boolean(result?.advancedLines?.length || result?.advancedRequest);
  const budgetPath = savedOrder ? `/quotes/pending/${encodeURIComponent(savedOrder.id)}` : null;
  return <section className="page quick-quote-page">
    <div className="quick-heading">
      <div><h1>¿Cuánto cobrar?</h1><p>Elegí el filamento, cargá el tiempo y los gramos.</p></div>
      <span className={`connection ${online ? 'online' : 'offline'}`}>{online ? 'Conectado' : 'Sin conexión'}</span>
    </div>
    {!online ? <p className="warning" role="status">Tu borrador sigue disponible. No mostramos un precio como verificado hasta reconectar.</p> : null}
    {filamentNotice ? <p className="notice" role="status">{filamentNotice}</p> : null}
    {message ? <p className="notice" role="status">{message}</p> : null}

    <div className="quick-quote-grid">
      <form className="quick-form" aria-label="Datos para cotizar" noValidate onSubmit={event => { event.preventDefault(); sessionRef.current.start(); void calculate(); }}>
        <QuickPlateFields plate={draft} id={firstPlate} number={1} filaments={filaments} filamentsLoaded={filamentsLoaded} online={online}
          touched={touched[firstPlate]} errors={validationErrors.get(firstPlate) ?? {}}
          onEdit={(field, patch) => editPlate(firstPlate, field, patch)} onAddFilament={() => setAddFilamentOpen(true)} />
        {draft.additionalPlates.map((plate, index) => <fieldset className="quick-plate" key={plate.id} aria-labelledby={`${platePrefix(plate.id)}-heading`}>
          <QuickPlateFields plate={plate} id={plate.id} number={index + 2} filaments={filaments} filamentsLoaded={filamentsLoaded} online={online}
            touched={touched[plate.id]} errors={validationErrors.get(plate.id) ?? {}}
            onEdit={(field, patch) => editPlate(plate.id, field, patch)} />
          <button type="button" className="quiet quick-remove-plate" onClick={() => removePlate(plate.id)}>Quitar plato {index + 2}</button>
        </fieldset>)}
        <button type="button" id="quick-add-plate" className="secondary quick-add-plate" onClick={addPlate}>
          <Plus size={18} aria-hidden="true" />Agregar plato
        </button>
        <button type="submit" disabled={loading || !online || !filamentsLoaded}>{loading ? 'Calculando…' : 'Calcular precio'}</button>
        <p className="auto-calc-note">El precio se actualiza automáticamente cuando cambiás un dato.</p>
        {!breakdown ? <button type="button" className="quiet" onClick={startAgain}><RotateCcw size={18} aria-hidden="true" />Nuevo cálculo</button> : null}
      </form>

      <article className="price-widget" aria-live="polite" aria-busy={loading}>
        <header><h2>Precio recomendado</h2></header>
        {canSaveOrders ? <div className="quick-order-save">
          {!online ? 'Pendiente de guardar. Conservamos tus datos en este navegador.'
            : loading && session.active.current ? 'Calculando y guardando presupuesto…'
            : saveError ? <><span>No se guardó el presupuesto.</span><button type="button" className="secondary" onClick={() => void calculate()}>Reintentar guardado</button></>
            : budgetPath ? <><span>Guardado en Presupuestos</span><a href={budgetPath} onClick={event => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault(); navigate(budgetPath);
            }}>Abrir presupuesto</a></>
            : 'Al completar la cotización, se guarda en Presupuestos como pendiente de aceptación.'}
        </div> : null}
        {loading && !breakdown ? <div className="result-empty" role="status"><span className="loading-mark" aria-hidden="true" />Calculando el mejor precio…</div>
          : result && !breakdown ? <div className="result-empty"><h3>No podemos darte un precio todavía</h3><PriceWarnings warnings={result.warnings} /><button type="button" onClick={() => navigate('/settings')}>Revisar ajustes</button></div>
          : !result || !breakdown ? <div className="result-empty"><strong>{hasAdditionalPlates ? 'Completá los datos de cada plato' : 'Completá los tres datos'}</strong><span>El precio aparecerá acá.</span></div>
          : <>
            {!result.canUsePrice ? <div className="incomplete-heading"><h3>Precio pendiente de revisión</h3><p>Resolvé los avisos antes de compartirlo.</p></div> : null}
            <div className="dominant-price"><span>{result.canUsePrice ? 'Podés cobrar' : 'Estimación'}</span><strong>{formatPyg(breakdown.customerTotalGs)}</strong>
              {plateCount > 1 ? <small>{plateCount} platos · {formatDecimal(totalGrams)} g · {formatPrintDuration(totalMinutes)}</small> : null}
              {result.canUsePrice ? <small>Ya incluye costos, imprevistos y ganancia.</small> : null}
              {selectedFilament ? <small>{materialSummary ?? `Filamento usado: ${selectedFilament.material} · ${selectedFilament.color}`}</small> : null}
            </div>
            <PriceWarnings warnings={result.warnings} />
            <details className="breakdown-details"><summary>Ver cómo se calculó</summary>
              <dl className="human-breakdown">
                <div><dt>Material</dt><dd>{formatPyg(breakdown.materialCostGs)}</dd></div>
                <div><dt>Impresión</dt><dd>{formatPyg('energyCostGs' in breakdown ? breakdown.energyCostGs + breakdown.machineCostGs : breakdown.energy.costGs + breakdown.machine.costGs)}</dd></div>
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
              {!budgetPath ? <button type="button" className="secondary" disabled={loading || !online || !canContinue} onClick={() => {
                if (canSaveOrders) { sessionRef.current.start(); void calculate(); }
                else setSaveQuoteOpen(true);
              }}><Save size={18} aria-hidden="true" />Guardar presupuesto</button> : null}
              {result.canUsePrice ? <button type="button" className="secondary" onClick={() => void copyPrice()}><Clipboard size={18} aria-hidden="true" />Copiar precio</button> : null}
              {canSaveOrders && result.canUsePrice ? <button type="button" className="secondary" disabled={loading || !online} onClick={() => void copyPrice(true)}>Copiar presupuesto</button> : null}
              {budgetPath ? <a href={`${budgetPath}/adjust`} className="secondary" onClick={event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); navigate(`${budgetPath}/adjust`);
              }}><SlidersHorizontal size={18} aria-hidden="true" />Ajustar este presupuesto</a>
                : <button type="button" className="secondary" onClick={() => void openAdvanced()} disabled={loading || !online || !canContinue}><SlidersHorizontal size={18} aria-hidden="true" />Necesito ajustar algo</button>}
              <button type="button" className="quiet" onClick={startAgain}><RotateCcw size={18} aria-hidden="true" />Nuevo cálculo</button>
            </div>
          </>}
      </article>
      {canSaveOrders ? <section className="quick-order-fields" aria-labelledby="quick-customer-heading">
        <h2 id="quick-customer-heading">Datos para el presupuesto</h2>
        <label>Cliente / referencia<input aria-label="Cliente / referencia" aria-describedby="quick-customer-help" maxLength={200} value={draft.customerReference ?? ''} placeholder="Nombre, alias o WhatsApp" onChange={e => updateDraft(current => ({ ...current, customerReference: e.target.value }))} />
          <small id="quick-customer-help">Opcional al guardar, necesaria para confirmar el pedido.</small>
        </label>
        <label>Qué se va a imprimir (opcional)<input maxLength={1000} value={draft.description ?? ''} placeholder="Ej.: Soporte para auriculares" onChange={e => updateDraft(current => ({ ...current, description: e.target.value }))} /></label>
      </section> : null}
    </div>
    <NewFilamentDialog open={addFilamentOpen} onClose={() => setAddFilamentOpen(false)} onCreated={filament => {
      setFilaments(current => [...current, filament]);
      updateDraft(current => ({ ...current, spoolId: filament.id }));
      setFilamentNotice(null);
      setMessage('Filamento guardado y seleccionado.');
    }} />
    <SaveQuoteDialog open={saveQuoteOpen} advancedRequest={result?.advancedRequest ?? null} advancedLines={result?.advancedLines}
      onClose={() => setSaveQuoteOpen(false)} onSaved={code => setMessage(`${code} se guardó en Presupuestos como borrador.`)} />
    <ClientQuoteShareDialog
      open={shareQuoteOpen && Boolean(result?.canUsePrice && breakdown && selectedFilament)}
      quote={result?.canUsePrice && breakdown && selectedFilament ? {
        totalGs: breakdown.customerTotalGs,
        customerReference: draft.customerReference,
        description: draft.description,
        material: selectedFilament.material,
        color: selectedFilament.color,
        materialSummary,
        plateCount,
        totalGrams,
        printDurationMinutes: totalMinutes
      } : null}
      onClose={() => setShareQuoteOpen(false)}
    />
  </section>;
}
