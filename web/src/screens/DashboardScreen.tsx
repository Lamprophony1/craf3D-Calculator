import { useEffect, useState } from 'react';
import { get } from '../api/client';
import { formatPyg } from '../utils/format';
import { navigate } from '../components/AppShell';

interface DashboardData {
  summary?: { quotes: number; acceptedQuotes: number; jobs: number; completedJobs: number; actualProductionCostGs: number };
  readiness?: Record<string, boolean>;
}

const readinessLabels: Record<string, string> = {
  defaultPrinterConfigured: 'Impresora predeterminada utilizable',
  defaultPrinterMachineCostConfigured: 'Costo horario de la impresora predeterminada',
  defaultTariffConfigured: 'Tarifa predeterminada vigente',
  defaultPolicyConfigured: 'Política predeterminada vigente',
  defaultLaborRateConfigured: 'Tarifa laboral predeterminada',
  defaultQuickSetupConfigured: 'Setup rápido configurado',
  defaultQuickPackagingConfigured: 'Embalaje rápido configurado',
  activePricedFilamentAvailable: 'Filamento activo con costo positivo',
  compatibleEnergyProfileAvailable: 'Perfil energético compatible disponible',
  quickQuoteReady: 'Cotización rápida lista',
  machineCostConfigured: 'Costo de impresora configurado', laborRateConfigured: 'Tarifa de trabajo configurada',
  pricingPolicyConfigured: 'Política de precios configurada', electricityTariffReviewed: 'Tarifa eléctrica revisada',
  activeFilamentAvailable: 'Al menos un filamento activo', pinsConfigured: 'PINs configurados',
  quickQuoteDefaultsConfigured: 'Defaults de cotización rápida configurados',
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
  return <section className="page"><div className="page-heading"><div><h1>Resumen</h1><p>Una vista breve de la actividad.</p></div>
    <button type="button" onClick={() => navigate('/')}>Cotizar ahora</button></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <div className="metric-grid">
      <article><span>Cotizaciones</span><strong>{data.summary?.quotes ?? '—'}</strong></article>
      <article><span>Aceptadas</span><strong>{data.summary?.acceptedQuotes ?? '—'}</strong></article>
      <article><span>Trabajos terminados</span><strong>{data.summary?.completedJobs ?? '—'}</strong></article>
      <article><span>Costo real registrado</span><strong>{data.summary ? formatPyg(data.summary.actualProductionCostGs) : '—'}</strong></article>
    </div>
    {data.readiness && !data.readiness.quickQuoteReady ? <article className="card setup-callout"><h2>Terminá la configuración para empezar a cotizar.</h2><p>Revisá los ajustes básicos que todavía faltan.</p><button type="button" onClick={() => navigate('/settings')}>Revisar ajustes</button><details><summary>Ver detalles técnicos</summary><ul className="checklist">{Object.entries(data.readiness).filter(([key, ready]) => !ready && readinessLabels[key]).map(([key]) => <li key={key} className="pending"><span aria-hidden="true">!</span>{readinessLabels[key]}</li>)}</ul></details></article> : null}
  </section>;
}
