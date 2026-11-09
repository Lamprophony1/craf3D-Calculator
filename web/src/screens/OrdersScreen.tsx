import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError, get, post, put } from '../api/client';
import { type Order, type OrderStatus, orderLabels, orderNext } from '../api/orders';
import { navigate } from '../components/AppShell';
import { ModalDialog } from '../components/ModalDialog';
import { registerNavigationGuard } from '../utils/navigation';
import { formatPyg } from '../utils/format';
import { orderListOriginState, orderListReturn } from './orderListNavigation';

export { OrdersScreen } from './OrdersList';

interface Fields {
  customerReference: string;
  description: string;
  quantity: number;
  total: string;
  orderDate: string;
  dueDate: string;
  deliveredDate: string;
  notes: string;
  historical: boolean;
  historicalStatus: OrderStatus;
}

const empty: Fields = {
  customerReference: '', description: '', quantity: 1, total: '', orderDate: '',
  dueDate: '', deliveredDate: '', notes: '', historical: false, historicalStatus: 'Delivered'
};

function fromOrder(order: Order): Fields {
  return {
    customerReference: order.customerReference ?? '', description: order.description ?? '',
    quantity: order.quantity, total: order.totalGs == null ? '' : String(order.totalGs),
    orderDate: order.orderDate ?? '', dueDate: order.dueDate ?? '', deliveredDate: order.deliveredDate ?? '',
    notes: order.notes ?? '', historical: Boolean(order.historical), historicalStatus: order.status
  };
}

const title = (order: Order) => order.customerReference || order.description || order.code;
const dateText = (date: string) => new Intl.DateTimeFormat('es-PY', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
}).format(new Date(date + 'T12:00:00Z'));
const errorText = (e: unknown) => e instanceof Error ? e.message : 'No pudimos completar la operación. Reintentá.';

const statusNotices: Partial<Record<OrderStatus, { text: string; href?: string; label?: string }>> = {
  InProgress: { text: 'Pedido en proceso.' },
  Ready: { text: 'Pedido listo para entregar.' },
  Delivered: { text: 'Entrega registrada. El pedido está en el Historial.', href: '/jobs?view=history', label: 'Ver Historial' },
  Cancelled: { text: 'El pedido está en el Historial.', href: '/jobs?view=history', label: 'Ver Historial' },
  Discarded: { text: 'Presupuesto descartado. Podés recuperarlo en Descartados.', href: '/quotes?view=discarded', label: 'Ver Descartados' },
  Draft: { text: 'Presupuesto recuperado en Pendientes.', href: '/quotes', label: 'Ver Pendientes' }
};

export function OrderEditorScreen({ id, budget = false }: { id?: string; budget?: boolean }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [editing, setEditing] = useState(!id);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<{ text: string; href?: string; label?: string } | null>(null);
  const [confirmAttempt, setConfirmAttempt] = useState(false);
  const [reload, setReload] = useState(0);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<'customerReference' | 'totalGs' | 'action' | 'edit' | null>(null);
  const [saveId] = useState(() => crypto.randomUUID());
  const writing = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextAction = useRef<HTMLButtonElement>(null);
  const editAction = useRef<HTMLButtonElement>(null);

  const baseline = order ? fromOrder(order) : empty;
  const fieldKeys = Object.keys(fields) as (keyof Fields)[];
  const dirty = fieldKeys.some(key => fields[key] !== baseline[key]);
  const missingReference = confirmAttempt && !fields.customerReference.trim();
  const missingTotal = confirmAttempt && fields.total === '';

  useEffect(() => {
    if (!id) return;
    let current = true;
    setLoading(true);
    setError(null);
    get<Order>(`/api/orders/${id}`).then(value => {
      if (!current) return;
      setOrder(value);
      setFields(fromOrder(value));
    }).catch(reason => {
      if (current) setError(errorText(reason));
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [id, reload]);

  useLayoutEffect(() => {
    if (!dirty && !busy) return;
    const unregister = registerNavigationGuard(proceed => {
      if (writing.current) return;
      if (!dirty) {
        proceed();
        return;
      }
      setCancelOpen(false);
      setLeave(() => proceed);
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [dirty, busy]);

  useLayoutEffect(() => {
    if (!focusTarget || busy) return;
    if (focusTarget === 'action') (nextAction.current ?? heading.current)?.focus();
    else if (focusTarget === 'edit') editAction.current?.focus();
    else (form.current?.elements.namedItem(focusTarget) as HTMLInputElement | null)?.focus();
    setFocusTarget(null);
  }, [focusTarget, busy]);

  function change<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields(current => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function accept(saved: Order) {
    setOrder(saved);
    setFields(fromOrder(saved));
    setConfirmAttempt(false);
  }

  async function apply(status?: OrderStatus, afterSave?: () => void) {
    if (writing.current) return;

    const mustSave = !order || dirty;
    const requireCommercialData = !fields.historical && (status === 'Confirmed' || !order);
    if (requireCommercialData && (!fields.customerReference.trim() || fields.total === '')) {
      setConfirmAttempt(true);
      setError(null);
      setConflict(false);
      setEditing(true);
      setFocusTarget(!fields.customerReference.trim() ? 'customerReference' : 'totalGs');
      return;
    }
    if (mustSave && !form.current?.reportValidity()) return;

    writing.current = true;
    setBusy(true);
    setError(null);
    setConflict(false);
    setNotice(null);
    let saved = order;
    let fieldsSaved = false;
    try {
      if (mustSave) {
        const body = {
          id: order?.id ?? saveId, version: order?.version ?? 0,
          customerReference: fields.customerReference.trim() || null,
          description: fields.description.trim() || null, quantity: fields.quantity,
          totalGs: fields.total === '' ? null : Number(fields.total),
          status: order?.status ?? (fields.historical ? fields.historicalStatus : 'Confirmed'),
          orderDate: fields.orderDate || null, dueDate: fields.dueDate || null,
          deliveredDate: fields.deliveredDate || null, notes: fields.notes.trim() || null,
          historical: fields.historical
        };
        saved = order ? await put<Order>(`/api/orders/${order.id}`, body) : await post<Order>('/api/orders', body);
        accept(saved);
        fieldsSaved = true;
      }
      if (!saved) return;
      if (status) {
        saved = await post<Order>(`/api/orders/${saved.id}/status`, { status, version: saved.version });
        accept(saved);
      }
      if (afterSave) {
        afterSave();
      } else if (!id || (status === 'Confirmed' && budget)) {
        navigate(`/orders/${saved.id}`, {
          confirmed: true, replace: true, state: orderListOriginState()
        });
      } else {
        setEditing(false);
        setNotice(status ? statusNotices[status] ?? { text: 'Estado actualizado.' } : { text: 'Cambios guardados.' });
        setFocusTarget(status ? 'action' : 'edit');
      }
    } catch (reason) {
      setConflict(reason instanceof ApiError && reason.status === 409);
      const detail = errorText(reason);
      setError(fieldsSaved && status ? `Los cambios se guardaron. ${detail}` : detail);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  async function refreshVersion() {
    if (!order || writing.current) return;
    writing.current = true;
    setBusy(true);
    try {
      const latest = await get<Order>(`/api/orders/${order.id}`);
      const changedFields = Object.fromEntries(
        fieldKeys.filter(key => fields[key] !== baseline[key]).map(key => [key, fields[key]])
      );
      setOrder(latest);
      setFields({ ...fromOrder(latest), ...changedFields });
      setError(null);
      setConflict(false);
      setNotice({ text: 'Versión actualizada. Revisá tus cambios antes de guardar.' });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  const isBudget = order ? order.status === 'Draft' || order.status === 'Discarded' : budget;
  const fallback = isBudget
    ? order?.status === 'Discarded' ? '/quotes?view=discarded' : '/quotes'
    : order?.status === 'Delivered' || order?.status === 'Cancelled' ? '/jobs?view=history' : '/jobs';
  const returnTo = orderListReturn(fallback, order ?? undefined);
  const goBack = () => navigate(returnTo.href, { state: returnTo.state });
  const backLabel = returnTo.href.startsWith('/quotes') ? 'Volver a presupuestos' : 'Volver a pedidos';
  if (loading) return <section className="page"><h1>{budget ? 'Presupuesto' : 'Pedido'}</h1><p role="status">Cargando…</p></section>;
  if (id && !order) return <section className="page">
    <button type="button" className="quiet" onClick={goBack}>{backLabel}</button>
    <h1>{budget ? 'Presupuesto' : 'Pedido'}</h1>
    <p className="error" role="alert">{error}</p>
    <button type="button" onClick={() => setReload(x => x + 1)}>Reintentar</button>
  </section>;

  const next = order ? orderNext[order.status] : null;
  const canCancel = order && ['Confirmed', 'InProgress', 'Ready'].includes(order.status);
  const validationError = missingReference || missingTotal
    ? 'Completá cliente/referencia e importe total para confirmar.' : null;
  const showForm = !order || editing;
  return <section className="page order-editor">
    <button type="button" className="quiet order-back" onClick={goBack} disabled={busy}>{backLabel}</button>
    <header className="page-heading">
      <div>
        <h1 ref={heading} tabIndex={-1}>{order ? title(order) : 'Nuevo pedido'}</h1>
        <p>{order ? `${order.code} · ${order.status === 'Draft' ? 'Pendiente de aceptación' : orderLabels[order.status]}`
          : 'Cargá un pedido con un precio ya acordado.'}</p>
      </div>
    </header>
    {error || validationError ? <div className="error order-message" role="alert">
      {error ?? validationError}
      {order && conflict ? <button type="button" className="secondary" disabled={busy} onClick={() => void refreshVersion()}>
        Actualizar versión conservando mis datos
      </button> : null}
    </div> : null}
    {notice ? <p className="notice order-message" role="status">
      {notice.text}
      {notice.href ? <> <a href={notice.href} onClick={event => {
        event.preventDefault();
        navigate(notice.href!);
      }}>{notice.label}</a></> : null}
    </p> : null}
    {dirty ? <p className="order-pending" role="status">Cambios sin guardar</p> : null}
    {order ? <section className="order-overview" aria-label={isBudget ? 'Resumen del presupuesto' : 'Resumen del pedido'}>
      <dl className="order-info order-summary-data">
        <div><dt>{isBudget ? 'Total presupuestado' : 'Total acordado'}</dt><dd>{order.totalGs == null ? 'Sin definir' : formatPyg(order.totalGs)}</dd></div>
        <div><dt>Cantidad</dt><dd>{order.quantity} {order.quantity === 1 ? 'unidad' : 'unidades'}</dd></div>
        <div><dt>{order.status === 'Delivered' ? 'Fecha de entrega' : 'Entrega prevista'}</dt><dd>
          {order.status === 'Delivered'
            ? order.deliveredDate ? dateText(order.deliveredDate) : 'Sin fecha'
            : order.dueDate ? dateText(order.dueDate) : 'Sin fecha'}
        </dd></div>
      </dl>
      <div className="order-primary-actions">
        {next ? <button ref={nextAction} type="button" disabled={busy} onClick={() => void apply(next.status)}>
          {busy ? 'Guardando…' : order.status === 'Discarded' ? 'Recuperar presupuesto' : next.label}
        </button> : null}
        {!editing ? <button ref={editAction} type="button" className="secondary" aria-expanded={false}
          aria-controls="order-fields" disabled={busy} onClick={() => {
            setEditing(true);
            setFocusTarget('customerReference');
          }}>Editar datos</button> : null}
        {editing && !dirty ? <button ref={editAction} type="button" className="quiet" aria-expanded={true}
          aria-controls="order-fields" disabled={busy} onClick={() => {
            setEditing(false);
            setFocusTarget('edit');
          }}>Cerrar edición</button> : null}
      </div>
      {order.description && order.description !== title(order) ? <p className="order-description">{order.description}</p> : null}
      {order.status === 'Draft' || canCancel ? <div className="order-secondary-actions">
        {order.status === 'Draft' ? <button type="button" className="quiet" disabled={busy} onClick={() => void apply('Discarded')}>
          Descartar presupuesto
        </button> : null}
        {canCancel ? <button type="button" className="quiet" disabled={busy} onClick={() => setCancelOpen(true)}>
          Cancelar pedido
        </button> : null}
      </div> : null}
    </section> : null}
    <form id="order-fields" ref={form} className="order-form" hidden={!showForm} onSubmit={event => {
      event.preventDefault();
      void apply();
    }}>
      {order ? <h2>Datos del {isBudget ? 'presupuesto' : 'pedido'}</h2> : null}
      <fieldset className="order-form-main" disabled={busy || !showForm}>
        <label>Cliente / referencia
          <input aria-label="Cliente / referencia" name="customerReference" maxLength={200} value={fields.customerReference}
            aria-invalid={missingReference} aria-describedby={missingReference ? 'order-reference-error' : undefined}
            onChange={event => change('customerReference', event.target.value)} placeholder="Ej.: Ana · WhatsApp" />
          {missingReference ? <small id="order-reference-error" className="field-error">Ingresá una referencia para confirmar.</small> : null}
        </label>
        <label>Qué se va a imprimir (opcional)
          <textarea rows={2} maxLength={1000} value={fields.description}
            onChange={event => change('description', event.target.value)} placeholder="Ej.: Soporte para auriculares" />
        </label>
        <div className="order-pair">
          <label>Cantidad<input type="number" min="1" step="1" required value={fields.quantity}
            onChange={event => change('quantity', Number(event.target.value))} /></label>
          <label>{isBudget ? 'Importe presupuestado (Gs.)' : 'Importe total acordado (Gs.)'}
            <input aria-label={isBudget ? 'Importe presupuestado (Gs.)' : 'Importe total acordado (Gs.)'} name="totalGs"
              type="number" min="0" step="any" inputMode="numeric" value={fields.total} aria-invalid={missingTotal}
              aria-describedby={missingTotal ? 'order-total-error order-total-help' : 'order-total-help'}
              onChange={event => change('total', event.target.value)} />
            {missingTotal ? <small id="order-total-error" className="field-error">Indicá el importe total.</small> : null}
            <small id="order-total-help">El total por todo el pedido, sin multiplicar por cantidad.</small>
          </label>
        </div>
        {!order ? <label className="order-check">
          <input type="checkbox" checked={fields.historical} onChange={event => change('historical', event.target.checked)} />
          Registrar un trabajo anterior
        </label> : null}
        {fields.historical && !order ? <label>Estado del trabajo
          <select value={fields.historicalStatus} onChange={event => change('historicalStatus', event.target.value as OrderStatus)}>
            <option value="Delivered">Entregado</option><option value="Ready">Listo para entregar</option>
            <option value="Confirmed">Confirmado</option><option value="Cancelled">Cancelado</option>
          </select>
          <small>Podés dejar sin completar los datos que no conozcas.</small>
        </label> : null}
        <div className="order-pair">
          <label>Fecha del pedido (opcional)<input type="date" value={fields.orderDate}
            onChange={event => change('orderDate', event.target.value)} /></label>
          <label>Entrega prevista (opcional)<input type="date" value={fields.dueDate}
            onChange={event => change('dueDate', event.target.value)} /></label>
        </div>
        {fields.historical || order?.status === 'Delivered' ? <label>Fecha de entrega (opcional)
          <input type="date" value={fields.deliveredDate} onChange={event => change('deliveredDate', event.target.value)} />
        </label> : null}
        <label>Notas (opcional)<textarea rows={3} maxLength={4000} value={fields.notes}
          onChange={event => change('notes', event.target.value)} /></label>
      </fieldset>
      <div className="order-save-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : order ? isBudget ? 'Guardar presupuesto' : 'Guardar cambios'
            : fields.historical ? 'Registrar trabajo anterior' : 'Crear pedido'}
        </button>
      </div>
    </form>
    {order ? <section className="order-followup">
      <details>
        <summary>Presupuesto, producción y costos</summary>
        <p>{order.quoteId ? <a href={`/quotes/${order.quoteId}`} onClick={event => {
          event.preventDefault();
          navigate(`/quotes/${order.quoteId}`, { state: orderListOriginState() });
        }}>Ver presupuesto de origen</a> : 'Precio acordado manualmente.'}</p>
        {order.jobId ? <p><a href={`/jobs/${order.jobId}`} onClick={event => {
          event.preventDefault();
          navigate(`/jobs/${order.jobId}`, { state: orderListOriginState() });
        }}>Ver producción y costos registrados</a></p> : <p>Sin costos reales registrados. Ganancia sin calcular.</p>}
        {order.productionStatus === 'Completed' && order.status !== 'Delivered' ? <p>Producción terminada. Entrega pendiente.</p> : null}
      </details>
    </section> : null}
    <ModalDialog open={Boolean(leave)} title="Cambios sin guardar"
      description="Elegí qué hacer con los datos que editaste antes de salir." onClose={() => setLeave(null)}
      footer={<>
        <button type="button" className="secondary" data-autofocus onClick={() => setLeave(null)}>Seguir editando</button>
        <button type="button" className="quiet" onClick={() => {
          setLeave(null);
          leave?.();
        }}>Salir sin guardar</button>
        <button type="button" onClick={() => {
          setLeave(null);
          if (leave) void apply(undefined, leave);
        }}>{!order && !fields.historical ? 'Crear pedido y salir' : 'Guardar y salir'}</button>
      </>}>
      {order ? <p>{title(order)}</p> : <p>Nuevo pedido</p>}
    </ModalDialog>
    <ModalDialog open={cancelOpen} title="Cancelar pedido"
      description="El pedido pasará al Historial como cancelado. La cancelación es definitiva."
      onClose={() => setCancelOpen(false)} footer={<>
        <button type="button" className="secondary" data-autofocus onClick={() => setCancelOpen(false)}>Mantener pedido</button>
        <button type="button" onClick={() => {
          setCancelOpen(false);
          void apply('Cancelled');
        }}>Confirmar cancelación</button>
      </>}>
      {order ? <p><strong>{title(order)}</strong> · {order.code}</p> : null}
      {dirty ? <p>Los cambios pendientes se guardarán antes de cancelar.</p> : null}
    </ModalDialog>
  </section>;
}
