# Selección visual de filamentos — 2026-10-20

El selector anterior obligaba a buscar dentro de un select largo; sus opciones omitían la marca y la búsqueda tampoco la incluía. El usuario pidió una alternativa visual o por subselecciones como Marca → PLA → Blanco. Se implementa una extensión acotada del cotizador existente, con Impeccable en modo Operate y conservando la identidad de craf3D.

## Decisión y recorrido

Filtros combinables de **Marca** y **Material** más opciones visuales con color y nombre. A diferencia de un recorrido obligatorio de tres pasos, permite elegir por marca, ir directo a un color o buscar varias palabras en marca, material, color, variante y lote, ignorando acentos. Conserva el rollo seleccionado visible mientras se busca.

El control cerrado muestra el rollo elegido; al abrirlo aparece el buscador y los filtros dentro del formulario. Las opciones muestran color, marca/material, variante y costo por gramo. La selección usa su ID exacto. Abrir, buscar, filtrar o ampliar resultados no selecciona otro rollo ni genera una cotización. Elegir cierra el selector y devuelve el foco; Escape cierra sin cambiar datos.

Los primeros seis resultados mantienen acotada la búsqueda visual; se pueden ampliar de seis en seis. Los últimos cinco IDs elegidos se guardan localmente y se ofrecen accesos compactos a los que siguen activos. No se registra como reciente una restauración pasiva del formulario. Las muestras de nombres habituales son orientativas; los colores especiales conservan su nombre y un icono neutro, sin inventar una muestra exacta.

## Datos y precio

La marca pasa a ser un campo opcional en alta/edición cotidiana de Filamentos. Los registros sin fabricante quedan en **Sin marca**; no se infieren marcas a partir de texto libre ni se modifican rollos existentes automáticamente. La API añade `manufacturer` opcional al contrato simple, sin migración de esquema. Una edición anterior que lo omite conserva la marca. Completarla conserva costos, inventario y nombres de variante ya registrados.

El precio continúa calculándose en el backend con el rollo elegido. La UI sólo presenta su costo por gramo para identificarlo. No se cambian fórmulas, tarifas, políticas ni presupuestos productivos. La cotización rápida y su guardado en Presupuestos mantienen el recorrido vigente.

## Verificación

- Regresiones RED → GREEN para filtros, búsqueda, selección exacta, recientes y teclado; prueba de catálogo de 30 rollos.
- Regresión API para marca opcional, edición compatible, conservación de costos exactos y variante. Se reprodujo y corrigió que editar desde el formulario simple reemplazaba una variante distinta por el color.
- Backend: 89 pruebas correctas (32 Domain, 25 Application, 6 Infrastructure, 26 API).
- Frontend: 108 pruebas correctas en 16 archivos; tipos y build Vite correctos. Se adaptaron las expectativas del select anterior al contenido del nuevo control sin retirar las verificaciones de precio, restauración ni respuesta tardía.
- Playwright: 21 recorridos correctos.
- Chrome con API local y base aislada: 13 comprobaciones correctas, cero errores de página. Incluye filtros sin cotizar, rollo exacto, mismo presupuesto con otro costo, búsqueda vacía que no cambia la selección, Escape, recientes y restauración al recargar.
- Caso Creality blanco de 131,04 g y 3 h 40 min: Gs.60.000 con los ajustes auditados. Otra selección se contrastó contra el preview del backend para su propio costo.
- Revisión de escritorio 1440px, móvil 390px y reflow 320px. Se compactaron los recientes en una única tanda y se recapturaron los mismos estados. Evidencia privada en `.impeccable/previews/filament-picker/` y `.artifacts/filament-picker/`. Detector ejecutado una vez: `[]`.

La revisión independiente dio **ship**, sin hallazgos importantes. Señaló dos detalles menores que se reprodujeron y corrigieron en una tanda: el selector abierto se cierra al quedar sin conexión/cargando y el resumen conserva el lote conocido. El pase acotado posterior marcó ambos como resueltos. Tres comprobaciones Chrome adicionales acreditan lote visible, cierre sin cambiar rollo al desconectar y permanencia cerrado al reconectar; capturas y `minor-evidence.json` junto a la evidencia inicial.

No se acredita validación en dispositivos físicos ni medición con catálogos de miles de rollos. Las muestras de colores son una ayuda visual, no una carta de color del fabricante. La suite E2E general pasó antes de los dos últimos ajustes; éstos se comprobaron con las regresiones, build y recorridos específicos indicados.

## Prueba local

Cotizador: <http://127.0.0.1:5173/>. API: <http://127.0.0.1:5080/health>. Se mantienen servicios levantados y la base local persistente. Los rollos sintéticos adicionales llevan **PRUEBA LOCAL** en el nombre de producto; no se modificaron producción ni sus filamentos. Cambios conservados en la rama local `feat/orders-workflow`, junto a los incrementos anteriores.
