import { useEffect, useState } from 'react';
import { get } from '../api/client';
import { formatPyg } from '../utils/format';
import { navigate } from '../components/AppShell';
import { DELIVERY_DETAILS_PATH } from './orderListNavigation';

interface SalesTotals {
  salesGs: number;
  realizedProfitGs: number;
  orderCount: number;
  pricedOrderCount: number;
  costedOrderCount: number;
}

interface SalesReport {
  currentMonth: string;
  totals: SalesTotals;
  months: (SalesTotals & { month: string })[];
  undated: SalesTotals;
}

const monthName = new Intl.DateTimeFormat('es-PY', { month: 'long', timeZone: 'UTC' });
const count = new Intl.NumberFormat('es-PY');
const salesAmount = (totals: SalesTotals) => totals.pricedOrderCount || !totals.orderCount ? formatPyg(totals.salesGs) : 'Sin importe';
const profitAmount = (totals: SalesTotals) => totals.costedOrderCount ? formatPyg(totals.realizedProfitGs) : 'Sin calcular';

const readinessItems = [
  ['defaultPrinterConfigured', 'Impresora predeterminada y costo horario utilizables'],
  ['defaultEnergyProfileConfigured', 'Perfil energético predeterminado vigente'],
  ['defaultTariffConfigured', 'Tarifa predeterminada vigente'],
  ['defaultPolicyConfigured', 'Política predeterminada vigente'],
  ['defaultLaborRateConfigured', 'Tarifa laboral predeterminada'],
  ['defaultQuickSetupConfigured', 'Setup rápido configurado'],
  ['defaultQuickPackagingConfigured', 'Embalaje rápido configurado'],
  ['activePricedFilamentAvailable', 'Filamento activo con costo positivo'],
  ['compatibleEnergyProfileAvailable', 'Perfil energético compatible disponible']
] as const;

function MonthlySales({ report }: { report: SalesReport }) {
  const currentYear = report.currentMonth.slice(0, 4);
  const [year, setYear] = useState(currentYear);
  const years = [...new Set([currentYear, ...report.months.map(row => row.month.slice(0, 4))])].sort().reverse();
  const yearMonths = report.months.filter(row => row.month.startsWith(`${year}-`));
  const yearEnd = year === currentYear ? Number(report.currentMonth.slice(5)) : 12;
  const lastMonth = Math.max(yearEnd, ...yearMonths.map(row => Number(row.month.slice(5))));
  const byMonth = new Map(yearMonths.map(row => [row.month, row]));
  const profits = yearMonths.filter(row => row.costedOrderCount).map(row => row.realizedProfitGs);
  const low = Math.min(0, ...profits);
  const high = Math.max(0, ...profits);
  const range = high - low;
  const zero = range ? -low / range * 100 : 0;

  return <section className="card dashboard-monthly" aria-labelledby="dashboard-monthly-title">
    <header className="dashboard-monthly-heading">
      <div><h2 id="dashboard-monthly-title">Ganancia por mes</h2><p>Según la fecha de entrega.</p></div>
      <label>Año<select value={year} onChange={event => setYear(event.target.value)}>
        {years.map(option => <option value={option} key={option}>{option}</option>)}
      </select></label>
    </header>
    {yearMonths.length ? <table className="dashboard-month-table" aria-label="Ventas y ganancia por mes">
      <thead><tr><th scope="col">Mes</th><th scope="col">Ventas</th><th scope="col">Ganancia</th></tr></thead>
      <tbody>{Array.from({ length: lastMonth }, (_, index) => {
        const month = `${year}-${String(lastMonth - index).padStart(2, '0')}`;
        const row = byMonth.get(month);
        const delta = row?.costedOrderCount && range ? row.realizedProfitGs / range * 100 : 0;
        return <tr key={month}>
          <th scope="row">{monthName.format(new Date(`${month}-01T00:00:00Z`))}</th>
          <td>{row ? salesAmount(row) : '—'}</td>
          <td><strong className={row && row.realizedProfitGs < 0 ? 'dashboard-loss' : undefined}>{row ? profitAmount(row) : '—'}</strong>
            {row?.costedOrderCount && range ? <span className="dashboard-month-bar" aria-hidden="true">
              <span className={delta < 0 ? 'dashboard-bar-loss' : 'dashboard-bar-profit'} style={{ left: `${zero + Math.min(delta, 0)}%`, width: `${Math.abs(delta)}%` }} />
              <span className="dashboard-bar-zero" style={{ left: `${zero}%` }} />
            </span> : null}
            {row && row.costedOrderCount > 0 && row.costedOrderCount < row.orderCount ? <small className="dashboard-month-coverage">
              {count.format(row.costedOrderCount)} de {count.format(row.orderCount)} con resultado
            </small> : null}
          </td>
        </tr>;
      })}</tbody>
    </table> : <p className="dashboard-month-empty">Todavía no hay entregas con fecha en este año.</p>}
    {report.undated.orderCount ? <p className="dashboard-undated">{count.format(report.undated.orderCount)} {report.undated.orderCount === 1 ? 'pedido sin fecha de entrega incluido' : 'pedidos sin fecha de entrega incluidos'} en el acumulado.</p> : null}
  </section>;
}

export function DashboardScreen() {
  const [report, setReport] = useState<SalesReport | null>(null);
  const [readiness, setReadiness] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    get<SalesReport>('/api/reports/sales')
      .then(data => { if (active) setReport(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el resumen.'); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    let active = true;
    get<{ readiness: Record<string, boolean> }>('/api/settings')
      .then(settings => { if (active) setReadiness(settings.readiness); })
      .catch(() => { /* The sales report loads independently of pricing settings. */ });
    return () => { active = false; };
  }, []);

  const totals = report?.totals;
  const unpriced = totals ? totals.orderCount - totals.pricedOrderCount : 0;
  return <section className="page dashboard-page"><div className="page-heading"><div><h1>Resumen</h1><p>Acumulado de entregas.</p></div>
    <button type="button" onClick={() => navigate('/')}>Cotizar ahora</button></div>
    {error ? <div className="card dashboard-error"><p role="alert">{error}</p><button type="button" className="secondary" onClick={() => { setError(null); setAttempt(value => value + 1); }}>Volver a cargar</button></div>
      : report && totals ? <>
        <section className="dashboard-overview" aria-label="Resultado acumulado">
          <div className="dashboard-stat"><h2>Ventas entregadas</h2><strong className="dashboard-amount">{salesAmount(totals)}</strong>
            <p>{count.format(totals.orderCount)} {totals.orderCount === 1 ? 'pedido entregado' : 'pedidos entregados'}{unpriced ? ` · ${count.format(unpriced)} sin importe` : ''}</p></div>
          <div className="dashboard-stat dashboard-profit"><h2>Ganancia registrada</h2><strong className={`dashboard-amount${totals.realizedProfitGs < 0 ? ' dashboard-loss' : ''}`}>{profitAmount(totals)}</strong>
            <p>{totals.orderCount ? `${count.format(totals.costedOrderCount)} de ${count.format(totals.orderCount)} entregas con ganancia calculada` : 'Disponible al registrar los costos de un pedido entregado.'}</p>
            {totals.orderCount > 0 ? <a className="table-link dashboard-history-link" href={DELIVERY_DETAILS_PATH} onClick={event => {
              if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault(); navigate(DELIVERY_DETAILS_PATH);
            }}>Completar historial</a> : null}
          </div>
        </section>
        <MonthlySales report={report} />
        <details className="dashboard-method"><summary>Qué incluyen las cifras</summary>
          <p>Las ventas suman el importe de los pedidos entregados. Cuando la ficha de producción registra un importe real, se usa ese valor.</p>
          <p>La ganancia usa el resultado del cierre de producción cuando está registrado. Para las demás entregas, se calcula al restar el costo real total del importe de venta.</p>
        </details>
      </> : <p className="card dashboard-loading" role="status">Cargando ventas y ganancias…</p>}
    {readiness && !readiness.quickQuoteReady ? <article className="card setup-callout"><h2>Terminá la configuración para empezar a cotizar.</h2><p>Revisá los ajustes básicos que todavía faltan.</p><button type="button" onClick={() => navigate('/settings')}>Revisar ajustes</button><details><summary>Ver detalles técnicos</summary><ul className="checklist">{readinessItems.filter(([key]) => readiness[key] === false).map(([key, label]) => <li key={key} className="pending"><span aria-hidden="true">!</span>{label}</li>)}</ul></details></article> : null}
  </section>;
}
