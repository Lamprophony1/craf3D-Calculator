export type OrderStatus = 'Draft' | 'Confirmed' | 'InProgress' | 'Ready' | 'Delivered' | 'Discarded' | 'Cancelled';
export interface Order {
  id: string; code: string; customerReference: string | null; description: string | null;
  quantity: number; totalGs: number | null; status: OrderStatus; version: number; position: number;
  orderDate: string | null; dueDate: string | null; deliveredDate: string | null; notes: string | null;
  historical: boolean; quoteId: string | null; jobId: string | null; productionStatus: string | null;
  actualCostGs: number | null; updatedAt: string;
}
export interface OrderPage { items: Order[]; total: number; draftCount: number; activeCount: number; }
export const orderLabels: Record<OrderStatus, string> = { Draft: 'Borrador', Confirmed: 'Confirmado', InProgress: 'En proceso', Ready: 'Listo para entregar', Delivered: 'Entregado', Discarded: 'Descartado', Cancelled: 'Cancelado' };
export const orderNext: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  Draft: { status: 'Confirmed', label: 'Confirmar pedido' }, Confirmed: { status: 'InProgress', label: 'Iniciar pedido' },
  InProgress: { status: 'Ready', label: 'Marcar listo' }, Ready: { status: 'Delivered', label: 'Registrar entrega' },
  Discarded: { status: 'Draft', label: 'Recuperar borrador' }
};
