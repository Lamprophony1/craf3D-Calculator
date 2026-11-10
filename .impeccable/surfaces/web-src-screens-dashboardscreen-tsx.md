---
version: 1
slug: "web-src-screens-dashboardscreen-tsx"
primary_target: "web/src/screens/DashboardScreen.tsx"
related_targets: ["web/src/styles/dashboard.css"]
---

# Resumen

Modo Operate. Ruta `/dashboard` en la aplicación autenticada. La tarea es ver el importe acumulado de las entregas, la ganancia registrada y su evolución mensual. El usuario eligió contar las ventas al entregar el pedido.

El acumulado combina dos cifras con sus conteos de cobertura. Las ventas toman el importe real de producción cuando existe y el importe del pedido en las demás entregas con precio. Ganancia registrada utiliza el resultado de producción o la diferencia entre venta y costo real total cargado. Completar historial abre la lista de entregas para cargar esos datos y su fecha. La tabla mensual usa fecha de entrega y un selector nativo de año. El saldo con pérdida conserva el signo. La ausencia de costos se presenta como Sin calcular. Las entregas sin fecha se indican debajo de la tabla y se incluyen en el acumulado.

Estados de carga, vacío y error con reintento. La llamada a ajustes es independiente del reporte y mantiene el acceso al flujo de configuración. La tabla conserva etiquetas, importes y foco de teclado en pantallas estrechas. Tipografía, bordes y colores siguen los tokens del proyecto.
