# Simplificación de Presupuestos hasta confirmar el pedido

> Usar Superpowers para ejecutar y verificar cada parte. Las casillas registran los incrementos del plan.

**Objetivo.** Continuar desde el guardado hasta un pedido confirmado en el mismo registro y con el importe visible.

**Diseño aprobado.** [Auditoría del recorrido](../../changes/2026-11-09-quote-conversion-audit.md).

**Arquitectura.** React reutiliza las fichas, la navegación y los controles actuales. El servidor guarda el ajuste de cálculo como una revisión de la cotización vinculada dentro de una transacción y valida la versión del pedido y la revisión de origen. El documento usa el precio de la revisión persistida y la aceptación comercial sigue usando el importe del pedido.

## Criterios

- El guardado rápido tiene una sola acción para abrir el presupuesto y explica cuándo se requiere la referencia.
- Desde la ficha o el rápido guardado se ajusta el cálculo del mismo presupuesto. Conservar identidad, referencia, descripción, revisiones y un importe acordado manualmente. El ajuste concurrente se rechaza sin sobrescribir cambios.
- La revisión guardada se puede imprimir si tiene precio utilizable. Un recálculo queda separado. Si los totales difieren, se ven ambos y usar el de la revisión requiere una decisión explícita.
- Una fila incompleta abre los campos faltantes con foco y **Confirmar pedido** junto al formulario. **Guardar para después** conserva el estado pendiente.
- La confirmación desde una fila completa sigue siendo directa. El documento confirma directamente si los datos están completos y abre el formulario mínimo si faltan. Al llegar a la ficha se anuncia el éxito, se enfoca el encabezado y se ofrece **Ver en Confirmados**.
- Preservar estilo, acceso, precios guardados, datos y navegación anterior. Los cambios quedan en el entorno local hasta una solicitud de publicación.

## Incrementos

- [x] Contratos transaccionales para guardar una revisión y adoptar explícitamente su importe. Validar estado, versión, revisión y conflictos con la cotización rápida.
- [x] Completar y confirmar en la ficha con los campos requeridos y continuidad de foco y navegación.
- [x] Abrir e imprimir la revisión guardada y simplificar la confirmación desde el documento.
- [x] Unificar el guardado rápido y conectar el cálculo completo al presupuesto pendiente existente.
- [x] Validar con pruebas de backend y web, build, navegador en escritorio y móvil y detector Impeccable. Registrar evidencia y dejar disponible el entorno habitual.
