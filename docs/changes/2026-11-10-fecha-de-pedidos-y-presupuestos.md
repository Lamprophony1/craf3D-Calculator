# Fecha automática en pedidos y presupuestos

Los pedidos nuevos y los borradores guardados desde Cotizar o Presupuesto completo toman el día de Paraguay en su primer guardado. El duplicado de un presupuesto toma su propio día de creación. La fecha aparece junto al código y el estado de la ficha. Recalcular o confirmar conserva la fecha registrada.

**Nuevo pedido** sugiere la fecha del día y permite elegir otra. El servidor asigna la fecha automática al guardar. **Registrar un trabajo anterior** admite dejarla vacía. La fecha del pedido se guarda en el campo comercial existente, separado de la fecha de entrega que usa el Resumen para agrupar ventas y ganancias.

## Verificación local

Pasaron 135 pruebas .NET, 163 pruebas web y el build de TypeScript y Vite. Las regresiones cubren altas manuales y de cotizador, duplicación, recálculo, confirmación y cambio de día entre UTC y Paraguay. El detector Impeccable no informó hallazgos en la ficha.

El recorrido en Chrome a 1440 y 390 px usó SQLite aislada. Comprobó el alta con el navegador en un día distinto al de Paraguay, el histórico con fecha explícita o desconocida y el guardado de los presupuestos rápido y completo. Las capturas están en `.impeccable/order-date-2026-11-10/`. El preview habitual quedó en `http://127.0.0.1:5173`, con API en `http://127.0.0.1:5080/health`.
