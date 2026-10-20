# Revisión de usabilidad de pedidos — 2026-10-20

Estado: antecedente histórico de la revisión y de los requisitos ajustados con el usuario, anterior a la implementación. El usuario autorizó ejecutar el plan el 2026-10-20; la gestión comercial está implementada localmente. La revisión final dio **ship** para la tanda de correcciones, con sus siete hallazgos resueltos; no es una segunda auditoría general. Ver [diseño autorizado](../superpowers/specs/2026-10-20-orders-management-design.md) y [registro de implementación y validación](2026-10-20-orders-management.md). No hubo despliegue productivo.

## Necesidad confirmada

El usuario necesita registrar los pedidos que ya realizó y los que tiene pendientes, y consultar su situación con facilidad. Actualmente usa exclusivamente la cotización rápida. La calculadora avanzada es poco práctica y queda como pendiente prioritario después de pedidos. Se conserva la identidad de craf3D: crema, naranja quemado, ámbar, Chakra Petch, logo y controles rectos.

El usuario confirmó que la información varía y debe poder completarse después. Ajustó el recorrido solicitado: el presupuesto rápido debe quedar automáticamente como pedido en Borrador antes de Confirmado; se debe poder descartar con un botón si no se acepta y ordenar manualmente la prioridad de los pedidos. Al confirmar se pueden exigir los datos faltantes necesarios.

Cliente/referencia será un campo libre, sin un paso de alta en el catálogo. Debe aparecer también en el presupuesto, junto con una descripción opcional de lo que se presupuesta imprimir. Se conserva la generación de pedido desde presupuesto.

El usuario confirmó además el alta independiente de la calculadora: cuando el precio se fija manualmente, se debe poder crear el pedido directamente, sin generar un presupuesto. Se incorpora como un recorrido principal de Pedidos.

El criterio de éxito es poder cargar un trabajo conocido directamente, encontrar qué falta hacer o entregar y actualizarlo sin reconstruir un presupuesto ni completar una ficha técnica de impresión.

## Qué se revisó

- Lista y detalle de pedidos, recorrido desde presupuestos, navegación móvil y guardado desde cotización rápida.
- Contratos de aplicación/API, persistencia SQLite, transiciones, consumo de inventario y consumidores de reportes.
- Interfaz publicada en `https://craf3d.crg-dev.com`, en 1440×1000 y 390×844. Todas las solicitudes `/api/**` se sustituyeron por datos sintéticos, con escrituras bloqueadas. No hubo una sesión real ni modificaciones en producción.
- Cuatro capturas y resultados de inspección en `.artifacts/orders-review/`, excluidos de Git. Se inspeccionaron visualmente la lista de escritorio y el detalle móvil. No se modificó producto durante la revisión.

## Hallazgos anteriores al incremento

Los comportamientos de esta sección corresponden al producto revisado inicialmente; se conservan como evidencia de la necesidad, no como descripción de la implementación local posterior.

| Impacto en el uso | Comportamiento comprobado | Origen |
| --- | --- | --- |
| Cargar un pedido implica recorrer presupuestos | No hay acción «Nuevo pedido». El backend solo permite convertir una cotización aceptada. Desde el borrador rápido hay pasos de calcular, dejar listo, enviar, aceptar y convertir. | `web/src/screens/ResourceScreens.tsx`, `src/PrintCost.Application/Quotes/QuoteWorkflowService.cs`, `src/PrintCost.Api/Endpoints/QuoteEndpoints.cs` |
| Registrar trabajos anteriores requiere inventar un recorrido actual | La creación y el cierre utilizan la fecha actual. No hay carga histórica directa ni fecha comercial editable. | `QuoteWorkflowService.cs`, `PrintJobRecord` |
| La lista no ayuda a decidir qué atender | Mezcla estados, carece de búsqueda y filtros, y muestra únicamente trabajo, fecha de creación, estado e importe. Faltan cliente y entrega prevista. | `JobListScreen`, `JobSummary` |
| El historial quedaría incompleto al crecer | La pantalla solicita los primeros 50 pedidos y no ofrece paginación. La API admite hasta 100 por solicitud; aumentar ese número fijo no resuelve el problema. | `JobListScreen`, `QuoteEndpoints.cs`, `PrintCostRepository.ListJobsAsync` |
| Terminar un pedido exige conceptos de costos | Solo desde «Imprimiendo» o «Pausado» se abre el cierre, con horas, kWh, intentos, filamentos, trabajo, consumibles, costos generales, precio e impuesto. En móvil ocupa varias pantallas. | `JobDetailScreen`, `QuoteWorkflowService.CompleteJobAsync` |
| «Terminado» no acredita entrega al cliente | Los estados representan producción. No hay una fecha de entrega ni un dato que confirme entrega o cobro. | `PrintJobStatus`, `PrintJobEntity` |
| Falta una ficha comercial editable | No hay edición general de descripción, cliente, importe o fechas. El endpoint de notas solo modifica `ActualInput` cuando ya existe. | `PUT /api/jobs/{id}`, `JobNotesRequest` |
| Pedidos resulta menos accesible en móvil | Está dentro de «Más», mientras la cotización y los presupuestos tienen acceso directo. | `AppShell.tsx` |
| Un fallo de carga puede parecer falta de pedidos | La lista parte vacía y no distingue carga de estado vacío. Muestra el aviso de error junto con el mismo vacío. | `JobListScreen`, `ListPage` |

La inspección de navegador confirmó ausencia de búsqueda, filtros, alta directa y acceso móvil directo, además de la extensión del cierre técnico. No se detectó desbordamiento horizontal en los dos tamaños inspeccionados. Los hallazgos de persistencia y paginación provienen de lectura de código.

## Alternativas consideradas

| Enfoque | Ventaja | Alcance y límite |
| --- | --- | --- |
| Optimizar el recorrido actual de presupuestos y producción | Mantiene los contratos actuales y permite mejorar navegación, filtros y presentación. | Sigue necesitando una estimación completa para todo pedido; la carga histórica requiere un recorrido adicional. |
| Incorporar registro directo y una gestión comercial simple, con producción y costos opcionales | Resuelve la carga histórica y el seguimiento diario, y permite conservar los cálculos existentes cuando están disponibles. | Requiere evolucionar datos y API, con compatibilidad para los pedidos actuales. Es la opción recomendada. |
| Organizar un tablero completo de producción, cobros e inventario | Permite planificar máquinas, entregas y pagos en un mismo sistema. | Introduce varias reglas nuevas y más controles. Se puede evaluar después del registro y seguimiento básicos. |

## Recorrido ajustado

El detalle completo y los criterios de implementación están en el [diseño de pedidos](../superpowers/specs/2026-10-20-orders-management-design.md). Esta revisión conserva los hallazgos del producto anterior; el diseño recoge el recorrido ajustado que se autorizó implementar.

### Presupuesto rápido y borrador

- Cliente/referencia libre y descripción opcional en el cotizador y el presupuesto.
- Guardado automático de un borrador por cotización en edición. Cambiar gramos o tiempo actualiza el mismo borrador; **Nuevo cálculo** conserva el anterior y empieza otro.
- Estado visible de guardado y acceso al borrador. No mostrar «Guardado» antes de confirmación del servidor; reintentos y respuestas tardías no pueden duplicarlo ni revertirlo.
- Los cambios de datos comerciales no recalculan el precio. El importe mostrado y su versión guardada deben ser consistentes.

En el código revisado inicialmente, **Guardar presupuesto** ya persistía una cotización con `QuoteStatus.Draft`; después se mostraba un mensaje, pero el registro no aparecía en Pedidos. Esto acreditaba una separación del recorrido, no una pérdida de datos confirmada. El requisito fue mantener visible lo presupuestado y sus vínculos.

### Gestión cotidiana

- Vistas propuestas: **Borradores**, **Confirmados** e **Historial**, con búsqueda y paginación de todo el conjunto.
- **Nuevo pedido** abre una ficha comercial con importe total manual. Permite crear directamente un Confirmado si tiene los mínimos, o Guardar borrador si faltan datos, sin calcular ni crear un presupuesto.
- Borradores con acciones **Completar**, **Confirmar pedido** y **Descartar**. Descarte directo y recuperable, sin eliminación física de la información.
- Confirmación breve. Mínimos propuestos para un pedido nuevo: referencia libre, importe acordado informado y cantidad válida con inicial 1. Descripción, fecha de entrega y datos técnicos siguen opcionales.
- La cola activa usa prioridad manual persistente. Fechas y avisos de atraso no sustituyen el orden elegido. Controles de Subir, Bajar y Poner primero, también utilizables en móvil/teclado.
- Secuencia propuesta: **Borrador → Confirmado → En proceso → Listo para entregar → Entregado**. Los estados posteriores a Confirmado y la composición de vistas se revisan como parte del diseño escrito.
- Registro directo e histórico con datos parciales, fechas conocidas y edición posterior. No exige simular el recorrido de un pedido nuevo ni tener una estimación.

### Compatibilidad y significado de los datos

- El pedido comercial puede existir sin un trabajo técnico de impresión. Presupuesto/revisión y producción se vinculan cuando existen; una conversión no crea un duplicado del borrador.
- El importe manual es el total acordado: no se multiplica por cantidad ni recibe márgenes o redondeos del calculador. El pedido manual no exige ni genera un presupuesto y utiliza la misma cola y seguimiento.
- Conservar presupuestos, cálculos y clientes del catálogo ya existentes, con lectura compatible. Los nuevos datos cotidianos de cliente se escriben libremente.
- Una producción terminada no acredita entrega o cobro. Un importe acordado tampoco acredita pago.
- Un costo desconocido permanece desconocido; la ganancia queda sin calcular. Registrar historia no consume stock actual ni aplica tarifas actuales a ventas pasadas.
- Las revisiones históricas conservan su información. La autoridad del backend, los ajustes productivos y el resultado rápido auditado de Gs.60.000 se mantienen.

## Alcance de la definición y seguimiento

Los requisitos de alta manual independiente de presupuesto, borradores, prioridad y cliente libre fueron confirmados por el usuario. La especificación propuso los mínimos de confirmación, las vistas y una separación entre registro comercial y producción, para evitar fabricar estimaciones cuando faltan datos. Después de esta definición se preparó el [plan](../superpowers/plans/2026-10-20-orders-management.md), autorizado el 2026-10-20 e implementado localmente. El estado y la evidencia posteriores se registran en [gestión de pedidos](2026-10-20-orders-management.md).

Este incremento no incorpora señas/cobros, facturación ni planificación de máquinas. La calculadora avanzada sigue como pendiente prioritario posterior. Durante esta revisión y definición inicial no se modificaron código de producto, base de datos, servicios ni despliegue; esa afirmación describe la fase inicial, no la implementación local posterior.
