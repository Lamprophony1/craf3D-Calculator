import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { ApiError, get, post } from '../api/client';
import { type Order, type OrderPage, type OrderStatus, orderLabels } from '../api/orders';
import { navigate } from '../components/AppShell';
import { formatPyg } from '../utils/format';
import { OrderPriorityDialog, OrderPriorityList, PriorityOrderRow } from './OrderPriority';
import {
  DELIVERY_DETAILS_PATH, ORDER_LIST_PAGE_SIZE, orderConfirmationState, orderListDeparture, orderListHref, orderListPath, readOrderListPoint,
  readOrderListQuery, rememberOrderList, replaceOrderListLocation,
  type OrderListArea, type OrderListControl, type OrderListNotice, type OrderListPoint, type OrderListQuery, type OrderListView
} from './orderListNavigation';

const errorText = (error: unknown) => error instanceof Error ? error.message : 'No pudimos completar la operación. Reintentá.';
const dateText = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  : 'Sin fecha';
const title = (order: Order) => order.customerReference || order.description || order.code;

function recordPath(order: Order, quotes: boolean) {
  if (quotes && (order.status === 'Draft' || order.status === 'Discarded')) return `/quotes/pending/${order.id}`;
  if (quotes && order.quoteId) return `/quotes/${order.quoteId}`;
  return `/orders/${order.id}`;
}

function plainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

function rowControl(list: HTMLElement | null, id: string, preferred: OrderListControl) {
  const row = Array.from(list?.querySelectorAll<HTMLElement>('[data-order-id]') ?? [])
    .find(element => element.dataset.orderId === id);
  for (const action of [preferred, 'priority', 'open', 'record']) {
    const target = row?.querySelector<HTMLElement>(`[data-order-control="${action}"]`);
    if (target && !target.matches(':disabled, [aria-disabled="true"]')) return target;
  }
}

type RequestKey = { href: string; refresh: number };
type ListResult = RequestKey & { page: OrderPage };
type ListError = RequestKey & { message: string };
type OrderAction = { kind: 'status'; status: OrderStatus }
  | { kind: 'move'; position: number; expectedTargetId?: string };
type Mutation = {
  href: string;
  order: Order;
  action: 'status' | 'move';
  control: OrderListControl;
  trigger: HTMLButtonElement;
  restoreFocus: boolean;
};

export function OrdersScreen({ area = 'orders' }: { area?: OrderListArea }) {
  const quotes = area === 'quotes';
  const noun = quotes ? 'presupuestos' : 'pedidos';
  const path = orderListPath(area);
  const [query, setQuery] = useState(() => readOrderListQuery(area, window.location.pathname === path ? window.location.search : ''));
  const href = orderListHref(area, query);
  const currentHref = useRef(href);
  const restorePoint = useRef<OrderListPoint | undefined>(readOrderListPoint(href));
  const [result, setResult] = useState<ListResult | null>(null);
  const [readError, setReadError] = useState<ListError | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writing, setWriting] = useState<OrderAction['kind'] | null>(null);
  const [prioritySelection, setPrioritySelection] = useState<{ order: Order; trigger: HTMLButtonElement } | null>(null);
  const [notice, setNotice] = useState<OrderListNotice | null>(restorePoint.current?.notice ?? null);
  const [refresh, setRefresh] = useState(0);
  const mounted = useRef(false);
  const writeLock = useRef(false);
  const mutation = useRef<Mutation | null>(null);
  const focusAfterRefresh = useRef<Mutation | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const noticeLink = useRef<HTMLAnchorElement>(null);

  const { view, search, page } = query;
  const skip = (page - 1) * ORDER_LIST_PAGE_SIZE;
  const data = result?.href === href ? result.page : null;
  const fresh = result?.href === href && result.refresh === refresh;
  const readFailure = readError?.href === href && readError.refresh === refresh ? readError.message : null;
  const loading = !fresh && !readFailure;
  const blocked = Boolean(writing) || !fresh;
  const error = writeError ?? readFailure;

  useEffect(() => {
    mounted.current = true;
    function syncLocation() {
      if (window.location.pathname !== path) return;
      const next = readOrderListQuery(area, window.location.search);
      const nextHref = orderListHref(area, next);
      const point = readOrderListPoint(nextHref);
      if (currentHref.current !== nextHref) {
        mutation.current = null;
        focusAfterRefresh.current = null;
      }
      restorePoint.current = point;
      if (nextHref !== `${path}${window.location.search}`) replaceOrderListLocation(nextHref, point);
      currentHref.current = nextHref;
      setQuery(next);
      setPrioritySelection(null);
      setNotice(point?.notice ?? null);
      setWriteError(null);
    }
    syncLocation();
    window.addEventListener('popstate', syncLocation);
    return () => {
      mounted.current = false;
      window.removeEventListener('popstate', syncLocation);
    };
  }, [area, path]);

  function changeQuery(next: OrderListQuery, point?: OrderListPoint) {
    const nextHref = orderListHref(area, next);
    currentHref.current = nextHref;
    restorePoint.current = point;
    if (window.location.pathname === path) replaceOrderListLocation(nextHref, point);
    setQuery(next);
  }

  useEffect(() => {
    let current = true;
    const isCurrent = () => current && currentHref.current === href;
    const params = new URLSearchParams({ view, search, skip: String(skip), take: String(ORDER_LIST_PAGE_SIZE) });
    get<OrderPage>(`/api/orders?${params}`).then(value => {
      if (!isCurrent()) return;
      const lastPage = Math.max(1, Math.ceil(value.total / ORDER_LIST_PAGE_SIZE));
      if (page > lastPage) {
        const next = { view, search, page: lastPage };
        const nextHref = orderListHref(area, next);
        const point = restorePoint.current;
        if (mutation.current?.href === href) mutation.current.href = nextHref;
        changeQuery(next, point ? { ...point, href: nextHref } : undefined);
        return;
      }
      const pending = mutation.current;
      if (pending?.href === href) {
        const stillOnPage = value.items.some(order => order.id === pending.order.id);
        if (pending.action === 'move') {
          const destination = Math.max(1, Math.ceil(pending.order.position / ORDER_LIST_PAGE_SIZE));
          setNotice({
            text: `Prioridad actualizada. ${title(pending.order)} quedó en la posición ${pending.order.position}.`,
            ...(!stillOnPage ? {
              href: orderListHref('orders', { view: 'active', search: '', page: destination }), label: 'Ver en Confirmados'
            } : {})
          });
        }
        focusAfterRefresh.current = pending;
        mutation.current = null;
      }
      const point = restorePoint.current;
      if (point?.orderId && !value.items.some(order => order.id === point.orderId)) {
        const recordHref = `/orders/${encodeURIComponent(point.orderId)}`;
        if (!point.notice) setNotice({ text: 'El registro ya no aparece en este resultado.', href: recordHref, label: 'Abrir registro' });
        // A return using browser history may reach an entry saved before the transition.
        void get<Order>(`/api${recordHref}`).then(order => {
          const destination = orderListDeparture(href, order);
          if (isCurrent() && destination) setNotice(destination);
        }).catch(() => { /* Keep the original list and its return link. */ });
      }
      setResult({ href, refresh, page: value });
    }).catch(reason => {
      if (isCurrent()) setReadError({ href, refresh, message: errorText(reason) });
    });
    return () => { current = false; };
  }, [area, href, page, refresh, search, skip, view]);

  useLayoutEffect(() => {
    if (!fresh) return;
    const point = restorePoint.current;
    if (point?.href === href) {
      restorePoint.current = undefined;
      const target = point.orderId && rowControl(list.current, point.orderId, point.control ?? 'record');
      window.scrollTo({ top: point.scrollY, behavior: 'instant' });
      if (target) target.focus({ preventScroll: true });
      else if (noticeLink.current) noticeLink.current.focus();
    }
    const completed = focusAfterRefresh.current;
    if (!completed || completed.href !== href) return;
    focusAfterRefresh.current = null;
    if (!completed.restoreFocus) return;
    const active = document.activeElement;
    if (active !== completed.trigger && active !== document.body) return;
    const target = rowControl(list.current, completed.order.id, completed.control) ?? noticeLink.current ?? searchInput.current;
    target?.focus();
  }, [fresh, href, result]);

  function open(pathname: string, orderId?: string, control?: OrderListControl, message?: OrderListNotice) {
    navigate(pathname, { state: rememberOrderList(href, orderId, control, message) });
  }

  async function act(order: Order, action: OrderAction, control: OrderListControl, trigger: HTMLButtonElement) {
    if (writeLock.current || blocked) return;
    const pathname = window.location.pathname;
    const restoreFocus = action.kind === 'move' || trigger === document.activeElement;
    writeLock.current = true;
    setWriting(action.kind);
    setNotice(null);
    setWriteError(null);
    try {
      const body = action.kind === 'move' ? {
        direction: 'position', position: action.position, version: order.version,
        ...(action.expectedTargetId ? { expectedTargetId: action.expectedTargetId } : {})
      } : { status: action.status, version: order.version };
      const updated = await post<Order>(`/api/orders/${order.id}/${action.kind}`, body);
      if (!mounted.current || window.location.pathname !== pathname) return;
      if (currentHref.current === href) {
        mutation.current = { href, order: updated, action: action.kind, control, trigger, restoreFocus };
        if (action.kind === 'status') {
          const message = orderListDeparture(href, updated) ?? { text: 'Pedido actualizado.' };
          setNotice(message);
          if (action.status === 'Confirmed') navigate(`/orders/${updated.id}`, {
            state: orderConfirmationState(updated.id, rememberOrderList(href, order.id, control, message))
          });
        } else {
          setNotice({ text: `Prioridad guardada en la posición ${updated.position}.` });
        }
      }
      setRefresh(count => count + 1);
    } catch (reason) {
      if (mounted.current && currentHref.current === href) {
        setWriteError(errorText(reason));
        if (action.kind === 'move' && reason instanceof ApiError && reason.status === 409) {
          focusAfterRefresh.current = { href, order, action: 'move', control, trigger, restoreFocus };
          setRefresh(count => count + 1);
        }
      }
    } finally {
      writeLock.current = false;
      if (mounted.current) setWriting(null);
    }
  }

  function selectQuery(next: OrderListQuery) {
    setPrioritySelection(null);
    setNotice(null);
    setWriteError(null);
    mutation.current = null;
    focusAfterRefresh.current = null;
    changeQuery(next);
  }

  const tabs: [OrderListView, string, number?][] = quotes
    ? [['drafts', 'Pendientes', result?.page.draftCount], ['quoted', 'Con pedido'], ['discarded', 'Descartados']]
    : [['active', 'Confirmados', result?.page.activeCount], ['history', 'Historial']];
  const newPath = quotes ? '/' : '/orders/new';
  const orderRows = data && data.items.length > 0 ? <ol ref={list} className="orders-list" aria-label={quotes ? 'Presupuestos' : 'Pedidos'} aria-busy={Boolean(writing) || loading}>
      {data.items.map(order => {
        const label = title(order);
        const destination = recordPath(order, quotes);
        const missingReference = order.status === 'Draft' && !order.historical && !order.customerReference?.trim();
        const missingTotal = order.status === 'Draft' && !order.historical && order.totalGs == null;
        const missingData = missingReference && missingTotal ? 'Faltan la referencia y el importe total'
          : missingReference ? 'Falta cliente o referencia' : missingTotal ? 'Falta el importe total' : null;
        const content = <>
          <div className="order-main">
            <a href={destination} data-order-control="record" onClick={event => {
              if (!plainClick(event)) return;
              event.preventDefault();
              open(destination, order.id, 'record');
            }}>{label}</a>
            {order.description && order.customerReference ? <p>{order.description}</p> : null}
            <small>{order.code} · {order.quantity} {order.quantity === 1 ? 'unidad' : 'unidades'}</small>
            <span className="status-badge">{order.status === 'Draft' ? 'Borrador · pendiente de aceptación' : orderLabels[order.status]}</span>
            {missingData ? <small className="order-missing-data">{missingData}</small> : null}
            {order.productionStatus === 'Failed' ? <strong className="error">Revisar producción fallida</strong> : null}
          </div>
          <dl className="order-info">
            <div><dt>Entrega prevista</dt><dd>{dateText(order.dueDate)}</dd></div>
            <div><dt>{order.status === 'Draft' ? 'Total presupuestado' : 'Total acordado'}</dt><dd>{order.totalGs == null ? 'Sin definir' : formatPyg(order.totalGs)}</dd></div>
          </dl>
        </>;
        const actions = order.status === 'Draft' ? <>
          <button type="button" data-order-control="complete" aria-disabled={blocked || undefined} onClick={event => {
            if (blocked) return;
            if (missingData) open(`${destination}?complete=1`, order.id, 'complete');
            else void act(order, { kind: 'status', status: 'Confirmed' }, 'complete', event.currentTarget);
          }}>{missingData ? 'Completar y confirmar' : 'Confirmar pedido'}</button>
          <button type="button" className="quiet" data-order-control="discard" aria-disabled={blocked || undefined}
            onClick={event => void act(order, { kind: 'status', status: 'Discarded' }, 'discard', event.currentTarget)}>Descartar</button>
        </> : order.status === 'Discarded' ?
          <button type="button" className="secondary" data-order-control="recover" aria-disabled={blocked || undefined}
            onClick={event => void act(order, { kind: 'status', status: 'Draft' }, 'recover', event.currentTarget)}>Recuperar presupuesto</button> :
          <button type="button" className="secondary" data-order-control="open" onClick={() => open(`/orders/${order.id}`, order.id, 'open')}>Ver pedido</button>;
        return view === 'active'
          ? <PriorityOrderRow key={order.id} order={order} label={label} blocked={blocked} actions={actions}
            onOpen={event => { if (!blocked) setPrioritySelection({ order, trigger: event.currentTarget }); }}>
            {content}
          </PriorityOrderRow>
          : <li key={order.id} className="order-row" data-order-id={order.id}>
            {content}
            <div className="order-row-actions">{actions}</div>
          </li>;
      })}
    </ol> : null;

  return <section className="page orders-page">
    <header className="page-heading">
      <div>
        <h1>{quotes ? 'Presupuestos' : 'Pedidos'}</h1>
        <p>{quotes ? 'Cada cotización queda acá hasta que confirmes si se aceptó.' : 'Pedidos confirmados, lo que sigue y lo que ya entregaste.'}</p>
      </div>
      <button type="button" onClick={() => open(newPath)}><Plus size={18} aria-hidden="true" />{quotes ? 'Nuevo presupuesto' : 'Nuevo pedido'}</button>
    </header>
    <div className="order-toolbar">
      <div className="order-tabs" aria-label={`Ver ${noun}`}>
        {tabs.map(([key, label, count]) => <button key={key} type="button" className="secondary" aria-pressed={view === key}
          onClick={() => selectQuery({ view: key, search, page: 1 })}>{label}{count != null ? ` (${count})` : ''}</button>)}
      </div>
      <label className="order-search">
        <Search size={18} aria-hidden="true" /><span className="sr-only">Buscar {noun}</span>
        <input ref={searchInput} type="search" aria-label={`Buscar ${noun}`} placeholder="Cliente, trabajo o código" value={search}
          onChange={event => selectQuery({ view, search: event.target.value, page: 1 })} />
      </label>
    </div>
    {view === 'drafts' ? <p className="hint">Son borradores pendientes de aceptación. Al confirmar, pasan a Pedidos; si no se aceptan, podés descartarlos.</p> : null}
    {view === 'active' ? <p id="order-priority-instructions" className="hint">El 1 se atiende primero. Arrastrá el asa de puntos o pulsala para elegir una posición.</p> : null}
    {view === 'history' ? <div className="actions"><a href={DELIVERY_DETAILS_PATH} className="table-link" onClick={event => {
      if (!plainClick(event)) return;
      event.preventDefault(); open(DELIVERY_DETAILS_PATH);
    }}>Completar historial</a></div> : null}
    {writing === 'move' ? <p className="notice" role="status">Guardando prioridad…</p> : null}
    {notice ? <p className="notice" role="status">{notice.text}{notice.href ? <> <a ref={noticeLink} href={notice.href} onClick={event => {
      if (!plainClick(event)) return;
      event.preventDefault();
      if (notice.href) open(notice.href, undefined, undefined, notice);
    }}>{notice.label}</a></> : null}</p> : null}
    {error ? <div className="error" role="alert">{error} <button type="button" className="secondary" onClick={() => {
      setWriteError(null);
      setRefresh(count => count + 1);
    }}>Actualizar lista</button></div> : null}
    {loading && !data ? <div className="orders-loading" role="status">Cargando {noun}…</div> : null}
    {fresh && data?.items.length === 0 ? <div className="empty-state card">
      <h2>{search ? 'No encontramos coincidencias' : view === 'drafts' ? 'Los próximos presupuestos quedarán acá' : quotes ? 'No hay presupuestos en esta vista' : view === 'active' ? 'No hay pedidos en esta cola' : 'No hay pedidos en esta vista'}</h2>
      <p>{search ? 'Probá otra referencia o descripción.' : quotes ? 'Cada cotización se conserva como borrador para confirmar o descartar.' : 'Confirmá un presupuesto o cargá un precio acordado directamente.'}</p>
      <button type="button" onClick={() => open(newPath)}>{quotes ? 'Cotizar' : 'Agregar pedido'}</button>
    </div> : null}
    {view === 'active' && data && orderRows ? <OrderPriorityList key={href} orders={data.items} onMove={(source, target) => {
      const trigger = rowControl(list.current, source.id, 'priority');
      if (trigger instanceof HTMLButtonElement) {
        void act(source, { kind: 'move', position: target.position, expectedTargetId: target.id }, 'priority', trigger);
      }
    }}>{orderRows}</OrderPriorityList> : orderRows}
    {data && data.total > ORDER_LIST_PAGE_SIZE ? <nav className="order-pagination" aria-label={`Páginas de ${noun}`}>
      <button type="button" className="secondary" disabled={page === 1 || loading} onClick={() => selectQuery({ view, search, page: page - 1 })}>Anterior</button>
      <span>{skip + 1}–{Math.min(skip + ORDER_LIST_PAGE_SIZE, data.total)} de {data.total}</span>
      <button type="button" className="secondary" disabled={skip + ORDER_LIST_PAGE_SIZE >= data.total || loading} onClick={() => selectQuery({ view, search, page: page + 1 })}>Siguiente</button>
    </nav> : null}
    {prioritySelection && data ? <OrderPriorityDialog label={title(prioritySelection.order)}
      position={prioritySelection.order.position} total={data.activeCount} onClose={() => setPrioritySelection(null)}
      onMove={position => {
        setPrioritySelection(null);
        void act(prioritySelection.order, { kind: 'move', position }, 'priority', prioritySelection.trigger);
      }} /> : null}
  </section>;
}
