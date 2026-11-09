import type { Order } from '../api/orders';

export const ORDER_LIST_PAGE_SIZE = 25;
export type OrderListArea = 'orders' | 'quotes';
export type OrderListView = 'active' | 'history' | 'drafts' | 'quoted' | 'discarded';
export type OrderListQuery = { view: OrderListView; search: string; page: number };
export type OrderListNotice = { text: string; href?: string; label?: string };
export type OrderListControl = 'record' | 'open' | 'complete' | 'priority' | 'discard' | 'recover';
export type OrderListPoint = {
  href: string;
  scrollY: number;
  orderId?: string;
  control?: OrderListControl;
  notice?: OrderListNotice;
};

const views: Record<OrderListArea, readonly OrderListView[]> = {
  orders: ['active', 'history'],
  quotes: ['drafts', 'quoted', 'discarded']
};

export function orderListPath(area: OrderListArea) {
  return area === 'quotes' ? '/quotes' : '/jobs';
}

export function readOrderListQuery(area: OrderListArea, search: string): OrderListQuery {
  const params = new URLSearchParams(search);
  const requestedView = params.get('view');
  const view = views[area].find(value => value === requestedView) ?? views[area][0];
  const requestedPage = params.get('page') ?? '';
  const page = /^[1-9][0-9]*$/.test(requestedPage) ? Number(requestedPage) : 1;
  const validPage = Number.isSafeInteger(page) && (page - 1) * ORDER_LIST_PAGE_SIZE <= 2147483647;
  return { view, search: params.get('search') ?? '', page: validPage ? page : 1 };
}

export function orderListHref(area: OrderListArea, query: OrderListQuery) {
  const params = new URLSearchParams();
  if (query.view !== views[area][0]) params.set('view', query.view);
  if (query.search) params.set('search', query.search);
  if (query.page > 1) params.set('page', String(query.page));
  return `${orderListPath(area)}${params.size ? `?${params}` : ''}`;
}

export function orderListDeparture(href: string, order: Pick<Order, 'id' | 'status' | 'code'>): OrderListNotice | undefined {
  const url = new URL(href, window.location.origin);
  const area = url.pathname === '/quotes' ? 'quotes' : 'orders';
  const { view } = readOrderListQuery(area, url.search);
  const { id, code, status } = order;
  const to = (targetArea: OrderListArea, targetView: OrderListView) =>
    orderListHref(targetArea, { view: targetView, search: code, page: 1 });

  if (status === 'Discarded' && view !== 'discarded') return {
    text: 'Presupuesto descartado. Podés recuperarlo en Descartados.', href: to('quotes', 'discarded'), label: 'Ver en Descartados'
  };
  if (status === 'Draft' && view !== 'drafts') return {
    text: 'Presupuesto recuperado en Pendientes.', href: to('quotes', 'drafts'), label: 'Ver en Pendientes'
  };
  if ((view === 'active' || view === 'drafts' || view === 'discarded') && (status === 'Delivered' || status === 'Cancelled')) return {
    text: status === 'Delivered' ? 'El pedido entregado quedó en Historial.' : 'El pedido cancelado quedó en Historial.',
    href: to('orders', 'history'), label: 'Ver en Historial'
  };
  if ((view === 'drafts' || view === 'discarded') && status !== 'Draft' && status !== 'Discarded') return {
    text: 'Pedido confirmado. Ahora podés seguirlo en Pedidos.', href: `/orders/${encodeURIComponent(id)}`, label: 'Ver pedido'
  };
}

function readPoint(value: unknown): OrderListPoint | undefined {
  if (!value || typeof value !== 'object') return;
  const point = value as Partial<OrderListPoint>;
  if (typeof point.href !== 'string' || !/^\/(?:jobs|quotes)(?:\?|$)/.test(point.href)) return;
  if (typeof point.scrollY !== 'number' || !Number.isFinite(point.scrollY)) return;
  const url = new URL(point.href, window.location.origin);
  if (url.origin !== window.location.origin || (url.pathname !== '/jobs' && url.pathname !== '/quotes')) return;
  const area = url.pathname === '/quotes' ? 'quotes' : 'orders';
  return { ...point, href: orderListHref(area, readOrderListQuery(area, url.search)), scrollY: Math.max(0, point.scrollY) };
}

export function replaceOrderListLocation(href: string, point?: OrderListPoint) {
  window.history.replaceState({ ...window.history.state, orderListRestore: point }, '', href);
}

export function readOrderListPoint(href: string) {
  const point = readPoint(window.history.state?.orderListRestore);
  return point?.href === href ? point : undefined;
}

export function rememberOrderList(href: string, orderId?: string, control?: OrderListControl, notice?: OrderListNotice) {
  const point: OrderListPoint = { href, scrollY: window.scrollY, orderId, control, notice };
  if (window.location.pathname === href.split('?')[0]) {
    replaceOrderListLocation(href, point);
  }
  return { orderListOrigin: point };
}

export function orderListOriginState(): Record<string, unknown> | undefined {
  const origin = readPoint(window.history.state?.orderListOrigin);
  return origin ? { orderListOrigin: origin } : undefined;
}

export function orderListReturn(fallback: string, order?: Pick<Order, 'id' | 'status' | 'code'>): { href: string; state?: Record<string, unknown> } {
  const origin = readPoint(window.history.state?.orderListOrigin);
  if (!origin) return { href: fallback };
  const notice = order ? orderListDeparture(origin.href, order) ?? origin.notice : origin.notice;
  return { href: origin.href, state: { orderListRestore: { ...origin, notice } } };
}
