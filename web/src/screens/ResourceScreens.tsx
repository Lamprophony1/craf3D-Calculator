import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, get, post, put } from '../api/client';
import type { ApplicationSettings, Filament, JobSummary, PriceWarning, QuoteBreakdown, QuoteMaterialSelection, SettingsResponse } from '../api/types';
import { OrdersScreen } from './OrdersScreen';
import { orderConfirmationState, orderListOriginState, orderListReturn } from './orderListNavigation';
import { type Order, orderLabels } from '../api/orders';
import { navigate } from '../components/AppShell';
import { APP_NAME, MASTER_LOGO_PATH } from '../config/app';
import { formatDecimal, formatLocalDate, formatPyg } from '../utils/format';
import { editableGrams, selectQuoteMaterial, usesBaseGrams } from '../utils/quoteMaterials';

interface CalculationView {
  printDurationHours: number;
  occupiedPrinterHours: number;
  materials: QuoteMaterialSelection[];
  [key: string]: unknown;
}
interface QuoteLineView {
  id: string;
  description: string;
  request: CalculationView;
  breakdown: QuoteBreakdown;
  canUsePrice: boolean;
  warnings: PriceWarning[];
}
interface QuoteRevisionView {
  revisionNumber: number;
  createdAt: string;
  lines?: QuoteLineView[] | null;
  effectiveLines?: QuoteLineView[];
  isLegacyRevision?: boolean;
  aggregate?: { breakdown: {
    customerTotalGs: number; fullyLoadedCostGs: number; estimatedProfitGs: number;
    taxGs: number; achievedMarginPercent: number; canUsePrice: boolean;
  }} | null;
}
interface QuoteView {
  customerReference?: string | null;
  itemDescription?: string | null;
  id: string;
  code: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  validUntil: string | null;
  customerId: string | null;
  notes: string | null;
  terms: string | null;
  revisions: QuoteRevisionView[];
}
type QuoteFollowUp = { kind: 'loading' | 'unavailable' } | { kind: 'ready'; order: Order };
interface JobView {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  estimate: QuoteRevisionView;
  actualInput?: { attempts: number; failedAttempts: number; notes: string | null } | null;
  actualResult?: {
    materialCostGs: number; electricityCostGs: number; machineCostGs: number; laborCostGs: number;
    additionalCostGs: number; overheadGs: number; fullyLoadedCostGs: number; realizedProfitGs: number; realizedMarginPercent: number;
    actualCustomerTotalGs: number; actualTaxGs: number; actualNetSalePriceGs: number;
    variableSellingFeeGs: number; netRevenueAfterSellingFeesGs: number;
  } | null;
  actualDetails?: {
    materials: Array<{ spoolId: string; grams: number; costGs: number }>;
    labor: Array<{ category: string; minutes: number; costGs: number }>;
    additionalCosts: Array<{ description: string; amountGs: number }>;
  } | null;
}

const revisionLines = (revision?: QuoteRevisionView): QuoteLineView[] =>
  revision?.lines?.length ? revision.lines : revision?.effectiveLines ?? [];

const statusLabels: Record<string, string> = {
  Draft: 'Borrador', Calculated: 'Calculado', ReadyToSend: 'Listo para enviar', Sent: 'Enviado', Accepted: 'Aceptado',
  Rejected: 'Rechazado', Expired: 'Vencido', ConvertedToJob: 'Convertido en pedido', Cancelled: 'Cancelado',
  Planned: 'Planificado', Printing: 'Imprimiendo', Paused: 'Pausado', Completed: 'Terminado', Failed: 'Fallido'
};
const statusLabel = (status: string) => statusLabels[status] ?? status;

export function QuoteListScreen() {
  return <OrdersScreen area="quotes" />;
}

export function JobListScreen() {
  const [rows, setRows] = useState<JobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { get<JobSummary[]>('/api/jobs').then(setRows).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Error')); }, []);
  return <ListPage title="Pedidos" error={error}>
    {rows.length ? <table className="resource-table"><thead><tr><th>Pedido</th><th>Fecha</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
      <td data-label="Pedido"><button type="button" className="table-link" onClick={() => navigate(`/jobs/${row.id}`)}><strong>{row.description}</strong><small>{row.code}</small></button></td>
      <td data-label="Fecha">{formatLocalDate(row.createdAt)}</td><td data-label="Estado"><span className="status-badge">{statusLabel(row.status)}</span></td><td data-label="Importe" className="amount-cell">{formatPyg(row.actualCustomerTotalGs ?? row.estimatedCustomerTotalGs)}</td>
    </tr>)}</tbody></table> : <div className="empty-state"><strong>Todavía no hay pedidos</strong><p>Los presupuestos aceptados que conviertas en pedido aparecerán acá.</p></div>}
  </ListPage>;
}

export function QuoteDetailScreen({ id }: { id: string }) {
  const [data, setData] = useState<QuoteView | null>(null);
  const [followUp, setFollowUp] = useState<QuoteFollowUp>({ kind: 'loading' });
  const [transitioning, setTransitioning] = useState(false);
  const followUpVersion = useRef(0);
  const writing = useRef(false);
  const followUpAction = useRef<HTMLButtonElement>(null);
  const [priceAdopted, setPriceAdopted] = useState(false);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [editing, setEditing] = useState<QuoteLineView[] | null>(null);
  const editingRevision = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [draftCustomerReference, setDraftCustomerReference] = useState('');
  const [customer, setCustomer] = useState<{ name: string; email?: string | null; phone?: string | null } | null>(null);
  const refresh = useCallback(async (version: number) => {
    try {
      const quote = await get<QuoteView>(`/api/quotes/${id}`);
      if (version === followUpVersion.current) setData(quote);
    } catch (reason) {
      if (version === followUpVersion.current)
        setError(reason instanceof Error ? reason.message : 'No se pudo cargar la cotización.');
    }
  }, [id]);
  const refreshFollowUp = useCallback(async (version: number) => {
    const order = await get<Order>(`/api/orders/by-quote/${id}`).catch(() => null);
    if (version !== followUpVersion.current) return;
    setFollowUp(order?.quoteId === id ? { kind: 'ready', order } : { kind: 'unavailable' });
  }, [id]);
  useEffect(() => {
    get<Filament[]>('/api/filaments').then(setFilaments).catch(() => undefined);
    get<SettingsResponse>('/api/settings').then(response => setSettings(response.settings)).catch(() => undefined);
  }, [id]);
  useEffect(() => {
    writing.current = false;
    setTransitioning(false);
    setFollowUp({ kind: 'loading' });
    setError(null);
    setEditing(null);
    setPriceAdopted(false);
    const version = ++followUpVersion.current;
    void refresh(version);
    void refreshFollowUp(version);
    return () => { followUpVersion.current += 1; };
  }, [refresh, refreshFollowUp]);
  useEffect(() => {
    if (priceAdopted && !transitioning) followUpAction.current?.focus();
  }, [priceAdopted, transitioning]);
  useEffect(() => {
    if (!data?.customerId) { setCustomer(null); return; }
    get<{ name: string; email?: string | null; phone?: string | null }>(`/api/customers/${data.customerId}`).then(setCustomer).catch(() => setCustomer(null));
  }, [data?.customerId]);
  const currentQuote = data?.id === id ? data : null;
  const revision = currentQuote?.revisions.reduce((latest, item) => item.revisionNumber > latest.revisionNumber ? item : latest, currentQuote.revisions[0]);
  const lines = revisionLines(revision);
  const total = revision?.aggregate?.breakdown.customerTotalGs ?? lines.reduce((sum, line) => sum + line.breakdown.customerTotalGs, 0);
  const totalCost = revision?.aggregate?.breakdown.fullyLoadedCostGs ?? lines.reduce((sum, line) => sum + line.breakdown.fullyLoadedCostGs, 0);
  const totalProfit = revision?.aggregate?.breakdown.estimatedProfitGs ?? lines.reduce((sum, line) => sum + line.breakdown.estimatedProfitGs, 0);
  const totalTax = revision?.aggregate?.breakdown.taxGs ?? lines.reduce((sum, line) => sum + line.breakdown.taxGs, 0);
  const status = currentQuote?.status ?? '';
  const canPrint = lines.length > 0
    && (revision?.aggregate?.breakdown.canUsePrice ?? lines.every(line => line.canUsePrice));
  const printBlockReason = !canPrint ? 'La revisión guardada necesita al menos una línea y un precio utilizable para imprimir.' : null;
  const canEditDocument = ['Draft', 'Calculated', 'ReadyToSend', 'Sent'].includes(status);
  const linkedOrder = followUp.kind === 'ready' && followUp.order.quoteId === id ? followUp.order : null;
  const orderPending = linkedOrder?.status === 'Draft';
  const orderIncomplete = !linkedOrder?.customerReference?.trim() || linkedOrder.totalGs == null;
  const differentTotal = canPrint && linkedOrder !== null && total !== linkedOrder.totalGs;
  const orderActionLabel = orderPending
    ? orderIncomplete ? 'Completar y confirmar'
      : differentTotal && linkedOrder.totalGs != null ? `Confirmar pedido por ${formatPyg(linkedOrder.totalGs)}` : 'Confirmar pedido'
    : linkedOrder?.status === 'Discarded' ? 'Ver presupuesto descartado' : 'Ver pedido';

  const write = async (action: (version: number) => Promise<void>, fallback: string, reloadFollowUp = false) => {
    if (writing.current) return;
    writing.current = true;
    setTransitioning(true);
    setError(null);
    setPriceAdopted(false);
    const version = ++followUpVersion.current;
    if (reloadFollowUp) setFollowUp({ kind: 'loading' });
    try {
      await action(version);
      if (version === followUpVersion.current && reloadFollowUp)
        await Promise.all([refresh(version), refreshFollowUp(version)]);
    } catch (reason) {
      if (version !== followUpVersion.current) return;
      setError(reason instanceof Error ? reason.message : fallback);
      if (reason instanceof ApiError && reason.status === 409)
        await Promise.all([refresh(version), refreshFollowUp(version)]);
      else if (reloadFollowUp) await refreshFollowUp(version);
    } finally {
      if (version === followUpVersion.current) {
        writing.current = false;
        setTransitioning(false);
      }
    }
  };
  const act = async (action: string) => {
    if (editing) return;
    await write(async () => {
      await post(`/api/quotes/${id}/${action}`);
    }, 'No se pudo actualizar la cotización.', true);
  };
  const applyOrderChange = async (action: 'confirm' | 'use-price') => {
    if (!linkedOrder || !orderPending || !revision || editing) return;
    const path = `/api/orders/${linkedOrder.id}`;
    await write(async version => {
      const updated = action === 'confirm'
        ? await post<Order>(`${path}/status`, { status: 'Confirmed', version: linkedOrder.version })
        : await post<Order>(`${path}/quote-price`, { version: linkedOrder.version, revisionNumber: revision.revisionNumber });
      if (version !== followUpVersion.current) return;
      setFollowUp({ kind: 'ready', order: updated });
      if (action === 'confirm') {
        navigate(`/orders/${updated.id}`, { state: orderConfirmationState(updated.id) });
      } else setPriceAdopted(true);
    }, action === 'confirm' ? 'No se pudo confirmar el pedido.' : 'No se pudo actualizar el importe del pedido.');
  };
  const followOrder = () => {
    if (!linkedOrder || writing.current) return;
    if (orderPending && !orderIncomplete) {
      void applyOrderChange('confirm');
      return;
    }
    const path = orderPending ? `/quotes/pending/${linkedOrder.id}?complete=1`
      : linkedOrder.status === 'Discarded' ? `/quotes/pending/${linkedOrder.id}` : `/orders/${linkedOrder.id}`;
    navigate(path, { state: orderListOriginState() });
  };
  const patchLine = (lineId: string, patch: Partial<QuoteLineView>) => setEditing(current => current?.map(line => line.id === lineId ? { ...line, ...patch } : line) ?? null);
  const patchMaterial = (lineId: string, index: number, grams: number) => setEditing(current => current?.map(line => {
    if (line.id !== lineId) return line;
    const materials = line.request.materials.map((material, materialIndex) => materialIndex === index
      ? selectQuoteMaterial(material.spoolId, grams, material) : material);
    return { ...line, request: { ...line.request, materials } };
  }) ?? null);
  const editOutdated = editing !== null && (status !== 'Draft' || revision?.revisionNumber !== editingRevision.current);
  const saveDraft = async () => {
    if (!data || !editing?.length || editOutdated) return;
    await write(async version => {
      await put(`/api/quotes/${id}`, {
        revisionNumber: editingRevision.current, customerId: data.customerId, customerReference: draftCustomerReference, itemDescription: data.itemDescription,
        validUntil: data.validUntil, notes: data.notes, terms: data.terms,
        calculation: editing[0].request,
        lines: editing.map(line => ({ description: line.description, calculation: line.request }))
      });
      if (version === followUpVersion.current) setEditing(null);
    }, 'No se pudo editar el borrador.', true);
  };

  if (!data || !currentQuote || !revision) return <section className="page"><h1>Cotización</h1><p>{error ?? 'Cargando…'}</p></section>;
  const listTarget = orderListReturn('/quotes', linkedOrder ?? undefined);
  return <section className="page quote-page"><div className="page-heading no-print"><div><h1>{data.code}</h1><p>Estado del documento: {statusLabel(status)} · Revisión {revision.revisionNumber}</p></div>
    {!editing ? <button type="button" className="quiet" disabled={transitioning} onClick={() => navigate(listTarget.href, { state: listTarget.state })}>{listTarget.href.startsWith('/jobs') ? 'Volver a pedidos' : 'Volver a presupuestos'}</button> : null}</div>
    {error ? <p className="error no-print" role="alert">{error}</p> : null}
    {!editing ? <section className="notice quote-follow-up no-print" aria-labelledby="quote-follow-up-heading" aria-busy={followUp.kind === 'loading' || transitioning}>
      <h2 id="quote-follow-up-heading">Seguimiento del pedido</h2>
      {linkedOrder ? <>
        <p>{linkedOrder.status === 'Draft' ? 'Presupuesto pendiente de aceptación. Cuando el cliente acepte, confirmá el pedido.'
          : linkedOrder.status === 'Discarded' ? 'El presupuesto está en Descartados.' : `Pedido: ${orderLabels[linkedOrder.status]}.`}</p>
        {differentTotal ? <dl className="quote-follow-up-prices">
          <div><dt>Total del documento</dt><dd>{formatPyg(total)}</dd></div>
          <div><dt>{orderPending ? 'Importe a confirmar' : 'Importe del pedido'}</dt><dd>{linkedOrder.totalGs == null ? 'Sin definir' : formatPyg(linkedOrder.totalGs)}</dd></div>
        </dl> : null}
        {priceAdopted ? <p role="status">Importe del pedido actualizado.</p> : null}
        <div className="actions">
          <button ref={followUpAction} type="button" disabled={transitioning} onClick={followOrder}>{orderActionLabel}</button>
          {canEditDocument && orderPending && differentTotal ? <button type="button" className="secondary" disabled={transitioning}
            onClick={() => void applyOrderChange('use-price')}>Usar importe de esta revisión</button> : null}
        </div>
      </> : <p role="status">{followUp.kind === 'loading' ? 'Consultando el seguimiento…' : 'No pudimos verificar el estado del pedido asociado. Podés volver a la bandeja para consultarlo.'}</p>}
    </section> : null}
    <section className="card no-print quote-document-controls" aria-labelledby="quote-document-controls-heading">
      <h2 id="quote-document-controls-heading">Documento para el cliente</h2>
      {canPrint ? <p className="hint">La impresión usa la revisión guardada.</p> : null}
      <div className="actions"><button type="button" className="secondary" disabled={!canPrint || transitioning} aria-describedby={printBlockReason ? 'quote-print-condition' : undefined} onClick={() => window.print()}>Imprimir cotización de cliente</button></div>
      {printBlockReason ? <p id="quote-print-condition" className="hint" role="status">{printBlockReason}</p> : null}
      {revision.isLegacyRevision ? <p className="hint">La revisión histórica está disponible para consultar.</p> : null}
      {!editing && (canEditDocument || status === 'Accepted') ? <details className="quote-document-actions">
        <summary>Acciones del documento</summary>
        <div className="actions">
          {status === 'Draft' ? <button type="button" className="secondary" disabled={transitioning} onClick={() => {
            editingRevision.current = revision.revisionNumber;
            setDraftCustomerReference(data.customerReference ?? '');
            setEditing(lines.map(line => ({ ...line, request: { ...line.request, materials: line.request.materials.map(material => ({ ...material })) } })));
          }}>Editar líneas de la cotización</button> : null}
          {status === 'Calculated' || status === 'Draft' && canPrint
            ? <button type="button" className="secondary" disabled={transitioning || !canPrint} onClick={() => void act('ready')}>Marcar cotización lista para enviar</button> : null}
          {status === 'ReadyToSend' ? <button type="button" className="secondary" disabled={transitioning} onClick={() => void act('send')}>Marcar cotización enviada</button> : null}
          {status === 'Sent' ? <><button type="button" className="secondary" disabled={transitioning} onClick={() => void act('accept')}>Aceptar cotización</button><button type="button" className="secondary" disabled={transitioning} onClick={() => void act('reject')}>Rechazar cotización</button></> : null}
          {status === 'Accepted' ? <button type="button" className="secondary" disabled={transitioning} onClick={() => void act('convert-to-job')}>Crear trabajo de producción</button> : null}
          {canEditDocument ? <button type="button" className="secondary" disabled={transitioning} onClick={() => void act('revisions/from-current-costs')}>{canPrint ? 'Recalcular con costos actuales' : 'Calcular cotización'}</button> : null}
          {canEditDocument ? <button type="button" className="secondary" disabled={transitioning} onClick={() => void act('cancel')}>Cancelar cotización</button> : null}
        </div>
        {canEditDocument && orderPending ? <p className="hint">Si cancelás la cotización, el presupuesto pasa a Descartados.</p> : null}
      </details> : null}
    </section>

    {editing ? <form className="card edit-quote no-print" aria-busy={transitioning} onSubmit={event => { event.preventDefault(); void saveDraft(); }}><h2>Editar líneas del borrador</h2>
      <label>Cliente / referencia<input disabled={transitioning} maxLength={200} value={draftCustomerReference} onChange={event => setDraftCustomerReference(event.target.value)} /></label>
      {editing.map((line, lineIndex) => <fieldset key={line.id} disabled={transitioning}><legend>Línea {lineIndex + 1}</legend>
        <label>Descripción<input value={line.description} onChange={event => patchLine(line.id, { description: event.target.value })} required /></label>
        <label>Horas de impresión<input type="number" min="0.01" step="any" value={line.request.printDurationHours} onChange={event => patchLine(line.id, { request: { ...line.request, printDurationHours: Number(event.target.value), occupiedPrinterHours: Number(event.target.value) } })} required /></label>
        {line.request.materials.map((material, materialIndex) => <label key={`${line.id}-${materialIndex}`}>Filamento {materialIndex + 1}<span className="inline-fields"><select value={material.spoolId} onChange={event => {
          const materials = line.request.materials.map((item, index) => index === materialIndex ? { ...item, spoolId: event.target.value } : item);
          patchLine(line.id, { request: { ...line.request, materials } });
        }}>{filaments.filter(x => x.isActive).map(row => <option key={row.id} value={row.id}>{row.material} · {row.color}</option>)}</select>
          <input aria-label={`${usesBaseGrams(material) ? 'Gramos base' : 'Gramos'} línea ${lineIndex + 1} material ${materialIndex + 1}`} type="number" min="0" step="any" value={editableGrams(material)} onChange={event => patchMaterial(line.id, materialIndex, Number(event.target.value))} /></span></label>)}
        {editing.length > 1 ? <button type="button" className="secondary" onClick={() => setEditing(current => current?.filter(x => x.id !== line.id) ?? null)}>Quitar línea</button> : null}
      </fieldset>)}
      {editOutdated ? <p className="hint">Salí de la edición para volver a la revisión actual.</p> : null}
      <div className="actions"><button type="submit" disabled={transitioning || editOutdated}>Guardar revisión del borrador</button><button type="button" className="secondary" disabled={transitioning} onClick={() => setEditing(null)}>Salir de la edición</button></div>
    </form> : null}

    <article className="card no-print internal-quote" aria-label="Información interna de la cotización">
      <h2>{canPrint ? 'Resumen interno' : 'Cotización incompleta'}</h2>
      {!canPrint ? <p className="warning">Revisá los costos obligatorios para generar una revisión utilizable.</p> : null}
      <dl className="breakdown"><div><dt>Costo completo</dt><dd>{formatPyg(totalCost)}</dd></div><div><dt>Ganancia estimada</dt><dd>{formatPyg(totalProfit)}</dd></div><div><dt>Total cliente</dt><dd>{formatPyg(total)}</dd></div></dl>
      {lines.flatMap(line => line.warnings ?? []).map(warning => <p className={warning.blocksPrice ? 'warning' : 'hint'} key={`${warning.code}-${warning.field ?? ''}`}>{warning.message}</p>)}
    </article>

    {canPrint ? <article className="quote-document card" aria-label="Cotización imprimible para cliente">
      <header className="quote-document-header"><div className="client-brand"><img src={MASTER_LOGO_PATH} alt="" /><div><h1>{settings?.visibleAppName || APP_NAME}</h1><p>Cotización de impresión 3D · {data.code}</p></div></div><div><strong>{formatPyg(total)}</strong><span>Total</span></div></header>
      <dl className="document-meta"><div><dt>Fecha</dt><dd>{formatLocalDate(data.createdAt)}</dd></div><div><dt>Validez</dt><dd>{data.validUntil ?? 'Sin vencimiento'}</dd></div>
        {data.customerReference ? <div><dt>Cliente / referencia</dt><dd>{data.customerReference}</dd></div> : customer ? <><div><dt>Cliente</dt><dd>{customer.name}</dd></div>{customer.phone ? <div><dt>Teléfono del cliente</dt><dd>{customer.phone}</dd></div> : null}{customer.email ? <div><dt>Email del cliente</dt><dd>{customer.email}</dd></div> : null}</> : null}</dl>
      {data.itemDescription ? <p>{data.itemDescription}</p> : null}
      <section><h2>Detalle</h2>{lines.map((line, index) => <article className="quote-line" key={line.id}><div className="quote-line-heading"><h3>{index + 1}. {line.description}</h3><strong>{formatPyg(line.breakdown.customerTotalGs)}</strong></div>
        <dl className="breakdown compact-breakdown"><div><dt>Cantidad</dt><dd>{line.breakdown.quantity}</dd></div><div><dt>Precio unitario</dt><dd>{formatPyg(line.breakdown.unitPriceGs)}</dd></div><div><dt>Total de línea</dt><dd>{formatPyg(line.breakdown.customerTotalGs)}</dd></div><div><dt>Impuesto</dt><dd>{formatPyg(line.breakdown.taxGs)}</dd></div></dl>
      </article>)}</section>
      <dl className="quote-totals"><div><dt>Impuesto</dt><dd>{formatPyg(totalTax)}</dd></div><div className="grand-total"><dt>Total final</dt><dd>{formatPyg(total)}</dd></div></dl>
      {data.notes ? <section><h2>Notas</h2><p>{data.notes}</p></section> : null}{data.terms ? <section><h2>Términos</h2><p>{data.terms}</p></section> : null}
    </article> : null}
  </section>;
}

interface ActualMaterialDraft { id: string; spoolId: string; grams: number }
interface ActualLaborDraft { id: string; category: string; minutes: number }
interface ActualAdditionalDraft { id: string; description: string; amountGs: number }

export function JobDetailScreen({ id }: { id: string }) {
  const [data, setData] = useState<JobView | null>(null);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(0); const [kwh, setKwh] = useState(0); const [charged, setCharged] = useState(0); const [actualTax, setActualTax] = useState(0);
  const [prefilled, setPrefilled] = useState(false);
  const [attempts, setAttempts] = useState(1); const [failedAttempts, setFailedAttempts] = useState(0); const [overhead, setOverhead] = useState(0); const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<ActualMaterialDraft[]>([]);
  const [labor, setLabor] = useState<ActualLaborDraft[]>([]);
  const [additional, setAdditional] = useState<ActualAdditionalDraft[]>([]);
  const refresh = () => get<JobView>(`/api/jobs/${id}`).then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Error'));
  useEffect(() => { void refresh(); get<Filament[]>('/api/filaments').then(setFilaments).catch(() => undefined); }, [id]);
  const estimateLines = revisionLines(data?.estimate);
  useEffect(() => {
    if (!data || prefilled) return;
    const lines = revisionLines(data.estimate);
    const materialTotals = new Map<string, number>();
    lines.flatMap(line => line.breakdown.materials).forEach(material => {
      if (material.spoolId) materialTotals.set(material.spoolId, (materialTotals.get(material.spoolId) ?? 0) + material.totalChargeableGrams);
    });
    setMaterials([...materialTotals].map(([spoolId, grams]) => ({ id: crypto.randomUUID(), spoolId, grams })));
    setHours(lines.reduce((sum, line) => sum + line.breakdown.machine.totalOccupiedHours, 0));
    setKwh(lines.reduce((sum, line) => sum + line.breakdown.energy.totalKWh, 0));
    setCharged(lines.reduce((sum, line) => sum + line.breakdown.customerTotalGs, 0));
    setActualTax(lines.reduce((sum, line) => sum + line.breakdown.taxGs, 0));
    setPrefilled(true);
  }, [data, prefilled]);
  const status = data?.status ?? '';
  const transition = async (action: string) => {
    try { await post(`/api/jobs/${id}/${action}`); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Error'); }
  };
  const complete = async () => {
    try {
      await post(`/api/jobs/${id}/complete`, {
        actualOccupiedHours: hours, actualKWh: kwh, attempts, failedAttempts,
        materials: materials.map(({ spoolId, grams }) => ({ spoolId, grams })),
        labor: labor.map(({ category, minutes }) => ({ category, minutes })),
        additionalCosts: additional.map(({ description, amountGs }) => ({ description, amountGs, scope: 'FixedPerOrder', repeatOnFailure: false, isInternalCost: true, participatesInMargin: true })),
        actualOverheadGs: overhead, actualCustomerTotalGs: charged, actualTaxGs: actualTax, notes: notes || null
      });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Error'); }
  };

  if (!data) return <section className="page"><h1>Trabajo</h1><p>{error ?? 'Cargando…'}</p></section>;
  const estimatedCost = estimateLines.reduce((sum, line) => sum + line.breakdown.fullyLoadedCostGs, 0);
  return <section className="page"><div className="page-heading"><div><h1>{data.code}</h1><p>Estado: {statusLabel(status)}</p></div></div>
    {error ? <p className="error">{error}</p> : null}<div className="actions">
      {status === 'Planned' ? <button onClick={() => void transition('start')}>Iniciar</button> : null}
      {status === 'Printing' ? <button onClick={() => void transition('pause')}>Pausar</button> : null}
      {status === 'Paused' ? <button onClick={() => void transition('resume')}>Reanudar</button> : null}
      {['Printing', 'Paused'].includes(status) ? <button className="secondary" onClick={() => void transition('fail')}>Marcar fallido</button> : null}
      {['Planned', 'Printing', 'Paused'].includes(status) ? <button className="secondary" onClick={() => void transition('cancel')}>Cancelar</button> : null}
    </div>
    <section className="metric-grid"><article><span>Costo estimado</span><strong>{formatPyg(estimatedCost)}</strong></article><article><span>Creado</span><strong>{formatLocalDate(data.createdAt)}</strong></article>
      <article><span>Intentos</span><strong>{data.actualInput?.attempts ?? '—'}</strong></article><article><span>Fallas</span><strong>{data.actualInput?.failedAttempts ?? '—'}</strong></article></section>

    {['Printing', 'Paused'].includes(status) ? <form className="card actuals-form" onSubmit={event => { event.preventDefault(); void complete(); }}><h2>Registrar costos reales</h2>
      <div className="form-grid"><label>Horas reales<input type="number" min="0" step="0.01" value={hours} onChange={event => setHours(Number(event.target.value))} /></label>
        <label>kWh reales<input type="number" min="0" step="0.001" value={kwh} onChange={event => setKwh(Number(event.target.value))} /></label>
        <label>Intentos<input type="number" min="1" step="1" value={attempts} onChange={event => setAttempts(Number(event.target.value))} /></label>
        <label>Intentos fallidos<input type="number" min="0" max={attempts} step="1" value={failedAttempts} onChange={event => setFailedAttempts(Number(event.target.value))} /></label></div>
      <h3>Filamentos reales</h3>{materials.map(row => <div className="dynamic-row" key={row.id}><select aria-label="Filamento real" value={row.spoolId} onChange={event => setMaterials(current => current.map(item => item.id === row.id ? { ...item, spoolId: event.target.value } : item))}>{filaments.filter(x => x.isActive).map(item => <option key={item.id} value={item.id}>{item.material} · {item.color}</option>)}</select>
        <input aria-label="Gramos reales" type="number" min="0.01" step="0.01" value={row.grams} onChange={event => setMaterials(current => current.map(item => item.id === row.id ? { ...item, grams: Number(event.target.value) } : item))} required />
        <button type="button" className="secondary" onClick={() => setMaterials(current => current.filter(item => item.id !== row.id))}>Quitar</button></div>)}
      <button type="button" className="secondary" onClick={() => setMaterials(current => [...current, { id: crypto.randomUUID(), spoolId: filaments.find(x => x.isActive)?.id ?? '', grams: 0 }])}>Agregar filamento</button>
      <h3>Trabajo real</h3>{labor.map(row => <div className="dynamic-row" key={row.id}><input aria-label="Categoría de trabajo real" value={row.category} onChange={event => setLabor(current => current.map(item => item.id === row.id ? { ...item, category: event.target.value } : item))} />
        <input aria-label="Minutos de trabajo real" type="number" min="0" value={row.minutes} onChange={event => setLabor(current => current.map(item => item.id === row.id ? { ...item, minutes: Number(event.target.value) } : item))} /><button type="button" className="secondary" onClick={() => setLabor(current => current.filter(item => item.id !== row.id))}>Quitar</button></div>)}
      <button type="button" className="secondary" onClick={() => setLabor(current => [...current, { id: crypto.randomUUID(), category: estimateLines.flatMap(line => (line.request.labor as Array<{ category?: string }> | undefined) ?? [])[0]?.category ?? 'Setup', minutes: 0 }])}>Agregar trabajo</button>
      <h3>Consumibles reales</h3>{additional.map(row => <div className="dynamic-row" key={row.id}><input aria-label="Descripción del consumible" value={row.description} onChange={event => setAdditional(current => current.map(item => item.id === row.id ? { ...item, description: event.target.value } : item))} />
        <input aria-label="Costo real del consumible" type="number" min="0" value={row.amountGs} onChange={event => setAdditional(current => current.map(item => item.id === row.id ? { ...item, amountGs: Number(event.target.value) } : item))} /><button type="button" className="secondary" onClick={() => setAdditional(current => current.filter(item => item.id !== row.id))}>Quitar</button></div>)}
      <button type="button" className="secondary" onClick={() => setAdditional(current => [...current, { id: crypto.randomUUID(), description: 'Consumible', amountGs: 0 }])}>Agregar consumible</button>
      <div className="form-grid actual-summary"><label>Overhead real (Gs)<input type="number" min="0" value={overhead} onChange={event => setOverhead(Number(event.target.value))} /></label>
        <label>Total finalmente cobrado al cliente (Gs)<input type="number" min="0" value={charged} onChange={event => setCharged(Number(event.target.value))} /></label>
        <label>Impuesto real incluido/cobrado (Gs)<input type="number" min="0" max={charged} value={actualTax} onChange={event => setActualTax(Number(event.target.value))} /></label>
        <label className="span-2">Notas<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} /></label></div>
      <button type="submit">Completar trabajo</button></form> : null}

    <article className="card"><h2>Estimación</h2>{estimateLines.map((line, index) => <div className="readable-line" key={line.id}><strong>{index + 1}. {line.description}</strong><span>{formatPyg(line.breakdown.fullyLoadedCostGs)} costo · {formatPyg(line.breakdown.customerTotalGs)} precio</span></div>)}</article>
    {data.actualResult ? <article className="card"><h2>Resultado real</h2><dl className="breakdown"><div><dt>Material</dt><dd>{formatPyg(data.actualResult.materialCostGs)}</dd></div><div><dt>Electricidad</dt><dd>{formatPyg(data.actualResult.electricityCostGs)}</dd></div><div><dt>Máquina</dt><dd>{formatPyg(data.actualResult.machineCostGs)}</dd></div><div><dt>Trabajo</dt><dd>{formatPyg(data.actualResult.laborCostGs)}</dd></div><div><dt>Consumibles</dt><dd>{formatPyg(data.actualResult.additionalCostGs)}</dd></div><div><dt>Overhead</dt><dd>{formatPyg(data.actualResult.overheadGs)}</dd></div><div className="total"><dt>Costo completo</dt><dd>{formatPyg(data.actualResult.fullyLoadedCostGs)}</dd></div><div><dt>Total cliente</dt><dd>{formatPyg(data.actualResult.actualCustomerTotalGs)}</dd></div><div><dt>Impuesto real</dt><dd>{formatPyg(data.actualResult.actualTaxGs)}</dd></div><div><dt>Venta neta</dt><dd>{formatPyg(data.actualResult.actualNetSalePriceGs)}</dd></div><div><dt>Comisión variable</dt><dd>{formatPyg(data.actualResult.variableSellingFeeGs)}</dd></div><div><dt>Ingreso después de comisiones</dt><dd>{formatPyg(data.actualResult.netRevenueAfterSellingFeesGs)}</dd></div><div><dt>Ganancia</dt><dd>{formatPyg(data.actualResult.realizedProfitGs)}</dd></div><div><dt>Margen</dt><dd>{formatDecimal(data.actualResult.realizedMarginPercent)}%</dd></div></dl>
      {data.actualDetails ? <><h3>Detalle persistido</h3>{data.actualDetails.materials.map((row, index) => <p key={`${row.spoolId}-${index}`}>Filamento {index + 1}: {formatDecimal(row.grams)} g · {formatPyg(row.costGs)}</p>)}{data.actualDetails.labor.map((row, index) => <p key={`${row.category}-${index}`}>{row.category}: {formatDecimal(row.minutes)} min · {formatPyg(row.costGs)}</p>)}</> : null}</article> : null}
  </section>;
}

function ListPage({ title, action, onAction, error, children }: { title: string; action?: string; onAction?: () => void; error: string | null; children: React.ReactNode }) {
  return <section className="page"><div className="page-heading"><div><h1>{title}</h1></div>{action ? <button onClick={onAction}>{action}</button> : null}</div>
    {error ? <p className="error">{error}</p> : null}<div className="card list">{children}</div></section>;
}

export function JsonCard({ data }: { data: unknown }) {
  return <article className="card readable-data"><ReadableValue value={data} /></article>;
}

function ReadableValue({ value }: { value: unknown }): React.ReactNode {
  if (value == null) return <span>—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Sí' : 'No'}</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return <div className="readable-array">{value.length ? value.map((item, index) => <div className="readable-item" key={index}><ReadableValue value={item} /></div>) : <span>Sin registros</span>}</div>;
  return <dl className="readable-object">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key}><dt>{humanize(key)}</dt><dd><ReadableValue value={item} /></dd></div>)}</dl>;
}

const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase());
