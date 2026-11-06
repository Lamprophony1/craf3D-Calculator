# Revisión completa UI/UX — craf3D Calculator

Fecha: 2026-11-06, America/Asuncion.

Method: dual-agent (A: /root/design_review · B: /root/technical_review), con Product Design para recorridos y evidencia capturada por /root.

## Dictamen

La identidad visual es coherente y propia. Conviene conservar crema/naranja quemado/ámbar, Chakra Petch, logo y esquinas rectas. Las mejoras prioritarias son la confianza del importe, el alta de filamentos y dos barreras de accesibilidad móvil. No se modificó UI, motor, configuración comercial, producción o credenciales.

**14 hallazgos: 0 P0, 7 P1, 6 P2, 1 P3.** P1 requiere atención prioritaria antes de promover los recorridos afectados; P2 mejora importante de uso; P3 oportunidad cuya mejora debe medirse. No se detectó un P0 que impida toda la aplicación; esto no reduce el impacto de los P1 locales.

Las evaluaciones independientes dieron **24/40 en heurísticas de diseño** y **13/20 en calidad técnica**. Son notas ordinales de inspección, no mediciones de satisfacción ni certificación de accesibilidad. El coordinador añadió reproducciones funcionales frescas y el bloqueo de costo entero después de esas evaluaciones.

## Alcance y método

- Lectura de PRODUCT.md, DESIGN.md, docs/ui-ux.md, informe funcional obligatorio de octubre y fuentes actuales. Impeccable context se ejecutó una vez en la sesión; no se reinstalaron herramientas.
- Evaluación A sin detector ni acceso a B; B sin acceso a A. A terminó antes de incorporar detector en la síntesis. Target estable web/src, slug web-src; lista de ignores inexistente.
- Navegador Chrome temporal con Playwright local existente. No había Browser nativo. Escritorio 1440×900 y móvil 390×844 en todas las superficies; B añadió 320×844 y confirmación 390×832 para defectos concretos. Se probó ampliación CSS de texto 200% a 640 px; no es zoom nativo ni dispositivo físico.
- Preview original API 5080/web 5173: navegación y lectura; reviewers bloquearon mutaciones. Para guardados y transiciones, /root usó API 5081 con SQLite nueva, datos sintéticos y el mismo backend local publicado. Ningún dato existente de preview o producción se editó.
- Login/PIN incorrecto y fallos 503 se simularon para observar recuperación; offline se ejerció con el contexto real sin red. Share/cámara/galería nativa no se activaron. Los estados sintéticos y sus importes están identificados.
- Se guardaron 114 capturas principales nuevas; se aceptaron 111 después de inspección en hojas de contacto y apertura individual de evidencias clave. Tres capturas intermedias de cambio de estado se excluyeron porque mostraban Guardando; historial y capturas complementarias documentan los estados finales. A/B aportan evidencia adicional actual. No se reutilizó la evidencia de octubre ni la investigación previa como prueba visual de esta corrida.
- Capturas y trazas privadas: .impeccable/audit-2026-11-06/. Informe visual local: report.html. Las fullPage no se usan para inferir solapamientos de elementos fijos; F05 se fundamenta en foco/bounds y captura de viewport.
- No se ejecutó el preflight Python de contexto persistente Product Design: no se encontró intérprete en PATH/bundle y el archivo user-context.md no existe. Se continuó con el contexto explícito del repositorio y esta conversación. No impidió capturar el producto.

## Índice de hallazgos

| ID | Prioridad | Hallazgo |
|---|---|---|
| F01 | P1 | [El avanzado permite copiar un precio anterior a las entradas visibles](#f01) |
| F02 | P1 | [Pasar del rápido al avanzado hereda datos de otra cotización](#f02) |
| F03 | P1 | [El preview multilínea no representa el total que se guarda](#f03) |
| F04 | P1 | [Nuevo filamento rechaza costos enteros en guaraníes](#f04) |
| F05 | P1 | [La navegación inferior puede tapar por completo el campo enfocado](#f05) |
| F06 | P1 | [Auditoría pierde reflow en pantallas estrechas](#f06) |
| F07 | P1 | [El selector avanzado no distingue rollos con igual material y color](#f07) |
| F08 | P2 | [Los datos comerciales opcionales preceden a los tres datos del cálculo](#f08) |
| F09 | P2 | [El avanzado distribuye la atención entre técnica y 14 métricas](#f09) |
| F10 | P2 | [Controles y áreas táctiles cambian entre superficies](#f10) |
| F11 | P2 | [Reportes y registro de operaciones conservan el formato técnico](#f11) |
| F12 | P2 | [El menú Más permite desplazar la tarea de fondo](#f12) |
| F13 | P2 | [La navegación entre pantallas no orienta el foco hacia el contenido nuevo](#f13) |
| F14 | P3 | [La carga inicial puede dividirse por rutas y uso](#f14) |

<a id="f01"></a>

## F01 — [P1] El avanzado permite copiar un precio anterior a las entradas visibles

**Evidencia actual:** Con PLA blanco,142 g y 5,4 h se obtuvieron Gs.60.000. Se editaron los gramos a 300 y Copiar precio seguía disponible: el portapapeles recibió Gs.60.000. Al recalcular, la misma API devolvió Gs.100.000.

**Impacto:** Se puede comunicar al cliente un importe que no corresponde a lo que muestra el formulario. Assessment A lo reprodujo independientemente con otro rollo y otro importe.

**Propuesta:** Invalidar o rotular el resultado como pendiente al cambiar cualquier entrada económica; bloquear copiar/compartir y aceptar sólo respuestas de la versión vigente. Conservar el backend como fuente del cálculo.

**Aceptación:** Cambiar gramos, tiempo, material, cantidad, energía o costos impide compartir el precio previo; un error o una respuesta tardía tampoco lo reactiva.

**Ubicación:** web/src/screens/CalculatorScreen.tsx:144,174,180. **Playbook:** $impeccable harden.

[Captura: extra-advanced-stale-price-1440.png](../../.impeccable/audit-2026-11-06/captures/extra-advanced-stale-price-1440.png) · [Captura: extra-advanced-stale-price-390.png](../../.impeccable/audit-2026-11-06/captures/extra-advanced-stale-price-390.png)

<a id="f02"></a>

## F02 — [P1] Pasar del rápido al avanzado hereda datos de otra cotización

**Evidencia actual:** Después de dejar cantidad 10 y 4 kWh en un borrador avanzado, una cotización rápida de 142 g/5 h 24 min dio Gs.75.000. Necesito ajustar algo conservó cantidad 10,4 kWh y una línea adicional previa en el borrador; el preview avanzado dio Gs.625.000.

**Impacto:** La acción sugiere continuar el mismo presupuesto, pero cambia sus supuestos sin una decisión del usuario. La línea previa persiste en almacenamiento aunque no se vea en Cálculo avanzado.

**Propuesta:** Importar el request completo sobre un estado limpio; restablecer explícitamente cantidad, base de entrada, consumo medido, extras y líneas. Conservar sólo metadatos deliberadamente compatibles.

**Aceptación:** La primera previsualización avanzada equivale a la rápida antes de editar; no incorpora cantidades, consumos o líneas del borrador anterior.

**Ubicación:** web/src/screens/CalculatorScreen.tsx:29,47. **Playbook:** $impeccable harden.

[Captura: extra-advanced-inherited-values-1440.png](../../.impeccable/audit-2026-11-06/captures/extra-advanced-inherited-values-1440.png) · [Captura: extra-advanced-inherited-values-390.png](../../.impeccable/audit-2026-11-06/captures/extra-advanced-inherited-values-390.png)

<a id="f03"></a>

## F03 — [P1] El preview multilínea no representa el total que se guarda

**Evidencia actual:** Con dos líneas visibles de 142 g/5,4 h, el preview mostró Gs.60.000 y envió un único QuotePreviewRequest. Guardar envió 2 líneas y el agregado persistido de la API resultó Gs.120.000.

**Impacto:** La persona puede copiar o usar un precio parcial y descubrir otro total después de guardar. Estos importes pertenecen al fixture aislado; no sustituyen ajustes productivos.

**Propuesta:** Usar el mismo cálculo agregado autoritativo para preview y guardado; mostrar el total agregado dominante y rotular los importes por línea. No sumar precios individuales ya redondeados.

**Aceptación:** Para la misma entrada, preview, copiar, documento y guardado coinciden; preparación, mínimos, impuestos y redondeo se aplican conforme al agregado de dominio.

**Ubicación:** web/src/screens/CalculatorScreen.tsx:125,144,151,157. **Playbook:** $impeccable harden.

[Captura: extra-multiline-preview-1440.png](../../.impeccable/audit-2026-11-06/captures/extra-multiline-preview-1440.png) · [Captura: extra-multiline-saved-document-1440.png](../../.impeccable/audit-2026-11-06/captures/extra-multiline-saved-document-1440.png)

<a id="f04"></a>

## F04 — [P1] Nuevo filamento rechaza costos enteros en guaraníes

**Evidencia actual:** En el dialog se ingresaron marca Muestra, materialPLA, Gris perla,1000 g y costo 140000. El formulario no se envió: validity.stepMismatch=true. El navegador pidió 139999,01 o 140000,01. Cambiar a 140000.01 permitió guardar y seleccionó el rollo en la base aislada.

**Impacto:** Bloquea un alta cotidiana con un importe normal y ofrece como salida modificar el costo real. No es una validación del motor ni un problema de la API.

**Propuesta:** Alinear min/step con el contrato de moneda y validar un costo positivo sin desplazar la grilla de enteros en 0,01. Añadir un mensaje de campo claro y conservar las entradas.

**Aceptación:** 140000 y cualquier entero positivo válido se guardan sin sumar centavos; cero y valores negativos siguen rechazados. El rollo se selecciona al volver al cálculo.

**Ubicación:** web/src/components/QuickQuoteDialogs.tsx:33. **Playbook:** $impeccable harden.

[Captura: extra2-filament-integer-cost-invalid-1440.png](../../.impeccable/audit-2026-11-06/captures/extra2-filament-integer-cost-invalid-1440.png) · [Captura: extra2-filament-integer-cost-invalid-390.png](../../.impeccable/audit-2026-11-06/captures/extra2-filament-integer-cost-invalid-390.png)

<a id="f05"></a>

## F05 — [P1] La navegación inferior puede tapar por completo el campo enfocado

**Evidencia actual:** A 390×832, diez Tab llevan a Gramos. El input queda en y 762,03–810,03 y la barra opaca ocupa y 756–832; elementFromPoint en el centro devuelve Pedidos. A 390×844 quedan sólo 5,97 px del campo visibles.

**Impacto:** Al navegar con teclado se puede escribir sin ver el valor ni el foco en un dato indispensable para cotizar. El caso de ocultamiento total incumple WCAG 2.2 AA 2.4.11.

**Propuesta:** Reservar espacio de desplazamiento para cabecera y barra fija mediante scroll-padding/scroll-margin; comprobar foco hacia delante/atrás y no duplicar paddings inferiores por pantalla.

**Aceptación:** Todo control enfocado queda visible sobre la barra en distintas alturas móviles y con texto ampliado; la posición no depende de una altura exacta de teléfono.

**Ubicación:** web/src/styles/shell.css:27,32; web/src/screens/QuickQuoteScreen.tsx:#quick-grams. **Playbook:** $impeccable harden / $impeccable adapt.

[Captura: focus-grams-390x832.png](../../.impeccable/audit-2026-11-06/reviewer-b/focus-grams-390x832.png)

<a id="f06"></a>

## F06 — [P1] Auditoría pierde reflow en pantallas estrechas

**Evidencia actual:** A 320 px, documentElement.scrollWidth=427:107 px de exceso. La grilla de cada objeto conserva columnas 160 px/58 px; acciones, fechas y UUID se recortan o desbordan. También se observó overflow a 390 px en la evaluaciónA.

**Impacto:** Exige desplazamiento en dos direcciones para leer un registro y oculta parte de su contexto. La lista de propiedades no necesita una estructura bidimensional para conservar significado; incumple WCAG 2.2 AA 1.4.10 en este estado.

**Propuesta:** Apilar etiqueta y valor en móvil, quitar el mínimo rígido y permitir rupturas seguras de identificadores/fechas. Conservar detalle técnico dentro de su superficie.

**Aceptación:** A 320 y 390 px se puede leer cada evento sin scroll horizontal del documento ni pérdida de acción/fecha.

**Ubicación:** web/src/styles/resources.css:48,50; web/src/screens/ResourceScreens.tsx:317,319. **Playbook:** $impeccable adapt.

[Captura: audit-320-viewport.png](../../.impeccable/audit-2026-11-06/reviewer-b/audit-320-viewport.png)

<a id="f07"></a>

## F07 — [P1] El selector avanzado no distingue rollos con igual material y color

**Evidencia actual:** En el preview existente hay dos opciones con IDs diferentes llamadas PLA · Blanco ·1.000 g; corresponden a Creality y Bambu Lab con costos por gramo distintos. Las líneas adicionales reducen la etiqueta a PLA · Blanco.

**Impacto:** Se puede elegir otro costo sin una diferencia reconocible en el formulario. La selección por ID funciona; falla la identidad que se presenta al usuario.

**Propuesta:** Reutilizar FilamentPicker o incluir marca, variante y costo por gramo en todas las opciones avanzadas; mantener la identificación exacta por ID.

**Aceptación:** Dos rollos con igual material/color se distinguen sin abandonar el cálculo, incluida cada línea adicional y segundo material.

**Ubicación:** web/src/screens/CalculatorScreen.tsx:212,230,246; web/src/components/FilamentPicker.tsx:49. **Playbook:** $impeccable clarify.

[Captura: 05-filaments-1440.png](../../.impeccable/audit-2026-11-06/reviewer-a/05-filaments-1440.png) · [Captura: 08-calculator-1440.png](../../.impeccable/audit-2026-11-06/reviewer-a/08-calculator-1440.png)

<a id="f08"></a>

## F08 — [P2] Los datos comerciales opcionales preceden a los tres datos del cálculo

**Evidencia actual:** Cliente/referencia y Descripción encabezan el formulario. A 390×844 Gramos empieza alrededor de y 762, junto a la barra fija. La condición opcional de Cliente está sólo en un placeholder que se corta.

**Impacto:** Añade lectura y desplazamiento antes de completar el objetivo principal. El objetivo de menos de 15 s es documental; no se cronometró con usuarios.

**Propuesta:** Presentar Filamento→Tiempo→Gramos primero. Ubicar los datos comerciales después o en una sección opcional compacta y declarar opcional en el label. Mantener guardado automático y referencias existentes.

**Aceptación:** El orden inicial corresponde a los tres datos prometidos, y la persona entiende qué puede omitir sin leer un placeholder.

**Ubicación:** web/src/screens/QuickQuoteScreen.tsx:210. **Playbook:** $impeccable distill / $impeccable layout.

[Captura: 29-quick-viewport-390.png](../../.impeccable/audit-2026-11-06/reviewer-a/29-quick-viewport-390.png) · [Captura: 004-quick-empty-desktop.png](../../.impeccable/audit-2026-11-06/captures/004-quick-empty-desktop.png)

<a id="f09"></a>

## F09 — [P2] El avanzado distribuye la atención entre técnica y 14 métricas

**Evidencia actual:** El primer grupo abierto mezcla impresora, perfil, tarifa, material, gramos, tiempo y energías adicionales. El resultado enumera 14 conceptos; Total cliente llega al final. Overhead/Markup y las secciones cerradas requieren interpretación.

**Impacto:** La persona pierde la claridad de una cifra principal y necesita entender el motor para realizar ajustes puntuales.

**Propuesta:** Priorizar total vigente y su estado; agrupar costos/ganancia en detalle. Mostrar variables técnicas según la intención del ajuste y explicar cantidad/unidades por placa con ejemplos breves. Añadir indicador visible a los acordeones.

**Aceptación:** El importe para comunicar y si está vigente se reconocen primero; los detalles siguen disponibles y la tarea habitual exige menos decisiones visibles.

**Ubicación:** web/src/screens/CalculatorScreen.tsx:207,260; web/src/styles/advanced.css:3. **Playbook:** $impeccable distill / $impeccable clarify.

[Captura: extra-advanced-stale-price-1440.png](../../.impeccable/audit-2026-11-06/captures/extra-advanced-stale-price-1440.png) · [Captura: 032-advanced-calculator-mobile.png](../../.impeccable/audit-2026-11-06/captures/032-advanced-calculator-mobile.png)

<a id="f10"></a>

## F10 — [P2] Controles y áreas táctiles cambian entre superficies

**Evidencia actual:** En Presupuesto completo a 320 px, primera descripción mide 188×27 px, Cliente 98×25 y Notas 181×69. Editar/Desactivar de catálogos tienen 35 px de alto. Algunos inputs de impresión heredan 14,08 px de fuente.

**Impacto:** Reduce legibilidad y tolerancia táctil, y hace que la misma pantalla parezca incompleta. Los 44 px y fuente 1 rem son contrato del proyecto; estas medidas no demuestran por sí solas incumplir WCAG 2.5.8, cuyo mínimoAA es 24 px con excepciones.

**Propuesta:** Extender los estilos/componentes existentes a todos los labels y controles del formulario, con ancho y alineación comunes, y ampliar el área clickeable secundaria a 44 px sin agrandar necesariamente el texto.

**Aceptación:** Descripción, Cliente, Notas y acciones de catálogo conservan composición, fuente y targets del sistema en 320/390/1440 px.

**Ubicación:** web/src/screens/CalculatorScreen.tsx:243,252,253; web/src/styles/base.css:34,35; web/src/styles/resources.css:8. **Playbook:** $impeccable adapt / $impeccable polish.

[Captura: quotes-new-320.png](../../.impeccable/audit-2026-11-06/reviewer-b/quotes-new-320.png) · [Captura: printers-320.png](../../.impeccable/audit-2026-11-06/reviewer-b/printers-320.png)

<a id="f11"></a>

## F11 — [P2] Reportes y registro de operaciones conservan el formato técnico

**Evidencia actual:** Rentabilidad con un trabajo completado muestra Job Id, Estimated Cost Gs y valores como 43704.402735; Auditoría presenta GUIDs, acciones internas y timestamps. Las seis pestañas de reportes sólo muestran parte del conjunto en móvil. Resumen no aclara la diferencia entre pedidos comerciales y producción.

**Impacto:** Cuesta saber qué importe o actividad se está comparando y localizar un cambio. El ruido aumenta con datos reales; en Auditoría se solicitan hasta 200 eventos sin búsqueda o paginación visible.

**Propuesta:** Diseñar cada reporte por pregunta: etiquetas españolas, Gs. sin decimales cotidianos, porcentajes y fechas locales; definir el universo de cada métrica. Resumir eventos por acción/fecha y relegar IDs al detalle; agregar filtros/paginación e indicar que hay más reportes.

**Aceptación:** Se entiende costo, ganancia, período y tipo de registro sin interpretar claves internas; un evento se localiza sin recorrer 200 fichas.

**Ubicación:** web/src/screens/ReportsAndProfileScreens.tsx:12,20,21,26; web/src/screens/ResourceScreens.tsx:314,319,322. **Playbook:** $impeccable clarify / $impeccable distill.

[Captura: extra2-profitability-with-data-390.png](../../.impeccable/audit-2026-11-06/captures/extra2-profitability-with-data-390.png) · [Captura: 037-reports-desktop.png](../../.impeccable/audit-2026-11-06/captures/037-reports-desktop.png)

<a id="f12"></a>

## F12 — [P2] El menú Más permite desplazar la tarea de fondo

**Evidencia actual:** Con Más abierto, wheel sintetizado sobre el backdrop mueve scrollY de 0 a 600; bodyOverflow permanece visible y el foco continúa en Cerrar. ModalDialog sí bloquea/restaura scroll. Escape y retorno de foco del menú funcionan.

**Impacto:** Al cerrar el menú, la persona puede regresar a otra posición de su tarea. Se probó wheel, no swipe en un teléfono físico.

**Propuesta:** Reutilizar el bloqueo/restauración de scroll del diálogo y contener el desplazamiento dentro del drawer.

**Aceptación:** Abrir/cerrar Más conserva la posición de fondo; teclado y desplazamiento del propio menú siguen funcionando.

**Ubicación:** web/src/components/AppShell.tsx:53,114; web/src/styles/shell.css:35,36. **Playbook:** $impeccable harden.

[Captura: extra2-mobile-more.png](../../.impeccable/audit-2026-11-06/captures/extra2-mobile-more.png)

<a id="f13"></a>

## F13 — [P2] La navegación entre pantallas no orienta el foco hacia el contenido nuevo

**Evidencia actual:** Al activar Presupuestos desde el sidebar cambia el h1 pero el foco queda en el enlace; el título del documento conserva sólo el nombre de app. No se mueve a main/h1 ni hay anuncio de ruta.

**Impacto:** Quien depende del teclado o lector debe descubrir dónde empieza la nueva vista. No se presenta como fallo automático de 4.1.3; la navegación necesita validación con un lector real.

**Propuesta:** Definir título por ruta y un patrón de foco en main/h1 después de navegar; mantener excepciones para dialogs, interacciones locales e historial.

**Aceptación:** Después de activar un destino se identifica la vista y comienza una secuencia de teclado útil, sin capturar foco durante cambios locales.

**Ubicación:** web/src/components/AppShell.tsx:29,73,105; web/src/App.tsx. **Playbook:** $impeccable harden.

[Captura: 02-quotes-1440.png](../../.impeccable/audit-2026-11-06/reviewer-a/02-quotes-1440.png)

<a id="f14"></a>

## F14 — [P3] La carga inicial puede dividirse por rutas y uso

**Evidencia actual:** Un build Vite actual en carpeta privada produjo JS 377945 bytes/gzip 107826 y CSS 91852/gzip 33743. App importa las pantallas estáticamente y html-to-image entra desde el exportador. La página pública recibe el mismo chunk. Los dosGIF suman 5,57 MB; el segundo tiene lazy loading.

**Impacto:** Hay una oportunidad de reducir trabajo inicial, pero no se midieron LCP/INP/CLS de campo ni se comprobó lentitud con hardware/red limitada. El tamaño por sí solo no es un bloqueo.

**Propuesta:** Medir carga en red móvil y separar pantallas/exportación con imports dinámicos si aporta mejora. Optimizar losGIF dentro del formato autorizado, manteniendo pausa, imágenes estáticas y material real.

**Aceptación:** Una medición comparable acredita menor transferencia/trabajo inicial y mantiene todos los controles y la alternativa de movimiento reducido.

**Ubicación:** web/src/App.tsx; web/src/hooks/useClientQuoteImageExport.ts:2; web/public/media/portacelular. **Playbook:** $impeccable optimize.

[Captura: 059-public-instructions-desktop.png](../../.impeccable/audit-2026-11-06/captures/059-public-instructions-desktop.png) · [Captura: 060-public-instructions-mobile.png](../../.impeccable/audit-2026-11-06/captures/060-public-instructions-mobile.png)

## Puntuación heurística de la evaluaciónA

| Heurística | /4 | Evidencia |
|---|---:|---|
| Visibilidad del estado | 2 | El resultado avanzado no informa que quedó anterior. |
| Correspondencia con el mundo real | 3 | Buen lenguaje cotidiano; jerga residual en avanzado/reportes. |
| Control y libertad | 3 | Escape, Cancelar y retorno de foco funcionan en las muestras. |
| Consistencia y estándares | 2 | Controles avanzados y selección de rollos divergen del flujo rápido. |
| Prevención de errores | 2 | Hay validación útil, pero persisten riesgos de importe y selección. |
| Reconocimiento sobre recuerdo | 3 | Selector rápido reconocible; avanzado omite identidad de rollos. |
| Flexibilidad y eficiencia | 2 | Datos opcionales preceden al cálculo; superficies largas. |
| Diseño estético y minimalista | 2 | Identidad sólida;14 métricas y datos crudos elevan ruido. |
| Recuperación de errores | 3 | Avisos claros y recuperación en flujos cotidianos; límites descritos. |
| Ayuda y documentación | 2 | Hints útiles; faltan ejemplos en ajustes y reportes complejos. |
| **Total** | **24/40** | **Aceptable; mejoras significativas localizadas.** |

## Auditoría técnica de la evaluaciónB

| Dimensión | /4 | Evidencia |
|---|---:|---|
| Accesibilidad | 2 | Foco tapado y pérdida de reflow. |
| Rendimiento | 3 | Build medido; oportunidad de separar carga. |
| Tokens y tema | 3 | Sistema propio coherente, algunos valores literales. |
| Adaptación a pantallas | 2 | Desborde, targets y scroll del menú. |
| Integridad de implementación | 3 | Coherencia general; controles avanzados fuera del patrón. |
| **Total** | **13/20** | **Aceptable; requiere mejoras.** |

## Detector, contraste y rendimiento

El detector CLI corrió una vez sobre web/src: exit 0,JSON [],0 hallazgos. La comprobación en navegador se inyectó en cuatro rutas y produjo 6 ocurrencias de 2 reglas: cuatro de cream-palette y dos kicker-above-heading en el instructivo. La crema está expresamente fijada; los kickers identifican producto/marca sin defecto técnico demostrado. Se clasifican como avisos no accionables frente al brief. Un detector limpio no invalida los hallazgos funcionales ni prueba accesibilidad.

La inyección y overlay se verificaron en Chrome headless; no hubo una pestaña humana visible persistente. El helper temporal 8400 fue detenido por B. No se activaron hooks.

Pares renderizados medidos: blanco/naranja quemado 7,04:1; tinta/ámbar acción 5,85:1; texto secundario/crema 6,55:1; texto secundario/superficie 7,70:1; foco/crema 6,56:1 y borde/superficie 5,51:1. Las muestras activas examinadas superan 4,5:1; no se generaliza a todos los estados, transparencias o texto sobre imágenes.

Build Vite de medición actual en carpeta privada: exit 0,1794 módulos; JS 377945 bytes/gzip 107826 y CSS 91852/gzip 33743. No modifica web/dist y no equivale a typecheck ni suites de producto. Las oportunidades están en F14; no se reportan métricas de campo a partir del servidor Vite.

## Fortalezas a conservar

1. Identidad propia y lenguaje local: pregunta concreta, monedaGs., muestras de filamento con texto y marca; no se justifica rediseñar la estética.
2. Recorrido comercial coherente: Presupuestos antes de Pedidos, alta de precio acordado y separación de entrega/producción; el ensayo de cantidad 3/total 100000 conserva el importe total y no lo multiplica.
3. Recuperación en la operación diaria: estados vacíos con acción, error 503 con reintento, borrador y foco restaurados en dialogs/picker. Escape y ciclos de foco se comprobaron en muestras.
4. La página pública enseña con material real, pausa/reproducción y pasos escritos; reduced-motion usa imágenes estáticas y preserva la posibilidad de reproducir.

## Carga cognitiva y recorrido emocional

El rápido ofrece una promesa clara y selección reconocible; el orden de datos comerciales añade dos decisiones antes del cálculo. El avanzado tiene carga alta: técnica y datos de impresión en el primer grupo,14 métricas de resultado y varias secciones sin señal visual clara de expansión. La agrupación progresiva existente es una buena base. El mayor valle de confianza aparece cuando un resultado anterior sigue listo para compartir.

Lentes de prueba, no investigación de usuarios: el usuario frecuente pierde eficiencia por desplazamiento y estado del precio; la persona primeriza puede interpretar cliente como requisito y no distinguir los rollos; el uso móvil exige targets y foco visibles; el teclado necesita orientación al navegar. No se inventaron nuevas personas ni se midió satisfacción o el objetivo de 15 s con Rafa/Clari.

## Cobertura por paso

Cada fila incluye recorrido/superficie, salud observada y capturas actuales de ambos anchos.

| Paso | Superficie / tarea | Salud general | Escritorio / móvil |
|---:|---|---|---|
| 1 | Acceso y PIN — / | Claro; error de PIN simulado, sin credenciales reales. | [D](../../.impeccable/audit-2026-11-06/captures/001-login-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/002-login-mobile.png) |
| 2 | Cotización rápida y selector — / | Base clara; F05/F08 y F04 en alta. | [D](../../.impeccable/audit-2026-11-06/captures/004-quick-empty-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/005-quick-empty-mobile.png) |
| 3 | Resultado, loading, guardado y desconexión — / | Guardado real aislado; offline al editar invalida resultado. | [D](../../.impeccable/audit-2026-11-06/captures/012-quick-result-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/013-quick-result-mobile.png) |
| 4 | Compartir presupuesto — / → dialog | Vista previa inspeccionada; cámara/share del dispositivo no probados. | [D](../../.impeccable/audit-2026-11-06/captures/014-share-client-dialog-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/015-share-client-dialog-mobile.png) |
| 5 | Presupuestos — /quotes | Pendientes y confirmación comprensibles. | [D](../../.impeccable/audit-2026-11-06/captures/019-budgets-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/020-budgets-mobile.png) |
| 6 | Ficha pendiente y documento — /quotes/pending/:id; /quotes/:id | Confirmación y documento inspeccionados; F03 en multilínea. | [D](../../.impeccable/audit-2026-11-06/captures/073-quote-document-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/074-quote-document-mobile.png) |
| 7 | Cola de pedidos e historial — /jobs | Vistas, búsqueda, vacío y error recuperable presentes. | [D](../../.impeccable/audit-2026-11-06/captures/021-orders-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/022-orders-mobile.png) |
| 8 | Alta y ficha comercial — /orders/new; /orders/:id | Cantidad 3 y total 100000 conservan total 100000; ciclo de estados completado. | [D](../../.impeccable/audit-2026-11-06/captures/064-order-detail-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/065-order-detail-mobile.png) |
| 9 | Trabajo anterior — /orders/new | Formulario específico y ausencias explícitas. | [D](../../.impeccable/audit-2026-11-06/captures/extra2-historical-order-form-1440.png) · [M](../../.impeccable/audit-2026-11-06/captures/extra2-historical-order-form-390.png) |
| 10 | Producción y costos reales — /jobs/:id | Iniciar, pausar, reanudar y completar ejercidos en base aislada. | [D](../../.impeccable/audit-2026-11-06/captures/extra2-production-completed-1440.png) · [M](../../.impeccable/audit-2026-11-06/captures/extra2-production-completed-390.png) |
| 11 | Filamentos — /filaments | Identidad y costos claros; oportunidad de búsqueda. | [D](../../.impeccable/audit-2026-11-06/captures/025-filaments-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/026-filaments-mobile.png) |
| 12 | Ajustes de precio — /settings | Ayudas y preview reales; restauración sólo abierta/cancelada. | [D](../../.impeccable/audit-2026-11-06/captures/027-price-settings-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/028-price-settings-mobile.png) |
| 13 | Configuración avanzada — /settings/advanced | Grupos adecuados; expandir podría hacerse más evidente. | [D](../../.impeccable/audit-2026-11-06/captures/029-advanced-settings-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/030-advanced-settings-mobile.png) |
| 14 | Calculadora avanzada — /calculator | F01/F02/F07/F09; riesgo de comunicar un precio incorrecto. | [D](../../.impeccable/audit-2026-11-06/captures/extra-advanced-stale-price-1440.png) · [M](../../.impeccable/audit-2026-11-06/captures/extra-advanced-stale-price-390.png) |
| 15 | Presupuesto completo — /quotes/new | F03/F10; preview y guardado divergen. | [D](../../.impeccable/audit-2026-11-06/captures/extra-multiline-preview-1440.png) · [M](../../.impeccable/audit-2026-11-06/captures/extra-multiline-preview-390.png) |
| 16 | Resumen — /dashboard | Limpio; aclarar qué cuenta producción frente a pedidos. | [D](../../.impeccable/audit-2026-11-06/captures/035-dashboard-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/036-dashboard-mobile.png) |
| 17 | Reportes — /reports | Seis vistas recorridas; F11 con datos vacíos y poblados. | [D](../../.impeccable/audit-2026-11-06/captures/extra2-profitability-with-data-1440.png) · [M](../../.impeccable/audit-2026-11-06/captures/extra2-profitability-with-data-390.png) |
| 18 | Registro de operaciones — /audit | F06/F11: reflow y lectura de eventos. | [D](../../.impeccable/audit-2026-11-06/captures/039-audit-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/040-audit-mobile.png) |
| 19 | Perfil y seguridad — /profile | Formulario inspeccionado; no se cambió PIN. | [D](../../.impeccable/audit-2026-11-06/captures/041-profile-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/042-profile-mobile.png) |
| 20 | Impresoras — /printers | Lista/editor inspeccionados; formularios extensos. | [D](../../.impeccable/audit-2026-11-06/captures/043-printers-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/044-printers-mobile.png) |
| 21 | Perfiles de energía — /energy-profiles | Lista/editor inspeccionados; campos técnicos al inicio. | [D](../../.impeccable/audit-2026-11-06/captures/045-energy-profiles-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/046-energy-profiles-mobile.png) |
| 22 | Tarifas eléctricas — /electricity-tariffs | Lista inspeccionada; acciones compactas. | [D](../../.impeccable/audit-2026-11-06/captures/047-electricity-tariffs-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/048-electricity-tariffs-mobile.png) |
| 23 | Políticas de precio — /pricing-policies | Lista/editor inspeccionados; revelación por método recomendable. | [D](../../.impeccable/audit-2026-11-06/captures/049-pricing-policies-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/050-pricing-policies-mobile.png) |
| 24 | Clientes — /customers | Estado vacío y lista; explicar utilidad del catálogo. | [D](../../.impeccable/audit-2026-11-06/captures/051-customers-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/052-customers-mobile.png) |
| 25 | Plantillas — /product-templates | Vacío genérico; no bloquea el cotizador. | [D](../../.impeccable/audit-2026-11-06/captures/053-product-templates-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/054-product-templates-mobile.png) |
| 26 | Inventario avanzado — /settings/advanced/filaments | Lista/editor inspeccionados; identidad reducida frente al picker. | [D](../../.impeccable/audit-2026-11-06/captures/055-advanced-filaments-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/056-advanced-filaments-mobile.png) |
| 27 | Configuración general y marca — /settings/advanced/general | Formulario inspeccionado, sin guardar ajustes. | [D](../../.impeccable/audit-2026-11-06/captures/057-general-settings-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/058-general-settings-mobile.png) |
| 28 | Instrucciones públicas — /portacelular | Buena secuencia con medios reales, pausa y texto alternativo al movimiento. | [D](../../.impeccable/audit-2026-11-06/captures/059-public-instructions-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/060-public-instructions-mobile.png) |
| 29 | Menú, navegación y 404 — Shell; ruta inexistente | F12/F13; ruta desconocida conserva shell y muestra página no encontrada. | [D](../../.impeccable/audit-2026-11-06/captures/061-not-found-desktop.png) · [M](../../.impeccable/audit-2026-11-06/captures/062-not-found-mobile.png) |

Las rutas explícitas de App.tsx (incluidas / y /portacelular), los catálogos técnicos y los estados dinámicos se cubren conforme a la tabla; varias comparten componente. No se interpreta “toda la app” como prueba exhaustiva de cada combinación posible de datos o navegador.

## Incrementos propuestos

1. **Proteger el importe y destrabar el alta:** F01–F04 y F07. Regresiones con importación limpia, resultados vigentes y equivalencia preview/guardado/copia; validación de costo entero.
2. **Corregir acceso móvil:** F05/F06, luego F10/F12/F13. Una ronda conjunta en escritorio/móvil, teclado,320 px y ampliación, corregir en lote y confirmar.
3. **Simplificar los recorridos:** F08/F09. Mantener tres datos protagonistas y total dominante; conservar detalle avanzado.
4. **Volver legibles los datos:** F11, aclarando alcance de métricas y registros.
5. **Medir antes de optimizar carga:** F14. Cerrar cada incremento con $impeccable polish y verificación proporcional.

## Observaciones menores

- Filamentos y catálogos largos se beneficiarían de búsqueda/filtros propios; el picker ya muestra un patrón reutilizable.
- Clientes/Plantillas vacíos podrían explicar su utilidad y siguiente acción. No son requisitos del flujo de referencia libre.
- Los formularios técnicos deberían mostrar campos del método elegido y vigencias bajo detalle; no eliminar datos de dominio.
- El reset global reduced-motion a 0,01 ms es deuda para revisar por componente; no se comprobó que rompa una tarea y no se cuenta como defecto independiente.
- DESIGN.md y su sidecar siguen con el desajuste ya informado; no se reparó ni se eligió un buildPath comercial durante la auditoría.

## Límites de las conclusiones

No se operó producción, VM, SSH, credenciales, precios productivos o migraciones. DevSelector no acredita el login real porPIN. No se ejercieron cambios de PIN ni restauración de ajustes. Se revisaron catálogos y editores sin cambiar sus registros existentes.

No se probaron dispositivos físicos, Safari/Firefox, teclado virtual móvil, lector de pantalla, PWA instalada ni secuencia offline del build productivo; SW está desactivado enDEV. Se inspeccionó su código: API network-only, shell/assets y medios conforme al contrato. El offline del cotizador sí se ejerció en el contexto temporal. No se certifican conformidad global WCAG, exactitud integral del motor, share/cámara nativos, impresión física ni rendimiento de campo.

La impresión sólo se inspeccionó por emulación de CSSprint; la captura de 390 px no equivale a una páginaA 4 impresa. El build técnico de B no es ejecución de todas las pruebas ni typecheck. Al no modificar código de producto, no se añadieron suites ni se ejecutó una batería completa.

Las fallas iniciales de selectores del harness, la intercepción accidental de /src/api/ y el métodoGET inicial en una transición se diagnosticaron y corrigieron sólo en scripts privados. Los escenarios avanzados y de producción se repitieron de forma focal y concluyeron correctamente; no se cuentan esos problemas de herramienta como defectos de producto.

## Fuentes normativas

- [W3C: foco no completamente oculto,2.4.11AA](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- [W3C: reflow a320CSSpx,1.4.10AA](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- [W3C: target mínimo24CSSpx y excepciones,2.5.8AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). El proyecto exige 44 px como contrato propio; son criterios distintos.

## Evidencia y siguientes decisiones

Evidencia privada: evidence.json, advanced-evidence.json, extra-evidence.json, accepted-captures.json, contacts/, reviewer-a/assessment-a.md y reviewer-b/assessment-b.md. El informe visual muestra las capturas aceptadas con su ruta y estado. No se ejecutaron las propuestas.

Para un próximo incremento: ¿datos comerciales después del cálculo o sección opcional compacta? ¿Primero protección de precios/alta, acceso móvil o un incremento que reúna ambos? Estas decisiones no son necesarias para considerar entregada la revisión.
