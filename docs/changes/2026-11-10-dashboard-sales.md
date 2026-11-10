# Ventas y ganancia en Resumen

El usuario eligió **Pedidos entregados** como criterio de venta. **Ventas entregadas** muestra el acumulado de esos pedidos. Usa el importe real registrado en producción si existe y el importe del pedido en las demás entregas con precio. **Ganancia registrada** suma los resultados reales de producción vinculados y muestra cuántas entregas aportan costos. Una ganancia registrada de Gs. 0 tiene su propio valor y los resultados pendientes aparecen como **Sin calcular**.

**Ganancia por mes** organiza ventas y ganancias por fecha de entrega. El selector de año cambia la tabla. Las entregas sin fecha se indican aparte y cuentan en el acumulado. El reporte consulta SQLite en una lectura conjunta de pedidos y cierres de producción. Cada pedido aporta como máximo una venta y un resultado de producción.

## Evidencia

El recorrido integrado usó una base SQLite aislada. Al completar producción, el pedido todavía no aportaba una venta. Al marcarlo Entregado, el dashboard mostró el importe real y la ganancia guardada. Se comprobó el acumulado, un registro sin fecha y el cambio de año. Chrome también cubrió 1440, 390 y 320 px con datos sintéticos, incluidos ganancia negativa, cero real, meses con cobertura parcial, vacío y reintento tras un error.

Pasaron 128 pruebas de backend, 155 de frontend, 23 de Playwright y el build web. El detector Impeccable devolvió cero hallazgos. El dashboard local y el nuevo reporte respondieron HTTP 200.

[Escritorio](../../.impeccable/dashboard-sales-2026-11-10/after-populated-1440.png) · [Móvil a 320 px](../../.impeccable/dashboard-sales-2026-11-10/after-viewport-320.png) · [Año anterior](../../.impeccable/dashboard-sales-2026-11-10/after-previous-year-390.png) · [Estado vacío](../../.impeccable/dashboard-sales-2026-11-10/after-empty-390.png)
