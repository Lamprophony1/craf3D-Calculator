import { useEffect, useState } from 'react';
import { get } from '../api/client';
import type { Order } from '../api/orders';
import type { QuoteLineRecord } from '../api/types';
import { navigate } from '../components/AppShell';
import { CalculatorScreen, type QuoteAdjustment } from './CalculatorScreen';
import { orderListOriginState } from './orderListNavigation';

interface QuoteForAdjustment {
  status: string;
  revisions: Array<{ revisionNumber: number; lines?: QuoteLineRecord[] | null; effectiveLines?: QuoteLineRecord[] }>;
}

export function QuoteAdjustmentScreen({ id }: { id: string }) {
  const [result, setResult] = useState<QuoteAdjustment | string | null>(null);
  const [retry, setRetry] = useState(0);
  const path = `/quotes/pending/${encodeURIComponent(id)}`;

  useEffect(() => {
    let mounted = true;
    async function load() {
      const order = await get<Order>(`/api/orders/${encodeURIComponent(id)}`);
      if (order.status !== 'Draft' || !order.quoteId)
        throw new Error('El ajuste está disponible para presupuestos pendientes con un cálculo guardado.');
      const quote = await get<QuoteForAdjustment>(`/api/quotes/${encodeURIComponent(order.quoteId)}`);
      if (!['Draft', 'Calculated', 'ReadyToSend', 'Sent'].includes(quote.status))
        throw new Error('El estado del documento ya no permite ajustar el cálculo.');
      const revision = quote.revisions.reduce<(typeof quote.revisions)[number] | undefined>(
        (latest, current) => !latest || current.revisionNumber > latest.revisionNumber ? current : latest, undefined
      );
      const lines = revision?.lines?.length ? revision.lines : revision?.effectiveLines;
      if (!revision || !lines?.length) throw new Error('Falta el cálculo de la revisión guardada.');
      if (mounted) setResult({
        order, quoteId: order.quoteId, revisionNumber: revision.revisionNumber,
        lines: lines.map(line => ({ description: line.description, calculation: line.request, isPrintPlate: line.isPrintPlate }))
      });
    }
    void load().catch(error => {
      if (mounted) setResult(error instanceof Error ? error.message : 'No pudimos abrir el cálculo guardado.');
    });
    return () => { mounted = false; };
  }, [id, retry]);

  if (result && typeof result !== 'string') return <CalculatorScreen saveAsQuote adjustment={result} />;
  return <section className="page calculator-page">
    <button type="button" className="quiet order-back" onClick={() => navigate(path, { state: orderListOriginState() })}>Volver al presupuesto</button>
    <h1>Ajustar presupuesto</h1>
    {typeof result === 'string' ? <>
      <p className="error" role="alert">{result}</p>
      <button type="button" className="secondary" onClick={() => { setResult(null); setRetry(value => value + 1); }}>Reintentar</button>
    </> : <p role="status">Cargando el cálculo guardado…</p>}
  </section>;
}
