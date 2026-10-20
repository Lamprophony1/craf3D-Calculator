# Revisión funcional de craf3D Calculator

Fecha: 2026-10-20, America/Asuncion. Pedido: revisar el software tras un período sin desarrollo, priorizando la exactitud de las cotizaciones que ya se usan en producción.

## Resultado

La cotización real aportada por el usuario —PLA Creality blanco, 131,04g y 3h40m, Gs.60.000— coincide con el motor y los ajustes vigentes de producción. No se encontraron discrepancias en 2.494 comprobaciones independientes de importes y en 91 comprobaciones de las siete revisiones guardadas.

Se confirmaron tres errores de prioridad alta en los recorridos de la calculadora avanzada, un defecto de asignación de impuestos entre líneas para importes pequeños y una ausencia de copias en la carpeta prevista para backups. Los errores de UI permiten que el importe comunicado no corresponda a las entradas actuales aunque el motor calcule correctamente.

Esta entrega documenta la revisión. Los errores identificados todavía requieren corrección; no se cambiaron componentes, fórmulas, configuración comercial ni registros de producción.

## Versión y método

- Producción: `https://craf3d.crg-dev.com/`, contenedor `printcost`.
- Imagen instalada: `ghcr.io/lamprophony1/craf3d-calculator:b225e80d3afae2dce9b17afc554fdebcecc52891`.
- El commit coincide con el HEAD local revisado. JavaScript `index-DI33RpjO.js` y CSS `index-B3IAEikA.css` públicos coinciden por SHA-256 con el build local.
- Se revisaron fórmulas de dominio, resolución de catálogos, cotizador rápido/avanzado, guardado/agregación, snapshots, resultados de trabajos, avisos, cliente HTTP, PWA y recorridos existentes de navegador.
- Se ejecutó un verificador separado con cálculos decimales y fórmulas independientes; también se ejercitó `QuoteCalculationService` y el guardado en un repositorio en memoria.
- La reproducción de errores de UI usó el frontend publicado, con **todas las llamadas `/api/**` interceptadas** y datos sintéticos. No representa una sesión autenticada real ni creó presupuestos productivos.
- Tras autorización expresa del usuario para consultar la VM, se accedió a SQLite con `mode=ro`, `PRAGMA query_only=ON` y transacciones de lectura. Sólo se devolvieron valores comerciales necesarios y resúmenes de comprobaciones. No se extrajeron credenciales, clientes ni snapshots completos; éstos se comprobaron dentro de la VM.

## Caso real y ajustes comprobados en la VM

| Parámetro | Valor vigente |
| --- | ---: |
| Rollo Creality blanco | Gs.132.000,01 / 1.000g |
| Impresora | Gs.2.000/h, modo horario manual |
| Perfil energético PLA | 95W promedio |
| Electricidad | Gs.435,51/kWh |
| Preparación | 30min por pedido |
| Trabajo manual | Gs.10.000/h |
| Embalaje | Gs.1.500 |
| Probabilidad de falla | 10%, intentos esperados |
| Costos generales | 5% |
| Margen objetivo / mínimo | 40% / 30% |
| Pedido mínimo | Gs.10.000 |
| Redondeo | Hacia arriba, múltiplos de Gs.10.000 |
| Comisiones e impuestos | Deshabilitados/cero |

El registro del rollo contiene Gs.132.000,01; la diferencia de Gs.0,01 frente al dato comunicado de Gs.132.000 no cambia el precio final.

Para 131,04g y 220min:

| Concepto | Gs. aproximados |
| --- | ---: |
| Material | 17.297,28 |
| Electricidad | 151,70 |
| Máquina | 7.333,33 |
| Preparación | 5.000,00 |
| Embalaje | 1.500,00 |
| Reserva por fallas | 2.753,59 |
| Costos generales | 1.701,80 |
| Costo completo | **35.737,70** |
| Precio antes del redondeo | **59.562,84** |
| Precio final | **60.000,00** |

La preparación y el embalaje no se repiten por falla. La reserva se aplica a material, energía y máquina. El margen se obtiene dividiendo el costo completo por `1 - 0,40`, y luego se redondea hacia arriba a Gs.10.000. Ganancia estimada: Gs.24.262,30; margen resultante: 40,44%.

El primer contraste con los ajustes recomendados daba Gs.65.000 porque asumía preparación de20min a Gs.20.000/h, embalaje deGs.2.000 y redondeo deGs.5.000. Esos valores **no son** los configurados por el usuario. No corresponde cambiarlos automáticamente.

La comprobación ejecuta el servicio de aplicación local con los valores numéricos consultados en producción y contrasta el resultado con una fórmula independiente. No se hizo un POST autenticado a la API productiva.

## Hallazgos que deben corregirse

### 1. Prioridad alta: un precio anterior sigue disponible después de editar

Código: `web/src/screens/CalculatorScreen.tsx`, cálculo en línea144, actualizaciones en174 y copia en180.

Reproducción: calcular142g, editar a300g y pulsar Copiar precio sin recalcular. La pantalla y el portapapeles conservan el precio de142g. Si el nuevo cálculo falla, el precio anterior también permanece disponible. Una respuesta pendiente tampoco se vincula a una versión de las entradas.

Con un fixture de configuración recomendada, el precio anterior es Gs.75.000 y el correspondiente a300g es Gs.115.000; el frontend publicado permitió copiar Gs.75.000 con300g visibles. Los importes de este ejemplo son de prueba y no sustituyen la configuración productiva anterior.

Corrección necesaria: invalidar el resultado al cambiar entradas económicas, antes de un nuevo cálculo y ante error; aceptar respuestas sólo para las entradas que las originaron. Copiar/compartir deben exigir un resultado vigente.

### 2. Prioridad alta: pasar de rápido a avanzado mezcla cotizaciones

Código: `web/src/screens/CalculatorScreen.tsx:29`, especialmente la mezcla de `...restored` en47.

`initialDraft` conserva cantidad, unidades por placa, base por unidad/placa, espera, kWh medidos y energías adicionales de un borrador avanzado previo, porque no restaura todos los campos del request rápido. También puede conservar líneas independientes antiguas.

Reproducción: dejar un borrador de10unidades con4kWh medidos; calcular una pieza en la pantalla rápida; abrir Necesito ajustar algo. La solicitud avanzada lleva10unidades y4kWh en lugar de1unidad y consumo estimado. La prueba con el servicio da Gs.75.000 para el request rápido y Gs.625.000 para la combinación heredada.

Corrección necesaria: importar el request completo sobre un estado limpio y separar metadatos que realmente deban conservarse. La primera previsualización avanzada debe equivaler al cotizador rápido antes de cualquier edición.

### 3. Prioridad alta: el preview de un presupuesto multilínea sólo calcula la primera línea

Código: `web/src/screens/CalculatorScreen.tsx:125`, `:144` y `:151`.

Calcular con el servidor envía un único `QuotePreviewRequest`. Las líneas adicionales se incorporan únicamente al guardar mediante `CreateQuoteRequest.Lines`. Por eso la pantalla y Copiar precio representan una línea, mientras el guardado recalcula un importe agregado distinto.

Reproducción: abrir Presupuesto completo, agregar una segunda línea y calcular. Se capturó un preview de una línea y un guardado de dos. Con el fixture recomendado, el preview muestra Gs.75.000; la agregación correcta del servicio para las dos líneas da Gs.135.000, aplicando preparación, embalaje, mínimo y redondeo una sola vez.

Corrección necesaria: usar la misma agregación para preview y guardado, sin persistir una cotización sólo para mostrar un precio y sin sumar precios individuales ya redondeados. Las acciones para el cliente deben usar el agregado vigente.

### 4. Prioridad media: el reparto de redondeos puede generar impuestos negativos

Código: `src/PrintCost.Domain/Pricing/PricingCalculator.cs:513`.

`AllocateExact` redondea cada asignación previa al guaraní y coloca todo el residuo en la última línea. Con cuatro líneas iguales, precio neto total deGs.20 e impuesto externo de10%, reparte los Gs.2 de impuesto como `[1,1,1,-1]`. El agregado conserva Gs.22 y `CanUsePrice=true`, pero una línea tiene impuesto negativo.

Es un caso límite confirmado de importes pequeños; no se observó en las siete revisiones productivas. Corrección necesaria: una distribución de residuos que preserve el total exacto y la no negatividad de las asignaciones para totales y pesos no negativos.

### 5. Operación: la carpeta prevista de backups está vacía

`/opt/printcost/backups` existe pero tiene0entradas. `systemctl list-unit-files 'printcost*'` no encontró unidades dedicadas. El repositorio dispone de un script de backup, pero eso no acredita su ejecución periódica.

No se inspeccionaron respaldos externos o snapshots generales de la VM; no se afirma que no existan. Antes de ampliar el uso, corresponde comprobar un respaldo consistente y una restauración aislada. No se crearon backups ni se cambiaron servicios durante la revisión.

## Verificación de datos existentes

- Dos cotizaciones, siete revisiones, un trabajo y un movimiento de inventario registrados.
- Siete revisiones comprobadas dentro de la VM:91 controles de costos directos, electricidad, máquina, costos completos, ganancias, totales de cliente, material y conciliación de agregados. Cero discrepancias con tolerancia deGs.0,000001.
- Cero rollos con inventario negativo.
- SQLite `PRAGMA integrity_check`: `ok`; `PRAGMA foreign_key_check`: cero infracciones.
- No se reinterpretaron ni reescribieron precios históricos. Estos controles prueban consistencia aritmética de los snapshots guardados; no certifican que cada dato físico cargado por un usuario haya sido correcto.

## Pruebas y cobertura

| Comprobación | Resultado |
| --- | --- |
| Backend: Domain / Application / Infrastructure / API | 32 + 25 + 6 + 9 = **72 correctas** |
| Frontend Vitest | **88 correctas**,13archivos |
| Navegador Playwright existente | **21 correctas** |
| TypeScript y build Vite | Correctos |
| Verificador independiente | **2.494 comprobaciones correctas** |
| Importes históricos en producción | **91 comprobaciones correctas** |
| Reproducciones adicionales | Tres errores de UI y reparto negativo confirmados |

Los escenarios del verificador incluyen variaciones de costo del rollo, gramos, duración, mínimos, redondeo, cantidades, placas, margen, comisiones e impuestos incluidos/externos. La suite existente usa mocks en navegador y no cubría los tres recorridos avanzados anteriores; que esté verde no invalida esos hallazgos.

El cotizador rápido sí elimina su resultado inmediatamente al cambiar gramos, también sin conexión. Al perder conexión sin editar, conserva el precio previo y las acciones de copiar/compartir pese al aviso de no verificación; es una inconsistencia secundaria de estado, diferente de reutilizar un precio para nuevas entradas.

La base local antigua `printcost.db` no tiene el esquema de defaults actual. Se detectó mediante lectura y no se modificó; no se usó como sustituto de la configuración productiva. Las suites de persistencia/API utilizan bases de prueba aisladas.

## Evidencia y alcance de los cambios

Evidencia privada en `.artifacts/calculator-audit/`: verificador C#, scripts de consulta de lectura, resúmenes numéricos de producción, logs de pruebas, solicitudes sintéticas del navegador y capturas. No versionar esta carpeta. La exportación integral de snapshots fue rechazada por la revisión automática; se sustituyó por comprobaciones dentro de la VM y resultados agregados.

Se comprobaron los hashes de los133archivos de producto, pruebas, CI y despliegue registrados antes de la migración de herramientas: todos permanecen intactos. Los cambios anteriores de herramientas UI/UX se conservan. Esta revisión sólo agrega documentación y diagnóstico privado; no publica una corrección.

Actualización de prioridad por decisión del usuario del 2026-10-20: actualmente utiliza exclusivamente la cotización rápida y solicita atender primero la gestión de pedidos. La mejora de la calculadora avanzada queda como pendiente prioritario después de ese incremento; conserva los tres errores confirmados de preview/importación/multilínea y el caso límite del reparto de impuestos. Al retomarla, incorporar regresiones y comprobar equivalencia entre preview, copia y guardado. Revisión del nuevo frente en [gestión de pedidos](2026-10-20-orders-ux-review.md). La comprobación de respaldos continúa pendiente de operación.
