# Auditoría UX de Presupuestos y Pedidos — 2026-11-06

La gestión comercial permite completar sus recorridos principales y conserva la identidad de craf3D. La prioridad es **proteger el trabajo y las decisiones, mejorar el seguimiento diario y aclarar la continuidad del presupuesto**. Se consolidan **9 hallazgos: 3 P1 y 6 P2**, sin cambios de UI ni reglas.

## Alcance y método

Dos agentes aislados: A evaluó diseño, carga cognitiva y recorrido; B ejecutó detector y ramales técnicos. A terminó antes de que sus resultados se cruzaran con B para la síntesis. Se leyeron PRODUCT.md, DESIGN.md, docs/ui-ux.md y los playbooks aplicables. No se usaron informes previos como evidencia. Chrome temporal headless con Playwright local, sin ventana visible para el usuario ni perfil personal. API sintética independiente por agente: 5081 (A), 5082 (B); web actual 5173. Escritorio 1440×900, móvil 390×844 y 320×844. Las capturas originales se guardaron e inspeccionaron antes de aceptarse: 42 de 45 en A y 29 en B; sólo accepted=true entra en este informe.

Identidad preservada: crema/naranja quemado/ámbar, Chakra Petch, logo y esquinas rectas. Modo **Operate**. El backend y motor decimal siguen siendo la fuente de costos/precios. Este informe propone; no implementa.

Las capturas y registros privados están en `.impeccable/orders-audit-2026-11-06/`, fuera de Git. Los nombres de evidencia de este documento remiten a ese directorio; el informe navegable local es `report.html`.

## Prioridades consolidadas

| ID | Prioridad | Hallazgo | Procedencia | Esfuerzo relativo |
|---|---|---|---|---|
| O01 | P1 | Salir de la ficha pierde la edición sin guardar | A1 + B05 | Medio |
| O02 | P1 | Cancelar un pedido aplica una transición terminal en un toque | B01 | Bajo |
| O03 | P1 | La navegación pierde legibilidad con texto ampliado al 200% | B02 | Medio |
| O04 | P2 | Reintentar la confirmación puede generar un falso conflicto | B04 | Medio |
| O05 | P2 | La siguiente acción de seguimiento queda después de todo el formulario | A2 | Medio |
| O06 | P2 | Volver a la lista reinicia la vista y la búsqueda | A3 | Medio |
| O07 | P2 | El avanzado guarda, pero no acompaña el siguiente paso comercial | A4 | Medio |
| O08 | P2 | El documento y la aceptación muestran dos secuencias sin explicar su relación | A5 | Medio |
| O09 | P2 | Reordenar por teclado pierde el foco al refrescar la lista | B03 | Bajo–medio |

Bajo: ajuste acotado en controles/estado existentes. Medio: coordinación entre componentes, navegación o variantes con validación adicional. Son tamaños relativos, sin plazo comprometido. No se propone reabrir estados terminales sin revisión de negocio.

## O01 · P1 — Salir de la ficha pierde la edición sin guardar

**Observado:** Escribir una nota, pulsar Volver a pedidos y reabrir el mismo registro elimina el texto sin aviso. A y B reprodujeron el comportamiento de forma independiente. El rápido conserva automáticamente sus datos, lo que vuelve menos evidente que la ficha requiera guardado explícito.

**Impacto:** Una indicación de entrega, fecha o corrección comercial puede perderse durante una navegación cotidiana.

**Propuesta:** Comunicar Cambios sin guardar y ofrecer Guardar y volver, Descartar cambios o Seguir editando cuando haya una edición real. Si se elige un borrador local por registro, conservar versión y revisión de conflictos. No sobrescribir silenciosamente otra edición.

**Aceptación:**

- Editar una nota y usar Volver no pierde el texto sin una decisión explícita.
- Guardar y volver conserva el cambio; descartar lo elimina; seguir editando conserva valores y foco.
- Revisar también navegación principal y Atrás del navegador; un conflicto sigue conservando los datos pendientes.

**Evidencia:** A35/A36: valor antes/después y DOM local. B evidence.json#metrics.notesAfterLeaving confirma desaparición de la nota.

`design/captures/35-edicion-pendiente-390.png` — Antes de salir: nota escrita y aún sin guardar.

`design/captures/36-edicion-perdida-al-volver-390.png` — Al reabrir el mismo registro: nota vacía.

**Fuente:** [web/src/screens/OrdersScreen.tsx:91](../../web/src/screens/OrdersScreen.tsx#L91), [web/src/screens/OrdersScreen.tsx:104](../../web/src/screens/OrdersScreen.tsx#L104), [web/src/screens/OrdersScreen.tsx:150](../../web/src/screens/OrdersScreen.tsx#L150). Registro: `technical/evidence.json#metrics.notesAfterLeaving`.
**Esfuerzo relativo: Medio.** Estado pendiente y protección de salidas de la ficha.

## O02 · P1 — Cancelar un pedido aplica una transición terminal en un toque

**Observado:** Pulsar Cancelar pedido en un confirmado lo pasó inmediatamente a Cancelado, sin segunda decisión. La ficha no ofreció reactivación y el contrato actual no permite salir de Cancelled.

**Impacto:** Un toque accidental retira un trabajo de la cola sin recuperación desde el flujo actual. Esto es distinto de descartar un presupuesto, que sí puede recuperarse.

**Propuesta:** Pedir una confirmación accesible que muestre referencia y consecuencia antes de cancelar. Mantener el descarte recuperable como acción diferente. No prometer Deshacer ni agregar reactivación sin revisar primero reglas, producción, auditoría y negocio.

**Aceptación:**

- Un toque inicial en Cancelar pedido no cambia el estado.
- El diálogo identifica el pedido y permite volver sin mutación; confirmar produce una sola transición.
- Escape, foco y retorno al trigger funcionan; el descarte de presupuestos conserva su recuperación.

**Evidencia:** B evidence.json#metrics.cancel: transición sin diálogo; estado Cancelled y acciones restantes. OrderService define las transiciones permitidas.

`technical/captures/cancelled-390.png` — Cancelado: no queda una acción para reactivar.

**Fuente:** [web/src/screens/OrdersScreen.tsx:171](../../web/src/screens/OrdersScreen.tsx#L171), [src/PrintCost.Application/Orders/OrderService.cs:70](../../src/PrintCost.Application/Orders/OrderService.cs#L70). Registro: `technical/evidence.json#metrics.cancel`.
**Esfuerzo relativo: Bajo.** Confirmación explícita de cancelación con el dialog existente.

## O03 · P1 — La navegación pierde legibilidad con texto ampliado al 200%

**Observado:** Al aplicar html { font-size: 200% } a 390 y 320 CSS px, Presupuestos se superpone con los destinos vecinos y Historial queda cortado. La etiqueta mide 149,23 px dentro de celdas de 97,5 px y 80 px, respectivamente.

**Impacto:** Quien necesita texto mayor pierde la separación y lectura de los destinos cotidianos.

**Propuesta:** Permitir crecimiento y reflow de etiquetas y vistas sin recorte ni solapamiento, preservando nombres, foco y targets. Incluir esta corrección en la primera tanda junto a las protecciones de confianza.

**Aceptación:**

- Con texto normal y raíz CSS 200%, los cuatro destinos y ambas vistas se leen completos a 390/320 px.
- No hay solapamiento, recorte de labels ni pérdida de acciones; se conserva navegación por teclado.
- Validar además zoom nativo y una configuración real de accesibilidad antes de afirmar cobertura de esas modalidades.

**Evidencia:** B followup.json#metrics.nav-200-390 y nav-200-320 contienen las cajas de celdas/labels; capturas de viewport muestran el defecto. Es una prueba dirigida de tamaño raíz CSS, no zoom nativo ni certificación WCAG. Como guía de validación, [W3C: Understanding Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) contempla distintos mecanismos de ampliación. El resultado reproducido aquí se limita al cambio de tamaño raíz por CSS.

`technical/captures/orders-text-200-390.png` — 390px con tamaño raíz CSS200%: etiquetas superpuestas.

`technical/captures/orders-text-200-320.png` — 320px con tamaño raíz CSS200%: reflow insuficiente.

**Fuente:** [web/src/styles/shell.css:35](../../web/src/styles/shell.css#L35). Registro: `technical/followup.json#metrics.nav-200-390`, `technical/followup.json#metrics.nav-200-320`.
**Esfuerzo relativo: Medio.** Reflow de navegación inferior y selector de vistas.

## O04 · P2 — Reintentar la confirmación puede generar un falso conflicto

**Observado:** Se permitió el PUT de guardado y se inyectó 503 sólo en POST /status. El servidor avanzó de versión 1 a 2, pero la ficha conservó 1. Al restablecer la transición y reintentar, apareció 409 y Este pedido cambió en otra pantalla sin una segunda edición externa.

**Impacto:** La recuperación de un fallo temporal exige resolver un conflicto creado por la propia escritura y comunica una causa incorrecta.

**Propuesta:** Actualizar la versión local tras un guardado aceptado antes de intentar la transición. Evaluar una operación atómica sólo si la solución acotada no alcanza; una ampliación de contrato requiere definición y plan. Conservar los conflictos reales y las entradas pendientes.

**Aceptación:**

- PUT exitoso seguido de fallo temporal en /status conserva campos y versión vigente.
- Restablecer /status y reintentar confirma el mismo ID sin falso 409 ni registro duplicado.
- Una escritura concurrente real sigue mostrando conflicto y permite recuperar versión sin perder lo pendiente.

**Evidencia:** B followup.json#metrics.afterStatusFailure registra versión 2; las peticiones y el DOM del reintento acreditan el 409. El error de red fue sintético, no una incidencia productiva.

`technical/captures/confirm-status-failed-390.png` — Primera confirmación: guardado aceptado y fallo dirigido de transición.

`technical/captures/confirm-retry-conflict-390.png` — Reintento: conflicto atribuido a otra pantalla.

**Fuente:** [web/src/screens/OrdersScreen.tsx:123](../../web/src/screens/OrdersScreen.tsx#L123). Registro: `technical/followup.json#metrics.afterStatusFailure`, `technical/followup.json#requests`.
**Esfuerzo relativo: Medio.** Coordinación del guardado y la transición desde la ficha.

## O05 · P2 — La siguiente acción de seguimiento queda después de todo el formulario

**Observado:** Iniciar pedido, Marcar listo y Registrar entrega aparecen después de referencia, descripción, cantidad, total, fechas, notas y Guardar cambios. Marcar listo empieza en y 1081,94 dentro de un viewport de 900 px en escritorio, y en y 1252,94 dentro de 844 px en móvil.

**Impacto:** Registrar un hecho simple exige atravesar controles de edición que no hacen falta. Guardar cambios aparece antes y compite con el seguimiento cotidiano.

**Propuesta:** Para registros existentes, proponer resumen y siguiente CTA junto al estado arriba, con Editar datos como acceso a la ficha o bloque posterior. Mantener las transiciones explícitas, el guardado de entradas pendientes y la separación entre producción, entrega y cobro.

**Aceptación:**

- Al abrir una ficha confirmada, en proceso o lista, se identifica la próxima transición en el primer viewport 390×844 y 1440×900.
- Editar datos sigue accesible y conserva todos los campos, sin cambiar importes ni recalcular.
- Al cambiar estado se conservan las entradas pendientes y las validaciones/conflictos existentes.

**Evidencia:** A followup-metrics.json: posición DOM medida en 1440/390/320. Las dos capturas viewport evitan interpretar la composición fullPage de la barra fija como una obstrucción permanente.

`design/captures/44-listo-viewport-inicial-390.png` — Inicio de la ficha lista: no aparece Registrar entrega.

`design/captures/45-listo-viewport-seguimiento-390.png` — Después de desplazar: seguimiento al pie del formulario.

**Fuente:** [web/src/screens/OrdersScreen.tsx:153](../../web/src/screens/OrdersScreen.tsx#L153), [web/src/screens/OrdersScreen.tsx:169](../../web/src/screens/OrdersScreen.tsx#L169). Registro: `design/followup-metrics.json`.
**Esfuerzo relativo: Medio.** Jerarquía de la ficha existente, sin rediseñar la identidad.

## O06 · P2 — Volver a la lista reinicia la vista y la búsqueda

**Observado:** Historial con búsqueda Ana → abrir entregado → Volver a pedidos termina en Confirmados(0), búsqueda vacía. Para seguir revisando se debe elegir de nuevo Historial y reconstruir la consulta.

**Impacto:** Se pierde el lugar de trabajo al comparar fichas. La cola vacía de regreso puede parecer la desaparición del registro consultado.

**Propuesta:** Conservar vista, búsqueda, página y posición mediante URL o estado de retorno. Restaurarlos al regresar; si una transición mueve el registro fuera de la vista, informar su destino y ofrecer abrirlo allí. La prioridad continúa siendo global.

**Aceptación:**

- Abrir y volver desde un resultado conserva vista, consulta y página, con un punto de retorno útil.
- Si el registro deja de cumplir el filtro, se explica el destino sin borrar silenciosamente el contexto.
- Se verifica el retorno explícito y Atrás del navegador con listas de más de 25 registros.

**Evidencia:** A15/A16 y snapshots .png.txt: Historial/Ana antes frente a Confirmados y búsqueda vacía después. Estado de lista reinicializado y retorno directo en fuente.

`design/captures/15-historial-filtrado-390.png` — Historial filtrado antes de abrir la ficha.

`design/captures/16-volver-desde-historial-390.png` — Al volver: cola Confirmados y consulta vacía.

**Fuente:** [web/src/screens/OrdersScreen.tsx:18](../../web/src/screens/OrdersScreen.tsx#L18), [web/src/screens/OrdersScreen.tsx:19](../../web/src/screens/OrdersScreen.tsx#L19), [web/src/screens/OrdersScreen.tsx:150](../../web/src/screens/OrdersScreen.tsx#L150). Registro: `design/captures/15-historial-filtrado-390.png.txt`, `design/captures/16-volver-desde-historial-390.png.txt`.
**Esfuerzo relativo: Medio.** Estado de consulta y retorno a Presupuestos/Pedidos.

## O07 · P2 — El avanzado guarda, pero no acompaña el siguiente paso comercial

**Observado:** El rápido admite referencia libre y ofrece abrir el presupuesto. El avanzado pide Cliente de catálogo, sin esa referencia, y sólo informa que guardó como Draft y que el backend recalculó. Para confirmar hubo que navegar a Presupuestos, buscar el registro y completar la referencia en otra pantalla. Descripción inicial, Cliente y Notas también muestran controles de apariencia nativa pequeña, distintos de sus vecinos.

**Impacto:** Hay búsqueda y recaptura después de un cálculo válido; Cliente opcional no anticipa la referencia necesaria al confirmar.

**Propuesta:** Reutilizar referencia libre/descripcion y el feedback de guardado del rápido. Ofrecer Abrir presupuesto y continuar al mismo pendiente. Adaptar esos controles a los componentes/tokens existentes y dejar el cliente de catálogo como opción secundaria.

**Aceptación:**

- El avanzado permite informar referencia libre sin crear un cliente.
- El éxito enlaza al mismo presupuesto pendiente y conserva el ID al confirmar.
- Datos comerciales y controles conservan el patrón del producto; precio/agregado siguen viniendo del backend.

**Evidencia:** A24/A25: éxito sin enlace y controles; A26/A29: fila pendiente sin referencia y ficha que la pide. Snapshot DOM y fuente corroboran la ausencia de referencia libre.

`design/captures/24-avanzado-guardado-1440.png` — Guardado avanzado: feedback técnico sin acceso directo.

`design/captures/29-completar-avanzado-390.png` — Continuación comercial en otra pantalla, con referencia vacía.

**Fuente:** [web/src/screens/CalculatorScreen.tsx:240](../../web/src/screens/CalculatorScreen.tsx#L240), [web/src/screens/CalculatorScreen.tsx:323](../../web/src/screens/CalculatorScreen.tsx#L323), [web/src/screens/CalculatorScreen.tsx:332](../../web/src/screens/CalculatorScreen.tsx#L332). Registro: `design/captures/24-avanzado-guardado-1440.png.txt`.
**Esfuerzo relativo: Medio.** Datos comerciales y salida del guardado avanzado.

## O08 · P2 — El documento y la aceptación muestran dos secuencias sin explicar su relación

**Observado:** El origen ofrece Confirmar pedido junto a Calcular Draft, Editar entradas, Cancelar e impresión bloqueada. Tras calcular aparece Marcar lista para enviar, mientras la confirmación comercial continúa disponible. La aceptación sí funcionó sin recorrer esa secuencia documental.

**Impacto:** Para pasar un presupuesto aceptado a la cola hay que decidir si antes calcular, preparar, enviar, aceptar o confirmar. Draft y Cancelar sin objeto agregan ambigüedad.

**Propuesta:** Mantener la aceptación comercial como acción principal y agrupar preparación/envío documental como información secundaria explicada. Traducir Draft en copy visible y nombrar Cancelar cotización. Conservar estados/snapshots y no unir producción, entrega o cobro.

**Aceptación:**

- La próxima acción comercial se identifica sin aprender los estados documentales.
- El grupo documental explica su fin y la condición real para imprimir; no se omiten validaciones.
- Las etiquetas distinguen cancelar cotización, cancelar pedido, descartar presupuesto y salir de la edición.

**Evidencia:** A31/A33 y DOM: confirmación junto a acciones documentales. ResourceScreens conserva ramas por estado distintas del vínculo comercial.

`design/captures/31-detalle-origen-avanzado-1440.png` — Origen guardado: Confirmar pedido y Calcular Draft coexistentes.

`design/captures/33-cotizacion-calculada-1440.png` — Tras calcular: preparación del documento y aceptación siguen juntas.

**Fuente:** [web/src/screens/ResourceScreens.tsx:133](../../web/src/screens/ResourceScreens.tsx#L133), [web/src/screens/ResourceScreens.tsx:167](../../web/src/screens/ResourceScreens.tsx#L167), [web/src/screens/ResourceScreens.tsx:171](../../web/src/screens/ResourceScreens.tsx#L171). Registro: `design/captures/31-detalle-origen-avanzado-1440.png.txt`, `design/captures/33-cotizacion-calculada-1440.png.txt`.
**Esfuerzo relativo: Medio.** Jerarquía y copy del presupuesto de origen.

## O09 · P2 — Reordenar por teclado pierde el foco al refrescar la lista

**Observado:** Enfocar Poner primero en la tercera fila y activar Enter actualizó la prioridad, pero document.activeElement terminó en BODY. Durante el refresco la lista se sustituye por Cargando pedidos y no se restaura un foco útil.

**Impacto:** Seguir ordenando con teclado exige reencontrar el registro desde fuera de la cola, con más esfuerzo en listas largas.

**Propuesta:** Mantener la lista durante el refresco y restaurar foco dentro del mismo pedido. Si Poner primero queda deshabilitado por haber llegado arriba, elegir una acción habilitada y predecible sin cambiar la prioridad global.

**Aceptación:**

- Tras Enter y respuesta, el foco permanece en el mismo pedido y nunca cae a BODY.
- Si el control original se deshabilita, se elige y documenta una alternativa útil de esa fila.
- El mensaje de prioridad sigue anunciándose y búsqueda/paginación no cambian el alcance global.

**Evidencia:** B evidence.json#metrics.afterReorderFocus registra BODY. La captura acredita resultado y mensaje; la pérdida de foco se afirma por DOM, no por ausencia visual de un borde.

`technical/captures/priority-result-390.png` — Prioridad actualizada; el DOM registró foco en BODY.

**Fuente:** [web/src/screens/OrdersScreen.tsx:60](../../web/src/screens/OrdersScreen.tsx#L60). Registro: `technical/evidence.json#metrics.afterReorderFocus`.
**Esfuerzo relativo: Bajo–medio.** Persistencia de la lista y foco del pedido reordenado.

## Recorrido principal: 18 pasos

Cada fila conserva la salud y evidencia de A. Los errores adicionales de B están debajo.

| Paso | Tarea y salud | Evidencia aceptada |
|---|---|---|
| 1 | Cotizar rápido y completar referencia/descripción: funciona, guardado automático explícito. | 01 escritorio `design/captures/01-rapido-guardado-1440.png`, 02 móvil `design/captures/02-rapido-movil-390.png` |
| 2 | Abrir Pendientes: fila reconocible, total, estado y confirmación claros. | 03 móvil `design/captures/03-pendientes-390.png`, 04 escritorio `design/captures/04-pendientes-escritorio-1440.png` |
| 3 | Abrir ficha y guardar notas: funciona; formulario largo antes de confirmar. | 05 escritorio `design/captures/05-ficha-presupuesto-1440.png`, 06 móvil `design/captures/06-ficha-presupuesto-movil-390.png` |
| 4 | Confirmar y entrar a Pedidos: conserva datos y cambia navegación/estado. | 07 confirmado `design/captures/07-pedido-confirmado-390.png`, 08 cola `design/captures/08-cola-movil-390.png` |
| 5 | Iniciar: funciona, muestra “En proceso” y “Estado actualizado”. | 43 en proceso `design/captures/43-en-proceso-estable-390.png` |
| 6 | Marcar listo: funciona; siguiente acción queda al final del formulario. | 12 a320 `design/captures/12-listo-estable-320.png`, 13 a390 `design/captures/13-listo-movil-estable-390.png` |
| 7 | Registrar entrega: funciona, agrega fecha de entrega. | 14 entregado `design/captures/14-entregado-390.png` |
| 8 | Buscar en Historial, abrir y volver: filtro y vista se pierden. | 15 antes `design/captures/15-historial-filtrado-390.png`, 16 después `design/captures/16-volver-desde-historial-390.png` |
| 9 | Alta manual: valida referencia/importe, permite 3 unidades por total Gs. 100.000 sin multiplicar. | 17 validación `design/captures/17-alta-validacion-390.png`, 18 formulario `design/captures/18-alta-manual-1440.png`, 19 cola `design/captures/19-manual-en-cola-1440.png`, `manual-check.json` |
| 10 | Registrar trabajo anterior: funciona; Gs.0 explícito, estado Entregado en Historial. | 20 alta anterior `design/captures/20-trabajo-anterior-390.png`, 21 historial `design/captures/21-historial-anterior-390.png` |
| 11 | Presupuesto completo multilínea: calcula y guarda; continuidad inferior a la del rápido. | 22 entrada móvil `design/captures/22-avanzado-inicio-390.png`, 23 calculado `design/captures/23-avanzado-calculado-1440.png`, 24 guardado `design/captures/24-avanzado-guardado-1440.png`, 25 móvil `design/captures/25-avanzado-guardado-movil-390.png` |
| 12 | Localizar avanzado en Pendientes: funciona; falta referencia libre que el avanzado no pidió. | 26 lista `design/captures/26-avanzado-en-pendientes-390.png`, 29 completar `design/captures/29-completar-avanzado-390.png`, 30 validación `design/captures/30-falta-referencia-390.png` |
| 13 | Descartar/recuperar: funciona, mensajes claros; recuperación deja una vista vacía con CTA Cotizar. | 27 descartado `design/captures/27-descartados-390.png`, 28 recuperado `design/captures/28-recuperado-390.png` |
| 14 | Abrir origen y editar entradas: accesible vía desplegable; hay una segunda secuencia documental de estados. Se abrió/canceló edición, sin modificar líneas. | 31 origen `design/captures/31-detalle-origen-avanzado-1440.png`, 32 edición `design/captures/32-editar-entradas-1440.png`, 33 calculado `design/captures/33-cotizacion-calculada-1440.png` |
| 15 | Confirmar avanzado: funciona y conserva total Gs. 120.000 y 2 unidades. | 34 confirmado `design/captures/34-avanzado-confirmado-1440.png` |
| 16 | Editar notas sin guardar y volver/abrir: se pierde texto sin aviso. | 35 antes `design/captures/35-edicion-pendiente-390.png`, 36 después `design/captures/36-edicion-perdida-al-volver-390.png` |
| 17 | Prioridades: Poner primero bajo búsqueda mueve la cola global; Subir y Bajar funcionan. | 37 cola `design/captures/37-cola-dos-pedidos-390.png`, 38 antes `design/captures/38-prioridad-filtrada-antes-390.png`, 39 después `design/captures/39-prioridad-filtrada-despues-390.png`, 40 global `design/captures/40-prioridad-global-1440.png` |
| 18 | Búsqueda vacía y lista320: funciona sin overflow horizontal; ausencia de resultados ofrece alta antes que limpiar búsqueda. | 41 vacío `design/captures/41-busqueda-vacia-320-320.png`, 42 lista `design/captures/42-cola-320-320.png` |

## Ramales técnicos y de recuperación

| Paso | Recorrido | Salud observada | Captura |
|---|---|---|---|
| B1 | Faltan referencia/importe → completar → confirmar mismo ID | Validación concreta y foco en referencia; sin duplicado. | `technical/captures/budget-validation-390.png` |
| B2 | Alta con escritura retrasada y doble clic | Guardando… y campos bloqueados; una petición POST y un pedido. | `technical/captures/write-busy-390.png` |
| B3 | 503 de escritura | Conserva referencia, cantidad e importe. | `technical/captures/write-error-390.png` |
| B4 | Fallo de listado → Actualizar lista | Error propio, recuperación correcta; no simula vacío. | `technical/captures/list-error-390.png` |
| B5 | Conflicto real → actualizar versión | Conserva Segunda nota pendiente y permite revisar antes de guardar. | `technical/captures/conflict-refreshed-390.png` |
| B6 | PUT aceptado y 503 en transición → reintentar | Falso 409 reproducido; hallazgo O04. | `technical/captures/confirm-retry-conflict-390.png` |
| B7 | Cancelar confirmado | Terminal en un toque; hallazgo O02. | `technical/captures/cancelled-390.png` |
| B8 | Texto raíz CSS 200% a 390/320 | Solapamiento y corte; hallazgo O03. | `technical/captures/orders-text-200-390.png` |
| B9 | Reordenar con Enter | Prioridad correcta, foco en BODY; hallazgo O09. | `technical/captures/priority-result-390.png` |
| B10 | Drawer por teclado y foco de ficha | Contiene foco hacia atrás, Escape y retorno al trigger; sin campos completamente ocultos en el recorrido observado. | `technical/captures/drawer-390.png` |
| B11 | Buscar un registro fuera de la primera página | Resultado final correcto;21 GET para 21 caracteres, oportunidad de debounce/cancelación. | `technical/captures/search-single-390.png` |

## Especificidad y fortalezas

La composición y el lenguaje visual son específicos de craf3D: crema, naranja quemado, ámbar, Chakra Petch, logo y geometría rectangular. Las mejoras necesarias afectan continuidad y jerarquía de tareas; no justifican sustituir esa identidad ni convertir el cotizador en un dashboard.

- La bandeja de aceptación separa pendientes, con pedido y descartados. La fila prioriza referencia, trabajo, total y estado; las ausencias se expresan como Sin fecha/Sin definir.
- El alta directa respeta el precio acordado: 3 unidades por Gs. 100.000 conserva total Gs. 100.000 y no crea presupuesto ni producción ficticios. Doble clic no duplicó el pedido.
- El ciclo confirmado → en proceso → listo → entregado funcionó. La entrega agregó fecha; prioridad manual global funcionó bajo búsqueda, y el descarte de presupuestos pudo recuperarse.
- Ante fallos de escritura/listado y conflictos reales se conservaron entradas y hubo recuperación. El drawer pasó las comprobaciones de foco/Escape registradas, y las flechas midieron 44×44 px.

## Heurísticas de A

**24/40 es el juicio independiente de Assessment A**, no una puntuación combinada, una medición de usuarios ni una calificación de accesibilidad. B aporta evidencia técnica y no vuelve a puntuar la misma escala.

| Heurística | Nota | Razón observada |
|---|---:|---|
| Visibilidad del estado | 3 | Guardado y transiciones informan; edición pendiente no se distingue. |
| Correspondencia con el mundo real | 3 | Referencia, total y estados comerciales comprensibles; Draft/backend se filtran al origen/avanzado. |
| Control y libertad | 2 | Descarte recuperable y retorno explícito; retorno pierde trabajo sin guardar. |
| Consistencia y estándares | 2 | Shell sólido; rápido/avanzado y dos secuencias de estado divergen. |
| Prevención de errores | 2 | Cantidad/importe validados y cero explícito; sin protección de salida editando. |
| Reconocimiento antes que memoria | 3 | Filas y estados identificables; retorno exige recordar filtro y el avanzado localizar su guardado. |
| Flexibilidad y eficiencia | 2 | Alta directa y prioridad global ayudan; seguimiento al pie y contexto perdido ralentizan. |
| Estética y minimalismo | 2 | Identidad limpia y listas enfocadas; editor y origen exponen más decisiones que la tarea actual. |
| Diagnóstico y recuperación | 3 | Faltantes concretos, foco y recuperación de descartados; contexto/edición perdidos no se recuperan. |
| Ayuda y documentación | 2 | Hints de prioridad, aceptación y total útiles; falta ayuda para documento frente a aceptación y persistencia. |
| **Total** | **24/40** | **Aceptable según la escala del playbook; necesita mejoras concretas de uso.** |

Todas aplican al modo Operate. La puntuación es juicio de esta auditoría, no una medición de usuarios ni una equivalencia con accesibilidad.

## Carga cognitiva, personas y emociones

Las bandejas tienen carga baja/moderada: 2–3 vistas y filas predecibles. La ficha y el origen elevan la carga: fallan foco único, jerarquía de la siguiente tarea, memoria entre pantallas y divulgación progresiva. La agrupación espacial y los pares de campos ayudan. El rápido ofrece 6 acciones y un desglose; el origen presenta confirmación, preparación documental, edición, cancelación e impresión a la vez. El pico favorable es obtener precio y guardado explícito. Los valles son descubrir una edición perdida, una cancelación terminal o volver a una cola vacía desde Historial. La recuperación de descartados es tranquilizadora; un enlace al destino continuaría mejor la tarea.

Alex, que revisa y ordena muchos trabajos, paga el coste del scroll, filtro reiniciado y foco perdido. Casey, móvil con interrupciones, es más vulnerable a la nota perdida y la cancelación accidental. Sam, teclado/tecnología asistiva, se beneficia de botones nativos y nombres específicos, pero necesita reflow y foco estable. No se inventan nuevos tipos de cliente: el contexto sigue siendo Rafa/Clari gestionando impresiones.

## Roadmap propuesto

| Tanda | Hallazgos | Resultado buscado |
|---|---|---|
| Primera tanda: confianza y acceso | O01, O02, O04 y O03 | Evitar pérdida de trabajo/cancelación accidental, recuperar confirmación y asegurar lectura con texto ampliado. |
| Segunda tanda: eficiencia cotidiana | O05, O06 y O09 | Hacer visible la siguiente acción, volver al contexto y mantener foco al ordenar. |
| Tercera tanda: coherencia comercial | O07 y O08 | Unir continuidad del avanzado con la aceptación sin fusionar estados de negocio. |

Las tandas ordenan un posible próximo incremento; no se implementaron. Mantienen identidad, datos, importes autoritativos, snapshots y la distinción entre aceptación, producción, entrega y cobro. Para cambios arquitectónicos, definir y planificar antes de editar.

## Detector y juicio contextual

La CLI se ejecutó una vez en OrdersScreen.tsx y AppShell.tsx: exit 0, JSON[], cero hallazgos. El detector de navegador se inyectó correctamente en /quotes, /jobs y /orders/new. Sus 3 avisos cream-palette se descartaron porque la crema es identidad explícita; cramped-padding marcó 4 px frente al umbral automático 4,8 px en un badge no interactivo, completo y legible. Tampoco se elevó a defecto. Un detector limpio no demuestra accesibilidad completa y esos avisos no autorizan cambiar el brief.

## Observaciones de menor alcance

- Recuperar un descartado deja al usuario en la vista vacía con Cotizar; ofrecer Ver en Pendientes continuaría mejor su intención (A28).
- El vacío de búsqueda destaca Agregar pedido antes que limpiar la consulta (A41).
- El aviso global de faltantes puede permanecer después de completar los campos, hasta guardar (A18).
- B observó 21 GET al escribir 21 caracteres con latencia sintética de 600 ms. El resultado final fue correcto, incluso fuera de la primera página; debounce y cancelación son oportunidades de eficiencia, no un fallo productivo acreditado.
- Volver a pedidos midió 37,78 px, debajo de la meta propia de 44 px. Los errores inline no tienen su propio aria-describedby; sí existen aria-invalid y alerta global. Corresponde validación con lector real, sin afirmar una pérdida de anuncio no probada.

## Límites y cierre de herramientas

Auditoría de navegador emulado, DOM, peticiones y código; no investigación con usuarios. Sin dispositivo físico, lector de pantalla real, zoom nativo, ajustes físicos de accesibilidad, contraste exhaustivo, red móvil real, impresión/exportación física, stock/costos reales, cobros o verificación productiva. El texto 200% fue tamaño raíz por CSS; no acredita zoom nativo ni conformidad WCAG. Los 503 fueron inyectados para probar recuperación, no incidentes reales. A abrió/canceló la edición técnica sin guardar líneas modificadas. No se verificó restauración de ficha tras cerrar pestaña/refresh. El recorrido completo de teclado sólo se comprobó en los ramales registrados, no en toda la app. Las imágenes fullPage incluyen elementos fijos en el primer viewport; esa composición no se trató como solapamiento permanente al desplazar. Los defectos de foco y pérdida de datos se apoyan en DOM/estado, además de capturas.

Chrome y helpers exclusivos cerrados: API A 14284/5081, API B 55612/5082 y detector 2904/8400 detenidos tras comprobar identidad. No hubo inyección en fuente. A verificó API 5080 status:ok y /jobs en 5173 HTTP 200 al cerrar; se conservaron ambos servicios habituales. No se tocaron producción, precios, PINs, claves ni datos reales. Esta auditoría no acredita un despliegue.

## Dos preguntas sugeridas para el cierre

- ¿Empezamos por proteger cambios y cancelación, resolver el reintento y corregir el texto ampliado en una primera tanda?
- Para las fichas existentes, ¿preferís abrir con un resumen y la siguiente acción arriba, dejando Editar datos como acceso al formulario?
