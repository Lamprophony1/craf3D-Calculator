import { useId, useState, type MouseEventHandler, type ReactNode } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type Modifier } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import type { Order } from '../api/orders';
import { ModalDialog } from '../components/ModalDialog';

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });
const visibleRows: CollisionDetection = args => {
  const point = args.pointerCoordinates;
  // Fixed navigation can cover a row even when its rectangle contains the pointer.
  if (!point || !document.elementFromPoint(point.x, point.y)?.closest('.orders-list')) return [];
  return pointerWithin(args);
};

export function OrderPriorityList({ orders, children, onMove }: {
  orders: Order[];
  children: ReactNode;
  onMove: (source: Order, target: Order) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragged = orders.find(order => order.id === draggedId);
  return <DndContext sensors={sensors} collisionDetection={visibleRows} modifiers={[verticalOnly]}
    onDragStart={({ active }) => setDraggedId(String(active.id))}
    onDragCancel={() => setDraggedId(null)}
    onDragEnd={({ active, over }) => {
      setDraggedId(null);
      if (!over || active.id === over.id) return;
      const source = orders.find(order => order.id === active.id);
      const target = orders.find(order => order.id === over.id);
      if (source && target) onMove(source, target);
    }}
    accessibility={{
      restoreFocus: false,
      screenReaderInstructions: { draggable: 'Activá el asa para escribir la nueva posición.' },
      announcements: {
        onDragStart: () => 'Moviendo pedido.',
        onDragOver: ({ over }) => {
          const target = orders.find(order => order.id === over?.id);
          return target ? `Posición ${target.position}.` : 'Fuera de la lista.';
        },
        onDragEnd: () => undefined,
        onDragCancel: () => 'Movimiento cancelado.'
      }
    }}>
    <SortableContext items={orders.map(order => order.id)} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
    <DragOverlay dropAnimation={null} zIndex={35} style={{ pointerEvents: 'none' }}>
      {dragged ? <div className="order-drag-preview" aria-hidden="true">
        <GripVertical size={20} />
        <strong>{dragged.customerReference || dragged.description || dragged.code}</strong>
      </div> : null}
    </DragOverlay>
  </DndContext>;
}

export function PriorityOrderRow({ order, label, blocked, onOpen, actions, children }: {
  order: Order;
  label: string;
  blocked: boolean;
  onOpen: MouseEventHandler<HTMLButtonElement>;
  actions: ReactNode;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id, disabled: blocked
  });
  return <li ref={setNodeRef} className="order-row order-row--priority" data-order-id={order.id}
    data-dragging={isDragging || undefined}
    style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}>
    <div className="order-rank" data-position={order.position}>
      <span className="sr-only">Prioridad </span>
      <strong className="order-rank-number">{order.position}</strong>
    </div>
    {children}
    <div className="order-row-actions">
      {actions}
      <button {...attributes} {...listeners} ref={setActivatorNodeRef} type="button"
        className="secondary icon-button order-priority-handle" data-order-control="priority"
        aria-label={`Cambiar prioridad de ${label}`} aria-haspopup="dialog" aria-roledescription={undefined}
        aria-pressed={undefined} aria-disabled={blocked || undefined} aria-describedby="order-priority-instructions"
        title="Arrastrar o cambiar prioridad" onClick={onOpen}>
        <GripVertical size={20} aria-hidden="true" />
      </button>
    </div>
  </li>;
}

export function OrderPriorityDialog({ label, position, total, onClose, onMove }: {
  label: string;
  position: number;
  total: number;
  onClose: () => void;
  onMove: (position: number) => void;
}) {
  const formId = useId();
  const helpId = useId();
  const [value, setValue] = useState(String(position));
  const next = Number(value);
  const canMove = Number.isInteger(next) && next >= 1 && next <= total && next !== position;
  return <ModalDialog open title="Cambiar prioridad" description={label} onClose={onClose}
    footer={<>
      <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
      <button type="submit" form={formId} disabled={!canMove}>Guardar prioridad</button>
    </>}>
    <form id={formId} className="order-priority-form" onSubmit={event => {
      event.preventDefault();
      if (canMove) onMove(next);
    }}>
      <p>Prioridad actual {position} de {total}.</p>
      <label>Nueva posición
        <input type="number" inputMode="numeric" required min="1" max={total} step="1" data-autofocus
          aria-describedby={helpId} value={value} onChange={event => setValue(event.target.value)} />
      </label>
      <p id={helpId} className="hint">Elegí del 1 al {total}. El 1 se atiende primero.</p>
    </form>
  </ModalDialog>;
}
