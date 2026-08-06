import { useEffect, useState } from 'react';
import { get } from '../api/client';
import { formatPyg } from '../utils/format';
import { navigate } from '../components/AppShell';

interface DashboardData {
  summary?: { quotes: number; acceptedQuotes: number; jobs: number; completedJobs: number; actualProductionCostGs: number };
  readiness?: Record<string, boolean>;
}

const readinessLabels: Record<string, string> = {
  machineCostConfigured: 'Costo de impresora configurado', laborRateConfigured: 'Tarifa de trabajo configurada',
  pricingPolicyConfigured: 'Política de precios configurada', electricityTariffReviewed: 'Tarifa eléctrica revisada',
  activeFilamentAvailable: 'Al menos un filamento activo', pinsConfigured: 'PINs configurados',
  productionHostnameConfigured: 'Hostname productivo definido'
};

export function DashboardScreen() {
  const [data, setData] = useState<DashboardData>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([get<DashboardData['summary']>('/api/reports/summary'), get<{ readiness: Record<string, boolean> }>('/api/settings')])
      .then(([summary, settings]) => setData({ summary, readiness: settings.readiness }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar el panel.'));
  }, []);
  return <section className="page"><div className="page-heading"><div><h1>Panel</h1><p>Estado operativo y accesos rápidos.</p></div>
    <button type="button" onClick={() => navigate('/calculator')}>Nueva cotización</button></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <div className="metric-grid">
      <article><span>Cotizaciones</span><strong>{data.summary?.quotes ?? '—'}</strong></article>
      <article><span>Aceptadas</span><strong>{data.summary?.acceptedQuotes ?? '—'}</strong></article>
      <article><span>Trabajos terminados</span><strong>{data.summary?.completedJobs ?? '—'}</strong></article>
      <article><span>Costo real registrado</span><strong>{data.summary ? formatPyg(data.summary.actualProductionCostGs) : '—'}</strong></article>
    </div>
    <article className="card"><h2>Preparación inicial</h2><ul className="checklist">
      {Object.entries(data.readiness ?? {}).map(([key, ready]) => <li key={key} className={ready ? 'ready' : 'pending'}>
        <span aria-hidden="true">{ready ? '✓' : '!'}</span>{readinessLabels[key] ?? key}</li>)}
    </ul><p className="hint">Los valores pendientes no se inventan: deben configurarse con decisiones reales del negocio.</p></article>
  </section>;
}

