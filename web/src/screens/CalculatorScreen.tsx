import { useEffect, useMemo, useState } from 'react';
import { get, post } from '../api/client';
import type { Customer, ElectricityTariff, EnergyProfile, Filament, PricingPolicy, Printer, QuotePreviewResponse } from '../api/types';
import { formatDecimal, formatPyg } from '../utils/format';
import { buildClientQuoteText } from '../utils/clientQuote';
import { QUICK_TO_ADVANCED_KEY } from './QuickQuoteScreen';

export const DRAFT_KEY = 'printcost.quote-draft.v1';
interface Draft {
  printerId: string; energyProfileId: string; tariffId: string; policyId: string; spoolId: string; secondSpoolId: string;
  quantity: number; unitsPerPlate: number; inputBasis: 'PerUnit' | 'PerPlate'; printHours: number;
  idleHours: number; occupiedHours: number; customOccupiedTime: boolean; grams: number; secondGrams: number; measuredKWh: string;
  warmupKWh: number; accessoryKWh: number; laborCategory: string; laborMinutes: number; laborRateGs: number;
  additionalDescription: string; additionalCostGs: number; notes: string; lineDescription: string; customerId: string;
  quoteLines: Array<{ id: string; description: string; spoolId: string; grams: number; printHours: number }>;
}
const emptyDraft: Draft = { printerId: '', energyProfileId: '', tariffId: '', policyId: '', spoolId: '', secondSpoolId: '', quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit', printHours: 1, idleHours: 0, occupiedHours: 1, customOccupiedTime: false, grams: 0, secondGrams: 0, measuredKWh: '', warmupKWh: 0, accessoryKWh: 0, laborCategory: 'Preparación del pedido', laborMinutes: 0, laborRateGs: 0, additionalDescription: 'Consumibles', additionalCostGs: 0, notes: '', lineDescription: 'Impresión 3D', customerId: '', quoteLines: [] };

export function restoreDraft(storage: Pick<Storage, 'getItem'> = localStorage): Draft {
  try {
    const restored = { ...emptyDraft, ...JSON.parse(storage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft> };
    return restored.customOccupiedTime ? restored : { ...restored, occupiedHours: restored.printHours };
  }
  catch { return emptyDraft; }
}

function initialDraft(): Draft {
  const restored = restoreDraft();
  try {
    const raw = localStorage.getItem(QUICK_TO_ADVANCED_KEY);
    if (!raw) return restored;
    localStorage.removeItem(QUICK_TO_ADVANCED_KEY);
    const request = JSON.parse(raw) as {
      printerId?: string; energyProfileId?: string; electricityTariffId?: string; pricingPolicyId?: string;
      printDurationHours?: number; occupiedPrinterHours?: number;
      materials?: Array<{ spoolId?: string; slicerTotalGrams?: number }>;
      labor?: Array<{ category?: string; minutes?: number; hourlyRateGs?: number | null }>;
      additionalCosts?: Array<{ description?: string; amountGs?: number }>;
    };
    const printHours = Number(request.printDurationHours ?? restored.printHours);
    return {
      ...restored,
      printerId: request.printerId ?? restored.printerId,
      energyProfileId: request.energyProfileId ?? restored.energyProfileId,
      tariffId: request.electricityTariffId ?? restored.tariffId,
      policyId: request.pricingPolicyId ?? restored.policyId,
      printHours,
      occupiedHours: printHours,
      customOccupiedTime: false,
      spoolId: request.materials?.[0]?.spoolId ?? restored.spoolId,
      grams: Number(request.materials?.[0]?.slicerTotalGrams ?? restored.grams),
      secondSpoolId: request.materials?.[1]?.spoolId ?? '',
      secondGrams: Number(request.materials?.[1]?.slicerTotalGrams ?? 0),
      laborCategory: request.labor?.[0]?.category ?? restored.laborCategory,
      laborMinutes: Number(request.labor?.[0]?.minutes ?? restored.laborMinutes),
      laborRateGs: Number(request.labor?.[0]?.hourlyRateGs ?? 0),
      additionalDescription: request.additionalCosts?.[0]?.description ?? restored.additionalDescription,
      additionalCostGs: Number(request.additionalCosts?.[0]?.amountGs ?? restored.additionalCostGs)
    };
  } catch {
    localStorage.removeItem(QUICK_TO_ADVANCED_KEY);
    return restored;
  }
}

export function CalculatorScreen({ saveAsQuote = false }: { saveAsQuote?: boolean }) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [profiles, setProfiles] = useState<EnergyProfile[]>([]);
  const [tariffs, setTariffs] = useState<ElectricityTariff[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [policies, setPolicies] = useState<PricingPolicy[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [preview, setPreview] = useState<QuotePreviewResponse | null>(null);
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
    if (!draft.customOccupiedTime && draft.occupiedHours !== draft.printHours)
      setDraft(current => ({ ...current, occupiedHours: current.printHours }));
  }, [draft.customOccupiedTime, draft.occupiedHours, draft.printHours]);
  useEffect(() => {
    Promise.all([
      get<Printer[]>('/api/printers'), get<ElectricityTariff[]>('/api/electricity-tariffs'),
      get<Filament[]>('/api/filaments'), get<PricingPolicy[]>('/api/pricing-policies'),
      saveAsQuote ? get<Customer[]>('/api/customers') : Promise.resolve([] as Customer[])
    ]).then(([printerRows, tariffRows, filamentRows, policyRows, customerRows]) => {
      setPrinters(printerRows.filter(x => x.isActive)); setTariffs(tariffRows.filter(x => x.isActive));
      setFilaments(filamentRows.filter(x => x.isActive)); setPolicies(policyRows);
      setCustomers(customerRows.filter(x => x.isActive));
      setDraft(current => ({ ...current, printerId: current.printerId || printerRows.find(x => x.isActive)?.id || '', tariffId: current.tariffId || tariffRows.find(x => x.isActive)?.id || '', spoolId: current.spoolId || filamentRows.find(x => x.isActive)?.id || '', policyId: current.policyId || policyRows.find(x => x.isDefault)?.id || policyRows[0]?.id || '' }));
    }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'No se pudieron cargar los catálogos.'));
  }, [saveAsQuote]);
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
    acceptZeroMachineRate: false, zeroMachineRateReason: null, tax: null
  }), [draft]);

  const calculate = async () => {
    if (!online) { setMessage('Sin conexión: el borrador se conserva, pero el precio definitivo requiere el servidor.'); return; }
    setLoading(true); setMessage(null);
    try { setPreview(await post<QuotePreviewResponse>('/api/calculations/quote-preview', request)); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No se pudo calcular.'); }
    finally { setLoading(false); }
  };
  const save = async () => {
    if (!online) { setMessage('Sin conexión: el borrador no fue guardado.'); return; }
    setLoading(true);
    try {
      const lines = [
        { description: draft.lineDescription || 'Impresión 3D', calculation: request },
        ...draft.quoteLines.map(line => ({
          description: line.description || 'Línea adicional',
          calculation: {
            ...request,
            printDurationHours: line.printHours,
            occupiedPrinterHours: line.printHours,
            materials: line.spoolId ? [{ spoolId: line.spoolId, slicerTotalGrams: line.grams }] : [],
            labor: request.labor.filter(item => item.scope !== 'FixedPerOrder'),
            additionalCosts: request.additionalCosts.filter(item => item.scope !== 'FixedPerOrder')
          }
        }))
      ];
      const quote = await post<{ code: string }>('/api/quotes', { calculation: request, lines, customerId: draft.customerId || null, validUntil: null, notes: draft.notes || null, terms: null });
      setMessage(`${quote.code} guardada como Draft. El backend recalculó todas las líneas.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No se pudo guardar.'); }
    finally { setLoading(false); }
  };
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const updateQuoteLine = (id: string, patch: Partial<Draft['quoteLines'][number]>) => setDraft(current => ({
    ...current, quoteLines: current.quoteLines.map(line => line.id === id ? { ...line, ...patch } : line)
  }));
  const shareSummary = async () => {
    if (!preview?.canUsePrice) return;
    const breakdown = preview.breakdown;
    const text = buildClientQuoteText(breakdown.customerTotalGs);
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
      <label className="checkbox-label"><input type="checkbox" checked={draft.customOccupiedTime} onChange={e => update('customOccupiedTime', e.target.checked)} />Usar un tiempo ocupado distinto</label>
      {draft.customOccupiedTime ? <label>Horas ocupadas de máquina<input type="number" min="0" step="0.01" value={draft.occupiedHours} onChange={e => update('occupiedHours', Number(e.target.value))} required /></label> : <p className="hint">Tiempo ocupado sincronizado: {formatDecimal(draft.printHours)} h</p>}
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
      {saveAsQuote ? <><h2>Líneas independientes</h2><label className="span-2">Descripción de la primera línea<input value={draft.lineDescription} onChange={e => update('lineDescription', e.target.value)} required /></label>
        {draft.quoteLines.map((line, index) => <fieldset className="span-2 line-editor" key={line.id}><legend>Línea {index + 2}</legend><div className="form-grid">
          <label>Descripción<input value={line.description} onChange={e => updateQuoteLine(line.id, { description: e.target.value })} required /></label>
          <label>Filamento<select value={line.spoolId} onChange={e => updateQuoteLine(line.id, { spoolId: e.target.value })} required><option value="">Seleccionar</option>{filaments.map(x => <option key={x.id} value={x.id}>{x.material} · {x.color}</option>)}</select></label>
          <label>Gramos<input type="number" min="0.01" step="0.01" value={line.grams} onChange={e => updateQuoteLine(line.id, { grams: Number(e.target.value) })} required /></label>
          <label>Horas de impresión<input type="number" min="0.01" step="0.01" value={line.printHours} onChange={e => updateQuoteLine(line.id, { printHours: Number(e.target.value) })} required /></label>
          <button type="button" className="secondary" onClick={() => update('quoteLines', draft.quoteLines.filter(x => x.id !== line.id))}>Quitar línea</button>
        </div></fieldset>)}
        <div className="actions span-2"><button type="button" className="secondary" onClick={() => update('quoteLines', [...draft.quoteLines, { id: crypto.randomUUID(), description: `Línea ${draft.quoteLines.length + 2}`, spoolId: draft.spoolId, grams: draft.grams, printHours: draft.printHours }])}>Agregar línea independiente</button></div></> : null}
      {saveAsQuote ? <><label className="span-2">Cliente (opcional)<select value={draft.customerId} onChange={e => update('customerId', e.target.value)}><option value="">Sin cliente</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="span-2">Notas<textarea value={draft.notes} onChange={e => update('notes', e.target.value)} rows={3} /></label></> : null}
      <div className="actions span-2"><button type="submit" disabled={loading || !online}>{loading ? 'Calculando…' : 'Calcular con el servidor'}</button>
        {saveAsQuote ? <button type="button" className="secondary" onClick={() => void save()} disabled={loading || !online}>Guardar cotización</button> : null}</div>
    </form>
    <article className="card result-card" aria-live="polite"><h2>Desglose</h2>{preview ? <>
      {preview.warnings.map(warning => <p key={warning.code} className={warning.blocksPrice ? 'warning' : 'hint'}>{warning.message}</p>)}
      <dl className="breakdown">
        <div><dt>1. Materiales</dt><dd>{formatPyg(preview.breakdown.materialCostGs)}</dd></div>
        <div><dt>2. Electricidad</dt><dd>{formatPyg(preview.breakdown.energy.costGs)}</dd></div>
        <div><dt>3. Máquina</dt><dd>{formatPyg(preview.breakdown.machine.costGs)}</dd></div>
        <div><dt>4. Mano de obra</dt><dd>{formatPyg(preview.breakdown.laborCostGs)}</dd></div>
        <div><dt>5. Consumibles</dt><dd>{formatPyg(preview.breakdown.additionalCostGs)}</dd></div>
        <div><dt>6. Riesgo de falla</dt><dd>{formatPyg(preview.breakdown.failureReserveGs)}</dd></div>
        <div><dt>7. Overhead</dt><dd>{formatPyg(preview.breakdown.totalOverheadGs)}</dd></div>
        <div className="total"><dt>8. Costo completo</dt><dd>{formatPyg(preview.breakdown.fullyLoadedCostGs)}</dd></div>
        <div><dt>9. Precio sugerido</dt><dd>{formatPyg(preview.breakdown.suggestedNetPriceGs)}</dd></div>
        <div><dt>10. Ganancia</dt><dd>{formatPyg(preview.breakdown.estimatedProfitGs)}</dd></div>
        <div><dt>11. Margen</dt><dd>{formatDecimal(preview.breakdown.achievedMarginPercent, 2)}%</dd></div>
        <div><dt>12. Markup</dt><dd>{formatDecimal(preview.breakdown.markupPercent, 2)}%</dd></div>
        <div><dt>13. Impuesto</dt><dd>{formatPyg(preview.breakdown.taxGs)}</dd></div>
        <div className="grand-total"><dt>14. Total cliente</dt><dd>{formatPyg(preview.breakdown.customerTotalGs)}</dd></div>
      </dl><div className="actions">{preview.canUsePrice ? <button type="button" className="secondary" onClick={() => void shareSummary()}>Copiar / compartir</button> : null}</div>
      {!preview.canUsePrice ? <p className="warning">Este precio no puede utilizarse hasta resolver los costos obligatorios.</p> : null}
    </> : <p className="empty">Completá los datos y solicitá un cálculo.</p>}</article></div>
  </section>;
}
