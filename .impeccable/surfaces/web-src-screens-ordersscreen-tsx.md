---
version: 1
slug: "web-src-screens-ordersscreen-tsx"
primary_target: "web/src/screens/OrdersScreen.tsx"
related_targets: ["web/src/screens/ResourceScreens.tsx","web/src/components/AppShell.tsx"]
---

# Presupuestos y pedidos — web/src/screens/OrdersScreen.tsx

Modo: Operate. Presupuestos `/quotes` y ficha pendiente `/quotes/pending/:id`; Pedidos `/jobs`, alta `/orders/new`, ficha confirmada `/orders/:id`. Extensión del sistema existente, 2026-10-20.

Tarea: conservar cada cotización en Presupuestos como pendiente de aceptación, confirmar o descartar desde esa bandeja, y seguir lo confirmado en Pedidos. Nuevo pedido permite un precio manual acordado, directamente confirmado y sin calculadora; no ofrece crear un borrador desde cero. Cliente/referencia libre, cantidad inicial1 e importe total. Historia admite fechas y costos desconocidos.

Composición: Presupuestos tiene Pendientes/Con pedido/Descartados, búsqueda y filas con referencia, trabajo, cantidad, estado, fecha y total. Confirmar pedido actúa directamente si está completo; sino abre Completar y confirmar. Pedidos tiene Confirmados/Historial y prioridad Subir/Bajar/Poner primero sobre la cola global. En móvil, filas apiladas y accesos Cotizar/Presupuestos/Pedidos/Más, con Filamentos en Más. Ficha simple con seguimiento y detalles técnicos secundarios.

Continuidad: aceptar mantiene registro, vínculo e importe; no recalcula ni inicia producción. Descarte recuperable dentro de Presupuestos. Cancelación/rechazo del recorrido anterior también archiva el pendiente; duplicación crea inmediatamente su vínculo visible. Un pedido confirmado se cancela desde Pedidos. No fabricar costo, ganancia ni stock. Guardar notas antes de transición; bloquear campos durante respuesta; recuperación de versión sólo ante409 conserva entradas. Conservar una sola acción de recuperación por descartado.

Identidad: tokens crema/naranja/ámbar, Chakra Petch, controles rectos; sin nuevo mundo visual. Validación en docs/changes/2026-10-20-orders-management.md. Documentos de autoridad: PRODUCT.md, DESIGN.md y diseño aprobado. Sin publicación productiva.
