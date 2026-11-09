import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, post, put } from '../api/client';
import type { Order } from '../api/orders';
import type { Customer, ElectricityTariff, EnergyProfile, Filament, PricingPolicy, Printer, QuoteAggregatePreviewResponse, QuoteLineRequest, QuotePreviewRequest, QuotePreviewResponse } from '../api/types';
import { navigate } from '../components/AppShell';
import { formatDecimal, formatPyg } from '../utils/format';
import { buildClientQuoteText } from '../utils/clientQuote';
import { filamentBrand, filamentVariant } from '../utils/filaments';
import { editableGrams, selectQuoteMaterial, usesBaseGrams } from '../utils/quoteMaterials';
import { QUICK_TO_ADVANCED_KEY } from './QuickQuoteScreen';
import { orderListOriginState } from './orderListNavigation';

export const DRAFT_KEY = 'printcost.quote-draft.v1';
interface Draft {
  printerId: string; energyProfileId: string; tariffId: string; policyId: string; spoolId: string; secondSpoolId: string;
  quantity: number; unitsPerPlate: number; inputBasis: 'PerUnit' | 'PerPlate'; printHours: number;
  idleHours: number; occupiedHours: number; customOccupiedTime: boolean; grams: number; secondGrams: number; measuredKWh: string;
  warmupKWh: number; accessoryKWh: number; laborCategory: string; laborMinutes: number; laborRateGs: number;
  additionalDescription: string; additionalCostGs: number; notes: string; lineDescription: string; customerId: string;
  customerReference: string; itemDescription: string;
  fixedSurchargesGs: number; percentageSurchargePercent: number; discountGs: number; manualNetPriceGs: string; manualPriceReason: string;
  calculationContext: 'Standard' | 'QuickQuote'; acceptStandardEnergyFallback: boolean;
  importedRequest?: Partial<QuotePreviewRequest>;
  plateMode: boolean;
  quoteLines: Array<{ id: string; description: string; spoolId: string; grams: number; printHours: number; energyProfileId?: string; calculation?: QuotePreviewRequest }>;
}
const emptyDraft: Draft = { printerId: '', energyProfileId: '', tariffId: '', policyId: '', spoolId: '', secondSpoolId: '', quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit', printHours: 1, idleHours: 0, occupiedHours: 1, customOccupiedTime: false, grams: 0, secondGrams: 0, measuredKWh: '', warmupKWh: 0, accessoryKWh: 0, laborCategory: 'Preparación del pedido', laborMinutes: 0, laborRateGs: 0, additionalDescription: 'Consumibles', additionalCostGs: 0, notes: '', lineDescription: 'Impresión 3D', customerId: '', customerReference: '', itemDescription: '', fixedSurchargesGs: 0, percentageSurchargePercent: 0, discountGs: 0, manualNetPriceGs: '', manualPriceReason: '', calculationContext: 'Standard', acceptStandardEnergyFallback: false, plateMode: false, quoteLines: [] };

type LinkedOrder = Pick<Order, 'id' | 'quoteId' | 'status'>;
interface SavedQuote { id: string; code: string; order?: LinkedOrder | null; adjustedTotalGs?: number | null }
export interface QuoteAdjustment {
  order: Pick<Order, 'id' | 'code' | 'version' | 'customerReference' | 'description' | 'totalGs'>;
  quoteId: string;
  revisionNumber: number;
  lines: QuoteLineRequest[];
}

export function restoreDraft(storage: Pick<Storage, 'getItem'> = localStorage): Draft {
  try {
    const restored = { ...emptyDraft, ...JSON.parse(storage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft> };
    return restored.customOccupiedTime ? restored : { ...restored, occupiedHours: restored.printHours };
  }
  catch { return emptyDraft; }
}

export function initialDraft(storage: Pick<Storage, 'getItem' | 'removeItem'> = localStorage): Draft {
  const restored = restoreDraft(storage);
  try {
    const raw = storage.getItem(QUICK_TO_ADVANCED_KEY);
    if (!raw) return restored;
    storage.removeItem(QUICK_TO_ADVANCED_KEY);
    const imported = JSON.parse(raw) as Partial<QuotePreviewRequest> & { lines?: QuoteLineRequest[] };
    return imported.lines?.length ? draftFromLines(imported.lines) : draftFromRequest(imported);
  } catch {
    storage.removeItem(QUICK_TO_ADVANCED_KEY);
    return restored;
  }
}

function draftFromRequest(request: Partial<QuotePreviewRequest>): Draft {
  const printHours = Number(request.printDurationHours ?? emptyDraft.printHours);
  const occupiedHours = Number(request.occupiedPrinterHours ?? printHours);
  return {
    ...emptyDraft,
    importedRequest: request,
    printerId: request.printerId ?? emptyDraft.printerId,
    energyProfileId: request.energyProfileId ?? emptyDraft.energyProfileId,
    tariffId: request.electricityTariffId ?? emptyDraft.tariffId,
    policyId: request.pricingPolicyId ?? emptyDraft.policyId,
    quantity: request.quantity?.quantity ?? emptyDraft.quantity,
    unitsPerPlate: request.quantity?.unitsPerPlate ?? emptyDraft.unitsPerPlate,
    inputBasis: request.quantity?.inputBasis ?? emptyDraft.inputBasis,
    printHours,
    occupiedHours,
    customOccupiedTime: occupiedHours !== printHours,
    idleHours: request.idleDurationHours ?? emptyDraft.idleHours,
    measuredKWh: request.measuredKWh == null ? '' : String(request.measuredKWh),
    warmupKWh: request.additionalWarmupKWh ?? emptyDraft.warmupKWh,
    accessoryKWh: request.additionalAccessoryKWh ?? emptyDraft.accessoryKWh,
    spoolId: request.materials?.[0]?.spoolId ?? emptyDraft.spoolId,
    grams: editableGrams(request.materials?.[0]),
    secondSpoolId: request.materials?.[1]?.spoolId ?? '',
    secondGrams: editableGrams(request.materials?.[1]),
    laborCategory: request.labor?.[0]?.category ?? emptyDraft.laborCategory,
    laborMinutes: Number(request.labor?.[0]?.minutes ?? emptyDraft.laborMinutes),
    laborRateGs: Number(request.labor?.[0]?.hourlyRateGs ?? 0),
    additionalDescription: request.additionalCosts?.[0]?.description ?? emptyDraft.additionalDescription,
    additionalCostGs: Number(request.additionalCosts?.[0]?.amountGs ?? emptyDraft.additionalCostGs),
    fixedSurchargesGs: Number(request.fixedSurchargesGs ?? emptyDraft.fixedSurchargesGs),
    percentageSurchargePercent: Number(request.percentageSurchargePercent ?? emptyDraft.percentageSurchargePercent),
    discountGs: Number(request.discountGs ?? emptyDraft.discountGs),
    manualNetPriceGs: request.manualNetPriceGs == null ? '' : String(request.manualNetPriceGs),
    manualPriceReason: request.manualPriceReason ?? emptyDraft.manualPriceReason,
    calculationContext: request.calculationContext ?? 'Standard',
    acceptStandardEnergyFallback: Boolean(request.acceptStandardEnergyFallback)
  };
}

function draftFromLines(lines: QuoteLineRequest[]): Draft {
  const [first, ...remaining] = lines;
  return {
    ...draftFromRequest(first.calculation),
    plateMode: lines.every(line => line.isPrintPlate === true),
    lineDescription: first.description,
    quoteLines: remaining.map(({ description, calculation }, index) => ({
      id: `saved-line-${index}`, description, calculation,
      spoolId: calculation.materials?.[0]?.spoolId ?? '',
      grams: editableGrams(calculation.materials?.[0]), printHours: calculation.printDurationHours
    }))
  };
}

function adjustmentDraft(adjustment: QuoteAdjustment, storageKey: string): Draft {
  const stored = sessionStorage.getItem(storageKey);
  if (stored) {
    try {
      const state = JSON.parse(stored) as { version: number; revisionNumber: number; draft: Draft };
      if (state.version === adjustment.order.version && state.revisionNumber === adjustment.revisionNumber)
        return { ...emptyDraft, ...state.draft };
    } catch { /* Open the saved revision if the local draft cannot be restored. */ }
  }
  return draftFromLines(adjustment.lines);
}

export function withTechnicalSelection(draft: Draft, key: 'printerId' | 'energyProfileId', value: string): Draft {
  return { ...draft, [key]: value, calculationContext: 'Standard', acceptStandardEnergyFallback: false };
}

const filamentLabel = (filament: Filament) => [filamentBrand(filament), filament.material, filament.color,
  filamentVariant(filament), `${formatPyg(filament.landedCostGs)} / ${formatDecimal(filament.netWeightGrams, 0)} g`]
  .filter(Boolean).join(' · ');

export function CalculatorScreen({ saveAsQuote = false, adjustment }: { saveAsQuote?: boolean; adjustment?: QuoteAdjustment }) {
  const adjustmentKey = adjustment ? `${DRAFT_KEY}.adjust.${adjustment.order.id}` : '';
  const [draft, setDraft] = useState<Draft>(() => adjustment ? adjustmentDraft(adjustment, adjustmentKey) : initialDraft());
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [profiles, setProfiles] = useState<EnergyProfile[]>([]);
  const [tariffs, setTariffs] = useState<ElectricityTariff[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [policies, setPolicies] = useState<PricingPolicy[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [previewResult, setPreview] = useState<{ key: string; result: QuotePreviewResponse | QuoteAggregatePreviewResponse } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState<SavedQuote | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error' | 'warning'>('success');
  const [online, setOnline] = useState(navigator.onLine);
  const calculationVersion = useRef(0);
  const calculationController = useRef<AbortController | null>(null);
  const savedAmountHeading = useRef<HTMLHeadingElement>(null);
  const plateToFocus = useRef<string | null>(null);
  const addPlateButton = useRef<HTMLButtonElement>(null);
  const shareApi = Reflect.get(navigator, 'share') as ((data: ShareData) => Promise<void>) | undefined;

  const invalidateCalculation = useCallback(() => {
    calculationVersion.current += 1;
    calculationController.current?.abort();
    calculationController.current = null;
    setPreview(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) {
        invalidateCalculation();
        setMessageKind('warning');
        setMessage('Sin conexión: el borrador se conserva, pero el precio definitivo requiere el servidor.');
      }
    };
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [invalidateCalculation]);
  useEffect(() => () => {
    calculationVersion.current += 1;
    calculationController.current?.abort();
  }, []);
  useEffect(() => {
    if (!adjustment || !savedQuote) return;
    savedAmountHeading.current?.scrollIntoView?.({ block: 'center' });
    savedAmountHeading.current?.focus({ preventScroll: true });
  }, [adjustment, savedQuote]);
  useEffect(() => {
    if (!adjustment) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else if (savedQuote) sessionStorage.removeItem(adjustmentKey);
    else sessionStorage.setItem(adjustmentKey, JSON.stringify({
      version: adjustment.order.version, revisionNumber: adjustment.revisionNumber, draft
    }));
  }, [draft, adjustment, adjustmentKey, savedQuote]);
  useEffect(() => {
    if (!draft.customOccupiedTime && draft.occupiedHours !== draft.printHours)
      setDraft(current => ({ ...current, occupiedHours: current.printHours }));
  }, [draft.customOccupiedTime, draft.occupiedHours, draft.printHours]);
  useEffect(() => {
    Promise.all([
      get<Printer[]>('/api/printers'), get<ElectricityTariff[]>('/api/electricity-tariffs'),
      get<Filament[]>('/api/filaments'), get<PricingPolicy[]>('/api/pricing-policies'),
      saveAsQuote && !adjustment ? get<Customer[]>('/api/customers') : Promise.resolve([] as Customer[])
    ]).then(([printerRows, tariffRows, filamentRows, policyRows, customerRows]) => {
      setPrinters(printerRows.filter(x => x.isActive)); setTariffs(tariffRows.filter(x => x.isActive));
      setFilaments(filamentRows.filter(x => x.isActive)); setPolicies(policyRows);
      setCustomers(customerRows.filter(x => x.isActive));
      setDraft(current => ({ ...current, printerId: current.printerId || printerRows.find(x => x.isActive)?.id || '', tariffId: current.tariffId || tariffRows.find(x => x.isActive)?.id || '', spoolId: current.spoolId || filamentRows.find(x => x.isActive)?.id || '', policyId: current.policyId || policyRows.find(x => x.isDefault)?.id || policyRows[0]?.id || '' }));
    }).catch((reason: unknown) => {
      setMessageKind('error');
      setMessage(reason instanceof Error ? reason.message : 'No se pudieron cargar los catálogos.');
    });
  }, [saveAsQuote, adjustment]);
  useEffect(() => {
    if (!draft.printerId) return;
    get<EnergyProfile[]>(`/api/printers/${draft.printerId}/energy-profiles`).then(rows => {
      setProfiles(rows); setDraft(current => ({ ...current, energyProfileId: rows.some(x => x.id === current.energyProfileId) ? current.energyProfileId : rows[0]?.id ?? '' }));
    }).catch(() => setProfiles([]));
  }, [draft.printerId]);

  const request = useMemo<QuotePreviewRequest>(() => ({
    printerId: draft.printerId, energyProfileId: draft.energyProfileId, electricityTariffId: draft.tariffId,
    pricingPolicyId: draft.policyId || null, quantity: { quantity: draft.quantity, unitsPerPlate: draft.unitsPerPlate, inputBasis: draft.inputBasis },
    printDurationHours: draft.printHours, idleDurationHours: draft.idleHours, occupiedPrinterHours: draft.customOccupiedTime ? draft.occupiedHours : draft.printHours,
    measuredKWh: draft.measuredKWh === '' ? null : Number(draft.measuredKWh), additionalWarmupKWh: draft.warmupKWh, additionalAccessoryKWh: draft.accessoryKWh,
    materials: [
      ...(draft.spoolId ? [selectQuoteMaterial(draft.spoolId, draft.grams, draft.importedRequest?.materials?.[0])] : []),
      ...(draft.secondSpoolId ? [selectQuoteMaterial(draft.secondSpoolId, draft.secondGrams, draft.importedRequest?.materials?.[1])] : []),
      ...(draft.importedRequest?.materials?.slice(2) ?? [])
    ],
    labor: [
      ...(draft.laborMinutes > 0 || draft.importedRequest?.labor?.length ? [{
        scope: 'FixedPerOrder' as const, repeatOnFailure: false, ...draft.importedRequest?.labor?.[0],
        category: draft.laborCategory, minutes: draft.laborMinutes,
        hourlyRateGs: draft.laborRateGs || (draft.importedRequest?.labor?.[0]?.hourlyRateGs === 0 ? 0 : null)
      }] : []),
      ...(draft.importedRequest?.labor?.slice(1) ?? [])
    ],
    additionalCosts: [
      ...(draft.additionalCostGs > 0 || draft.importedRequest?.additionalCosts?.length ? [{
        scope: 'FixedPerOrder' as const, repeatOnFailure: false, isInternalCost: true, participatesInMargin: true,
        ...draft.importedRequest?.additionalCosts?.[0], description: draft.additionalDescription, amountGs: draft.additionalCostGs
      }] : []),
      ...(draft.importedRequest?.additionalCosts?.slice(1) ?? [])
    ],
    fixedSurchargesGs: draft.fixedSurchargesGs, percentageSurchargePercent: draft.percentageSurchargePercent, discountGs: draft.discountGs,
    manualNetPriceGs: draft.manualNetPriceGs === '' ? null : Number(draft.manualNetPriceGs),
    manualPriceReason: draft.manualNetPriceGs === '' ? null : draft.manualPriceReason || null,
    acceptZeroMachineRate: draft.importedRequest?.acceptZeroMachineRate ?? false,
    zeroMachineRateReason: draft.importedRequest?.zeroMachineRateReason ?? null,
    tax: draft.importedRequest?.tax ?? null,
    calculationContext: draft.calculationContext,
    acceptStandardEnergyFallback: draft.acceptStandardEnergyFallback
  }), [draft]);

  const lines = useMemo<QuoteLineRequest[]>(() => {
    const marker = draft.plateMode ? { isPrintPlate: true } : {};
    const sharedPricing = draft.plateMode ? {
      pricingPolicyId: request.pricingPolicyId, electricityTariffId: request.electricityTariffId,
      fixedSurchargesGs: request.fixedSurchargesGs, percentageSurchargePercent: request.percentageSurchargePercent,
      discountGs: request.discountGs, manualNetPriceGs: request.manualNetPriceGs,
      manualPriceReason: request.manualPriceReason, tax: request.tax
    } : {};
    return [
      { ...marker, description: draft.lineDescription || (draft.plateMode ? 'Plato 1' : 'Impresión 3D'), calculation: request },
      ...draft.quoteLines.map((line, index) => {
        const saved = line.calculation;
        const plateDefaults = draft.plateMode && !saved ? {
          quantity: { quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit' as const },
          idleDurationHours: 0, measuredKWh: null, additionalWarmupKWh: 0, additionalAccessoryKWh: 0
        } : {};
        const profile = line.energyProfileId ? {
          energyProfileId: line.energyProfileId, calculationContext: 'Standard' as const, acceptStandardEnergyFallback: false
        } : {};
        return {
          ...marker,
          description: line.description || (draft.plateMode ? `Plato ${index + 2}` : 'Línea adicional'),
          calculation: {
            ...(saved ?? request), ...sharedPricing, ...plateDefaults, ...profile,
            printDurationHours: line.printHours,
            occupiedPrinterHours: saved && saved.occupiedPrinterHours !== saved.printDurationHours ? saved.occupiedPrinterHours : line.printHours,
            materials: [
              ...(line.spoolId ? [selectQuoteMaterial(line.spoolId, line.grams, saved?.materials?.[0])] : []),
              ...(saved?.materials?.slice(1) ?? [])
            ],
            labor: saved?.labor ?? request.labor.filter(item => item.scope !== 'FixedPerOrder'),
            additionalCosts: saved?.additionalCosts ?? request.additionalCosts.filter(item => item.scope !== 'FixedPerOrder')
          }
        };
      })
    ];
  }, [draft.lineDescription, draft.quoteLines, draft.plateMode, request]);
  const requestKey = JSON.stringify(saveAsQuote ? lines : request);
  const preview = online && previewResult?.key === requestKey ? previewResult.result : null;
  const breakdown = preview && ('aggregate' in preview ? preview.aggregate.breakdown : preview.breakdown);
  useEffect(() => { invalidateCalculation(); }, [requestKey, invalidateCalculation]);

  const calculate = async () => {
    invalidateCalculation();
    if (!online || !navigator.onLine) { setMessageKind('warning'); setMessage('Sin conexión: el borrador se conserva, pero el precio definitivo requiere el servidor.'); return; }
    const version = calculationVersion.current;
    const controller = new AbortController();
    calculationController.current = controller;
    setLoading(true); setMessage(null);
    try {
      const result = saveAsQuote
        ? await post<QuoteAggregatePreviewResponse>('/api/calculations/quote-aggregate-preview', { lines }, { signal: controller.signal })
        : await post<QuotePreviewResponse>('/api/calculations/quote-preview', request, { signal: controller.signal });
      if (calculationVersion.current === version && !controller.signal.aborted && navigator.onLine)
        setPreview({ key: requestKey, result });
    } catch (reason) {
      if (calculationVersion.current === version && !controller.signal.aborted) {
        setMessageKind('error');
        setMessage(reason instanceof Error ? reason.message : 'No se pudo calcular.');
      }
    } finally {
      if (calculationVersion.current === version) { setLoading(false); calculationController.current = null; }
    }
  };
  const save = async () => {
    if (saving || savedQuote) return;
    if (!online || !navigator.onLine) { setSaveError('Sin conexión. El borrador sigue en este navegador.'); return; }
    if ((adjustment || draft.plateMode) && !preview?.canUsePrice) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (adjustment) {
        const updated = await put<Order>(`/api/orders/${encodeURIComponent(adjustment.order.id)}/quote-revision`, {
          version: adjustment.order.version, revisionNumber: adjustment.revisionNumber, lines
        });
        setSavedQuote({ id: adjustment.quoteId, code: updated.code, order: updated, adjustedTotalGs: updated.totalGs });
        return;
      }
      const quote = await post<{ id: string; code: string }>('/api/quotes', {
        calculation: request, lines, customerId: draft.customerId || null,
        customerReference: draft.customerReference.trim() || null, itemDescription: draft.itemDescription.trim() || null,
        validUntil: null, notes: draft.notes || null, terms: null
      });
      setSavedQuote({ id: quote.id, code: quote.code });
      const updateLinkedOrder = (order: LinkedOrder | null) => {
        setSavedQuote(current => current?.id === quote.id ? { ...current, order } : current);
      };
      void get<LinkedOrder>(`/api/orders/by-quote/${quote.id}`)
        .then(order => updateLinkedOrder(order?.id && order.quoteId === quote.id ? order : null))
        .catch(() => updateLinkedOrder(null));
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'No se pudo guardar el presupuesto.'); }
    finally { setSaving(false); }
  };
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    if (key !== 'notes' && key !== 'customerId' && key !== 'customerReference' && key !== 'itemDescription') {
      invalidateCalculation(); setMessage(null);
    }
    setDraft(current => ({ ...current, [key]: value }));
  };
  const updateTechnicalSelection = (key: 'printerId' | 'energyProfileId', value: string) => {
    invalidateCalculation(); setMessage(null);
    setDraft(current => ({
      ...withTechnicalSelection(current, key, value),
      quoteLines: key === 'printerId' && current.plateMode
        ? current.quoteLines.map(line => line.calculation ? line : { ...line, energyProfileId: undefined })
        : current.quoteLines
    }));
  };
  const updateQuoteLine = (id: string, patch: Partial<Draft['quoteLines'][number]>) => {
    invalidateCalculation(); setMessage(null);
    setDraft(current => ({ ...current, quoteLines: current.quoteLines.map(line => line.id === id ? { ...line, ...patch } : line) }));
  };
  const addQuoteLine = (plate: boolean) => {
    invalidateCalculation(); setMessage(null);
    const id = crypto.randomUUID();
    if (plate) plateToFocus.current = id;
    setDraft(current => ({
      ...current,
      plateMode: plate,
      lineDescription: plate && current.lineDescription === 'Impresión 3D' ? '' : current.lineDescription,
      quoteLines: [...current.quoteLines, {
        id, description: plate ? '' : `Línea ${current.quoteLines.length + 2}`, spoolId: current.spoolId,
        grams: plate ? 0 : current.grams, printHours: plate ? 0 : current.printHours
      }]
    }));
  };
  const removeQuoteLine = (id: string) => {
    if (draft.plateMode) addPlateButton.current?.focus();
    invalidateCalculation(); setMessage(null);
    setDraft(current => {
      const quoteLines = current.quoteLines.filter(line => line.id !== id);
      return { ...current, quoteLines, plateMode: current.plateMode && quoteLines.length > 0,
        lineDescription: current.plateMode && !quoteLines.length && !current.lineDescription ? 'Impresión 3D' : current.lineDescription };
    });
  };
  const copySummary = async () => {
    if (!online || !navigator.onLine || !preview?.canUsePrice || !breakdown) return;
    const text = buildClientQuoteText(breakdown.customerTotalGs);
    try {
      await navigator.clipboard.writeText(text);
      setMessageKind('success');
      setMessage('Precio copiado');
    } catch {
      setMessageKind('error');
      setMessage('No pudimos copiar el precio. Podés intentarlo de nuevo.');
    }
  };
  const shareSummary = async () => {
    if (!online || !navigator.onLine || !preview?.canUsePrice || !breakdown || !shareApi) return;
    const text = buildClientQuoteText(breakdown.customerTotalGs);
    try {
      await shareApi.call(navigator, { title: 'Presupuesto de impresión 3D', text });
      setMessageKind('success');
      setMessage('Presupuesto compartido');
    } catch (reason) {
      if ((reason as { name?: string })?.name !== 'AbortError') {
        setMessageKind('error');
        setMessage(reason instanceof Error ? reason.message : 'No se pudo compartir.');
      }
    }
  };

  const linkedOrder = savedQuote?.order;
  const orderPending = linkedOrder?.status === 'Draft' || linkedOrder?.status === 'Discarded';
  const savedPath = linkedOrder ? `${orderPending ? '/quotes/pending' : '/orders'}/${linkedOrder.id}` : `/quotes/${savedQuote?.id}`;
  const adjustmentPath = adjustment ? `/quotes/pending/${encodeURIComponent(adjustment.order.id)}` : null;

  return <section className="page calculator-page">
    {adjustmentPath ? <button type="button" className="quiet order-back" onClick={() => navigate(adjustmentPath, { state: orderListOriginState() })}>Volver al presupuesto</button> : null}
    <div className="page-heading"><div><h1>{adjustment ? 'Ajustar presupuesto' : saveAsQuote ? 'Presupuesto completo' : 'Cálculo avanzado'}</h1>
    {adjustment ? <div className="quote-adjustment-context">
      <p><strong>{adjustment.order.customerReference || 'Sin referencia'}</strong> · {adjustment.order.code}</p>
      {adjustment.order.description ? <p>{adjustment.order.description}</p> : null}
      {!savedQuote ? <p>Importe actual {adjustment.order.totalGs == null ? 'sin definir' : formatPyg(adjustment.order.totalGs)}. Los ajustes se guardan como una nueva revisión.</p> : null}
    </div> : <p>Usá esta pantalla cuando necesites ajustar cantidades, energía, trabajo o costos especiales.</p>}</div>
    <span className={`connection ${online ? 'online' : 'offline'}`}>{online ? 'En línea' : 'Sin conexión'}</span></div>
    {!online ? <p role="status" className="warning">Se restauró el último borrador local. No se generarán precios definitivos sin conexión.</p> : null}
    {message ? <p role={messageKind === 'error' ? 'alert' : 'status'} className={messageKind === 'success' ? 'success' : 'warning'}>{message}</p> : null}
    <div className={`calculator-grid${saveAsQuote ? ' full-quote-grid' : ''}`}><form className="card advanced-calculator-form" onSubmit={(event) => { event.preventDefault(); void calculate(); }}>
      <details className="advanced-block" open><summary>{draft.plateMode && saveAsQuote ? '1. Impresión · Plato 1' : '1. Impresión'}</summary><div className="form-grid">
      <label>Impresora<select value={draft.printerId} onChange={e => updateTechnicalSelection('printerId', e.target.value)} required><option value="">Configurar</option>{printers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Perfil energético<select value={draft.energyProfileId} onChange={e => updateTechnicalSelection('energyProfileId', e.target.value)} required><option value="">Configurar</option>{profiles.map(x => <option key={x.id} value={x.id}>{x.name} · {x.averagePrintPowerW} W</option>)}</select></label>
      <label>Tarifa eléctrica<select value={draft.tariffId} onChange={e => update('tariffId', e.target.value)} required><option value="">Configurar</option>{tariffs.map(x => <option key={x.id} value={x.id}>{x.provider} · {x.baseRateGsPerKWh} Gs/kWh</option>)}</select></label>
      <label>Filamento<select value={draft.spoolId} onChange={e => update('spoolId', e.target.value)} required><option value="">Configurar un rollo</option>{filaments.map(x => <option key={x.id} value={x.id}>{filamentLabel(x)}</option>)}</select></label>
      <label>{usesBaseGrams(draft.importedRequest?.materials?.[0]) ? 'Gramos base' : 'Gramos totales del slicer'}<input type="number" min="0" step={adjustment ? 'any' : '0.01'} value={draft.grams} onChange={e => update('grams', Number(e.target.value))} required /></label>
      <label>Tiempo de impresión (h)<input type="number" min="0" step="any" value={draft.printHours} onChange={e => update('printHours', Number(e.target.value))} required /></label>
      <label className="checkbox-label"><input type="checkbox" checked={draft.customOccupiedTime} onChange={e => update('customOccupiedTime', e.target.checked)} />Usar un tiempo ocupado distinto</label>
      {draft.customOccupiedTime ? <label>Horas ocupadas de máquina<input type="number" min="0" step="any" value={draft.occupiedHours} onChange={e => update('occupiedHours', Number(e.target.value))} required /></label> : <p className="hint">Tiempo ocupado sincronizado: {formatDecimal(draft.printHours)} h</p>}
      <label>kWh extra de calentamiento<input type="number" min="0" step="0.001" value={draft.warmupKWh} onChange={e => update('warmupKWh', Number(e.target.value))} /></label>
      <label>kWh de accesorios<input type="number" min="0" step="0.001" value={draft.accessoryKWh} onChange={e => update('accessoryKWh', Number(e.target.value))} /></label>
      </div></details>
      <details className="advanced-block"><summary>2. Cantidad</summary><div className="form-grid">
      <label>Cantidad<input type="number" min="1" step="1" value={draft.quantity} onChange={e => update('quantity', Number(e.target.value))} required /></label>
      <label>Unidades por placa<input type="number" min="1" step="1" value={draft.unitsPerPlate} onChange={e => update('unitsPerPlate', Number(e.target.value))} required /></label>
      <label>Base de entrada<select value={draft.inputBasis} onChange={e => update('inputBasis', e.target.value as Draft['inputBasis'])}><option value="PerUnit">Por unidad</option><option value="PerPlate">Por placa</option></select></label>
      </div></details>
      <details className="advanced-block"><summary>3. Trabajo y extras</summary><div className="form-grid">
      <label>Categoría de trabajo<input value={draft.laborCategory} onChange={e=>update('laborCategory',e.target.value)}/></label>
      <label>Trabajo manual (minutos)<input type="number" min="0" step="1" value={draft.laborMinutes} onChange={e=>update('laborMinutes',Number(e.target.value))}/></label>
      <label>Tarifa laboral Gs/h<input type="number" min="0" step="1" value={draft.laborRateGs} onChange={e=>update('laborRateGs',Number(e.target.value))} placeholder="Usa la política si queda en 0"/></label>
      <label>kWh medidos (opcional)<input type="number" min="0" step="0.001" value={draft.measuredKWh} onChange={e => update('measuredKWh', e.target.value)} /></label>
      <label>Segundo filamento (opcional)<select value={draft.secondSpoolId} onChange={e => update('secondSpoolId', e.target.value)}><option value="">Ninguno</option>{filaments.filter(x=>x.id!==draft.spoolId).map(x => <option key={x.id} value={x.id}>{filamentLabel(x)}</option>)}</select></label>
      <label>{usesBaseGrams(draft.importedRequest?.materials?.[1]) ? 'Gramos base del segundo filamento' : 'Gramos del segundo filamento'}<input type="number" min="0" step={adjustment ? 'any' : '0.01'} value={draft.secondGrams} onChange={e => update('secondGrams', Number(e.target.value))} disabled={!draft.secondSpoolId} /></label>
      <label>Consumible / otro costo<input value={draft.additionalDescription} onChange={e=>update('additionalDescription',e.target.value)}/></label>
      <label>Importe del otro costo (Gs)<input type="number" min="0" step="1" value={draft.additionalCostGs} onChange={e=>update('additionalCostGs',Number(e.target.value))}/></label>
      </div></details>
      <details className="advanced-block"><summary>4. Precio</summary><div className="form-grid">
        <label>Política<select value={draft.policyId} onChange={e => update('policyId', e.target.value)} required><option value="">Configurar</option>{policies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Recargo fijo (Gs)<input type="number" min="0" step="1" value={draft.fixedSurchargesGs} onChange={e => update('fixedSurchargesGs', Number(e.target.value))} /></label>
        <label>Recargo porcentual (%)<input type="number" min="0" step="0.01" value={draft.percentageSurchargePercent} onChange={e => update('percentageSurchargePercent', Number(e.target.value))} /></label>
        <label>Descuento (Gs)<input type="number" min="0" step="1" value={draft.discountGs} onChange={e => update('discountGs', Number(e.target.value))} /></label>
        <label>Precio neto manual (opcional)<input type="number" min="0" step="1" value={draft.manualNetPriceGs} onChange={e => update('manualNetPriceGs', e.target.value)} /></label>
        {draft.manualNetPriceGs !== '' ? <label className="span-2">Motivo del precio manual<input value={draft.manualPriceReason} onChange={e => update('manualPriceReason', e.target.value)} required /></label> : null}
      </div></details>
      {saveAsQuote ? <>
        <div className="quote-line-heading">
          <h2>{draft.plateMode ? 'Platos de impresión' : draft.quoteLines.length ? 'Líneas independientes' : 'Platos y líneas'}</h2>
          {draft.plateMode ? <p className="hint">Los platos forman un solo trabajo.</p>
            : !draft.quoteLines.length ? <p className="hint">Agregá platos para un mismo trabajo o líneas independientes para cotizar piezas por separado.</p> : null}
        </div>
        <div className="form-grid"><label className="span-2">
          {draft.plateMode ? 'Descripción del primer plato (opcional)' : 'Descripción de la primera línea'}
          <input value={draft.lineDescription} placeholder={draft.plateMode ? 'Plato 1' : undefined} onChange={e => update('lineDescription', e.target.value)} required={!draft.plateMode} />
        </label></div>
        {draft.quoteLines.map((line, index) => {
          const label = `${draft.plateMode ? 'Plato' : 'Línea'} ${index + 2}`;
          return <fieldset className="span-2 line-editor" key={line.id}>
            <legend>{label}</legend>
            <div className="form-grid">
              <label>{draft.plateMode ? 'Descripción (opcional)' : 'Descripción'}<input value={line.description} placeholder={draft.plateMode ? label : undefined} onChange={e => updateQuoteLine(line.id, { description: e.target.value })} required={!draft.plateMode} /></label>
              <label>Filamento<select value={line.spoolId} onChange={e => updateQuoteLine(line.id, { spoolId: e.target.value })} required><option value="">Seleccionar</option>{filaments.map(x => <option key={x.id} value={x.id}>{filamentLabel(x)}</option>)}</select></label>
              <label>{usesBaseGrams(line.calculation?.materials?.[0]) ? 'Gramos base' : 'Gramos'}
                <input ref={input => {
                  if (input && plateToFocus.current === line.id) {
                    input.focus();
                    plateToFocus.current = null;
                  }
                }} type="number" min={line.calculation ? 0 : 0.01} step={line.calculation ? 'any' : '0.01'}
                  value={draft.plateMode && !line.calculation && !line.grams ? '' : line.grams}
                  onChange={e => updateQuoteLine(line.id, { grams: Number(e.target.value) })} required />
              </label>
              <label>Horas de impresión<input type="number" min="0.01" step="any" value={draft.plateMode && !line.printHours ? '' : line.printHours} onChange={e => updateQuoteLine(line.id, { printHours: Number(e.target.value) })} required /></label>
              {draft.plateMode && (!line.calculation || line.calculation.printerId === draft.printerId) ? <label>Perfil energético
                <select value={line.energyProfileId ?? line.calculation?.energyProfileId ?? draft.energyProfileId} onChange={e => updateQuoteLine(line.id, { energyProfileId: e.target.value })} required>
                  <option value="">Configurar</option>{profiles.map(x => <option key={x.id} value={x.id}>{x.name} · {x.averagePrintPowerW} W</option>)}
                </select>
              </label> : null}
              <button type="button" className="secondary" aria-label={draft.plateMode ? `Quitar plato ${index + 2}` : undefined}
                onClick={() => removeQuoteLine(line.id)}>{draft.plateMode ? 'Quitar plato' : 'Quitar línea'}</button>
            </div>
          </fieldset>;
        })}
        <div className="actions span-2 quote-line-actions">
          {draft.plateMode || !draft.quoteLines.length ? <button ref={addPlateButton} type="button" className="secondary" onClick={() => addQuoteLine(true)}>Agregar plato</button> : null}
          {!draft.plateMode || !draft.quoteLines.length ? <button type="button" className="secondary" onClick={() => addQuoteLine(false)}>Agregar línea independiente</button> : null}
        </div>
      </> : null}
      <div className="actions"><button type="submit" disabled={loading || saving || !online}>{loading ? 'Calculando…' : 'Calcular con el servidor'}</button></div>
    </form>
    <article className="card result-card" aria-live="polite">
    {adjustment && savedQuote ? <h2 ref={savedAmountHeading} tabIndex={-1}>Importe comercial guardado</h2> : <h2>Desglose</h2>}
    {adjustment && savedQuote ? <p><strong>{savedQuote.adjustedTotalGs == null ? 'Sin definir' : formatPyg(savedQuote.adjustedTotalGs)}</strong></p> : preview && breakdown ? <>
      {preview.warnings.map(warning => <p key={warning.code} className={warning.blocksPrice ? 'warning' : 'hint'}>{warning.message}</p>)}
      <dl className="breakdown">
        <div><dt>1. Materiales</dt><dd>{formatPyg(breakdown.materialCostGs)}</dd></div>
        <div><dt>2. Electricidad</dt><dd>{formatPyg('energyCostGs' in breakdown ? breakdown.energyCostGs : breakdown.energy.costGs)}</dd></div>
        <div><dt>3. Máquina</dt><dd>{formatPyg('machineCostGs' in breakdown ? breakdown.machineCostGs : breakdown.machine.costGs)}</dd></div>
        <div><dt>4. Mano de obra</dt><dd>{formatPyg(breakdown.laborCostGs)}</dd></div>
        <div><dt>5. Consumibles</dt><dd>{formatPyg(breakdown.additionalCostGs)}</dd></div>
        <div><dt>6. Riesgo de falla</dt><dd>{formatPyg(breakdown.failureReserveGs)}</dd></div>
        <div><dt>7. Overhead</dt><dd>{formatPyg(breakdown.totalOverheadGs)}</dd></div>
        <div className="total"><dt>8. Costo completo</dt><dd>{formatPyg(breakdown.fullyLoadedCostGs)}</dd></div>
        <div><dt>9. Precio sugerido</dt><dd>{formatPyg(breakdown.suggestedNetPriceGs)}</dd></div>
        <div><dt>10. Ganancia</dt><dd>{formatPyg(breakdown.estimatedProfitGs)}</dd></div>
        <div><dt>11. Margen</dt><dd>{formatDecimal(breakdown.achievedMarginPercent, 2)}%</dd></div>
        <div><dt>12. Markup</dt><dd>{formatDecimal(breakdown.markupPercent, 2)}%</dd></div>
        <div><dt>13. Impuesto</dt><dd>{formatPyg(breakdown.taxGs)}</dd></div>
        <div className="grand-total"><dt>14. Total cliente</dt><dd>{formatPyg(breakdown.customerTotalGs)}</dd></div>
      </dl>{!adjustment && preview.canUsePrice ? <div className="actions"><button type="button" className="secondary" onClick={() => void copySummary()}>Copiar precio</button>{shareApi ? <button type="button" className="secondary" onClick={() => void shareSummary()}>Compartir</button> : null}</div> : null}
      {!preview.canUsePrice ? <p className="warning">Este precio no puede utilizarse hasta resolver los costos obligatorios.</p> : null}
    </> : <p className="empty">Completá los datos y solicitá un cálculo.</p>}</article>
    {adjustment && adjustmentPath ? <section className="card advanced-quote-fields" aria-labelledby="advanced-adjust-heading">
      <h2 id="advanced-adjust-heading">Revisión del presupuesto</h2>
      {saveError ? <p className="warning" role="alert">{saveError}</p> : null}
      {savedQuote ? <>
        <div className="notice advanced-quote-saved">
          <p role="status">Ajustes guardados en el mismo presupuesto.</p>
          <a href={adjustmentPath} onClick={event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); navigate(adjustmentPath, { state: orderListOriginState(), replace: true });
          }}>Abrir presupuesto</a>
        </div>
        <a className="create-separate-quote" href="/quotes/new" onClick={event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); navigate('/quotes/new');
        }}>Crear otro presupuesto</a>
      </> : <>
        <p className="hint">{preview?.canUsePrice ? 'Guardá para agregar esta revisión al mismo presupuesto.' : 'Calculá el resultado antes de guardar los ajustes.'}</p>
        <div className="actions"><button type="button" onClick={() => void save()} disabled={loading || saving || !online || !preview?.canUsePrice}>
          {saving ? 'Guardando…' : 'Guardar ajustes'}
        </button></div>
      </>}
    </section> : saveAsQuote ? <section className="card advanced-quote-fields" aria-labelledby="advanced-quote-fields-heading">
      <h2 id="advanced-quote-fields-heading">Datos para el presupuesto</h2>
      <p className="hint">El presupuesto guardado queda pendiente de aceptación. La referencia se pide al confirmar el pedido.</p>
      <div className="form-grid">
        <label>Cliente / referencia (opcional)<input maxLength={200} value={draft.customerReference} placeholder="Nombre, alias o WhatsApp" onChange={e => update('customerReference', e.target.value)} /></label>
        <label>Qué se va a imprimir (opcional)<input maxLength={1000} value={draft.itemDescription} placeholder="Ej.: Soporte para auriculares" onChange={e => update('itemDescription', e.target.value)} /></label>
      </div>
      <details className="advanced-block"><summary>Cliente de catálogo y notas</summary>
        <div className="form-grid">
          <label>Cliente de catálogo (opcional)<select value={draft.customerId} onChange={e => update('customerId', e.target.value)}><option value="">Sin cliente de catálogo</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
          <label>Notas (opcional)<textarea value={draft.notes} onChange={e => update('notes', e.target.value)} rows={3} /></label>
        </div>
      </details>
      {saveError ? <p className="warning" role="alert">{saveError}</p> : null}
      {savedQuote ? <>
        <div className="notice advanced-quote-saved">
          <p role="status">{savedQuote.code} se guardó en Presupuestos.{savedQuote.order === undefined ? ' Buscando su ficha pendiente…' : savedQuote.order === null ? ' No pudimos encontrar la ficha pendiente. Podés abrir el documento.' : ''}</p>
          <a href={savedPath} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(savedPath); } }}>{linkedOrder ? (orderPending ? 'Abrir presupuesto' : 'Abrir pedido') : 'Abrir documento'}</a>
        </div>
        <p className="hint">Los cambios que hagas acá se aplican al próximo presupuesto.</p>
        <div className="actions"><button type="button" className="secondary" onClick={() => setSavedQuote(null)}>Preparar otro presupuesto</button></div>
      </> : <div className="actions"><button type="button" onClick={() => void save()} disabled={loading || saving || !online || (draft.plateMode && !preview?.canUsePrice)}>{saving ? 'Guardando…' : 'Guardar cotización'}</button></div>}
    </section> : null}
    </div>
  </section>;
}
