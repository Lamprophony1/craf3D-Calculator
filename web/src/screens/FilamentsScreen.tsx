import { useEffect, useState, type FormEvent } from 'react';
import { Edit3, Plus, Power } from 'lucide-react';
import { get, put } from '../api/client';
import type { Filament } from '../api/types';
import { ModalDialog } from '../components/ModalDialog';
import { NewFilamentDialog } from '../components/QuickQuoteDialogs';
import { formatDecimal, formatPyg } from '../utils/format';
import { filamentBrand } from '../utils/filaments';

export function FilamentsScreen() {
  const [rows, setRows] = useState<Filament[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Filament | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => get<Filament[]>('/api/filaments').then(setRows).catch(reason => setError(reason instanceof Error ? reason.message : 'No pudimos cargar los filamentos.'));
  useEffect(() => { void load(); }, []);
  const toggle = async (row: Filament) => {
    try { await put(`/api/filaments/${row.id}`, { ...row, isActive: !row.isActive }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos cambiar el estado.'); }
  };
  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editing) return; setSaving(true);
    const data = new FormData(event.currentTarget);
    try {
      await put(`/api/filaments/${editing.id}/simple`, {
        material: String(data.get('material')),
        manufacturer: String(data.get('manufacturer')),
        displayName: String(data.get('color')),
        landedCostGs: Number(data.get('cost')),
        netWeightGrams: Number(data.get('weight'))
      });
      setEditing(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el filamento.'); }
    finally { setSaving(false); }
  };
  return <section className="page filament-page"><div className="page-heading"><div><h1>Filamentos</h1><p>Los rollos que usás para calcular material.</p></div><button type="button" onClick={() => setAddOpen(true)}><Plus size={18} aria-hidden="true" />Agregar filamento</button></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <div className="filament-list">{rows.map(row => <article className={`filament-row ${row.isActive ? '' : 'inactive'}`} key={row.id}>
      <div><h2>{row.color || row.productName}</h2><p>{filamentBrand(row)} · {row.material}</p></div>
      <dl><div><dt>Costo por gramo</dt><dd>{formatPyg(row.landedCostGs / row.netWeightGrams)}</dd></div><div><dt>Costo del rollo</dt><dd>{formatPyg(row.landedCostGs)}</dd></div>
        {row.isInventoryTracked ? <div><dt>Disponible</dt><dd>{formatDecimal(row.remainingWeightGrams, 0)} g</dd></div> : null}</dl>
      <span className="status-badge">{row.isActive ? 'Activo' : 'Inactivo'}</span>
      <div className="row-actions"><button type="button" className="secondary" onClick={() => setEditing(row)}><Edit3 size={18} aria-hidden="true" />Editar</button><button type="button" className="secondary" onClick={() => void toggle(row)}><Power size={18} aria-hidden="true" />{row.isActive ? 'Desactivar' : 'Activar'}</button></div>
    </article>)}{!rows.length ? <div className="empty-state"><strong>Agregá tu primer filamento</strong><p>Solo necesitás material, color, costo y peso.</p><button type="button" onClick={() => setAddOpen(true)}>Agregar filamento</button></div> : null}</div>
    <NewFilamentDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={filament => setRows(current => [...current, filament])} />
    <ModalDialog open={Boolean(editing)} title="Editar filamento" description="Actualizá los datos que afectan el costo." onClose={() => setEditing(null)} footer={<><button type="submit" form="edit-filament-form" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button></>}>
      {editing ? <form id="edit-filament-form" className="dialog-form" onSubmit={event => void saveEdit(event)}>
        <label>Marca (opcional)<input name="manufacturer" maxLength={120} defaultValue={filamentBrand(editing) === 'Sin marca' ? '' : editing.manufacturer} /></label>
        <label>Material<input data-autofocus name="material" defaultValue={editing.material} required /></label>
        <label>Color o nombre<input name="color" defaultValue={editing.color} required /></label>
        <label>Costo total del rollo en Gs.<input name="cost" type="number" min="0.01" step="1" defaultValue={editing.landedCostGs} required /></label>
        <label>Peso neto del rollo en gramos<input name="weight" type="number" min="1" step="1" defaultValue={editing.netWeightGrams} required /></label>
        {editing.isInventoryTracked ? <p className="computed-value">Inventario activo · quedan {formatDecimal(editing.remainingWeightGrams, 0)} g. El peso neto no puede ser menor.</p> : null}
        <button type="button" className="text-link" onClick={() => { setEditing(null); window.history.pushState({}, '', '/settings/advanced/filaments'); window.dispatchEvent(new PopStateEvent('popstate')); }}>Editar moneda, envío e importación</button>
      </form> : null}
    </ModalDialog>
  </section>;
}
