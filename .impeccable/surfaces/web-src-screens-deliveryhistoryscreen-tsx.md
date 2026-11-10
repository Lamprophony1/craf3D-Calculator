---
version: 1
slug: "web-src-screens-deliveryhistoryscreen-tsx"
primary_target: "web/src/screens/DeliveryHistoryScreen.tsx"
related_targets: ["web/src/styles/delivery-history.css", "web/src/screens/DashboardScreen.tsx", "web/src/screens/OrdersList.tsx"]
---

# Completar historial

Modo Operate. Ruta `/jobs/delivery-details`. El trabajo es completar la fecha y el costo real total de las entregas históricas para consultar su ganancia mensual.

Pendientes agrupa entregas con datos faltantes. Todos deja revisar y corregir las entregas guardadas. La fila mantiene juntos su referencia, importe, fecha y costo. Cada pedido se guarda de forma independiente. Los resultados de producción conservan su origen. Un costo de cero se muestra con su valor y los campos vacíos representan datos desconocidos.

Los controles se apilan con etiquetas visibles en móvil. Los errores de guardado y conflictos dejan disponibles las entradas. Volver al Resumen refresca las cifras del reporte.
