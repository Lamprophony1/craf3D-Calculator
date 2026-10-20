import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpToLine, Plus, Search } from 'lucide-react';
import { ApiError, get, post, put } from '../api/client';
import { type Order, type OrderPage, type OrderStatus, orderLabels, orderNext } from '../api/orders';
import { navigate } from '../components/AppShell';
import { formatPyg } from '../utils/format';

const PAGE_SIZE = 25;
const errorText = (e: unknown) => e instanceof Error ? e.message : 'No pudimos completar la operación. Reintentá.';
const dateText = (value: string | null) => value ? new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : 'Sin fecha';
const title = (order: Order) => order.customerReference || order.description || order.code;
const pending = (order: Order) => order.status === 'Draft' || order.status === 'Discarded';
const recordPath = (order: Order, quotes: boolean) => quotes ? pending(order) ? `/quotes/pending/${order.id}` : order.quoteId ? `/quotes/${order.quoteId}` : `/orders/${order.id}` : `/orders/${order.id}`;

export function OrdersScreen({ area = 'orders' }: { area?: 'orders' | 'quotes' }) {
  const quotes = area === 'quotes';
  const noun = quotes ? 'presupuestos' : 'pedidos';
  const [view, setView] = useState(quotes ? 'drafts' : 'active');
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<OrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(null);
    const query = new URLSearchParams({ view, search, skip: String(skip), take: String(PAGE_SIZE) });
    get<OrderPage>(`/api/orders?${query}`).then(value => {
      if (!current) return;
      setData(value);
      if (skip > 0 && skip >= value.total) setSkip(Math.max(0, Math.floor((value.total - 1) / PAGE_SIZE) * PAGE_SIZE));
    }).catch(e => { if (current) setError(errorText(e)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [view, search, skip, refresh]);
  const act = async (order: Order, action: 'status' | 'move', value: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await post(`/api/orders/${order.id}/${action}`, { [action === 'move' ? 'direction' : 'status']: value, version: order.version });
      setNotice(action === 'move' ? 'Prioridad actualizada.' : value === 'Discarded' ? 'Presupuesto descartado. Podés recuperarlo en Descartados.' : value === 'Draft' ? 'Presupuesto recuperado en Pendientes.' : value === 'Confirmed' ? 'Pedido confirmado.' : 'Pedido actualizado.');
      setRefresh(x => x + 1);
      if (value === 'Confirmed') navigate(`/orders/${order.id}`);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const changeView = (value: string) => { setView(value); setSkip(0); setNotice(null); };
  return <section className="page orders-page">
    <header className="page-heading"><div><h1>{quotes ? 'Presupuestos' : 'Pedidos'}</h1><p>{quotes ? 'Cada cotización queda acá hasta que confirmes si se aceptó.' : 'Pedidos confirmados, lo que sigue y lo que ya entregaste.'}</p></div>
      <button type="button" onClick={() => navigate(quotes ? '/' : '/orders/new')}><Plus size={18} aria-hidden="true" />{quotes ? 'Nuevo presupuesto' : 'Nuevo pedido'}</button></header>
    <div className="order-toolbar"><div className="order-tabs" aria-label={`Ver ${noun}`}>
      {(quotes ? [['drafts', 'Pendientes', data?.draftCount], ['quoted', 'Con pedido', null], ['discarded', 'Descartados', null]] : [['active', 'Confirmados', data?.activeCount], ['history', 'Historial', null]]).map(([key, label, count]) =>
        <button key={String(key)} type="button" className="secondary" aria-pressed={view === key} onClick={() => changeView(String(key))}>{label}{count != null ? ` (${count})` : ''}</button>)}
    </div><label className="order-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar {noun}</span><input type="search" aria-label={`Buscar ${noun}`} placeholder="Cliente, trabajo o código" value={search} onChange={e => { setSearch(e.target.value); setSkip(0); }} /></label></div>
    {quotes && view === 'drafts' ? <p className="hint">Son borradores pendientes de aceptación. Al confirmar, pasan a Pedidos; si no se aceptan, podés descartarlos.</p> : null}
    {view === 'active' ? <p className="hint">Ordená qué atender primero con las flechas. La prioridad se conserva aunque cambien las fechas.</p> : null}
    {notice ? <p className="notice" role="status">{notice}</p> : null}
    {error ? <div className="error" role="alert">{error} <button type="button" className="secondary" onClick={() => setRefresh(x => x + 1)}>Actualizar lista</button></div> : null}
    {loading ? <div className="orders-loading" role="status">Cargando {noun}…</div> : !error && data?.items.length === 0 ?
      <div className="empty-state card"><h2>{search ? 'No encontramos coincidencias' : view === 'drafts' ? 'Los próximos presupuestos quedarán acá' : quotes ? 'No hay presupuestos en esta vista' : view === 'active' ? 'No hay pedidos en esta cola' : 'No hay pedidos en esta vista'}</h2>
        <p>{search ? 'Probá otra referencia o descripción.' : quotes ? 'Cada cotización se conserva como borrador para confirmar o descartar.' : 'Confirmá un presupuesto o cargá un precio acordado directamente.'}</p>
        <button type="button" onClick={() => navigate(quotes ? '/' : '/orders/new')}>{quotes ? 'Cotizar' : 'Agregar pedido'}</button></div> :
      <ol className="orders-list" aria-label={quotes ? 'Presupuestos' : 'Pedidos'} aria-busy={busy}>{data?.items.map(order => <li key={order.id} className="order-row">
        <div className="order-main"><a href={recordPath(order, quotes)} onClick={e => { e.preventDefault(); navigate(recordPath(order, quotes)); }}>{title(order)}</a>
          {order.description && order.customerReference ? <p>{order.description}</p> : null}<small>{view === 'active' ? `Prioridad ${order.position} · ` : ''}{order.code} · {order.quantity} {order.quantity === 1 ? 'unidad' : 'unidades'}</small>
          <span className="status-badge">{order.status === 'Draft' ? 'Borrador · pendiente de aceptación' : orderLabels[order.status]}</span>{order.productionStatus === 'Failed' ? <strong className="error">Revisar producción fallida</strong> : null}
        </div>
        <dl className="order-info"><div><dt>Entrega prevista</dt><dd>{dateText(order.dueDate)}</dd></div><div><dt>{order.status === 'Draft' ? 'Total presupuestado' : 'Total acordado'}</dt><dd>{order.totalGs == null ? 'Sin definir' : formatPyg(order.totalGs)}</dd></div></dl>
        <div className="order-row-actions">
          {view === 'active' ? <div className="order-priority" aria-label={`Prioridad de ${title(order)}`}>
            <button type="button" className="secondary icon-button" disabled={busy || order.position === 1} aria-label={`Subir a ${title(order)}`} onClick={() => void act(order, 'move', 'up')}><ArrowUp size={18} /></button>
            <button type="button" className="secondary icon-button" disabled={busy} aria-label={`Bajar a ${title(order)}`} onClick={() => void act(order, 'move', 'down')}><ArrowDown size={18} /></button>
            <button type="button" className="secondary icon-button" disabled={busy || order.position === 1} aria-label={`Poner primero a ${title(order)}`} onClick={() => void act(order, 'move', 'first')}><ArrowUpToLine size={18} /></button>
          </div> : null}
          {order.status === 'Draft' ? <><button type="button" disabled={busy} onClick={() => { if (!order.customerReference?.trim() || order.totalGs == null) navigate(`/quotes/pending/${order.id}`); else void act(order, 'status', 'Confirmed'); }}>{!order.customerReference?.trim() || order.totalGs == null ? 'Completar y confirmar' : 'Confirmar pedido'}</button><button type="button" className="quiet" disabled={busy} onClick={() => void act(order, 'status', 'Discarded')}>Descartar</button></> : order.status === 'Discarded' ?
            <button type="button" className="secondary" disabled={busy} onClick={() => void act(order, 'status', 'Draft')}>Recuperar presupuesto</button> :
            <button type="button" className="secondary" onClick={() => navigate(`/orders/${order.id}`)}>Ver pedido</button>}
        </div></li>)}</ol>}
    {data && data.total > PAGE_SIZE ? <nav className="order-pagination" aria-label={`Páginas de ${noun}`}><button type="button" className="secondary" disabled={!skip || loading} onClick={() => setSkip(x => Math.max(0, x - PAGE_SIZE))}>Anterior</button><span>{skip + 1}–{Math.min(skip + PAGE_SIZE, data.total)} de {data.total}</span><button type="button" className="secondary" disabled={skip + PAGE_SIZE >= data.total || loading} onClick={() => setSkip(x => x + PAGE_SIZE)}>Siguiente</button></nav> : null}
  </section>;
}

interface Fields { customerReference: string; description: string; quantity: number; total: string; orderDate: string; dueDate: string; deliveredDate: string; notes: string; historical: boolean; historicalStatus: OrderStatus; }
const empty: Fields = { customerReference: '', description: '', quantity: 1, total: '', orderDate: '', dueDate: '', deliveredDate: '', notes: '', historical: false, historicalStatus: 'Delivered' };
const fromOrder = (order: Order): Fields => ({ customerReference: order.customerReference ?? '', description: order.description ?? '', quantity: order.quantity,
  total: order.totalGs == null ? '' : String(order.totalGs), orderDate: order.orderDate ?? '', dueDate: order.dueDate ?? '', deliveredDate: order.deliveredDate ?? '', notes: order.notes ?? '', historical: order.historical, historicalStatus: order.status });

export function OrderEditorScreen({ id, budget = false }: { id?: string; budget?: boolean }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmAttempt, setConfirmAttempt] = useState(false);
  const [reload, setReload] = useState(0);
  const saveId = useRef(crypto.randomUUID());
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!id) return;
    let current = true; setLoading(true); setError(null);
    get<Order>(`/api/orders/${id}`).then(value => { if (current) { setOrder(value); setFields(fromOrder(value)); } }).catch(e => { if (current) setError(errorText(e)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, reload]);
  const change = <K extends keyof Fields>(key: K, value: Fields[K]) => { setFields(current => ({ ...current, [key]: value })); setNotice(null); };
  const save = async (confirm: boolean) => {
    if (busy || !form.current?.reportValidity()) return;
    confirm = confirm || (!order && !fields.historical);
    const target = fields.historical && !order ? fields.historicalStatus : confirm ? 'Confirmed' : order?.status ?? 'Draft';
    if (confirm && !fields.historical && (!fields.customerReference.trim() || fields.total === '')) {
      setConfirmAttempt(true); setConflict(false); setError('Completá cliente/referencia e importe total para confirmar.');
      (form.current.elements.namedItem(!fields.customerReference.trim() ? 'customerReference' : 'totalGs') as HTMLInputElement)?.focus();
      return;
    }
    setBusy(true); setError(null);
    try {
      const body = { id: order?.id ?? saveId.current, customerReference: fields.customerReference.trim() || null, description: fields.description.trim() || null,
        quantity: fields.quantity, totalGs: fields.total === '' ? null : Number(fields.total), status: target, orderDate: fields.orderDate || null,
        dueDate: fields.dueDate || null, deliveredDate: fields.deliveredDate || null, notes: fields.notes.trim() || null, historical: fields.historical, version: order?.version ?? 0 };
      let saved = order ? await put<Order>(`/api/orders/${order.id}`, body) : await post<Order>('/api/orders', body);
      if (order && confirm && order.status === 'Draft') saved = await post<Order>(`/api/orders/${saved.id}/status`, { status: 'Confirmed', version: saved.version });
      setOrder(saved); setFields(fromOrder(saved)); setNotice(confirm ? 'Pedido confirmado.' : 'Cambios guardados.');
      if (!id || confirm && budget) navigate(`/orders/${saved.id}`);
      return saved;
    } catch (e) { setConflict(e instanceof ApiError && e.status === 409); setError(errorText(e)); } finally { setBusy(false); }
  };
  const transition = async (status: OrderStatus) => {
    if (!order || busy) return;
    const current = await save(false); if (!current) return;
    setBusy(true); setError(null);
    try { const saved = await post<Order>(`/api/orders/${current.id}/status`, { status, version: current.version }); setOrder(saved); setFields(fromOrder(saved)); setNotice('Estado actualizado.'); }
    catch (e) { setConflict(e instanceof ApiError && e.status === 409); setError(errorText(e)); } finally { setBusy(false); }
  };
  const refreshVersion = async () => {
    if (!order || busy) return;
    setBusy(true);
    try {
      const latest = await get<Order>(`/api/orders/${order.id}`);
      setOrder(latest); setError(null);
      setNotice('Versión actualizada. Conservamos tus datos pendientes; revisalos antes de guardar sobre la versión actual.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  if (loading) return <section className="page"><h1>Pedido</h1><p role="status">Cargando pedido…</p></section>;
  if (id && !order) return <section className="page"><h1>Pedido</h1><p className="error" role="alert">{error}</p><button onClick={() => setReload(x => x + 1)}>Reintentar</button></section>;
  const next = order ? orderNext[order.status] : null;
  const isBudget = order ? pending(order) : budget;
  return <section className="page order-editor">
    <button type="button" className="quiet" onClick={() => navigate(isBudget ? '/quotes' : '/jobs')}>{isBudget ? 'Volver a presupuestos' : 'Volver a pedidos'}</button>
    <header className="page-heading"><div><h1>{order ? title(order) : 'Nuevo pedido'}</h1><p>{order ? `${order.code} · ${order.status === 'Draft' ? 'Presupuesto pendiente de aceptación' : orderLabels[order.status]}` : 'Cargá un pedido con un precio ya acordado.'}</p></div></header>
    {error ? <div className="error" role="alert">{error}{order && conflict ? <button type="button" className="secondary" disabled={busy} onClick={() => void refreshVersion()}>Actualizar versión conservando mis datos</button> : null}</div> : null}{notice ? <p className="notice" role="status">{notice}</p> : null}
    <form ref={form} className="order-form" onSubmit={e => { e.preventDefault(); void save(false); }}>
      <fieldset className="order-form-main" disabled={busy}><label>Cliente / referencia<input aria-label="Cliente / referencia" name="customerReference" maxLength={200} value={fields.customerReference} aria-invalid={confirmAttempt && !fields.customerReference.trim()} onChange={e => change('customerReference', e.target.value)} placeholder="Ej.: Ana · WhatsApp" />{confirmAttempt && !fields.customerReference.trim() ? <small className="field-error">Ingresá una referencia para confirmar.</small> : null}</label>
        <label>Qué se va a imprimir (opcional)<textarea rows={2} maxLength={1000} value={fields.description} onChange={e => change('description', e.target.value)} placeholder="Ej.: Soporte para auriculares" /></label>
        <div className="order-pair"><label>Cantidad<input type="number" min="1" step="1" required value={fields.quantity} onChange={e => change('quantity', Number(e.target.value))} /></label>
          <label>{isBudget ? 'Importe presupuestado (Gs.)' : 'Importe total acordado (Gs.)'}<input aria-label={isBudget ? 'Importe presupuestado (Gs.)' : 'Importe total acordado (Gs.)'} name="totalGs" aria-describedby="order-total-help" type="number" min="0" step="any" inputMode="numeric" value={fields.total} aria-invalid={confirmAttempt && fields.total === ''} onChange={e => change('total', e.target.value)} />{confirmAttempt && fields.total === '' ? <small className="field-error">Indicá el importe total.</small> : null}<small id="order-total-help">El total por todo el pedido, sin multiplicar por cantidad.</small></label></div>
        {!order ? <label className="order-check"><input type="checkbox" checked={fields.historical} onChange={e => change('historical', e.target.checked)} />Registrar un trabajo anterior</label> : null}
        {fields.historical && !order ? <label>Estado del trabajo<select value={fields.historicalStatus} onChange={e => change('historicalStatus', e.target.value as OrderStatus)}><option value="Delivered">Entregado</option><option value="Ready">Listo para entregar</option><option value="Confirmed">Confirmado</option><option value="Cancelled">Cancelado</option></select><small>Podés dejar sin completar los datos que no conozcas.</small></label> : null}
        <div className="order-pair"><label>Fecha del pedido (opcional)<input type="date" value={fields.orderDate} onChange={e => change('orderDate', e.target.value)} /></label><label>Entrega prevista (opcional)<input type="date" value={fields.dueDate} onChange={e => change('dueDate', e.target.value)} /></label></div>
        {fields.historical || order?.status === 'Delivered' ? <label>Fecha de entrega (opcional)<input type="date" value={fields.deliveredDate} onChange={e => change('deliveredDate', e.target.value)} /></label> : null}
        <label>Notas (opcional)<textarea rows={3} maxLength={4000} value={fields.notes} onChange={e => change('notes', e.target.value)} /></label>
      </fieldset>
      <div className="order-save-actions">
        {!order && !fields.historical ? <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Crear pedido'}</button> :
          <><button type="submit" disabled={busy}>{busy ? 'Guardando…' : order ? isBudget ? 'Guardar presupuesto' : 'Guardar cambios' : 'Registrar trabajo anterior'}</button>{order?.status === 'Draft' ? <button type="button" className="secondary" disabled={busy} onClick={() => void save(true)}>Confirmar pedido</button> : null}</>}
      </div>
    </form>
    {order ? <section className="order-followup"><h2>Seguimiento</h2><div className="actions">{next && order.status !== 'Draft' && order.status !== 'Discarded' ? <button type="button" disabled={busy} onClick={() => void transition(next.status)}>{next.label}</button> : null}
      {order.status === 'Draft' ? <button type="button" className="secondary" disabled={busy} onClick={() => void transition('Discarded')}>Descartar presupuesto</button> : order.status === 'Discarded' ? <button type="button" className="secondary" disabled={busy} onClick={() => void transition('Draft')}>Recuperar presupuesto</button> : null}
      {['Confirmed', 'InProgress', 'Ready'].includes(order.status) ? <button type="button" className="quiet" disabled={busy} onClick={() => void transition('Cancelled')}>Cancelar pedido</button> : null}</div>
      <details><summary>Presupuesto, producción y costos</summary><p>{order.quoteId ? <a href={`/quotes/${order.quoteId}`} onClick={e => { e.preventDefault(); navigate(`/quotes/${order.quoteId}`); }}>Ver presupuesto de origen</a> : 'Precio acordado manualmente.'}</p>
        {order.jobId ? <p><a href={`/jobs/${order.jobId}`} onClick={e => { e.preventDefault(); navigate(`/jobs/${order.jobId}`); }}>Ver producción y costos registrados</a></p> : <p>Sin costos reales registrados. Ganancia sin calcular.</p>}
        {order.productionStatus === 'Completed' && order.status !== 'Delivered' ? <p>Producción terminada; entrega sin registrar.</p> : null}
      </details></section> : null}
  </section>;
}
