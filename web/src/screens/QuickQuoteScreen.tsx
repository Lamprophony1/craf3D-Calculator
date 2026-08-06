import { useEffect, useState } from 'react';
import { get, post } from '../api/client';
import type { Filament, QuickQuotePreviewResponse } from '../api/types';
import { navigate } from '../components/AppShell';
import { formatDecimal, formatPyg } from '../utils/format';

export const QUICK_DRAFT_KEY = 'printcost.quick-quote-draft.v1';
export const QUICK_TO_ADVANCED_KEY = 'printcost.quick-to-advanced.v1';

interface QuickDraft {
  spoolId: string;
  hours: number;
  minutes: number;
  totalGrams: number;
}

const emptyDraft: QuickDraft = { spoolId: '', hours: 0, minutes: 0, totalGrams: 0 };

export function restoreQuickDraft(storage: Pick<Storage, 'getItem'> = localStorage): QuickDraft {
  try {
    const stored = JSON.parse(storage.getItem(QUICK_DRAFT_KEY) ?? '{}') as Partial<QuickDraft>;
    return { ...emptyDraft, ...stored };
  } catch {
    return emptyDraft;
  }
}

export function QuickQuoteScreen() {
  const [draft, setDraft] = useState<QuickDraft>(() => restoreQuickDraft());
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [result, setResult] = useState<QuickQuotePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (!online) return;
    get<Filament[]>('/api/filaments').then(rows => {
      const active = rows.filter(x => x.isActive);
      setFilaments(active);
      setDraft(current => ({ ...current, spoolId: current.spoolId || active[0]?.id || '' }));
    }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'No se pudieron cargar los filamentos.'));
  }, [online]);

  const calculate = async () => {
    if (!online) {
      setMessage('Sin conexión: recuperamos el borrador local, pero no existe una sesión ni un precio verificados.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const preview = await post<QuickQuotePreviewResponse>('/api/calculations/quick-quote-preview', {
        spoolId: draft.spoolId,
        printDurationMinutes: draft.hours * 60 + draft.minutes,
        totalGrams: draft.totalGrams
      });
      setResult(preview);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo calcular la cotización rápida.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!result?.advancedRequest || !online) return;
    setLoading(true);
    try {
      const quote = await post<{ code: string }>('/api/quotes', {
        calculation: result.advancedRequest,
        customerId: null,
        validUntil: null,
        notes: 'Creada desde cotización rápida',
        terms: null
      });
      setMessage(`${quote.code} guardada como borrador.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo guardar la cotización.');
    } finally {
      setLoading(false);
    }
  };

  const openAdvanced = () => {
    if (!result?.advancedRequest) return;
    localStorage.setItem(QUICK_TO_ADVANCED_KEY, JSON.stringify(result.advancedRequest));
    navigate('/calculator');
  };

  const share = async () => {
    if (!result?.canUsePrice || !result.breakdown) return;
    const text = `Cotización de impresión 3D: ${formatPyg(result.breakdown.customerTotalGs)}. Costo completo: ${formatPyg(result.breakdown.fullyLoadedCostGs)}. Margen: ${formatDecimal(result.breakdown.achievedMarginPercent)}%.`;
    if (navigator.share) await navigator.share({ title: 'Cotización 3D', text });
    else await navigator.clipboard.writeText(text);
    setMessage('Resumen compartido o copiado.');
  };

  const breakdown = result?.breakdown;
  return <section className="page quick-quote-page">
    <div className="page-heading"><div><h1>Cotización rápida</h1><p>Tres datos del slicer; todos los demás costos se resuelven en el servidor.</p></div>
      <span className={`connection ${online ? 'online' : 'offline'}`}>{online ? 'En línea' : 'Sin conexión'}</span></div>
    {!online ? <p className="warning" role="status">Borrador local disponible. La sesión y el precio no se consideran verificados hasta reconectar.</p> : null}
    {message ? <p className="warning" role="status">{message}</p> : null}
    <div className="quick-quote-grid">
      <form className="card quick-form" aria-label="Cotización rápida" onSubmit={event => { event.preventDefault(); void calculate(); }}>
        <label>Filamento
          <select value={draft.spoolId} onChange={event => setDraft(current => ({ ...current, spoolId: event.target.value }))} required>
            <option value="">Seleccioná un filamento</option>
            {filaments.map(row => <option key={row.id} value={row.id}>{row.material} · {row.color} · {formatDecimal(row.remainingWeightGrams, 0)} g</option>)}
          </select>
        </label>
        <fieldset><legend>Tiempo de impresión</legend><div className="duration-fields">
          <label>Horas<input aria-label="Horas de impresión" type="number" min="0" step="1" value={draft.hours} onChange={event => setDraft(current => ({ ...current, hours: Number(event.target.value) }))} /></label>
          <label>Minutos<input aria-label="Minutos de impresión" type="number" min="0" max="59" step="1" value={draft.minutes} onChange={event => setDraft(current => ({ ...current, minutes: Number(event.target.value) }))} /></label>
        </div></fieldset>
        <label>Gramos totales del slicer
          <input type="number" min="0.01" step="0.01" value={draft.totalGrams} onChange={event => setDraft(current => ({ ...current, totalGrams: Number(event.target.value) }))} required />
        </label>
        <button type="submit" disabled={loading || !online || !draft.spoolId || draft.hours * 60 + draft.minutes <= 0 || draft.totalGrams <= 0}>
          {loading ? 'Calculando…' : 'Calcular precio'}
        </button>
      </form>

      <article className="card result-card quick-result" aria-live="polite">
        <h2>Resultado</h2>
        {!breakdown ? <p className="empty">Completá los tres datos para obtener un precio.</p> : <>
          <div className="quick-metrics">
            <div className="primary-price"><span>Precio sugerido</span><strong>{formatPyg(breakdown.customerTotalGs)}</strong></div>
            <div><span>Costo completo</span><strong>{formatPyg(breakdown.fullyLoadedCostGs)}</strong></div>
            <div><span>Ganancia</span><strong>{formatPyg(breakdown.estimatedProfitGs)}</strong></div>
            <div><span>Margen</span><strong>{formatDecimal(breakdown.achievedMarginPercent)}%</strong></div>
          </div>
          {result.warnings.length > 0 ? <ul className="warning-list">{result.warnings.map(warning =>
            <li key={warning.code} className={warning.blocksPrice ? 'blocking' : ''}><strong>{warning.code}</strong><span>{warning.message}</span></li>)}</ul> : null}
          <details className="breakdown-details"><summary>Ver desglose completo</summary><dl className="breakdown">
            <div><dt>Material</dt><dd>{formatPyg(breakdown.materialCostGs)}</dd></div>
            <div><dt>Energía</dt><dd>{formatPyg(breakdown.energy.costGs)}</dd></div>
            <div><dt>Máquina</dt><dd>{formatPyg(breakdown.machine.costGs)}</dd></div>
            <div><dt>Trabajo</dt><dd>{formatPyg(breakdown.laborCostGs)}</dd></div>
            <div><dt>Embalaje y adicionales</dt><dd>{formatPyg(breakdown.additionalCostGs)}</dd></div>
            <div><dt>Reserva por fallas</dt><dd>{formatPyg(breakdown.failureReserveGs)}</dd></div>
            <div><dt>Overhead</dt><dd>{formatPyg(breakdown.totalOverheadGs)}</dd></div>
            <div><dt>Impuestos</dt><dd>{formatPyg(breakdown.taxGs)}</dd></div>
          </dl>{result.resolvedAssumptions ? <div className="assumptions"><h3>Supuestos resueltos</h3>
            <p>{result.resolvedAssumptions.printerName} · {result.resolvedAssumptions.energyProfileName}</p>
            <p>{result.resolvedAssumptions.electricityTariffName} · {result.resolvedAssumptions.pricingPolicyName}</p>
            <p>Ocupación: {formatDecimal(result.resolvedAssumptions.occupiedPrinterHours)} h · Setup: {formatDecimal(result.resolvedAssumptions.setupLaborMinutes)} min · Embalaje: {formatPyg(result.resolvedAssumptions.packagingCostGs)}</p>
          </div> : null}</details>
          <div className="actions">
            <button type="button" onClick={() => void save()} disabled={loading || !online || !result.advancedRequest}>Guardar como cotización</button>
            <button type="button" className="secondary" onClick={openAdvanced} disabled={!result.advancedRequest}>Abrir cálculo avanzado</button>
            {result.canUsePrice ? <button type="button" className="secondary" onClick={() => void share()}>Copiar o compartir</button> : null}
          </div>
          {!result.canUsePrice ? <p className="warning">El precio no puede utilizarse hasta resolver todos los costos obligatorios.</p> : null}
        </>}
      </article>
    </div>
  </section>;
}
