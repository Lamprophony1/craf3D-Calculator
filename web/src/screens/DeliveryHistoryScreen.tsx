import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { ApiError, get, put } from '../api/client';
import { ModalDialog } from '../components/ModalDialog';
import { formatPyg } from '../utils/format';
import { navigate, registerNavigationGuard } from '../utils/navigation';

interface DeliveryRow {
  id: string;
  code: string;
  customerReference: string | null;
  description: string | null;
  version: number;
  deliveredDate: string | null;
  salesGs: number | null;
  manualActualCostGs: number | null;
  productionActualCostGs: number | null;
  hasProductionResult: boolean;
  realizedProfitGs: number | null;
}

interface DeliveryList { today: string; items: DeliveryRow[]; }

interface RowEdit {
  deliveredDate?: string;
  cost?: string;
  error?: string;
  invalid?: 'date' | 'cost';
  status?: 'saving' | 'conflict' | 'updating';
  refreshed?: boolean;
}

const deliveriesPath = '/api/orders/delivery-details';
const storedDate = (row: DeliveryRow) => row.deliveredDate ?? '';
const storedCost = (row: DeliveryRow) => row.manualActualCostGs == null ? '' : String(row.manualActualCostGs);
const needsDetails = (row: DeliveryRow) => !row.deliveredDate || row.realizedProfitGs == null || row.salesGs == null;
const isDirty = (row: DeliveryRow, edit?: RowEdit) => Boolean(edit && (
  edit.deliveredDate !== undefined && edit.deliveredDate !== storedDate(row) ||
  !row.hasProductionResult && edit.cost !== undefined && edit.cost !== storedCost(row)
));
const matchText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const formId = (id: string) => `delivery-history-order-${id}`;

function followLink(event: MouseEvent<HTMLAnchorElement>, path: string, state?: Record<string, unknown>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(path, { state });
}

export function DeliveryHistoryScreen() {
  const [data, setData] = useState<DeliveryList | null>(null);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const working = useRef(new Set<string>());
  const searchInput = useRef<HTMLInputElement>(null);
  const nextFocus = useRef<{ previous: HTMLFormElement; id: string; nextId?: string } | null>(null);

  useEffect(() => {
    let current = true;
    get<DeliveryList>(deliveriesPath).then(result => { if (current) setData(result); })
      .catch((error: unknown) => { if (current) setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el historial.'); });
    return () => { current = false; };
  }, [attempt]);

  const rows = data?.items ?? [];
  const dirty = rows.some(row => isDirty(row, edits[row.id]));
  const busy = Object.values(edits).some(edit => edit.status === 'saving' || edit.status === 'updating');
  const pendingCount = rows.filter(needsDetails).length;
  const query = matchText(search.trim());
  const visible = rows.filter(row => (view === 'all' || needsDetails(row) || isDirty(row, edits[row.id])) &&
    matchText(`${row.customerReference ?? ''} ${row.description ?? ''} ${row.code}`).includes(query));

  useLayoutEffect(() => {
    if (!dirty && !busy) return;
    const unregister = registerNavigationGuard(proceed => {
      if (working.current.size) return;
      if (dirty) setLeave(() => proceed);
      else proceed();
    });
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { unregister(); window.removeEventListener('beforeunload', beforeUnload); };
  }, [dirty, busy]);

  useLayoutEffect(() => {
    const target = nextFocus.current;
    if (!target) return;
    nextFocus.current = null;
    const active = document.activeElement;
    if (active !== document.body && !target.previous.contains(active)) return;
    const sameRow = document.getElementById(formId(target.id));
    const nextRow = target.nextId ? document.getElementById(formId(target.nextId)) : null;
    const nextInput = sameRow?.querySelector<HTMLElement>('[data-needed]:not(:disabled)') ??
      nextRow?.querySelector<HTMLElement>('[data-needed]:not(:disabled)') ??
      nextRow?.querySelector<HTMLElement>('input:not(:disabled)') ?? searchInput.current;
    nextInput?.focus();
  }, [data]);

  function patchEdit(id: string, changes: Partial<RowEdit>) {
    setEdits(current => ({ ...current, [id]: { ...current[id], ...changes } }));
  }

  function changeField(id: string, changes: Partial<RowEdit>) {
    setNotice('');
    setEdits(current => {
      const edit = current[id];
      return { ...current, [id]: { ...edit, ...changes, invalid: undefined, refreshed: false,
        error: edit?.status === 'conflict' ? edit.error : undefined } };
    });
  }

  function clearEdit(id: string) {
    setEdits(current => {
      const remaining = { ...current };
      delete remaining[id];
      return remaining;
    });
  }

  async function save(event: FormEvent<HTMLFormElement>, row: DeliveryRow) {
    event.preventDefault();
    const form = event.currentTarget;
    const edit = edits[row.id];
    if (!data || !edit || !isDirty(row, edit) || edit.status === 'conflict' || working.current.has(row.id)) return;
    const dateInput = form.elements.namedItem('deliveredDate') as HTMLInputElement;
    const costInput = form.elements.namedItem('cost') as HTMLInputElement | null;
    const date = edit.deliveredDate ?? storedDate(row);
    const cost = edit.cost ?? storedCost(row);
    const manualActualCostGs = row.hasProductionResult ? row.manualActualCostGs : cost === '' ? null : Number(cost);
    if (dateInput.validity.badInput || date && date !== storedDate(row) && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > data.today)) {
      patchEdit(row.id, { invalid: 'date', error: 'Elegí una fecha de entrega válida, hasta hoy.' });
      dateInput.focus();
      return;
    }
    if (costInput?.validity.badInput || manualActualCostGs != null && (!Number.isFinite(manualActualCostGs) || manualActualCostGs < 0)) {
      patchEdit(row.id, { invalid: 'cost', error: 'Ingresá un costo real de cero o más.' });
      costInput?.focus();
      return;
    }
    working.current.add(row.id);
    setNotice('');
    patchEdit(row.id, { status: 'saving', error: undefined, invalid: undefined, refreshed: false });
    try {
      const updated = await put<DeliveryRow>(`/api/orders/${encodeURIComponent(row.id)}/delivery-details`, {
        version: row.version, deliveredDate: date || null, manualActualCostGs
      });
      const index = visible.findIndex(candidate => candidate.id === row.id);
      nextFocus.current = { previous: form, id: row.id, nextId: (visible[index + 1] ?? visible[index - 1])?.id };
      setData(current => current && ({ ...current, items: current.items.map(candidate => candidate.id === updated.id ? updated : candidate) }));
      clearEdit(row.id);
      setNotice(`Pedido ${row.code} guardado.`);
    } catch (error) {
      const conflict = error instanceof ApiError && error.status === 409;
      patchEdit(row.id, { status: conflict ? 'conflict' : undefined, error: conflict
        ? 'El pedido cambió en otra pantalla. Actualizá la fila y revisá tus cambios.'
        : error instanceof Error ? error.message : 'No se pudo guardar el pedido.' });
    } finally { working.current.delete(row.id); }
  }

  async function updateRow(row: DeliveryRow) {
    if (working.current.has(row.id)) return;
    working.current.add(row.id);
    patchEdit(row.id, { status: 'updating' });
    try {
      const fresh = await get<DeliveryList>(deliveriesPath);
      const updated = fresh.items.find(candidate => candidate.id === row.id);
      setData(current => current && ({ today: fresh.today,
        items: current.items.flatMap(candidate => candidate.id !== row.id ? [candidate] : updated ? [updated] : []) }));
      if (!updated) {
        clearEdit(row.id);
        setNotice(`El pedido ${row.code} ya no aparece entre los entregados.`);
        return;
      }
      setEdits(current => {
        const edit = current[row.id];
        return { ...current, [row.id]: {
          deliveredDate: edit?.deliveredDate === storedDate(row) ? undefined : edit?.deliveredDate,
          cost: updated.hasProductionResult || edit?.cost === storedCost(row) ? undefined : edit?.cost,
          refreshed: true
        } };
      });
    } catch (error) {
      patchEdit(row.id, { status: 'conflict', error: error instanceof Error ? error.message : 'No se pudo actualizar la fila.' });
    } finally { working.current.delete(row.id); }
  }

  return <section className="page delivery-history-page">
    <header className="page-heading delivery-history-heading">
      <div><h1>Completar historial</h1><p>Cargá las fechas de entrega y los costos reales de pedidos anteriores.</p></div>
      <a className="delivery-history-back" href="/dashboard" onClick={event => followLink(event, '/dashboard')}>Volver al Resumen</a>
    </header>
    {loadError ? <div className="card delivery-history-load-error"><p role="alert">{loadError}</p><button type="button" className="secondary" onClick={() => { setLoadError(null); setAttempt(value => value + 1); }}>Volver a cargar</button></div>
      : !data ? <p className="card" role="status">Cargando pedidos entregados…</p>
      : <>
        <div className="delivery-history-toolbar">
          <div className="delivery-history-filters" role="group" aria-label="Ver pedidos entregados">
            <button type="button" className="secondary" aria-pressed={view === 'pending'} onClick={() => { setView('pending'); setNotice(''); }}>Pendientes ({pendingCount})</button>
            <button type="button" className="secondary" aria-pressed={view === 'all'} onClick={() => { setView('all'); setNotice(''); }}>Todos ({rows.length})</button>
          </div>
          <label className="delivery-history-search">Buscar pedido<input ref={searchInput} type="search" placeholder="Cliente, trabajo o código" value={search} onChange={event => { setSearch(event.target.value); setNotice(''); }} /></label>
        </div>
        {visible.length > 0 ? <p className="delivery-history-guide">En el costo real total incluí los gastos, comisiones e impuestos que correspondan a la venta.</p> : null}
        {notice ? <p role="status" className="delivery-history-notice">{notice}</p> : null}
        {visible.length ? <ol className="delivery-history-list" aria-label="Pedidos entregados">
          {visible.map(row => {
            const edit = edits[row.id];
            const pending = edit?.status === 'saving' || edit?.status === 'updating';
            const conflict = edit?.status === 'conflict';
            const id = formId(row.id);
            const errorId = `${id}-error`;
            const orderPath = `/orders/${encodeURIComponent(row.id)}`;
            return <li key={row.id}>
              <form id={id} className="delivery-history-row" aria-label={`Pedido ${row.code}`} aria-busy={pending || undefined} noValidate onSubmit={event => void save(event, row)}>
                <div className="delivery-history-reference">
                  <h2>{row.customerReference || row.description || row.code}</h2>
                  {row.customerReference && row.description ? <p>{row.description}</p> : null}
                  {row.customerReference || row.description ? <small>{row.code}</small> : null}
                </div>
                <dl className="delivery-history-values">
                  <div><dt>Venta</dt><dd>{row.salesGs == null ? <>Sin importe <a href={orderPath} onClick={event => followLink(event, orderPath, { deliveryDetailsReturn: true })}>Ver pedido</a></> : formatPyg(row.salesGs)}</dd></div>
                  <div><dt>Ganancia</dt><dd className={row.realizedProfitGs != null && row.realizedProfitGs < 0 ? 'delivery-history-loss' : undefined}>{row.realizedProfitGs == null ? 'Sin calcular' : formatPyg(row.realizedProfitGs)}</dd></div>
                </dl>
                <label className="delivery-history-date">Fecha de entrega
                  <input name="deliveredDate" type="date" max={data.today} value={edit?.deliveredDate ?? storedDate(row)} disabled={pending}
                    aria-invalid={edit?.invalid === 'date' || undefined} aria-describedby={edit?.invalid === 'date' ? errorId : undefined}
                    data-needed={!row.deliveredDate || undefined} onChange={event => changeField(row.id, { deliveredDate: event.target.value })} />
                </label>
                {row.hasProductionResult ? <div className="delivery-history-locked"><span>Costo real total</span>
                  <strong>{row.productionActualCostGs == null ? 'Registrado' : formatPyg(row.productionActualCostGs)}</strong><small>Cierre de producción</small></div>
                  : <label className="delivery-history-cost">Costo real total (Gs.)
                    <input name="cost" type="number" min={0} step="any" inputMode="decimal" placeholder="Sin cargar" value={edit?.cost ?? storedCost(row)} disabled={pending}
                      aria-invalid={edit?.invalid === 'cost' || undefined} aria-describedby={edit?.invalid === 'cost' ? errorId : undefined}
                      data-needed={row.manualActualCostGs == null || undefined} onChange={event => changeField(row.id, { cost: event.target.value })} />
                  </label>}
                <div className="delivery-history-save">
                  {conflict ? <button type="button" className="secondary" onClick={() => void updateRow(row)}>Actualizar fila</button>
                    : <button type="submit" disabled={pending || !isDirty(row, edit)}>{edit?.status === 'saving' ? 'Guardando…' : edit?.status === 'updating' ? 'Actualizando…' : 'Guardar'}</button>}
                </div>
                {edit?.error ? <p className="delivery-history-row-error" role="alert" id={errorId}>{edit.error}</p>
                  : edit?.refreshed ? <p className="delivery-history-row-feedback" role="status">Fila actualizada. Revisá tus cambios antes de guardar.</p> : null}
              </form>
            </li>;
          })}
        </ol> : <div className="card empty-state delivery-history-empty">
          <h2>{query ? 'No encontramos coincidencias' : rows.length ? 'El historial está completo' : 'Todavía no hay pedidos entregados'}</h2>
          <p>{query ? 'Probá otro cliente, descripción o código.' : rows.length ? 'Podés consultar o corregir los datos en Todos.' : 'Las entregas van a aparecer acá cuando se registren en Pedidos.'}</p>
          {query ? <button type="button" className="secondary" onClick={() => { setSearch(''); searchInput.current?.focus(); }}>Limpiar búsqueda</button>
            : rows.length && view === 'pending' ? <button type="button" className="secondary" onClick={() => setView('all')}>Ver todos</button> : null}
        </div>}
      </>}
    <ModalDialog open={leave !== null} title="Cambios sin guardar" description="Hay datos editados en el historial. Guardá cada fila para conservarlos."
      onClose={() => setLeave(null)} footer={<>
        <button type="button" className="secondary" data-autofocus onClick={() => setLeave(null)}>Seguir editando</button>
        <button type="button" onClick={() => { const proceed = leave; setLeave(null); proceed?.(); }}>Salir sin guardar</button>
      </>}>{null}</ModalDialog>
  </section>;
}
