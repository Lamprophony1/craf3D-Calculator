# Prioridad de pedidos con arrastre

La vista **Confirmados** presenta el número de prioridad global al inicio de cada fila. El asa con puntos permite arrastrar con mouse o tacto. Un clic, toque o activación por teclado abre **Cambiar prioridad**, con la posición actual y un campo para elegir cualquier lugar de la cola. El historial conserva su orden por fecha.

La cola mantiene sus páginas y su búsqueda. Arrastrar sobre una fila usa la prioridad global que esa fila ocupa. Los pedidos que quedan entre origen y destino se desplazan conservando su orden relativo. Elegir un número permite mover un pedido a otra página en una sola acción.

La API valida y aplica el cambio dentro de la transacción existente. La solicitud `direction: "position"` lleva `position` y la versión del pedido. Un arrastre también envía `expectedTargetId` para detectar si cambió el pedido que ocupaba el lugar de destino. La respuesta devuelve la posición confirmada por el servidor.

- [x] Extender el movimiento transaccional y sus pruebas de posición, conflictos y compatibilidad.
- [x] Mostrar rango y asa con el patrón sortable de dnd kit. Conservar el desplazamiento táctil fuera del asa y el foco después de guardar.
- [x] Comprobar arrastre, toque, teclado, página filtrada, cancelación y error en navegador. Verificar que recargar recupere el orden guardado.
- [x] Correr las pruebas afectadas, tipos, build y detector. Revisar escritorio y móvil, guardar evidencia y dejar disponible el preview habitual.
