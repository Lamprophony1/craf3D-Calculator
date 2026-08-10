import { useEffect, useMemo, useState } from 'react';
import { get, post, put } from '../api/client';
import type { ApplicationSettings, ElectricityTariff, EnergyProfile, PricingPolicy, Printer, SettingsResponse } from '../api/types';

interface Field {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  required?: boolean;
  options?: Array<string | { value: string; label: string }>;
  defaultValue?: string | number;
  min?: number;
  max?: number;
}

interface Definition {
  title: string;
  endpoint: string;
  fields: Field[];
  build: (values: Record<string, string>, existing?: Record<string, unknown>) => Record<string, unknown>;
  label: (row: Record<string, unknown>) => string;
  detail: (row: Record<string, unknown>) => string;
}

const text = (values: Record<string, string>, key: string, existing?: Record<string, unknown>, fallback = '') =>
  values[key] ?? (existing?.[key] == null ? fallback : String(existing[key]));
const number = (values: Record<string, string>, key: string, existing?: Record<string, unknown>, fallback = 0) => {
  const value = text(values, key, existing, String(fallback));
  return value === '' ? fallback : Number(value);
};
const optionalNumber = (values: Record<string, string>, key: string, existing?: Record<string, unknown>) => {
  const value = text(values, key, existing);
  return value === '' ? null : Number(value);
};
const boolean = (values: Record<string, string>, key: string, existing?: Record<string, unknown>, fallback = false) =>
  values[key] === undefined ? Boolean(existing?.[key] ?? fallback) : values[key] === 'true';
const basicFields: Field[] = [{ name: 'name', label: 'Nombre', required: true }];
const yesNo = [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }];

const definitions: Record<string, Definition> = {
  printers: {
    title: 'Impresoras', endpoint: '/api/printers', label: row => String(row.name),
    detail: row => `${String(row.manufacturer)} ${String(row.model)} · ${row.manualHourlyRateGs == null ? 'costo horario pendiente' : `${String(row.manualHourlyRateGs)} Gs/h`}`,
    fields: [
      ...basicFields,
      { name: 'manufacturer', label: 'Fabricante', required: true },
      { name: 'model', label: 'Modelo', required: true },
      { name: 'voltage', label: 'Tensión (V)', type: 'number', defaultValue: 220, min: 0 },
      { name: 'machineCostMode', label: 'Método de costo', type: 'select', options: [
        { value: 'ManualHourlyRate', label: 'Costo manual por hora' },
        { value: 'UsefulLifeDepreciation', label: 'Depreciación por vida útil' },
        { value: 'TargetRecoveryPeriod', label: 'Recuperación objetivo' }
      ], defaultValue: 'ManualHourlyRate' },
      { name: 'manualHourlyRateGs', label: 'Costo manual por hora (Gs)', type: 'number', min: 0 },
      { name: 'purchaseCostGs', label: 'Costo de compra (Gs)', type: 'number', min: 0 },
      { name: 'residualValueGs', label: 'Valor residual (Gs)', type: 'number', min: 0, defaultValue: 0 },
      { name: 'usefulLifeHours', label: 'Vida útil (horas)', type: 'number', min: 0 },
      { name: 'recoveryYears', label: 'Años de recuperación', type: 'number', min: 0 },
      { name: 'businessDaysPerYear', label: 'Días de trabajo/año', type: 'number', min: 0 },
      { name: 'plannedBillableHoursPerDay', label: 'Horas facturables/día', type: 'number', min: 0 },
      { name: 'maintenanceReserveGsPerHour', label: 'Reserva mantenimiento Gs/h', type: 'number', min: 0, defaultValue: 0 },
      { name: 'repairReserveGsPerHour', label: 'Reserva reparaciones Gs/h', type: 'number', min: 0, defaultValue: 0 }
    ],
    build: (v, e) => ({ ...e, name: text(v, 'name', e), manufacturer: text(v, 'manufacturer', e), model: text(v, 'model', e),
      voltage: number(v, 'voltage', e, 220), machineCostMode: text(v, 'machineCostMode', e, 'ManualHourlyRate'),
      purchaseCostGs: optionalNumber(v, 'purchaseCostGs', e), residualValueGs: number(v, 'residualValueGs', e),
      usefulLifeHours: optionalNumber(v, 'usefulLifeHours', e), expectedLifetimeRepairCostGs: Number(e?.expectedLifetimeRepairCostGs ?? 0),
      maintenanceReserveGsPerHour: number(v, 'maintenanceReserveGsPerHour', e), recoveryYears: optionalNumber(v, 'recoveryYears', e),
      businessDaysPerYear: optionalNumber(v, 'businessDaysPerYear', e), plannedBillableHoursPerDay: optionalNumber(v, 'plannedBillableHoursPerDay', e),
      repairReserveGsPerHour: number(v, 'repairReserveGsPerHour', e), manualHourlyRateGs: optionalNumber(v, 'manualHourlyRateGs', e),
      isActive: Boolean(e?.isActive ?? true) })
  },
  filaments: {
    title: 'Filamentos e inventario', endpoint: '/api/filaments', label: row => `${String(row.material)} · ${String(row.color)}`,
    detail: row => `${String(row.productName)} · ${String(row.remainingWeightGrams)} g restantes`,
    fields: [
      { name: 'manufacturer', label: 'Fabricante', required: true }, { name: 'productName', label: 'Producto', required: true },
      { name: 'material', label: 'Material', type: 'select', options: ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Otro'], required: true },
      { name: 'color', label: 'Color', required: true }, { name: 'batchCode', label: 'Lote' },
      { name: 'purchaseCurrency', label: 'Moneda', type: 'select', options: ['PYG', 'USD', 'EUR'], defaultValue: 'PYG' },
      { name: 'purchaseAmount', label: 'Precio de compra', type: 'number', required: true, min: 0 },
      { name: 'exchangeRateGs', label: 'Tipo de cambio', type: 'number', min: 0 },
      { name: 'allocatedShippingGs', label: 'Envío asignado (Gs)', type: 'number', min: 0, defaultValue: 0 },
      { name: 'allocatedImportFeesGs', label: 'Importación asignada (Gs)', type: 'number', min: 0, defaultValue: 0 },
      { name: 'allocatedOtherCostsGs', label: 'Otros costos asignados (Gs)', type: 'number', min: 0, defaultValue: 0 },
      { name: 'netWeightGrams', label: 'Peso neto original (g)', type: 'number', defaultValue: 1000, min: 0 },
      { name: 'remainingWeightGrams', label: 'Peso restante (g)', type: 'number', defaultValue: 1000, min: 0 },
      { name: 'supplier', label: 'Proveedor' }
    ],
    build: (v, e) => ({ ...e, manufacturer: text(v, 'manufacturer', e), productName: text(v, 'productName', e), material: text(v, 'material', e),
      color: text(v, 'color', e), batchCode: text(v, 'batchCode', e) || null, purchaseCurrency: text(v, 'purchaseCurrency', e, 'PYG'),
      purchaseAmount: number(v, 'purchaseAmount', e), exchangeRateGs: optionalNumber(v, 'exchangeRateGs', e),
      allocatedShippingGs: number(v, 'allocatedShippingGs', e), allocatedImportFeesGs: number(v, 'allocatedImportFeesGs', e),
      allocatedOtherCostsGs: number(v, 'allocatedOtherCostsGs', e), netWeightGrams: number(v, 'netWeightGrams', e, 1000),
      remainingWeightGrams: number(v, 'remainingWeightGrams', e, 1000), purchasedAt: e?.purchasedAt ?? null,
      supplier: text(v, 'supplier', e) || null, isInventoryTracked: Boolean(e?.isInventoryTracked ?? true), isActive: Boolean(e?.isActive ?? true) })
  },
  'electricity-tariffs': {
    title: 'Tarifas eléctricas', endpoint: '/api/electricity-tariffs', label: row => `${String(row.provider)} · ${String(row.name)}`,
    detail: row => `${String(row.baseRateGsPerKWh)} Gs/kWh`,
    fields: [
      { name: 'provider', label: 'Proveedor', defaultValue: 'ANDE', required: true }, ...basicFields,
      { name: 'category', label: 'Categoría', required: true }, { name: 'baseRateGsPerKWh', label: 'Tarifa base Gs/kWh', type: 'number', required: true, min: 0 },
      { name: 'additionalChargesPercent', label: 'Cargos adicionales %', type: 'number', defaultValue: 0, min: 0, max: 100 },
      { name: 'explicitEffectiveRateGsPerKWh', label: 'Tarifa efectiva explícita', type: 'number', min: 0 },
      { name: 'sourceName', label: 'Fuente' }, { name: 'verifiedAt', label: 'Fecha de verificación', type: 'date' },
      { name: 'effectiveFrom', label: 'Vigente desde', type: 'date' }, { name: 'effectiveTo', label: 'Vigente hasta', type: 'date' }
    ],
    build: (v, e) => ({ ...e, provider: text(v, 'provider', e, 'ANDE'), name: text(v, 'name', e), category: text(v, 'category', e),
      baseRateGsPerKWh: number(v, 'baseRateGsPerKWh', e), excludesTax: Boolean(e?.excludesTax ?? true),
      additionalChargesPercent: number(v, 'additionalChargesPercent', e), explicitEffectiveRateGsPerKWh: optionalNumber(v, 'explicitEffectiveRateGsPerKWh', e),
      sourceName: text(v, 'sourceName', e) || null, verifiedAt: text(v, 'verifiedAt', e) || null,
      effectiveFrom: text(v, 'effectiveFrom', e) || null, effectiveTo: text(v, 'effectiveTo', e) || null, isActive: Boolean(e?.isActive ?? true) })
  },
  customers: {
    title: 'Clientes', endpoint: '/api/customers', label: row => String(row.name), detail: row => String(row.phone ?? row.email ?? ''),
    fields: [...basicFields, { name: 'phone', label: 'Teléfono' }, { name: 'email', label: 'Email' }, { name: 'notes', label: 'Notas' }],
    build: (v, e) => ({ ...e, name: text(v, 'name', e), phone: text(v, 'phone', e) || null, email: text(v, 'email', e) || null,
      notes: text(v, 'notes', e) || null, isActive: Boolean(e?.isActive ?? true) })
  },
  'product-templates': {
    title: 'Plantillas de producto', endpoint: '/api/product-templates', label: row => String(row.name), detail: row => String(row.description ?? ''),
    fields: [...basicFields, { name: 'description', label: 'Descripción' }],
    build: (v, e) => ({ ...e, name: text(v, 'name', e), description: text(v, 'description', e) || null,
      defaultPrinterId: e?.defaultPrinterId ?? null, defaultEnergyProfileId: e?.defaultEnergyProfileId ?? null,
      defaultQuantityData: e?.defaultQuantityData ?? null, defaultLaborLines: e?.defaultLaborLines ?? null,
      defaultCostLines: e?.defaultCostLines ?? null, isActive: Boolean(e?.isActive ?? true) })
  },
  'pricing-policies': {
    title: 'Políticas de precios', endpoint: '/api/pricing-policies', label: row => `${String(row.name)}${row.isDefault ? ' · predeterminada' : ''}`,
    detail: row => `Margen ${String(row.targetMarginPercent)}% · mínimo ${String(row.minimumOrderGs)} Gs`,
    fields: [
      ...basicFields, { name: 'targetMarginPercent', label: 'Margen objetivo %', type: 'number', defaultValue: 40, min: 0, max: 100 },
      { name: 'minimumMarginPercent', label: 'Margen mínimo %', type: 'number', defaultValue: 30, min: 0, max: 100 },
      { name: 'failureProbability', label: 'Probabilidad de falla (0 a 0,95)', type: 'number', defaultValue: 0.1, min: 0 },
      { name: 'minimumOrderGs', label: 'Pedido mínimo Gs', type: 'number', defaultValue: 30000, min: 0 },
      { name: 'roundingIncrementGs', label: 'Incremento de redondeo Gs', type: 'number', defaultValue: 5000, min: 0 },
      { name: 'defaultLaborRateGsPerHour', label: 'Tarifa laboral por hora', type: 'number', min: 0.01 },
      { name: 'fixedOverheadPerOrderGs', label: 'Overhead fijo por pedido', type: 'number', min: 0, defaultValue: 0 },
      { name: 'overheadPercent', label: 'Overhead %', type: 'number', min: 0, max: 100, defaultValue: 0 },
      { name: 'variableSellingFeePercent', label: 'Comisión variable %', type: 'number', min: 0, max: 100, defaultValue: 0 },
      { name: 'fixedSellingFeeGs', label: 'Comisión fija Gs', type: 'number', min: 0, defaultValue: 0 },
      { name: 'isDefault', label: 'Política predeterminada', type: 'select', options: yesNo, defaultValue: 'false' }
    ],
    build: (v, e) => ({ ...e, name: text(v, 'name', e), targetMarginPercent: number(v, 'targetMarginPercent', e, 40),
      minimumMarginPercent: number(v, 'minimumMarginPercent', e, 30), minimumOrderGs: number(v, 'minimumOrderGs', e, 30000),
      roundingIncrementGs: number(v, 'roundingIncrementGs', e, 5000), roundUp: Boolean(e?.roundUp ?? true),
      failureMode: String(e?.failureMode ?? 'ExpectedAttempts'), failureProbability: number(v, 'failureProbability', e, 0.1),
      simpleFailureReservePercent: Number(e?.simpleFailureReservePercent ?? 0), fixedOverheadPerOrderGs: number(v, 'fixedOverheadPerOrderGs', e),
      overheadPercent: number(v, 'overheadPercent', e), monthlyOverheadGs: Number(e?.monthlyOverheadGs ?? 0),
      expectedMonthlyProductiveHours: Number(e?.expectedMonthlyProductiveHours ?? 0), defaultLaborRateGsPerHour: optionalNumber(v, 'defaultLaborRateGsPerHour', e),
      variableSellingFeePercent: number(v, 'variableSellingFeePercent', e), fixedSellingFeeGs: number(v, 'fixedSellingFeeGs', e),
      isDefault: boolean(v, 'isDefault', e), effectiveFrom: e?.effectiveFrom ?? null, effectiveTo: e?.effectiveTo ?? null,
      isActive: Boolean(e?.isActive ?? true) })
  }
};

const valuesFromRow = (definition: Definition, row: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(definition.fields.map(field => [field.name, row[field.name] == null ? '' : String(row[field.name])]));

export function CatalogScreen({ resource }: { resource: string }) {
  const definition = definitions[resource];
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const load = () => get<Record<string, unknown>[]>(definition.endpoint).then(setRows).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Error'));
  useEffect(() => { void load(); }, [definition.endpoint]);

  const close = () => { setEditing(null); setShowForm(false); };
  const toggle = async (row: Record<string, unknown>) => {
    try {
      const payload = { ...definition.build(valuesFromRow(definition, row), row), isActive: row.isActive === false };
      await put(`${definition.endpoint}/${String(row.id)}`, payload);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cambiar el estado.');
    }
  };

  return <section className="page"><div className="page-heading"><div><h1>{definition.title}</h1><p>Los registros históricos se desactivan sin borrar sus referencias.</p></div>
    <button onClick={() => { if (showForm) close(); else setShowForm(true); }}>{showForm ? 'Cerrar' : 'Agregar'}</button></div>
    {error ? <p className="error">{error}</p> : null}
    {showForm ? <form key={String(editing?.id ?? 'new')} className="card form-grid" aria-label="Editor de catálogo" onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const values = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
      try {
        const payload = definition.build(values, editing ?? undefined);
        if (editing) await put(`${definition.endpoint}/${String(editing.id)}`, payload);
        else await post(definition.endpoint, payload);
        close();
        await load();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'No se pudo guardar.');
      }
    }}><h2>{editing ? 'Editar registro' : 'Nuevo registro'}</h2>{definition.fields.map(field => {
      const current = editing?.[field.name];
      const defaultValue = current == null ? field.defaultValue : String(current);
      if (field.type === 'select') return <label key={field.name}>{field.label}<select name={field.name} defaultValue={defaultValue} required={field.required}>
        {field.options?.map(option => {
          const value = typeof option === 'string' ? option : option.value;
          const label = typeof option === 'string' ? option : option.label;
          return <option key={value} value={value}>{label}</option>;
        })}</select></label>;
      return <label key={field.name}>{field.label}<input name={field.name} type={field.type ?? 'text'} min={field.min} max={field.max}
        step={field.type === 'number' ? 'any' : undefined} defaultValue={defaultValue} required={field.required} /></label>;
    })}<div className="actions span-2"><button type="submit">Guardar cambios</button>{editing ? <button type="button" className="secondary" onClick={close}>Cancelar</button> : null}</div></form> : null}
    <div className="card list">{rows.map(row => <div className="list-row static" key={String(row.id)}><span><strong>{definition.label(row)}</strong><small>{definition.detail(row)}</small></span>
      <span className="row-actions"><small className="status">{row.isActive === false ? 'Inactivo' : 'Activo'}</small><span className="actions">
        <button type="button" className="secondary" onClick={() => { setEditing(row); setShowForm(true); }}>Editar</button>
        <button type="button" className="secondary" onClick={() => void toggle(row)}>{row.isActive === false ? 'Reactivar' : 'Desactivar'}</button>
      </span></span></div>)}{rows.length === 0 ? <p className="empty">No hay registros.</p> : null}</div>
  </section>;
}

export function EnergyProfilesScreen() {
  const [printers, setPrinters] = useState<Array<{ id: string; name: string }>>([]);
  const [printerId, setPrinterId] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    get<Array<{ id: string; name: string }>>('/api/printers').then(items => {
      setPrinters(items);
      setPrinterId(items[0]?.id ?? '');
    }).catch(() => setError('No se pudieron cargar las impresoras.'));
  }, []);
  const load = () => {
    if (printerId) get<Record<string, unknown>[]>(`/api/printers/${printerId}/energy-profiles`).then(setRows).catch(reason => setError(reason instanceof Error ? reason.message : 'Error'));
  };
  useEffect(() => { load(); }, [printerId]);

  const payload = (form: HTMLFormElement, existing?: Record<string, unknown>) => {
    const data = new FormData(form);
    return { ...existing, name: String(data.get('name')), materialFamily: String(data.get('material')), averagePrintPowerW: Number(data.get('average')),
      idlePowerW: Number(data.get('idle')), maxPowerW: Number(data.get('max')), warmupKWh: Number(data.get('warmup')),
      accessoryKWh: Number(data.get('accessory')), sourceName: String(data.get('source') || '') || null,
      verifiedAt: existing?.verifiedAt ?? null, effectiveFrom: String(data.get('effectiveFrom') || '') || null,
      effectiveTo: String(data.get('effectiveTo') || '') || null, isActive: Boolean(existing?.isActive ?? true) };
  };
  const toggle = async (row: Record<string, unknown>) => {
    const request = { ...row, isActive: row.isActive === false };
    await put(`/api/energy-profiles/${String(row.id)}`, request);
    load();
  };

  return <section className="page"><div className="page-heading"><div><h1>Perfiles de energía</h1><p>La potencia máxima es referencia; el promedio compatible con el material se usa para estimar.</p></div></div>
    <label className="inline-control">Impresora<select value={printerId} onChange={event => { setPrinterId(event.target.value); setEditing(null); }}>{printers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    {error ? <p className="error">{error}</p> : null}<form key={String(editing?.id ?? 'new')} className="card form-grid" aria-label="Editor de perfil energético" onSubmit={async event => {
      event.preventDefault();
      try {
        const request = payload(event.currentTarget, editing ?? undefined);
        if (editing) await put(`/api/energy-profiles/${String(editing.id)}`, request);
        else await post(`/api/printers/${printerId}/energy-profiles`, request);
        event.currentTarget.reset(); setEditing(null); load();
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Error'); }
    }}><h2>{editing ? 'Editar perfil' : 'Nuevo perfil'}</h2>
      <label>Nombre<input name="name" defaultValue={String(editing?.name ?? '')} required /></label>
      <label>Material<input name="material" defaultValue={String(editing?.materialFamily ?? '')} required /></label>
      <label>Potencia promedio W<input name="average" type="number" min="0" step="any" defaultValue={Number(editing?.averagePrintPowerW ?? 0)} required /></label>
      <label>Potencia idle W<input name="idle" type="number" min="0" step="any" defaultValue={Number(editing?.idlePowerW ?? 0)} required /></label>
      <label>Potencia máxima W<input name="max" type="number" min="0" step="any" defaultValue={Number(editing?.maxPowerW ?? 0)} required /></label>
      <label>Calentamiento kWh<input name="warmup" type="number" min="0" step="any" defaultValue={Number(editing?.warmupKWh ?? 0)} /></label>
      <label>Accesorios kWh<input name="accessory" type="number" min="0" step="any" defaultValue={Number(editing?.accessoryKWh ?? 0)} /></label>
      <label>Fuente<input name="source" defaultValue={String(editing?.sourceName ?? '')} /></label>
      <label>Vigente desde<input name="effectiveFrom" type="date" defaultValue={String(editing?.effectiveFrom ?? '')} /></label>
      <label>Vigente hasta<input name="effectiveTo" type="date" defaultValue={String(editing?.effectiveTo ?? '')} /></label>
      <div className="actions span-2"><button>Guardar perfil</button>{editing ? <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button> : null}</div></form>
    <div className="card list">{rows.map(row => <div className="list-row static" key={String(row.id)}><span><strong>{String(row.name)}</strong><small>{String(row.materialFamily)} · promedio {String(row.averagePrintPowerW)} W · máxima {String(row.maxPowerW)} W</small></span>
      <span className="row-actions"><small>{row.isActive === false ? 'Inactivo' : 'Activo'}</small><span className="actions"><button type="button" className="secondary" onClick={() => setEditing(row)}>Editar</button><button type="button" className="secondary" onClick={() => void toggle(row)}>{row.isActive === false ? 'Reactivar' : 'Desactivar'}</button></span></span></div>)}</div>
  </section>;
}

type Feedback = { type: 'success' | 'error'; message: string };

const validEnergyProfiles = (rows: EnergyProfile[]) => {
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter(row => row.isActive
    && row.averagePrintPowerW > 0
    && (!row.effectiveFrom || row.effectiveFrom <= today)
    && (!row.effectiveTo || row.effectiveTo >= today));
};

export function GeneralSettingsScreen() {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [energyProfiles, setEnergyProfiles] = useState<EnergyProfile[]>([]);
  const [tariffs, setTariffs] = useState<ElectricityTariff[]>([]);
  const [policies, setPolicies] = useState<PricingPolicy[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useEffect(() => {
    Promise.all([
      get<SettingsResponse>('/api/settings'), get<Printer[]>('/api/printers'),
      get<ElectricityTariff[]>('/api/electricity-tariffs'), get<PricingPolicy[]>('/api/pricing-policies')
    ]).then(([response, printerRows, tariffRows, policyRows]) => {
      setSettings(response.settings); setPrinters(printerRows); setTariffs(tariffRows); setPolicies(policyRows);
    }).catch(reason => setFeedback({
      type: 'error',
      message: reason instanceof Error ? reason.message : 'No se pudo cargar la configuración.'
    }));
  }, []);
  useEffect(() => {
    if (!settings?.defaultPrinterId) { setEnergyProfiles([]); return; }
    let cancelled = false;
    const printerId = settings.defaultPrinterId;
    setEnergyProfiles([]);
    get<EnergyProfile[]>(`/api/printers/${printerId}/energy-profiles`)
      .then(rows => {
        if (cancelled) return;
        setEnergyProfiles(rows);
        const valid = validEnergyProfiles(rows);
        setSettings(current => current?.defaultPrinterId === printerId
          && !current.defaultEnergyProfileId
          && valid.length === 1
            ? { ...current, defaultEnergyProfileId: valid[0].id }
            : current);
      })
      .catch(reason => {
        if (!cancelled) setFeedback({
          type: 'error',
          message: reason instanceof Error ? reason.message : 'No se pudieron cargar los perfiles energéticos.'
        });
      });
    return () => { cancelled = true; };
  }, [settings?.defaultPrinterId]);

  const activePrinters = useMemo(() => printers.filter(x => x.isActive), [printers]);
  const activeEnergyProfiles = useMemo(() => validEnergyProfiles(energyProfiles), [energyProfiles]);
  const activeTariffs = useMemo(() => tariffs.filter(x => x.isActive), [tariffs]);
  const activePolicies = useMemo(() => policies.filter(x => x.isActive), [policies]);
  if (!settings) return <section className="page"><h1>Configuración general</h1>{feedback
    ? <p className="error" role="alert">{feedback.message}</p>
    : <p role="status">Cargando…</p>}</section>;

  return <section className="page"><div className="page-heading"><div><h1>Configuración general</h1><p>Nombre visible, impuestos y defaults utilizados por la cotización rápida.</p></div></div>
    {feedback ? <p className={feedback.type === 'error' ? 'error' : 'success'} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p> : null}
    <form className="card form-grid" onSubmit={async event => {
      event.preventDefault();
      setFeedback(null);
      try {
        const saved = await put<ApplicationSettings>('/api/settings', settings);
        setSettings(saved); setFeedback({ type: 'success', message: 'Configuración guardada y aplicada.' });
        window.dispatchEvent(new CustomEvent('printcost:settings-updated', { detail: saved.visibleAppName }));
      } catch (reason) {
        setFeedback({
          type: 'error',
          message: reason instanceof Error ? reason.message : 'No se pudo guardar la configuración.'
        });
      }
    }}><h2>Aplicación</h2>
      <label>Nombre visible<input value={settings.visibleAppName} onChange={event => setSettings({ ...settings, visibleAppName: event.target.value })} required /></label>
      <label>Hostname de producción<input value={settings.productionHostname ?? ''} onChange={event => setSettings({ ...settings, productionHostname: event.target.value || null })} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={settings.taxEnabled} onChange={event => setSettings({ ...settings, taxEnabled: event.target.checked })} />Aplicar impuestos</label>
      <label>Nombre del impuesto<input value={settings.taxName ?? ''} onChange={event => setSettings({ ...settings, taxName: event.target.value || null })} disabled={!settings.taxEnabled} /></label>
      <label>Tasa de impuesto %<input type="number" min="0" max="100" step="any" value={settings.taxRatePercent} onChange={event => setSettings({ ...settings, taxRatePercent: Number(event.target.value) })} disabled={!settings.taxEnabled} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={settings.priceIncludesTax} onChange={event => setSettings({ ...settings, priceIncludesTax: event.target.checked })} disabled={!settings.taxEnabled} />El precio mostrado incluye el impuesto</label>
      <h2>Defaults de cotización rápida</h2>
      <label>Impresora predeterminada<select value={settings.defaultPrinterId ?? ''} onChange={event => setSettings({ ...settings, defaultPrinterId: event.target.value || null, defaultEnergyProfileId: null })} required><option value="">Seleccionar</option>{activePrinters.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>Perfil energético predeterminado<select value={settings.defaultEnergyProfileId ?? ''} onChange={event => setSettings({ ...settings, defaultEnergyProfileId: event.target.value || null })} disabled={!settings.defaultPrinterId} required><option value="">Seleccionar perfil</option>{activeEnergyProfiles.map(row => <option key={row.id} value={row.id}>{row.name} · {row.materialFamily} · {row.averagePrintPowerW} W</option>)}</select></label>
      <label>Tarifa predeterminada<select value={settings.defaultElectricityTariffId ?? ''} onChange={event => setSettings({ ...settings, defaultElectricityTariffId: event.target.value || null })} required><option value="">Seleccionar</option>{activeTariffs.map(row => <option key={row.id} value={row.id}>{row.provider} · {row.name}</option>)}</select></label>
      <label>Política predeterminada<select value={settings.defaultPricingPolicyId ?? ''} onChange={event => setSettings({ ...settings, defaultPricingPolicyId: event.target.value || null })} required><option value="">Seleccionar</option>{activePolicies.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>Setup predeterminado (minutos)<input type="number" min="0" step="any" value={settings.defaultQuickSetupMinutes ?? ''} onChange={event => setSettings({ ...settings, defaultQuickSetupMinutes: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      <label>Embalaje predeterminado (Gs)<input type="number" min="0" step="any" value={settings.defaultQuickPackagingCostGs ?? ''} onChange={event => setSettings({ ...settings, defaultQuickPackagingCostGs: event.target.value === '' ? null : Number(event.target.value) })} /></label>
      <p className="hint span-2">El setup representa minutos de trabajo manual por pedido; requiere una tarifa laboral positiva en la política. Tanto setup como embalaje pueden ser cero cuando realmente no aplican, pero no deben quedar vacíos.</p>
      <div className="actions span-2"><button type="submit">Guardar configuración</button></div>
    </form>
  </section>;
}
