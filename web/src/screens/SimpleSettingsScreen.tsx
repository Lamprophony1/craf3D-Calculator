import { useEffect, useState, type FormEvent } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { get, post, put } from '../api/client';
import type { Filament, QuickQuotePreviewResponse, SimplePricingSettings } from '../api/types';
import { navigate } from '../components/AppShell';
import { ModalDialog } from '../components/ModalDialog';
import { formatPyg } from '../utils/format';

export function SimpleSettingsScreen() {
  const [settings, setSettings] = useState<SimplePricingSettings | null>(null);
  const [exampleSpoolId, setExampleSpoolId] = useState('');
  const [example, setExample] = useState<QuickQuotePreviewResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const loadExample = async (spoolId: string) => {
    if (!spoolId) { setExample(null); return; }
    try { setExample(await post<QuickQuotePreviewResponse>('/api/calculations/quick-quote-preview', { spoolId, printDurationMinutes: 324, totalGrams: 142 })); }
    catch { setExample(null); }
  };
  useEffect(() => {
    Promise.all([get<SimplePricingSettings>('/api/pricing/simple-settings'), get<Filament[]>('/api/filaments')])
      .then(([current, filaments]) => {
        setSettings(current);
        const spoolId = filaments.find(row => row.isActive)?.id ?? '';
        setExampleSpoolId(spoolId); void loadExample(spoolId);
      }).catch(reason => setMessage(reason instanceof Error ? reason.message : 'No pudimos cargar los ajustes.'));
  }, []);

  const update = (key: keyof SimplePricingSettings, value: number) => setSettings(current => current ? { ...current, [key]: value, isUsingRecommendedDefaults: false } : current);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!settings) return; setSaving(true); setMessage(null);
    try {
      const saved = await put<SimplePricingSettings>('/api/pricing/simple-settings', settings);
      setSettings(saved); setMessage('Ajustes guardados. El próximo precio ya usará estos valores.');
      await loadExample(exampleSpoolId);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No pudimos guardar los ajustes.'); }
    finally { setSaving(false); }
  };
  const restore = async () => {
    setSaving(true);
    try {
      const restored = await post<SimplePricingSettings>('/api/pricing/simple-settings/restore-recommended');
      setSettings(restored); setRestoreOpen(false); setMessage('Restauramos los ajustes recomendados.'); await loadExample(exampleSpoolId);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No pudimos restaurar los ajustes.'); }
    finally { setSaving(false); }
  };
  if (!settings) return <section className="page settings-page"><h1>Ajustes de precio</h1><p>{message ?? 'Cargando…'}</p></section>;

  const numberField = (key: keyof SimplePricingSettings, label: string, suffix: string, help: string, min = 0, max?: number) => <div className="pricing-setting"><label>{label}<span className="value-input"><input type="number" min={min} max={max} step="any" value={Number(settings[key])} onChange={event => update(key, Number(event.target.value))} /><span>{suffix}</span></span></label><p>{help}</p></div>;
  return <section className="page settings-page">
    <div className="page-heading"><div><h1>Ajustes de precio</h1><p>Los valores que usamos automáticamente en cada presupuesto.</p></div>{settings.isUsingRecommendedDefaults ? <span className="recommended-badge">✓ Ajustes recomendados</span> : null}</div>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <form className="simple-settings-form" onSubmit={event => void submit(event)}>
      <section className="settings-card"><h2>Así calculamos tus presupuestos</h2><div className="settings-fields">
        {numberField('machineHourlyRateGs', 'Uso de la impresora', 'Gs. por hora', 'Cubre desgaste, mantenimiento y recuperación del equipo.', .01)}
        {numberField('preparationMinutes', 'Preparación', 'minutos por pedido', 'Tiempo promedio para preparar, retirar y revisar una impresión.')}
        {numberField('laborHourlyRateGs', 'Valor de tu tiempo', 'Gs. por hora', 'Reconoce el trabajo manual dedicado a cada pedido.', .01)}
        <p className="computed-value">La preparación representa <strong>{formatPyg(settings.preparationCostGs)}</strong> por pedido.</p>
        {numberField('packagingCostGs', 'Embalaje', 'Gs. por pedido', 'Incluye el embalaje básico usado al entregar la pieza.')}
      </div></section>
      <details className="settings-card"><summary>Margen e imprevistos</summary><div className="settings-fields">
        {numberField('failureProbabilityPercent', 'Reserva por fallas', '%', 'Protege el precio ante reimpresiones ocasionales.', 0, 95)}
        {numberField('overheadPercent', 'Costos generales', '%', 'Cubre limpieza, alcohol, adhesivos y operación.', 0, 100)}
        {numberField('targetMarginPercent', 'Ganancia objetivo', '%', 'Es la ganancia buscada cuando el pedido lo permite.', 0, 99)}
        {numberField('minimumMarginPercent', 'Ganancia mínima', '%', 'Evita recomendar precios con una rentabilidad demasiado baja.', 0, 99)}
        {numberField('minimumOrderGs', 'Precio mínimo', 'Gs.', 'Evita aceptar trabajos pequeños que no cubren la gestión del pedido.')}
        {numberField('roundingIncrementGs', 'Redondeo', 'Gs.', 'Redondea hacia arriba al múltiplo indicado para dar un precio claro.')}
      </div></details>
      <details className="settings-card"><summary>Luz y consumo</summary><div className="settings-fields">
        {numberField('averagePrintPowerW', 'Consumo promedio al imprimir', 'W', 'Estimación técnica usada para calcular la electricidad.', .01)}
        {numberField('electricityRateGsPerKWh', 'Tarifa de electricidad', 'Gs. por kWh', 'Valor efectivo de energía configurado para el cálculo.', .01)}
      </div></details>
      <section className="settings-example" aria-live="polite"><div><h2>Ejemplo con tus ajustes</h2><p>PLA de 142 g · 5 h 24 min</p></div><strong>{example?.canUsePrice && example.breakdown ? formatPyg(example.breakdown.customerTotalGs) : 'Agregá un filamento para ver el ejemplo'}</strong></section>
      <section className="technical-data"><h2>Datos técnicos automáticos</h2><dl><div><dt>Impresora</dt><dd>{settings.printerName}</dd></div><div><dt>Consumo estimado</dt><dd>{settings.averagePrintPowerW} W</dd></div><div><dt>Tarifa</dt><dd>{settings.electricityTariffName}: {settings.electricityRateGsPerKWh.toLocaleString('es-PY')} Gs/kWh</dd></div></dl><p>Estos valores tienen poco impacto comparados con material y tiempo. Normalmente no necesitás modificarlos.</p></section>
      <div className="settings-actions"><button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button><button type="button" className="secondary" onClick={() => setRestoreOpen(true)}><RotateCcw size={18} aria-hidden="true" />Restaurar valores recomendados</button></div>
    </form>
    <button type="button" className="advanced-settings-link" onClick={() => navigate('/settings/advanced')}>Editar configuración técnica <ChevronRight size={18} aria-hidden="true" /></button>
    <ModalDialog open={restoreOpen} title="¿Restaurar ajustes recomendados?" description="Esto reemplazará los valores simples de precio por la configuración inicial recomendada." banner="Tus presupuestos guardados no se modificarán." onClose={() => setRestoreOpen(false)}
      footer={<><button type="button" disabled={saving} onClick={() => void restore()}>Sí, restaurar</button><button type="button" className="secondary" onClick={() => setRestoreOpen(false)}>Cancelar</button></>}>
      <p>Uso de impresora 2.000 Gs/h, preparación 20 min, tiempo 20.000 Gs/h, margen objetivo 40% y redondeo de 5.000 Gs.</p>
    </ModalDialog>
  </section>;
}

const advancedGroups = [
  ['Máquina y energía', [['Impresoras', '/printers'], ['Perfiles de consumo', '/energy-profiles'], ['Tarifas eléctricas', '/electricity-tariffs']]],
  ['Motor de precio', [['Políticas de precios', '/pricing-policies'], ['Impuestos y defaults', '/settings/advanced/general']]],
  ['Datos auxiliares', [['Clientes', '/customers'], ['Plantillas', '/product-templates'], ['Auditoría', '/audit']]]
] as const;

export function AdvancedSettingsScreen() {
  return <section className="page settings-page"><div className="page-heading"><div><h1>Configuración avanzada</h1><p>Estos valores modifican el motor de cálculo. Los ajustes recomendados son suficientes para el uso diario.</p></div></div>
    <div className="advanced-groups">{advancedGroups.map(([title, links], index) => <details className="settings-card" key={title} open={index === 0}><summary>{title}</summary><nav>{links.map(([label, href]) => <a key={href} href={href} onClick={event => { event.preventDefault(); navigate(href); }}>{label}<ChevronRight size={18} aria-hidden="true" /></a>)}</nav></details>)}</div>
    <button type="button" className="secondary" onClick={() => navigate('/settings')}>Volver a Ajustes de precio</button>
  </section>;
}
