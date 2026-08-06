import { useEffect, useMemo, useState } from 'react';
import { get, post } from '../api/client';
import type { ElectricityTariff, EnergyProfile, Filament, PricingPolicy, Printer, QuoteBreakdown, QuotePreviewResponse } from '../api/types';
import { formatDecimal, formatPyg } from '../utils/format';

export const DRAFT_KEY = 'printcost.quote-draft.v1';
interface Draft {
  printerId: string; energyProfileId: string; tariffId: string; policyId: string; spoolId: string; secondSpoolId: string;
  quantity: number; unitsPerPlate: number; inputBasis: 'PerUnit' | 'PerPlate'; printHours: number;
  idleHours: number; occupiedHours: number; grams: number; secondGrams: number; measuredKWh: string;
  warmupKWh: number; accessoryKWh: number; laborCategory: string; laborMinutes: number; laborRateGs: number;
  additionalDescription: string; additionalCostGs: number; notes: string;
}
const emptyDraft: Draft = { printerId: '', energyProfileId: '', tariffId: '', policyId: '', spoolId: '', secondSpoolId: '', quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit', printHours: 1, idleHours: 0, occupiedHours: 1, grams: 0, secondGrams: 0, measuredKWh: '', warmupKWh: 0, accessoryKWh: 0, laborCategory: 'Preparación del pedido', laborMinutes: 0, laborRateGs: 0, additionalDescription: 'Consumibles', additionalCostGs: 0, notes: '' };

export function restoreDraft(storage: Pick<Storage, 'getItem'> = localStorage): Draft {
  try { return { ...emptyDraft, ...JSON.parse(storage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft> }; }
  catch { return emptyDraft; }
}

export function CalculatorScreen({ saveAsQuote = false }: { saveAsQuote?: boolean }) {
  const [draft, setDraft] = useState<Draft>(() => restoreDraft());
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [profiles, setProfiles] = useState<EnergyProfile[]>([]);
  const [tariffs, setTariffs] = useState<ElectricityTariff[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [policies, setPolicies] = useState<PricingPolicy[]>([]);
  const [breakdown, setBreakdown] = useState<QuoteBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }, [draft]);
  useEffect(() => {
    Promise.all([
      get<Printer[]>('/api/printers'), get<ElectricityTariff[]>('/api/electricity-tariffs'),
      get<Filament[]>('/api/filaments'), get<PricingPolicy[]>('/api/pricing-policies')
    ]).then(([printerRows, tariffRows, filamentRows, policyRows]) => {
      setPrinters(printerRows.filter(x => x.isActive)); setTariffs(tariffRows.filter(x => x.isActive));
      setFilaments(filamentRows.filter(x => x.isActive)); setPolicies(policyRows);
      setDraft(current => ({ ...current, printerId: current.printerId || printerRows.find(x => x.isActive)?.id || '', tariffId: current.tariffId || tariffRows.find(x => x.isActive)?.id || '', spoolId: current.spoolId || filamentRows.find(x => x.isActive)?.id || '', policyId: current.policyId || policyRows.find(x => x.isDefault)?.id || policyRows[0]?.id || '' }));
    }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'No se pudieron cargar los catálogos.'));
  }, []);
  useEffect(() => {
    if (!draft.printerId) return;
    get<EnergyProfile[]>(`/api/printers/${draft.printerId}/energy-profiles`).then(rows => {
      setProfiles(rows); setDraft(current => ({ ...current, energyProfileId: rows.some(x => x.id === current.energyProfileId) ? current.energyProfileId : rows[0]?.id ?? '' }));
    }).catch(() => setProfiles([]));
  }, [draft.printerId]);

  const request = useMemo(() => ({
    printerId: draft.printerId, energyProfileId: draft.energyProfileId, electricityTariffId: draft.tariffId,
    pricingPolicyId: draft.policyId || null, quantity: { quantity: draft.quantity, unitsPerPlate: draft.unitsPerPlate, inputBasis: draft.inputBasis },
    printDurationHours: draft.printHours, idleDurationHours: draft.idleHours, occupiedPrinterHours: draft.occupiedHours,
    measuredKWh: draft.measuredKWh === '' ? null : Number(draft.measuredKWh), additionalWarmupKWh: draft.warmupKWh, additionalAccessoryKWh: draft.accessoryKWh,
    materials: [
      ...(draft.spoolId ? [{ spoolId: draft.spoolId, slicerTotalGrams: draft.grams }] : []),
      ...(draft.secondSpoolId ? [{ spoolId: draft.secondSpoolId, slicerTotalGrams: draft.secondGrams }] : [])
    ],
    labor: draft.laborMinutes > 0 ? [{ category: draft.laborCategory, minutes: draft.laborMinutes, hourlyRateGs: draft.laborRateGs || null, scope: 'FixedPerOrder', repeatOnFailure: false }] : [],
    additionalCosts: draft.additionalCostGs > 0 ? [{ description: draft.additionalDescription, amountGs: draft.additionalCostGs, scope: 'FixedPerOrder', repeatOnFailure: false, isInternalCost: true, participatesInMargin: true }] : [],
    fixedSurchargesGs: 0, percentageSurchargePercent: 0, discountGs: 0,
    acceptZeroMachineRate: false, zeroMachineRateReason: null, tax: { enabled: false, ratePercent: 0, priceIncludesTax: false }
  }), [draft]);

  const calculate = async () => {
    if (!online) { setMessage('Sin conexión: el borrador se conserva, pero el precio definitivo requiere el servidor.'); return; }
    setLoading(true); setMessage(null);
    try { setBreakdown((await post<QuotePreviewResponse>('/api/calculations/quote-preview', request)).breakdown); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No se pudo calcular.'); }
    finally { setLoading(false); }
  };
  const save = async () => {
    if (!online) { setMessage('Sin conexión: el borrador no fue guardado.'); return; }
    setLoading(true);
    try {
      const quote = await post<{ code: string }>('/api/quotes', { calculation: request, customerId: null, validUntil: null, notes: draft.notes || null, terms: null });
      setMessage(`${quote.code} guardada. El backend recalculó todos los costos.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No se pudo guardar.'); }
    finally { setLoading(false); }
  };
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const shareSummary = async () => {
    if (!breakdown) return;
    const text = `Impresión 3D: ${formatPyg(breakdown.customerTotalGs)}. Costo completo: ${formatPyg(breakdown.fullyLoadedCostGs)}.`;
    if (navigator.share) await navigator.share({ title: 'Cotización', text }); else await navigator.clipboard.writeText(text);
    setMessage('Resumen compartido o copiado.');
  };

  return <section className="page calculator-page"><div className="page-heading"><div><h1>{saveAsQuote ? 'Nueva cotización' : 'Calculadora'}</h1><p>El servidor es la fuente de verdad del precio.</p></div>
    <span className={`connection ${online ? 'online' : 'offline'}`}>{online ? 'En línea' : 'Sin conexión'}</span></div>
    {!online ? <p role="status" className="warning">Se restauró el último borrador local. No se generarán precios definitivos sin conexión.</p> : null}
    {message ? <p role="status" className={message.includes('no ') || message.includes('Sin ') ? 'warning' : 'success'}>{message}</p> : null}
    <div className="calculator-grid"><form className="card form-grid" onSubmit={(event) => { event.preventDefault(); void calculate(); }}>
      <h2>Datos de Bambu Studio</h2>
      <label>Impresora<select value={draft.printerId} onChange={e => update('printerId', e.target.value)} required><option value="">Configurar</option>{printers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Perfil energético<select value={draft.energyProfileId} onChange={e => update('energyProfileId', e.target.value)} required><option value="">Configurar</option>{profiles.map(x => <option key={x.id} value={x.id}>{x.name} · {x.averagePrintPowerW} W</option>)}</select></label>
      <label>Tarifa eléctrica<select value={draft.tariffId} onChange={e => update('tariffId', e.target.value)} required><option value="">Configurar</option>{tariffs.map(x => <option key={x.id} value={x.id}>{x.provider} · {x.baseRateGsPerKWh} Gs/kWh</option>)}</select></label>
      <label>Política<select value={draft.policyId} onChange={e => update('policyId', e.target.value)} required><option value="">Configurar</option>{policies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Filamento<select value={draft.spoolId} onChange={e => update('spoolId', e.target.value)} required><option value="">Configurar un rollo</option>{filaments.map(x => <option key={x.id} value={x.id}>{x.material} · {x.color} · {formatDecimal(x.remainingWeightGrams, 0)} g</option>)}</select></label>
      <label>Gramos totales del slicer<input type="number" min="0" step="0.01" value={draft.grams} onChange={e => update('grams', Number(e.target.value))} required /></label>
      <label>Segundo filamento (opcional)<select value={draft.secondSpoolId} onChange={e => update('secondSpoolId', e.target.value)}><option value="">Ninguno</option>{filaments.filter(x=>x.id!==draft.spoolId).map(x => <option key={x.id} value={x.id}>{x.material} · {x.color}</option>)}</select></label>
      <label>Gramos del segundo filamento<input type="number" min="0" step="0.01" value={draft.secondGrams} onChange={e => update('secondGrams', Number(e.target.value))} disabled={!draft.secondSpoolId} /></label>
      <label>Tiempo de impresión (h)<input type="number" min="0" step="0.01" value={draft.printHours} onChange={e => update('printHours', Number(e.target.value))} required /></label>
      <label>Horas ocupadas de máquina<input type="number" min="0" step="0.01" value={draft.occupiedHours} onChange={e => update('occupiedHours', Number(e.target.value))} required /></label>
      <label>kWh medidos (opcional)<input type="number" min="0" step="0.001" value={draft.measuredKWh} onChange={e => update('measuredKWh', e.target.value)} /></label>
      <label>kWh extra de calentamiento<input type="number" min="0" step="0.001" value={draft.warmupKWh} onChange={e => update('warmupKWh', Number(e.target.value))} /></label>
      <label>kWh de accesorios<input type="number" min="0" step="0.001" value={draft.accessoryKWh} onChange={e => update('accessoryKWh', Number(e.target.value))} /></label>
      <label>Cantidad<input type="number" min="1" step="1" value={draft.quantity} onChange={e => update('quantity', Number(e.target.value))} required /></label>
      <label>Unidades por placa<input type="number" min="1" step="1" value={draft.unitsPerPlate} onChange={e => update('unitsPerPlate', Number(e.target.value))} required /></label>
      <label>Base de entrada<select value={draft.inputBasis} onChange={e => update('inputBasis', e.target.value as Draft['inputBasis'])}><option value="PerUnit">Por unidad</option><option value="PerPlate">Por placa</option></select></label>
      <label>Categoría de trabajo<input value={draft.laborCategory} onChange={e=>update('laborCategory',e.target.value)}/></label>
      <label>Trabajo manual (minutos)<input type="number" min="0" step="1" value={draft.laborMinutes} onChange={e=>update('laborMinutes',Number(e.target.value))}/></label>
      <label>Tarifa laboral Gs/h<input type="number" min="0" step="1" value={draft.laborRateGs} onChange={e=>update('laborRateGs',Number(e.target.value))} placeholder="Usa la política si queda en 0"/></label>
      <label>Consumible / otro costo<input value={draft.additionalDescription} onChange={e=>update('additionalDescription',e.target.value)}/></label>
      <label>Importe del otro costo (Gs)<input type="number" min="0" step="1" value={draft.additionalCostGs} onChange={e=>update('additionalCostGs',Number(e.target.value))}/></label>
      {saveAsQuote ? <label className="span-2">Notas<textarea value={draft.notes} onChange={e => update('notes', e.target.value)} rows={3} /></label> : null}
      <div className="actions span-2"><button type="submit" disabled={loading || !online}>{loading ? 'Calculando…' : 'Calcular con el servidor'}</button>
        {saveAsQuote ? <button type="button" className="secondary" onClick={() => void save()} disabled={loading || !online}>Guardar cotización</button> : null}</div>
    </form>
    <article className="card result-card" aria-live="polite"><h2>Desglose</h2>{breakdown ? <>
      {breakdown.warnings.map(warning => <p key={warning} className="warning">{warning}</p>)}
      <dl className="breakdown">
        <div><dt>1. Materiales</dt><dd>{formatPyg(breakdown.materialCostGs)}</dd></div>
        <div><dt>2. Electricidad</dt><dd>{formatPyg(breakdown.energy.costGs)}</dd></div>
        <div><dt>3. Máquina</dt><dd>{formatPyg(breakdown.machine.costGs)}</dd></div>
        <div><dt>4. Mano de obra</dt><dd>{formatPyg(breakdown.laborCostGs)}</dd></div>
        <div><dt>5. Consumibles</dt><dd>{formatPyg(breakdown.additionalCostGs)}</dd></div>
        <div><dt>6. Riesgo de falla</dt><dd>{formatPyg(breakdown.failureReserveGs)}</dd></div>
        <div><dt>7. Overhead</dt><dd>{formatPyg(breakdown.totalOverheadGs)}</dd></div>
        <div className="total"><dt>8. Costo completo</dt><dd>{formatPyg(breakdown.fullyLoadedCostGs)}</dd></div>
        <div><dt>9. Precio sugerido</dt><dd>{formatPyg(breakdown.suggestedNetPriceGs)}</dd></div>
        <div><dt>10. Ganancia</dt><dd>{formatPyg(breakdown.estimatedProfitGs)}</dd></div>
        <div><dt>11. Margen</dt><dd>{formatDecimal(breakdown.achievedMarginPercent, 2)}%</dd></div>
        <div><dt>12. Markup</dt><dd>{formatDecimal(breakdown.markupPercent, 2)}%</dd></div>
        <div><dt>13. Impuesto</dt><dd>{formatPyg(breakdown.taxGs)}</dd></div>
        <div className="grand-total"><dt>14. Total cliente</dt><dd>{formatPyg(breakdown.customerTotalGs)}</dd></div>
      </dl><div className="actions"><button type="button" className="secondary" onClick={() => window.print()}>Imprimir</button><button type="button" className="secondary" onClick={() => void shareSummary()}>Copiar / compartir</button></div>
    </> : <p className="empty">Completá los datos y solicitá un cálculo.</p>}</article></div>
  </section>;
}
