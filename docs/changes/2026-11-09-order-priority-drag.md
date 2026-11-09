# Prioridad de pedidos con arrastre

En **Pedidos → Confirmados**, cada fila empieza con su número en la cola. El 1 se atiende primero. El asa de seis puntos se puede arrastrar con mouse o toque sobre otra fila visible. Activar el asa con clic, toque o teclado abre **Cambiar prioridad** para elegir una posición de toda la cola, incluso en otra página. Una búsqueda conserva los números globales.

Cada movimiento se guarda en una sola operación. Los pedidos intermedios conservan su orden relativo. El arrastre incluye la identidad del pedido de destino para detectar cambios concurrentes. Si la cola cambió, la lista se actualiza y el usuario puede volver a elegir. La API acepta los movimientos anteriores y el nuevo movimiento por posición. [Contrato de la API](../api.md)

## Verificación

- Pasaron 106 pruebas de backend, 137 pruebas web y 23 pruebas Playwright. También pasaron TypeScript y el build Vite. El detector Impeccable devolvió cero hallazgos.
- Pasaron siete escenarios con Chrome, la API y una base local de datos sintéticos. Se comprobó arrastre con mouse a 1440 px y toque emulado a 390 y 320 px. Los casos cubrieron búsqueda, salto entre páginas con teclado, recarga, cancelación, error de guardado y un intento de soltar sobre la navegación fija.
- En el entorno habitual se abrió **Pedidos** en Chrome y se verificó que las prioridades visibles coincidieran con la respuesta de la API. Quedaron activos el [preview local](http://127.0.0.1:5173/jobs) y la [API local](http://127.0.0.1:5080/health).

Se inspeccionaron 14 capturas en `.impeccable/order-priority-drag-2026-11-09/`. [Escritorio](../../.impeccable/order-priority-drag-2026-11-09/captures/01-números-globales-1440.png) · [Arrastre táctil](../../.impeccable/order-priority-drag-2026-11-09/captures/08-arrastre-táctil-390.png) · [Resumen de verificación](../../.impeccable/order-priority-drag-2026-11-09/verification-summary.json)

## Color y ubicación del asa

El número se centra en un recuadro, con naranja quemado para el primer puesto y ámbar suave para los siguientes. La etiqueta se conserva para lectores de pantalla. El asa queda a la derecha de **Ver pedido**, al final de la fila y del orden de tabulación.

Se revisó Chrome a 1440, 768 y 390 px y a 320 px con texto al 200 %. El contraste medido de los números fue 6,92:1 para el primer puesto y 13,05:1 para los demás. Se verificaron el arrastre con mouse y toque emulado y la activación y el retorno de foco por teclado. Pasaron 24 pruebas web afectadas, la regresión de arrastre Playwright, los tipos y el build. Impeccable devolvió cero hallazgos. [Escritorio](../../.impeccable/order-priority-color-2026-11-09/pedidos-1440.png) · [Móvil](../../.impeccable/order-priority-color-2026-11-09/pedidos-390.png)

El refinamiento siguiente distinguió el 1 en naranja quemado, el 2 en ámbar dorado y el 3 en terracota claro. Desde el 4 se mantiene el ámbar suave. Los colores se asignan al puesto global y se actualizan al reordenar. Chrome verificó cuatro anchos entre 320 y 1440 px, el cambio de color tras un arrastre táctil emulado y un contraste mínimo de 5,85 a 1 para los números. Pasaron 17 pruebas web afectadas, tipos y build. [Captura de escritorio](../../.impeccable/order-priority-top-three-2026-11-09/pedidos-1440.png)
