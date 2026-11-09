# Varios platos en un presupuesto

- **Cotizar** empieza con un plato. **Agregar plato** abre otro con su propio filamento, horas, minutos y gramos. El nuevo plato toma el filamento del primero y deja vacíos el tiempo y el peso. Los platos adicionales se pueden quitar y se numeran de nuevo.
- El rápido muestra un total, la cantidad de platos, el peso y el tiempo acumulados. La preparación, el embalaje, el mínimo y el redondeo se aplican una vez sobre el conjunto. El guardado automático actualiza la misma ficha y la confirmación la convierte en un pedido de cantidad uno.
- **Presupuesto completo** distingue **Agregar plato** de **Agregar línea independiente**. **Ajustar este presupuesto** recupera cada plato y guarda la revisión en la misma ficha. El documento muestra el tiempo y el peso de cada plato. La imagen para compartir muestra el precio y los totales del trabajo.
- Los presupuestos de un plato y los borradores anteriores siguen usando sus recorridos habituales. Los platos se guardan en las líneas de la revisión, con un marcador que se conserva al ajustar, duplicar o recalcular.

## Verificación

Chrome con API y SQLite aisladas confirmó el rápido con dos materiales, el guardado de tres platos, la eliminación con renumeración, el ajuste sobre la misma ficha, la confirmación y el guardado desde Presupuesto completo. Se revisaron vistas de 1440, 390 y 320 px. Impeccable devolvió cero hallazgos en los archivos afectados.

Pasaron 119 pruebas de backend, 151 de frontend, 23 de Playwright y el build web.

[Rápido en escritorio](../../.impeccable/multiple-print-plates-2026-11-09/captures/01-rapido-varios-platos-1440.png) · [Rápido a 320 px](../../.impeccable/multiple-print-plates-2026-11-09/captures/07-plato-adicional-320.png) · [Total móvil](../../.impeccable/multiple-print-plates-2026-11-09/captures/04-total-varios-platos-390.png) · [Documento](../../.impeccable/multiple-print-plates-2026-11-09/captures/05-documento-con-platos-390.png) · [Imagen para compartir](../../.impeccable/multiple-print-plates-2026-11-09/captures/02-compartir-varios-platos-1440.png) · [Presupuesto completo](../../.impeccable/multiple-print-plates-2026-11-09/captures/06-completo-platos-1440.png)

[Cotizador local](http://127.0.0.1:5173/) · [Presupuesto completo local](http://127.0.0.1:5173/quotes/new) · [Salud de la API local](http://127.0.0.1:5080/health)
