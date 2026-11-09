# Arreglos de Presupuestos y Pedidos

El incremento del 9 de noviembre de 2026 aplica O01–O09 de la [auditoría de Presupuestos y Pedidos](2026-11-06-orders-ux-audit.md). La ficha existente abre con resumen y próxima acción. **Editar datos** despliega el formulario y **Nuevo pedido** abre directamente en el formulario de alta.

| Hallazgo | Resultado |
|---|---|
| O01 | La ficha comercial muestra cambios pendientes. Volver, la navegación principal y Atrás ofrecen guardar, salir sin guardar o continuar. La recarga usa la confirmación del navegador. |
| O02 | Cancelar un pedido abre una confirmación con la referencia y el destino en Historial. Escape vuelve a la acción que la abrió. El descarte de presupuestos sigue ofreciendo recuperación. |
| O03 | La barra móvil usa dos filas cuando el texto necesita más espacio. Las vistas y los datos de las filas se redistribuyen a 320 y 390 px con texto normal y al 200 %. |
| O04 | El guardado actualiza la versión antes de confirmar. Si falla la transición, se puede reintentar con la versión guardada. El conflicto real conserva los campos editados y recupera los demás datos vigentes. |
| O05 | Iniciar pedido, Marcar listo y Registrar entrega aparecen junto al resumen. La descripción larga queda después de la próxima acción. |
| O06 | La URL conserva vista, búsqueda y página. Al regresar se restaura la posición. Si el registro cambió de bandeja, se indica el destino. |
| O07 | Presupuesto completo ofrece referencia libre y descripción opcionales después del resultado. Abrir presupuesto continúa en la misma ficha. Si falla la consulta del vínculo, el documento sigue accesible. |
| O08 | El documento separa seguimiento comercial de preparación, impresión y envío. Las acciones se nombran en español y el vínculo se vuelve a consultar al cambiar el estado. La edición de líneas tiene sus propios controles de guardado y salida. |
| O09 | Al reordenar se mantienen las filas. El foco pasa a una acción disponible del mismo pedido o al enlace a su nueva posición. |

Se usaron los componentes, estados y contratos de API existentes. El importe de un pedido sigue viniendo de su total guardado y el precio del presupuesto sigue viniendo del motor decimal.

## Verificación

- 136 pruebas web, chequeo de tipos y build Vite. La primera corrida paralela con el navegador produjo timeouts. Las mismas pruebas pasaron con dos workers después de completar Playwright.
- 22 pruebas Playwright. La regresión de Atrás verifica que se conserve la nota pendiente hasta elegir cómo salir y que se recupere la segunda página de un Historial filtrado.
- Chrome con API real y SQLite sintética. Pasaron los nueve hallazgos, incluido PUT exitoso seguido de un fallo inyectado de confirmación y reintento con la versión guardada. Un conflicto concurrente real conservó la nota local. El presupuesto completo mantuvo el mismo registro y Gs.120.000 desde preview hasta confirmación.
- Escritorio de 1440 px y móvil emulado de 390 y 320 px. Ocho combinaciones de listas con datos, texto normal y raíz CSS al 200 %, con comprobación de teclado. Las pruebas se hicieron con Chrome y emulación.
- Detector Impeccable sobre los archivos afectados con salida 0 y cero hallazgos.

Las 31 capturas y sus métricas se guardaron en `.impeccable/orders-ux-fixes-2026-11-09/`. El manifiesto [accepted-captures.json](../../.impeccable/orders-ux-fixes-2026-11-09/accepted-captures.json) identifica los PNG inspeccionados. Se puede ver el [resumen en móvil](../../.impeccable/orders-ux-fixes-2026-11-09/captures/O05-resumen-confirmado-390.png), la [salida protegida](../../.impeccable/orders-ux-fixes-2026-11-09/captures/O01-salida-protegida-390.png) y el [guardado avanzado](../../.impeccable/orders-ux-fixes-2026-11-09/captures/O07-avanzado-guardado-1440.png).

Quedaron activos el [preview local de Pedidos](http://127.0.0.1:5173/jobs) y la [API habitual](http://127.0.0.1:5080/health). En ese preview se comprobaron las pantallas de Pedidos, Presupuestos y Presupuesto completo. La API de datos sintéticos se cerró.
