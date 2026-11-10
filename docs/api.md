# API

La API es same-origin en producción, usa JSON, enums como texto, cookies con `credentials: include`, `ProblemDetails`, `CancellationToken` y límites de 1 a 100 (auditoría hasta 500).

## Rutas

- Salud: `GET /health`.
- Auth: `GET login-options`, `POST login`, `GET me`, `POST logout`, `POST change-pin` bajo `/api/auth`.
- Configuración: `GET/PUT /api/settings`; `GET/POST/PUT /api/pricing-policies`.
- Impresoras: CRUD lógico en `/api/printers`; perfiles en `/api/printers/{id}/energy-profiles` y `/api/energy-profiles/{id}`.
- Tarifas: `GET/POST/PUT /api/electricity-tariffs`.
- Filamentos: `GET/POST/PUT /api/filaments`, `POST /api/filaments/simple`, `PUT /api/filaments/{id}/simple`, movimientos y ajustes.
- Clientes y plantillas: `GET/POST/PUT`; `GET /api/customers/{id}` devuelve nombre, teléfono, email y estado incluso si el cliente está inactivo.
- Cálculo: `POST /api/calculations/quote-preview`, `POST /api/calculations/quick-quote-preview` y `POST /api/calculations/quote-aggregate-preview`.
- Cotizaciones: lista, detalle, create/update, calculate, ready, send, accept, reject, cancel, duplicate, revisión y conversión.
- Trabajos: lista, detalle, create/update, start, complete, fail y cancel.
- Pedidos comerciales: lista, detalle, alta/edición, estado, prioridad y borrador rápido bajo `/api/orders`.
- Reportes: sales, summary, profitability, estimate-vs-actual, material-consumption, printer-utilization y energy-calibration.
- Auditoría: `GET /api/audit` (Owner).

`GET /api/reports/sales` devuelve `currentMonth` en `America/Asuncion`, `totals`, `months` por fecha de entrega y `undated`. Cada grupo contiene `salesGs`, `realizedProfitGs`, `orderCount`, `pricedOrderCount` y `costedOrderCount`. Los meses incluyen `month` en formato `yyyy-MM`. Sólo se cuentan pedidos `Delivered`. Si el trabajo completado vinculado tiene importe real, se usa ese importe. Las demás entregas con precio aportan el total del pedido. La ganancia toma el resultado real de producción o la venta menos `manualActualCostGs` cuando están los dos importes. `costedOrderCount` cuenta entregas con ganancia conocida. `totals` incluye las entregas sin fecha.

El preview resuelve los IDs de catálogo en el servidor; el frontend no puede persistir un resultado arbitrario. El alta técnica de cotizaciones calcula con los costos actuales. El guardado rápido conserva el snapshot calculado por el servidor en la misma operación; editar únicamente sus metadatos conserva ese precio.

Las revisiones nuevas incluyen `aggregate.snapshot` y `aggregate.breakdown`. Este
agregado es el total autoritativo; `lines[].breakdown` contiene asignaciones
determinísticas que reconcilian exactamente precio, impuesto y total. Revisiones
anteriores pueden devolver `aggregate: null` e `isLegacyRevision: true`.

`POST /api/calculations/quote-aggregate-preview` recibe `{ lines: [{ description,
calculation }] }` y devuelve `{ aggregate, lines, canUsePrice, warnings }`. Reutiliza
exactamente la agregación de alta/edición de cotizaciones, sin guardar documentos,
consumir códigos, registrar auditoría o modificar inventario. Requiere la misma
autenticación que los demás previews. Las líneas deben compartir condiciones
globales; los costos `FixedPerOrder` se declaran sólo en la primera. Líneas vacías
o condiciones incompatibles producen un error de validación. El frontend utiliza
`aggregate.breakdown` y el `canUsePrice` superior, sin sumar precios redondeados.

`GET /api/settings` expone readiness específico de los recursos predeterminados:
impresora y costo horario, tarifa y política vigentes, tarifa laboral, setup,
embalaje, filamento activo con costo positivo, perfil compatible y
`quickQuoteReady`. Los nombres anteriores se conservan como aliases de lectura.

La cotización rápida recibe `spoolId`, `printDurationMinutes` y
`totalGrams` para el primer plato. `additionalPlates` es una lista opcional con
los mismos campos para los platos restantes. Cada entrada puede incluir
`repetitions`, un entero positivo con valor predeterminado 1. Tiempo y gramos
corresponden a una impresión del plato. El servidor resuelve los valores
predeterminados y busca un perfil energético activo para cada material. El
cálculo usa el mismo `QuoteCalculationService` del preview completo. La respuesta
de un solo plato incluye `breakdown`, `resolvedAssumptions`, `canUsePrice` y
advertencias estructuradas. Cada cálculo rápido persiste
`calculationContext=QuickQuote` y marca `acceptStandardEnergyFallback` si utilizó
el perfil estándar. Esos campos conservan el tratamiento de la advertencia al
guardar o recalcular.

Con varios platos o un plato repetido, el total autoritativo se devuelve en
`aggregateBreakdown` y `advancedLines` contiene una línea por grupo de platos.
La entrada de un solo plato con una impresión devuelve `breakdown`. Las líneas
con `isPrintPlate` representan platos del mismo trabajo y conservan las
repeticiones en `quantity` con base `PerPlate`. El agregado usa una sola
preparación, un solo embalaje y las condiciones comerciales globales.

La fachada simple de filamentos recibe `material`, `displayName`, `landedCostGs` y
`netWeightGrams`. El backend lo normaliza a PYG sin una segunda conversión y una
edición simple no cambia tracking, stock restante ni estado activo existentes.

Acepta también `manufacturer` opcional (máximo 120 caracteres). Crear sin marca conserva el valor compatible `Sin fabricante`; omitirla al editar conserva la anterior, mientras que enviarla vacía la quita explícitamente. La edición simple conserva un `productName` de variante diferente del color previo; los nombres espejados del flujo simple se actualizan con el nuevo color. No modifica esquema ni aplica un backfill de marcas. El selector visual filtra datos de `GET /api/filaments` en el cliente, pero sólo el `spoolId` elegido se usa para cotizar; los filtros no recalculan.

Las cotizaciones se crean como `Draft`. Sus líneas independientes se pueden editar
con `PUT /api/quotes/{id}` antes del cálculo y envío. Los trabajos admiten
`pause`, `resume`, `fail` y `cancel` mediante transiciones estrictas.

`POST /api/jobs/{id}/complete` recibe el total efectivamente cobrado en
`actualCustomerTotalGs` y su impuesto en `actualTaxGs`; ya no recibe un supuesto
total neto. La respuesta expone total cliente, impuesto, venta neta, comisión
variable, ingreso luego de comisiones, costo, ganancia y margen. Los JSON
históricos con `finalChargedNetGs` se leen de forma compatible como total sin
impuesto; los trabajos pendientes deben completarse con el contrato actual.

## Pedidos comerciales

Separados de `PrintJob`: registrar, confirmar o entregar un pedido no crea producción ni descuenta inventario. La conversión de un presupuesto aceptado sigue vinculando el trabajo técnico al mismo pedido, sin retroceder un estado comercial avanzado.

| Ruta | Contrato |
| --- | --- |
| `GET /api/orders` | `view=active\|drafts\|quoted\|history\|discarded`, `search`, `skip`, `take` (25 predeterminado, 100 máximo). Responde `items`, `total`, `draftCount`, `activeCount`. `drafts`/`discarded` son las bandejas de Presupuestos; `quoted` devuelve presupuestos que ya tienen pedido y excluye altas manuales sin presupuesto. |
| `GET /api/orders/{id}` | Ficha comercial o 404. |
| `GET /api/orders/delivery-details` | `{today, items}` con fecha local de Paraguay y pedidos entregados. Cada fila trae la versión, fecha, importe de venta y los importes de costo manual o producción disponibles. |
| `GET /api/orders/by-quote/{quoteId}` | Registro comercial vinculado al documento, o 404; permite abrir la aceptación o el pedido existente sin buscar por páginas. |
| `POST /api/orders` | `id` GUID del cliente para reintentos, `customerReference`, `description`, `quantity=1`, `totalGs`, `status`, fechas opcionales, `notes`, `historical`. Alta normal Draft/Confirmed; el historial admite datos desconocidos. |
| `PUT /api/orders/{id}` | Mismos datos y `version` vigente; conserva el estado. |
| `PUT /api/orders/{id}/delivery-details` | `{version, deliveredDate, manualActualCostGs}`. Actualiza fecha y costo del pedido entregado. `null` representa un dato desconocido y cero es un costo válido. La versión obsoleta responde 409. Un resultado real de producción conserva su precedencia. |
| `PUT /api/orders/{id}/quote-revision` | `{version, revisionNumber, lines}`. Ajusta el cálculo de un pendiente vinculado y devuelve el mismo pedido. Anexa una revisión utilizable y conserva los importes manuales o divergentes. |
| `POST /api/orders/{id}/quote-price` | `{version, revisionNumber}`. Adopta el total de la revisión guardada vigente como importe comercial del pendiente y devuelve el pedido actualizado. |
| `POST /api/orders/{id}/status` | `{status, version}`. Draft→Confirmed→InProgress→Ready→Delivered; Draft→Discarded→Draft; cancelación de activos. |
| `POST /api/orders/{id}/move` | `{direction: up\|down\|first, version}` o `{direction: position, position, expectedTargetId?, version}`. `position` es el rango final de 1 a la cantidad de pedidos activos, antes de filtrar o paginar. Devuelve el pedido con su rango confirmado. Un rango inválido sin destino esperado da 400. Si cambió la versión o el pedido que ocupaba el destino esperado, da 409. |
| `POST /api/orders/quick` | `{sessionId, sequence, calculation:{spoolId, printDurationMinutes, totalGrams, repetitions?, additionalPlates?}, customerReference?, description?}` → `{preview, order}`. Los platos y sus repeticiones se guardan en la misma revisión y se confirman en el mismo pedido. |

Todas respetan la autenticación configurada. `totalGs` es el total por todo el pedido, sin multiplicar por `quantity`. Para confirmar uno nuevo se exige referencia libre e importe; un histórico incompleto puede guardarse sin inventar valores. `null` en costos o importes desconocidos no representa cero. Fechas comerciales usan días de Paraguay; importar un trabajo previo no inventa fecha de entrega.

En `POST /api/orders`, si `historical` es falso y `orderDate` no viene informado, el servidor usa el día de Paraguay al crear el registro. Un `orderDate` explícito se conserva. El primer guardado de una sesión de `POST /api/orders/quick` y el alta o la duplicación de un presupuesto completo asignan ese día al registro comercial nuevo. Recalcular o confirmar un borrador conserva su `orderDate`.

La interfaz cotidiana presenta Draft como presupuesto pendiente en `/quotes` y confirma mediante la transición del mismo registro. El contrato de alta Draft se conserva por compatibilidad; **Nuevo pedido** crea Confirmed y no muestra una acción de borrador desde cero. No se cambia el esquema ni se migran o borran registros por este ajuste de navegación.

Las rutas conservadas de cancelación/rechazo de cotización archivan su pendiente comercial en una transacción. Si ya existe un pedido confirmado, responden 409 para gestionar su cancelación desde Pedidos. Recuperar un descartado revierte un estado terminal de la cotización a Draft sin recalcularla. Duplicar crea inmediatamente la cotización y su registro comercial vinculado; no necesita reiniciar o importar para aparecer en Presupuestos.

El mismo `sessionId` rápido actualiza un borrador; mismo payload y secuencia es idempotente y una secuencia anterior da 409. Sin precio utilizable se devuelve `order:null`. Un pedido confirmado, descartado o editado fuera del rápido rechaza escrituras de la pestaña anterior. Ediciones normales con versión obsoleta también dan 409; entradas inválidas de pedidos dan 400 y un identificador ausente 404.

`customerReference` e `itemDescription` libres acompañan cotización y revisiones. `PUT /api/quotes/{id}` sincroniza los metadatos con el pedido en una transacción, bloquea la antigua sesión rápida y conserva el desglose si las entradas financieras son iguales. Puede recibir `revisionNumber` para detectar una edición obsoleta. Cambiar entradas crea otra revisión y conserva las anteriores. El importe comercial manual o ya divergente se conserva.

Las acciones de revisión y adopción validan la versión comercial y la revisión documental dentro de la transacción. Una versión o revisión obsoleta devuelve 409. Una revisión utilizable en `Draft` permite marcar el documento `ReadyToSend` con `POST /api/quotes/{id}/ready`, conservando su precio guardado.

Al iniciar, la ampliación de esquema es aditiva y repetible (`OrderSchema`, `PrintCostSchemaVersions`). Vincula las cotizaciones y trabajos anteriores sin duplicarlos, recalcularlos ni consumir inventario. No requiere una migración destructiva de la base existente.
