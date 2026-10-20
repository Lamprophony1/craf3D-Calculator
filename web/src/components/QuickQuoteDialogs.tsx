import { useState, type FormEvent } from 'react';
import { post } from '../api/client';
import type { Filament } from '../api/types';
import { navigate } from './AppShell';
import { ModalDialog } from './ModalDialog';

export function NewFilamentDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (filament: Filament) => void }) {
  const [material, setMaterial] = useState('PLA');
  const [manufacturer, setManufacturer] = useState('');
  const [color, setColor] = useState('');
  const [cost, setCost] = useState(0);
  const [weight, setWeight] = useState(1_000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const filament = await post<Filament>('/api/filaments/simple', {
        material: material.trim(), displayName: color.trim(), landedCostGs: cost, netWeightGrams: weight,
        ...(manufacturer.trim() ? { manufacturer: manufacturer.trim() } : {})
      });
      onCreated(filament); onClose(); setManufacturer(''); setColor(''); setCost(0); setWeight(1_000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el filamento.'); }
    finally { setSaving(false); }
  };
  return <ModalDialog open={open} title="Nuevo filamento" description="Cargá material, color, costo y peso. La marca es opcional." onClose={onClose}
    footer={<><button type="submit" form="new-filament-form" disabled={saving}>{saving ? 'Guardando…' : 'Guardar filamento'}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></>}>
    <form id="new-filament-form" className="dialog-form" onSubmit={event => void submit(event)}>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <label>Marca (opcional)<input maxLength={120} value={manufacturer} onChange={event => setManufacturer(event.target.value)} placeholder="Ej.: Creality" /></label>
      <label>Material<input data-autofocus required value={material} onChange={event => setMaterial(event.target.value)} /></label>
      <label>Color o nombre<input required value={color} onChange={event => setColor(event.target.value)} placeholder="Ej.: Negro mate" /></label>
      <label>Costo total del rollo en Gs.<input required type="number" inputMode="numeric" min="0.01" step="1" value={cost || ''} onChange={event => setCost(Number(event.target.value))} /></label>
      <label>Peso neto del rollo en gramos<input required type="number" inputMode="numeric" min="1" step="1" value={weight} onChange={event => setWeight(Number(event.target.value))} /></label>
      <button type="button" className="text-link" onClick={() => { onClose(); navigate('/settings/advanced/filaments'); }}>Completar detalles avanzados</button>
    </form>
  </ModalDialog>;
}

export function SaveQuoteDialog({ open, advancedRequest, onClose, onSaved }: { open: boolean; advancedRequest: Record<string, unknown> | null; onClose: () => void; onSaved: (code: string) => void }) {
  const [customerReference, setCustomerReference] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!advancedRequest) return;
    setSaving(true); setError(null);
    try {
      const lineDescription = description.trim() || 'Impresión 3D';
      const quote = await post<{ code: string }>('/api/quotes', {
        calculation: advancedRequest,
        lines: [{ description: lineDescription, calculation: advancedRequest }],
        customerId: null,
        customerReference: customerReference.trim() || null,
        itemDescription: description.trim() || null,
        validUntil: null,
        notes: note.trim() || null,
        terms: null
      });
      onSaved(quote.code); onClose(); setCustomerReference(''); setDescription(''); setNote('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el presupuesto.'); }
    finally { setSaving(false); }
  };
  return <ModalDialog open={open} title="Guardar presupuesto" description="El precio y el cálculo se conservarán tal como están." banner="Todos los campos son opcionales." onClose={onClose}
    footer={<><button type="submit" form="save-quote-form" disabled={saving || !advancedRequest}>{saving ? 'Guardando…' : 'Guardar presupuesto'}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></>}>
    <form id="save-quote-form" className="dialog-form" onSubmit={event => void submit(event)}>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <label>Cliente / referencia<input data-autofocus maxLength={200} value={customerReference} onChange={event => setCustomerReference(event.target.value)} /></label>
      <label>Descripción<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Ej.: Soporte para auriculares" /></label>
      <label>Nota<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Algo que quieras recordar" /></label>
    </form>
  </ModalDialog>;
}
