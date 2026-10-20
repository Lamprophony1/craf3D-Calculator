# Pedidos: alta directa, borradores desde cotización rápida y prioridad manual

Estado: ejecución autorizada por el usuario el 2026-10-20 («avanzá con plan aprobado»), incluyendo el alta manual independiente. Implementación local verificada; sin despliegue productivo. Resultados y límites en [el registro del incremento](../../changes/2026-10-20-orders-management.md).

## Objetivo y decisiones del usuario

**Ajuste posterior del usuario, 2026-10-20:** Presupuestos representa el borrador pendiente de aceptación; confirmar lo pasa al mismo pedido en Pedidos. Pedidos sólo contiene confirmados e historial, sin un alta manual de borrador. Nuevo pedido sigue permitiendo un precio ya acordado sin calculadora. Este ajuste prevalece sobre la ubicación de Borradores/Descartados en Pedidos y la acción Guardar borrador manual propuestas más abajo. Implementación y validación en [aceptación de presupuestos](../../changes/2026-10-20-budget-acceptance.md).

Registrar y encontrar rápidamente lo presupuestado, lo confirmado, los trabajos pendientes y lo ya realizado. El usuario usa la cotización rápida y necesita completar información faltante después. La mejora avanzada queda como pendiente prioritario posterior.

Requisitos expresos:

- Una cotización rápida generada debe quedar como pedido en **Borrador**, antes de confirmarse.
- El borrador requiere pocos datos, se puede completar después y se puede descartar rápidamente con un botón si no se acepta.
- Al confirmar se pueden exigir los datos faltantes necesarios para gestionar el pedido.
- Se debe poder ordenar manualmente la prioridad de los pedidos.
- **Cliente / referencia** es texto libre, sin alta previa en un catálogo. Se incluye también en el presupuesto.
- **Qué se va a imprimir** es una descripción opcional que acompaña al presupuesto.
- Se conserva el recorrido para generar un pedido desde un presupuesto y la posibilidad de registrar trabajos anteriores.
- También se pueden crear pedidos directamente, con un precio acordado manualmente, sin usar la calculadora ni generar un presupuesto. Este es un origen de pedido independiente, no un paso previo a cotizar.

La identidad visual existente es autoridad: paleta crema/naranja/ámbar, Chakra Petch, logo y controles rectos. Se extienden los componentes actuales.

## Recorrido de uso

### 1. Cotizar y conservar el borrador

El formulario rápido conserva filamento, horas/minutos y gramos como datos del cálculo. Incorpora dos campos comerciales: **Cliente / referencia** y **Qué se va a imprimir (opcional)**. Ambos pueden estar vacíos mientras es un borrador.

Un cálculo válido generado por la interacción del usuario guarda automáticamente un borrador en el servidor. La respuesta muestra el precio y un estado explícito: **Guardando borrador…**, **Borrador guardado · Abrir** o **No se pudo guardar · Reintentar**. El guardado no exige pasar por un formulario adicional. Una restauración pasiva de entradas antiguas sin una sesión de cotización guardada no crea pedidos por sí sola; al editar, calcular o emitir ese presupuesto comienza el guardado.

Una misma cotización en edición representa **un solo pedido en borrador**. Los cambios de gramos, tiempo, filamento o datos comerciales lo actualizan sin crear otra fila en Pedidos. **Nuevo cálculo** conserva el borrador anterior y empieza otra cotización. La identidad de esta sesión debe sobrevivir una recarga; pestañas independientes no sobrescriben sus cotizaciones.

Las respuestas tardías y los reintentos no pueden reemplazar la última versión ni duplicar el pedido. Si el borrador se confirmó o descartó desde otra pantalla, no se vuelve a abrir ni se modifica automáticamente desde el cotizador: se informa la situación y se permite comenzar otro.

Guardar conserva el cálculo autoritativo del backend y los datos comerciales. Un precio enviado al cliente debe seguir disponible en su revisión; actualizar el borrador no sobrescribe las revisiones históricas. No recalcular dos veces, con ajustes potencialmente distintos, para mostrar un precio y guardar otro.

Editar únicamente cliente/referencia o descripción no recalcula el precio. Estos cambios guardan los datos comerciales del borrador y del presupuesto vinculado de forma consistente.

Los campos comerciales aparecen también en la presentación del presupuesto, texto completo para copiar/compartir y documento de cliente cuando estén informados. La descripción sigue siendo opcional. La acción existente **Copiar precio** puede conservar su formato breve. Emitir un presupuesto debe conservar su versión guardada y no obligar a avanzar por estados técnicos.

### 2. Encontrar, confirmar o descartar

Pedidos ofrece **Borradores**, **Confirmados** e **Historial**, con búsqueda por referencia, descripción o código. Los confirmados activos son la vista de trabajo; Borradores muestra su cantidad y un acceso visible para revisar presupuestos aún sin aceptación.

Cada borrador muestra cliente/referencia cuando exista, descripción opcional, importe y última actualización. Si falta un nombre identificable, el código generado permite abrirlo. Acciones: **Completar**, **Confirmar pedido** y **Descartar**.

**Descartar** es una acción directa que archiva el borrador, sin borrarlo físicamente ni consumir inventario. Sale de los listados activos y se puede recuperar desde Descartados. No inicia, cancela ni repite trabajos de producción existentes.

**Confirmar pedido** muestra una ficha breve con los datos conocidos. Se propone exigir únicamente:

- Cliente / referencia no vacío: puede ser un nombre, alias o identificación útil para el taller.
- Importe total acordado informado y no negativo; desconocido se distingue de cero.
- Cantidad válida, con valor inicial 1.

No exige registro de cliente, descripción, fecha de entrega, mediciones eléctricas, costos, filamento o tiempo adicional. La fecha prevista y las notas son opcionales. Confirmar coloca el pedido en la cola de trabajo sin iniciar la impresión ni registrar un pago.

Los datos comerciales se pueden completar o corregir después, con trazabilidad y sin reescribir los cálculos históricos. Los registros anteriores no se invalidan por reglas de alta nuevas.

### 3. Ordenar y seguir el trabajo

La cola de confirmados tiene un **orden manual persistente**, compartido entre usuarios y dispositivos. Las fechas de entrega y avisos de atraso ayudan a decidir, pero no cambian por detrás el orden elegido.

Cada pedido ofrece **Subir**, **Bajar** y **Poner primero**, utilizables con teclado y en móvil. Arrastrar puede evaluarse como mejora posterior; no es necesario para completar este incremento. El servidor aplica el movimiento dentro de toda la cola, no solo entre las filas descargadas o visibles tras una búsqueda.

Estados cotidianos propuestos: **Borrador → Confirmado → En proceso → Listo para entregar → Entregado**. Descartado pertenece a los borradores no aceptados; Cancelado corresponde a un pedido confirmado que se cancela. Las pausas y fallas existentes permanecen en el detalle de producción, sin obligar a completar una ficha técnica para gestionar la entrega.

El detalle prioriza cliente/referencia, descripción, cantidad, importe, fechas y notas. Presupuesto de origen, producción y costos quedan en secciones secundarias. Un importe acordado o una entrega no acreditan cobro.

### 4. Nuevo pedido directo con precio acordado

Pedidos ofrece **Nuevo pedido**, independiente del cotizador. Abre una ficha breve con cliente/referencia libre, descripción opcional, cantidad inicial 1 e **Importe total acordado (Gs.)** editable. Fecha de entrega y notas son opcionales.

Dos acciones permiten resolver el alta en esa misma ficha:

- **Crear pedido:** si están informados los mínimos de confirmación, guarda directamente en **Confirmado** y al final de la cola de trabajo. No exige guardar primero un borrador ni pasar por el proceso de presupuesto.
- **Guardar borrador:** conserva los datos disponibles cuando falta información, para completarlos y confirmar después.

El importe es el total por todo el pedido, no un precio unitario: indicar cantidad 3 e importe Gs.100.000 conserva un total de Gs.100.000. No multiplicar ese importe automáticamente, aplicar márgenes, redondeos o reemplazarlo por un cálculo de impresión. Se aplican las mismas validaciones de importe informado y no negativo.

El pedido manual participa en la misma lista, prioridad, edición y seguimiento que los pedidos procedentes de presupuesto. No requiere impresora, filamento, gramos, tiempo o costos. Su alta no genera una cotización ni un trabajo técnico ficticio y no consume inventario. Sin costos conocidos, su ganancia permanece **Sin calcular**.

### 5. Trabajos anteriores

**Registrar trabajo anterior** permite indicar el estado y las fechas realmente conocidas, sin reproducir las transiciones de un pedido nuevo. En historia se admiten datos desconocidos y se completan después; no se exige inventar un cliente, un costo o una fecha.

La fecha técnica de alta es distinta de la fecha del trabajo. La carga histórica no descuenta stock ni usa tarifas actuales para reconstruir una ganancia pasada. Si faltan costos, la ganancia se muestra **Sin calcular**. Terminado en producción y entrega confirmada se mantienen separados para los registros existentes.

## Arquitectura y compatibilidad

### Registro comercial separado del trabajo técnico

Introducir un registro comercial de pedido en Application/Infrastructure, con referencia libre, descripción opcional, cantidad, importe acordado nullable, estado, fechas conocidas, notas, posición de cola y versión de concurrencia. Puede vincular un presupuesto/revisión y un trabajo de impresión existentes; ambos vínculos son opcionales y cada origen admite un único pedido comercial.

Esta separación evita fabricar estimaciones o impresoras para registrar un borrador o un trabajo histórico. `PrintJob` sigue representando la producción y sus costos reales; el motor decimal conserva su autoridad. El estado comercial no se deduce de la presencia de costos.

El servicio de pedidos gestiona alta parcial, alta manual directamente confirmada, edición, confirmación, descarte/recuperación y prioridad. La creación manual valida los datos comerciales y guarda el registro de forma atómica, sin invocar el calculador ni crear un presupuesto o trabajo de impresión. El origen manual queda identificable y sus vínculos de presupuesto/producción pueden permanecer nulos durante todo el recorrido.

La generación rápida coordina el cálculo y la persistencia del presupuesto con su borrador mediante una operación consistente. La sesión de cotización y su versión sirven para idempotencia y protección frente a respuestas fuera de orden.

### Presupuestos y cliente libre

Extender los contratos y persistencia de presupuestos con una referencia de cliente en texto y la descripción opcional, sin hacer obligatorio `CustomerId`. Los registros existentes que usan un cliente del catálogo siguen mostrando su nombre como fallback. El nuevo recorrido diario utiliza el campo libre.

En un borrador vinculado, el guardado de los datos comerciales desde cotización o Pedidos mantiene coherentes el presupuesto y su referencia, sin duplicar el pedido. Emitir una nueva versión conserva los datos y precios de las versiones anteriores. No volver a consultar un catálogo como requisito para escribir o emitir un presupuesto.

La conversión existente desde un presupuesto aceptado conserva su funcionalidad. Debe vincular el pedido comercial asociado, si ya existe, en vez de crear un segundo pedido. Reintentar no puede duplicar el trabajo de producción. Confirmar un borrador comercial no necesita simular las transiciones Calculado/Listo/Enviado del flujo técnico de presupuestos.

### Datos existentes y evolución de esquema

Preparar una actualización aditiva y versionada, verificable contra el esquema anterior y contra una base nueva. Conserva presupuestos, revisiones, trabajos, importes y movimientos existentes. Vincula cada presupuesto/trabajo vigente con un único registro comercial, respetando el estado que realmente se conoce.

Los presupuestos previos en Draft/Calculated/ReadyToSend/Sent se incorporan a Borradores; Accepted pasa a Confirmado, y Rejected/Expired/Cancelled se conserva archivado con su motivo, fuera de Borradores activos. ConvertedToJob se vincula al pedido de su trabajo en vez de crear otra oportunidad.

Para trabajos existentes: Planned corresponde a Confirmado; Printing/Paused, a En proceso con su condición de producción; Completed, a Listo con **Entrega sin registrar**; Cancelled, a Cancelado. Failed conserva la falla y queda en Confirmados con **Revisar producción fallida**, sin presumir cancelación comercial o entrega. Las fechas comerciales desconocidas permanecen sin informar. La actualización debe ser repetible sin duplicación y mantener integridad referencial.

El despliegue y la aplicación de cambios en la VM quedan fuera de la ejecución local. Las consultas previamente autorizadas siguen siendo de lectura.

## Errores, carga y accesibilidad

- Diferenciar cargando, vacío, fallo, guardado y éxito. Ante error, conservar entradas y ofrecer reintento.
- Sin conexión, conservar el borrador local y mostrar **Pendiente de guardar**; no afirmar que existe en el servidor. El reintento mantiene la misma identidad y necesita una sesión verificada.
- Una actualización concurrente no sobrescribe cambios ajenos silenciosamente. Al reordenar, aplicar la posición que el servidor confirme y conservar el orden previo ante fallo.
- Bloquear dobles envíos mientras se confirma, descarta o registra un trabajo anterior. La idempotencia también debe existir en servidor.
- Búsqueda y paginación abarcan todo el conjunto guardado. Después de mover un pedido, su posición global sigue siendo la referencia aunque haya filtros.
- Nombres accesibles en acciones por fila, foco visible y retorno de foco donde corresponda. Confirmación no depende solo de color; controles utilizables con teclado y en móvil.

## Alcance

Incluye alta de pedidos con precio manual y sin presupuesto, integración del cotizador rápido, cliente libre en presupuesto/documento, borradores y confirmación, descarte/recuperación, cola manual, registro histórico y compatibilidad con la conversión existente. Reutiliza componentes y estilos; no incorpora una librería UI ni una plataforma nueva.

La mejora de la calculadora avanzada, señas/cobros, facturación y planificación de impresoras no forman parte de este incremento. La descripción de lo presupuestado permanece opcional.

## Validación requerida

1. Un cálculo rápido válido crea un borrador; diez ediciones sucesivas actualizan ese mismo registro. Nuevo cálculo crea otro sin perder el anterior.
2. Recargar, reintentar después de una respuesta perdida y recibir respuestas fuera de orden no duplica ni revierte el borrador. Una pestaña no pisa otra.
3. Cliente libre y descripción opcional se guardan y figuran en el presupuesto/documento, sin alta de cliente. Referencias antiguas del catálogo siguen legibles.
4. El borrador admite información parcial. Confirmar solo exige los mínimos indicados y muestra los errores junto a los campos. Descartar es rápido, recuperable y no tiene efectos de inventario.
5. Prioridad manual persiste al recargar y desde otra sesión; funciona con teclado/móvil y con más de una página de resultados. Un filtro no limita indebidamente la cola reordenada.
6. Convertir un presupuesto con borrador asociado produce un único pedido vinculado; el doble envío no duplica producción ni consumo.
7. Un trabajo anterior con datos incompletos conserva sus fechas conocidas, no altera stock y no recibe ganancias ficticias.
8. La actualización de esquema conserva las relaciones e importes anteriores y es idempotente. Los presupuestos ya convertidos no aparecen duplicados en Borradores.
9. Las pruebas afectadas de backend/frontend, tipos/build y recorridos en navegador verifican carga, errores, descarte, confirmación y prioridad. Se mantiene el caso auditado de Gs.60.000 con los ajustes productivos.
10. Crear un pedido manual confirmado con cantidad 3 e importe total Gs.100.000 conserva exactamente ese importe y entra en la cola. No invoca el calculador, no crea presupuesto ni trabajo técnico y no modifica inventario. La misma ficha permite guardar un borrador incompleto y completarlo después.

## Ejecución autorizada

El usuario autorizó avanzar con el plan e indicó dejar siempre levantados los servicios locales al finalizar cada corrida, como en SorteoApp. La regla persiste en `AGENTS.md`; el incremento se ejecuta en la rama local `feat/orders-workflow`, conservando los cambios anteriores de herramientas. Plan en `../plans/2026-10-20-orders-management.md`. Esta autorización no incluye despliegue ni escritura productiva.
