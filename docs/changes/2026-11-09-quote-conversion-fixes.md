# Presupuestos desde el guardado hasta la confirmación

El incremento aplica las cinco propuestas de la [auditoría del recorrido](2026-11-09-quote-conversion-audit.md).

- El rápido muestra **Guardado en Presupuestos** junto al precio con una sola acción **Abrir presupuesto**. La referencia se puede dejar vacía al guardar y se pide al confirmar.
- **Ajustar este presupuesto** abre el cálculo del pendiente desde el rápido o su ficha. Guardar anexa una revisión al mismo presupuesto y muestra el importe comercial devuelto por la API. Los datos comerciales, el vínculo y los importes manuales o ya divergentes se conservan. **Crear otro presupuesto** es una acción separada. Las revisiones con gramos base mantienen la merma asociada al editar.
- **Ver documento** abre la revisión guardada. Con precio utilizable se puede imprimir y marcar lista para enviar. Si un recálculo genera otro total, la pantalla distingue el importe del documento del que se va a confirmar. **Usar importe de esta revisión** adopta ese importe mediante una escritura versionada.
- **Completar y confirmar** muestra y enfoca los campos faltantes. El importe y la confirmación quedan en el mismo bloque. **Guardar para después** conserva el pendiente y **Editar datos** abre los campos opcionales.
- La bandeja y el documento confirman directamente cuando la referencia y el importe están completos. La ficha resultante enfoca el encabezado y anuncia **Pedido confirmado** con acceso a **Confirmados**. El regreso conserva el contexto de Presupuestos.

El servidor verifica la versión y la revisión de origen dentro de la transacción. Una edición anterior de líneas recibe un conflicto si cambió la revisión. Vincular producción a un pedido confirmado conserva su importe comercial informado.

## Evidencia

En Chrome con API real y SQLite sintética se verificaron tres recorridos. El ajuste pasó de Gs. 65.000 a Gs. 85.000 con el mismo pedido y una revisión adicional. Completar la referencia en móvil confirmó Gs. 55.000 con el mismo vínculo. En el documento, imprimir y marcar listo conservaron la revisión de Gs. 120.000 tras cambiar un costo de prueba. Solo el recálculo explícito generó una revisión de Gs. 265.000, que se aplicó después de elegirla.

Pasaron 116 pruebas .NET, 145 pruebas web y 23 pruebas Playwright. La última corrección de foco se volvió a verificar con las 21 pruebas de las pantallas afectadas, tipos, build y el recorrido de ajuste en Chrome. El detector Impeccable devolvió cero hallazgos.

[Guardado rápido](../../.impeccable/quote-conversion-fixes-2026-11-09/captures/01-guardado-1440.png) · [Ajuste guardado](../../.impeccable/quote-conversion-fixes-2026-11-09/captures/03-ajuste-guardado-1440.png) · [Completar en móvil](../../.impeccable/quote-conversion-fixes-2026-11-09/captures/05-completar-390.png) · [Importes distintos](../../.impeccable/quote-conversion-fixes-2026-11-09/captures/09-importes-distintos-390.png) · [Confirmación](../../.impeccable/quote-conversion-fixes-2026-11-09/captures/10-confirmado-desde-documento-390.png)

La verificación de impresión cubrió la revisión visible y la activación del comando en el navegador. El toque se emuló. El preview habitual quedó disponible en [Presupuestos](http://127.0.0.1:5173/quotes) con la [API local](http://127.0.0.1:5080/health).
