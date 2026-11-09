# Repeticiones por plato

El contador **Cantidad** va junto al título de cada plato en el cotizador rápido y en Presupuesto completo. El valor inicial es 1. Cargá el tiempo y los gramos del slicer de una impresión del plato. Si entran 10 piezas y necesitás 35, cargá el plato de 10 con cantidad 3 y el de 5 con cantidad 1. El resumen muestra 4 impresiones y el peso y tiempo acumulados.

El motor usa la base por plato para multiplicar los costos variables. Preparación, embalaje, mínimo y redondeo se aplican al trabajo completo. El documento y el ajuste conservan dos grupos en el ejemplo. La ficha sigue siendo un solo presupuesto y se convierte en un solo pedido. El documento distingue tiempo por plato y tiempo total cuando hay repeticiones.

El guardado conserva el contrato de los borradores anteriores con una impresión. Las repeticiones quedan en la estructura existente de las líneas. En Presupuesto completo siguen disponibles los planes técnicos de cantidad y unidades por placa.

## Evidencia del incremento inicial

En Chrome con SQLite aislada, el caso 3 + 1 dio 4 impresiones, 315 g y 13 h 15 min con los datos sintéticos. El precio coincidió con cargar los cuatro platos por separado. El ajuste y la confirmación conservaron el presupuesto y el pedido. También se verificó un solo grupo repetido y la validación de cero.

Pasaron 125 pruebas de backend, 153 de frontend, 23 de Playwright y el build web. Impeccable no reportó hallazgos.

[Cotizador en escritorio](../../.impeccable/plate-repetitions-2026-11-09/captures/01-rapido-35-piezas-1440.png) · [Resultado móvil](../../.impeccable/plate-repetitions-2026-11-09/captures/03-total-4-platos-390.png) · [Control a 320 px](../../.impeccable/plate-repetitions-2026-11-09/captures/04-repeticiones-plato-2-320.png) · [Ajuste](../../.impeccable/plate-repetitions-2026-11-09/captures/05-ajustar-repeticiones-390.png) · [Documento](../../.impeccable/plate-repetitions-2026-11-09/captures/06-documento-repeticiones-390.png)
