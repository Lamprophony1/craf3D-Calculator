# Varios platos en el mismo presupuesto

**Objetivo.** Cotizar un trabajo que requiere más de un plato desde el rápido y desde Presupuesto completo.

Cada plato tiene filamento, tiempo y gramos propios. El rápido empieza con los tres campos habituales y permite agregar o quitar platos. Presupuesto completo distingue **Agregar plato** de las líneas independientes. Los platos de un trabajo forman una unidad comercial y aparecen identificados en la revisión. El total se calcula en el servidor con el agregado existente. Preparación, embalaje, mínimo y redondeo se aplican al trabajo completo.

## Contratos

- El rápido conserva los campos del primer plato. `additionalPlates` agrega los demás con `spoolId`, `printDurationMinutes` y `totalGrams`. El resultado múltiple devuelve `aggregateBreakdown` y `advancedLines`. El resultado de un plato mantiene el contrato vigente.
- Los platos se guardan como líneas de la misma revisión, con `isPrintPlate` para preservar el significado al editar, recalcular y vincular el pedido. Una revisión de platos se mantiene en un único registro comercial. Las líneas independientes conservan su regla de cantidad.
- Los presupuestos y sesiones anteriores se pueden abrir y continuar. El guardado rápido usa la identidad y la secuencia vigentes. Quitar todos los adicionales vuelve al recorrido de un plato.
- El documento, el ajuste y el presupuesto para compartir muestran el trabajo completo. Los precios históricos y los importes manuales o ya acordados siguen su flujo actual.

## Validación

- [x] Agregar cálculo y persistencia de platos, con regresiones de compatibilidad y agregado.
- [x] Agregar controles, validación, resumen y guardado múltiple en el rápido.
- [x] Continuar los platos en Presupuesto completo, la ficha, el documento y la versión para compartir.
- [x] Verificar escritorio y móvil, pruebas, build y detector. Mantener el preview local listo para probar.
