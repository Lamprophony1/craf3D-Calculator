import { useEffect, useState, type FormEvent } from 'react';
import { get, post } from '../api/client';
import type { Customer, Filament } from '../api/types';
import { navigate } from './AppShell';
import { ModalDialog } from './ModalDialog';

export function NewFilamentDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (filament: Filament) => void }) {
  const [material, setMaterial] = useState('PLA');
  const [color, setColor] = useState('');
  const [cost, setCost] = useState(0);
  const [weight, setWeight] = useState(1_000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const filament = await post<Filament>('/api/filaments', {
        manufacturer: 'Sin fabricante', productName: color.trim(), material: material.trim(), color: color.trim(), batchCode: null,
        purchaseCurrency: 'PYG', purchaseAmount: cost, exchangeRateGs: null, allocatedShippingGs: 0,
        allocatedImportFeesGs: 0, allocatedOtherCostsGs: 0, netWeightGrams: weight, remainingWeightGrams: weight,
        purchasedAt: null, supplier: null, isInventoryTracked: false, isActive: true
      });
      onCreated(filament); onClose(); setColor(''); setCost(0); setWeight(1_000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el filamento.'); }
    finally { setSaving(false); }
  };
  return <ModalDialog open={open} title="Nuevo filamento" description="Con estos cuatro datos ya podés cotizar." onClose={onClose}
    footer={<><button type="submit" form="new-filament-form" disabled={saving}>{saving ? 'Guardando…' : 'Guardar filamento'}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></>}>
    <form id="new-filament-form" className="dialog-form" onSubmit={event => void submit(event)}>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <label>Material<input data-autofocus required value={material} onChange={event => setMaterial(event.target.value)} /></label>
      <label>Color o nombre<input required value={color} onChange={event => setColor(event.target.value)} placeholder="Ej.: Negro mate" /></label>
      <label>Costo total del rollo en Gs.<input required type="number" inputMode="numeric" min="0.01" step="1" value={cost || ''} onChange={event => setCost(Number(event.target.value))} /></label>
      <label>Peso neto del rollo en gramos<input required type="number" inputMode="numeric" min="1" step="1" value={weight} onChange={event => setWeight(Number(event.target.value))} /></label>
      <button type="button" className="text-link" onClick={() => { onClose(); navigate('/filaments'); }}>Completar detalles avanzados</button>
    </form>
  </ModalDialog>;
}

export function SaveQuoteDialog({ open, advancedRequest, onClose, onSaved }: { open: boolean; advancedRequest: Record<string, unknown> | null; onClose: () => void; onSaved: (code: string) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) get<Customer[]>('/api/customers').then(rows => setCustomers(rows.filter(row => row.isActive))).catch(() => setCustomers([])); }, [open]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!advancedRequest) return;
    setSaving(true); setError(null);
    try {
      const notes = [description.trim(), note.trim()].filter(Boolean).join('\n');
      const quote = await post<{ code: string }>('/api/quotes', { calculation: advancedRequest, customerId: customerId || null, validUntil: null, notes: notes || null, terms: null });
      onSaved(quote.code); onClose(); setCustomerId(''); setDescription(''); setNote('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos guardar el presupuesto.'); }
    finally { setSaving(false); }
  };
  return <ModalDialog open={open} title="Guardar presupuesto" description="El precio y el cálculo se conservarán tal como están." banner="Todos los campos son opcionales." onClose={onClose}
    footer={<><button type="submit" form="save-quote-form" disabled={saving || !advancedRequest}>{saving ? 'Guardando…' : 'Guardar presupuesto'}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></>}>
    <form id="save-quote-form" className="dialog-form" onSubmit={event => void submit(event)}>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <label>Cliente<select data-autofocus value={customerId} onChange={event => setCustomerId(event.target.value)}><option value="">Sin cliente</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
      <label>Descripción<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Ej.: Soporte para auriculares" /></label>
      <label>Nota<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Algo que quieras recordar" /></label>
    </form>
  </ModalDialog>;
}
