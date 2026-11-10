# Completar el historial de entregas

**Resumen → Completar historial** y **Pedidos → Historial** abren la misma lista de pedidos entregados. **Pendientes** muestra las entregas con algún dato faltante. **Todos** permite corregir datos ya cargados. Se puede buscar por cliente, trabajo o código y guardar la fecha, el costo real total o ambos en la fila del pedido. Si falta el importe de venta, la fila enlaza a la ficha.

El costo manual incluye los gastos, comisiones e impuestos de la venta y admite cero como valor conocido. El resultado del cierre de producción tiene prioridad. Cuando hay venta y costo manual, la ganancia es la diferencia entre ambos. El Resumen atribuye las cifras al mes de entrega y muestra las entregas sin fecha por separado. El registro de auditoría identifica las ediciones y el control de versión protege los cambios concurrentes. El costo manual se guarda en los datos existentes del pedido, sin migración de SQLite.

## Verificación local

- Pasaron 131 pruebas .NET en Release, 161 pruebas web, 23 recorridos Playwright y el build de Vite con TypeScript.
- En Chrome, con pedidos de prueba en SQLite aislada, se recorrieron las dos entradas, el guardado parcial, el costo cero, las correcciones, la protección de costos de producción y la actualización de tres meses en el Resumen. Se revisaron 1440, 390 y 320 px. Las capturas y el resultado se guardaron en `.impeccable/delivery-history-2026-11-10/`. El detector Impeccable terminó sin hallazgos.
- El preview quedó disponible en `http://127.0.0.1:5173` con API en `http://127.0.0.1:5080/health`. La entrega se verificó en local.
