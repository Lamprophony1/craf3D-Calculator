---
version: 1
slug: "web-src-screens-ordersscreen-tsx"
primary_target: "web/src/screens/OrdersScreen.tsx"
related_targets: ["web/src/screens/OrdersList.tsx","web/src/screens/OrderPriority.tsx","web/src/screens/CalculatorScreen.tsx","web/src/screens/ResourceScreens.tsx","web/src/components/AppShell.tsx"]
---

# Presupuestos y pedidos — web/src/screens/OrdersScreen.tsx

Modo: Operate. Presupuestos `/quotes` y ficha pendiente `/quotes/pending/:id`; Pedidos `/jobs`, alta `/orders/new`, ficha confirmada `/orders/:id`. Extensión del sistema existente, 2026-10-20.

Tarea: conservar cada cotización en Presupuestos como pendiente de aceptación, confirmar o descartar desde esa bandeja, y seguir lo confirmado en Pedidos. Nuevo pedido permite un precio manual acordado, directamente confirmado y sin calculadora; no ofrece crear un borrador desde cero. Cliente/referencia libre, cantidad inicial1 e importe total. Historia admite fechas y costos desconocidos.

Presupuestos tiene Pendientes, Con pedido y Descartados, con búsqueda y filas que muestran referencia, trabajo, cantidad, estado, fecha y total. Confirmar pedido actúa directamente si está completo. Si faltan datos, abre Completar y confirmar. Cada fila en Confirmados empieza con el número global centrado en un recuadro. El 1 usa naranja quemado, el 2 ámbar dorado y el 3 terracota claro. Desde el 4, los puestos usan ámbar suave. El asa de seis puntos es la última acción a la derecha. Arrastrar coloca el pedido en el puesto de otra fila visible. Activar el asa abre **Cambiar prioridad** para elegir el puesto en toda la cola. Historial se ordena por fecha. En móvil, las filas se apilan y el desplazamiento táctil se conserva fuera del asa. La ficha prioriza seguimiento y agrupa los detalles técnicos.

Continuidad: confirmar mantiene el registro, el vínculo y el importe. La ficha muestra resumen y próxima acción arriba, con **Editar datos** para abrir el formulario. La salida protege cambios pendientes. Cancelar exige confirmar el paso al Historial, mientras el descarte se recupera en Presupuestos. Cada guardado actualiza la versión local antes de una transición. La lista restaura consulta, posición y foco. El presupuesto completo ofrece acceso a la misma ficha tras guardar y el documento presenta la preparación para el cliente en un grupo propio.

Identidad: tokens crema/naranja/ámbar, Chakra Petch, controles rectos; sin nuevo mundo visual. Validación en docs/changes/2026-10-20-orders-management.md. Documentos de autoridad: PRODUCT.md, DESIGN.md y diseño aprobado. Sin publicación productiva.
