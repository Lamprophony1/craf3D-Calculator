# Completar historial de entregas

## Objetivo

Cargar la fecha de entrega y el costo real total de pedidos entregados desde una lista. El Resumen incorpora los datos al acumulado y a su mes de entrega.

## Contrato

`GET /api/orders/delivery-details` lista las entregas y devuelve el día actual en Paraguay. Cada fila tiene la versión del pedido y distingue costo manual de resultado de producción. `PUT /api/orders/{id}/delivery-details` actualiza fecha y costo manual con versión optimista. `null` expresa dato desconocido y `0` expresa costo real cero. El guardado conserva los demás datos de la ficha y registra la edición. El reporte toma el resultado real de producción cuando existe y, para las demás entregas con datos, resta el costo manual al importe de venta.

## Trabajo

- [x] Agregar lectura y edición de los datos de entrega, con validación, versión y regresiones del reporte mensual.
- [x] Agregar lista con pendientes, todos, búsqueda y guardado por pedido. Mantener los borradores ante fallos.
- [x] Conectar Resumen e Historial. Conservar la salida a la ficha y el regreso cuando falte importe.
- [x] Verificar pruebas, build y navegador en escritorio y móvil. Dejar disponibles web y API locales.
