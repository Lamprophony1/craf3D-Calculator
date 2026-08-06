import { useEffect, useState } from 'react';
import { get, post } from '../api/client';
import type { JobSummary, QuoteSummary } from '../api/types';
import { navigate } from '../components/AppShell';
import { formatLocalDate, formatPyg } from '../utils/format';

export function QuoteListScreen() {
  const [rows, setRows] = useState<QuoteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { get<QuoteSummary[]>('/api/quotes').then(setRows).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error')); }, []);
  return <ListPage title="Cotizaciones" action="Nueva cotización" onAction={() => navigate('/quotes/new')} error={error}>
    {rows.map(row => <button type="button" className="list-row" key={row.id} onClick={() => navigate(`/quotes/${row.id}`)}>
      <span><strong>{row.code}</strong><small>{formatLocalDate(row.createdAt)} · Rev. {row.revisionNumber}</small></span>
      <span><b>{formatPyg(row.totalGs)}</b><small className="status">{row.status}</small></span>
    </button>)}{rows.length === 0 ? <p className="empty">Todavía no hay cotizaciones.</p> : null}
  </ListPage>;
}

export function JobListScreen() {
  const [rows, setRows] = useState<JobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { get<JobSummary[]>('/api/jobs').then(setRows).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error')); }, []);
  return <ListPage title="Trabajos" error={error}>
    {rows.map(row => <button type="button" className="list-row" key={row.id} onClick={() => navigate(`/jobs/${row.id}`)}>
      <span><strong>{row.code}</strong><small>{formatLocalDate(row.createdAt)}</small></span>
      <span><b>{formatPyg(row.actualCostGs ?? row.estimatedTotalGs)}</b><small className="status">{row.status}</small></span>
    </button>)}{rows.length === 0 ? <p className="empty">Todavía no hay trabajos.</p> : null}
  </ListPage>;
}

export function QuoteDetailScreen({ id }: { id: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => get<Record<string, unknown>>(`/api/quotes/${id}`).then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'));
  useEffect(() => { void refresh(); }, [id]);
  const act = async (action: string) => { try { await post(`/api/quotes/${id}/${action}`); refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Error'); } };
  const status = String(data?.status ?? '');
  return <section className="page"><div className="page-heading"><div><h1>{String(data?.code ?? 'Cotización')}</h1><p>Estado: {status || 'Cargando…'}</p></div><button type="button" className="secondary" onClick={() => window.print()}>Imprimir</button></div>
    {error ? <p className="error">{error}</p> : null}<div className="actions">
      {status === 'Calculated' ? <button onClick={() => void act('ready')}>Marcar lista para enviar</button> : null}
      {status === 'ReadyToSend' ? <button onClick={() => void act('send')}>Marcar enviada</button> : null}
      {status === 'Sent' ? <><button onClick={() => void act('accept')}>Aceptar</button><button className="secondary" onClick={() => void act('reject')}>Rechazar</button></> : null}
      {status === 'Accepted' ? <button onClick={() => void act('convert-to-job')}>Convertir a trabajo</button> : null}
      {['Calculated', 'ReadyToSend', 'Sent'].includes(status) ? <button className="secondary" onClick={() => void act('revisions/from-current-costs')}>Nueva revisión con costos actuales</button> : null}
    </div>{data ? <JsonCard data={data} /> : <p>Cargando…</p>}</section>;
}

export function JobDetailScreen({ id }: { id: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(0);
  const [kwh, setKwh] = useState(0);
  const [grams, setGrams] = useState(0);
  const [charged, setCharged] = useState(0);
  const refresh = () => get<Record<string, unknown>>(`/api/jobs/${id}`).then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'));
  useEffect(() => { void refresh(); }, [id]);
  const status = String(data?.status ?? '');
  const estimate = data?.estimate as { breakdown?: { materials?: Array<{ spoolId?: string }> } } | undefined;
  const spoolId = estimate?.breakdown?.materials?.[0]?.spoolId;
  const complete = async () => {
    try {
      await post(`/api/jobs/${id}/complete`, { actualOccupiedHours: hours, actualKWh: kwh, attempts: 1, failedAttempts: 0, materials: spoolId ? [{ spoolId, grams }] : [], labor: [], additionalCosts: [], actualOverheadGs: 0, finalChargedNetGs: charged, notes: null });
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  };
  return <section className="page"><div className="page-heading"><div><h1>{String(data?.code ?? 'Trabajo')}</h1><p>Estado: {status || 'Cargando…'}</p></div></div>
    {error ? <p className="error">{error}</p> : null}
    {status === 'Planned' ? <button onClick={async () => { await post(`/api/jobs/${id}/start`); refresh(); }}>Iniciar</button> : null}
    {['Planned', 'Printing', 'Paused'].includes(status) ? <form className="card form-grid compact" onSubmit={(e) => { e.preventDefault(); void complete(); }}>
      <h2>Registrar costos reales</h2><label>Horas reales<input type="number" min="0" step="0.01" value={hours} onChange={e => setHours(Number(e.target.value))} /></label>
      <label>kWh reales<input type="number" min="0" step="0.001" value={kwh} onChange={e => setKwh(Number(e.target.value))} /></label>
      <label>Gramos reales<input type="number" min="0" step="0.01" value={grams} onChange={e => setGrams(Number(e.target.value))} /></label>
      <label>Importe neto cobrado<input type="number" min="0" step="1" value={charged} onChange={e => setCharged(Number(e.target.value))} /></label>
      <div className="actions span-2"><button type="submit">Completar trabajo</button></div></form> : null}
    {data ? <JsonCard data={data} /> : <p>Cargando…</p>}</section>;
}

function ListPage({ title, action, onAction, error, children }: { title: string; action?: string; onAction?: () => void; error: string | null; children: React.ReactNode }) {
  return <section className="page"><div className="page-heading"><div><h1>{title}</h1></div>{action ? <button onClick={onAction}>{action}</button> : null}</div>
    {error ? <p className="error">{error}</p> : null}<div className="card list">{children}</div></section>;
}

export function JsonCard({ data }: { data: unknown }) { return <article className="card json-card"><pre>{JSON.stringify(data, null, 2)}</pre></article>; }
