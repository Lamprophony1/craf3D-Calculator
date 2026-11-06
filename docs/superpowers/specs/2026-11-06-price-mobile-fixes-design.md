# Precios vigentes y acceso móvil — definición del incremento

Fecha: 2026-11-06, America/Asuncion.

## Decisiones y autorización

Después de la auditoría, el usuario eligió **ambos frentes** (precios/alta de filamentos y accesibilidad móvil) y los datos comerciales **después del resultado**. Esta definición concreta esas decisiones; no abre un rediseño ni una publicación. El informe y sus criterios ya presentados son la base del incremento.

## Alcance

Resolver F01–F07 de `docs/changes/2026-11-06-ui-ux-audit.md` y aplicar la posición solicitada en F08. Las demás propuestas de simplificación, reportes, menú y rendimiento siguen como backlog. Reutilizar cuatro capas, motor decimal, React/CSS y componentes actuales, sin dependencias, migraciones ni cambios de configuración comercial.

## Diseño funcional

1. **Resultado avanzado vigente:** cualquier edición económica invalida inmediatamente el resultado y las acciones de cliente. Una solicitud tiene identidad/versionado; las respuestas anteriores o que llegan después de editar, fallar o desmontar la pantalla no reactivan resultados. Una desconexión impide presentar el precio como verificado. Los errores se distinguen de una confirmación de éxito.
2. **Importación completa:** rápido→avanzado comienza desde `emptyDraft`, aplica todos los campos económicos de su request (cantidad/base, tiempos, energía, materiales, trabajo, extras, precio y contexto) y limpia líneas independientes anteriores. La primera cotización avanzada conserva los supuestos y el precio rápido. Los campos de horas aceptan la precisión del servidor: 3h40m no se redondea a 3,66/3,67h para superar la validación nativa, tampoco al añadir otra línea.
3. **Preview multilínea autoritativo:** añadir un endpoint de sólo cálculo que reutiliza exactamente la agregación del guardado. No persiste una cotización ni altera auditoría, contador de códigos, stock o datos. El frontend envía las mismas líneas que guardará, incluidos costos fijos sólo en la primera, y presenta/copia el agregado vigente.
4. **Alta de filamento:** aceptar un costo entero positivo en Gs. sin exigir centavos; mantener validación de cero/negativos, conservación de entradas y selección automática al guardar.
5. **Foco móvil:** el desplazamiento al enfocar contempla cabecera y navegación fija. No añadir reservas inferiores duplicadas. Confirmar que Gramos y los demás campos no queden tapados al usar Tab/Shift+Tab a 390×832 y otras alturas.
6. **Auditoría a 320px:** apilar propiedades/valores en ancho estrecho y permitir partir identificadores, fechas y acciones largas sin ampliar el documento. No transformar esta tarea en una nueva experiencia de reportes.
7. **Rollos reconocibles:** incluir marca, material, color, variante y/o costo en los selectores avanzados, segundo material y líneas adicionales. Mantener IDs exactos, sin deducir ni cambiar marcas en registros.
8. **Datos comerciales después del resultado:** en el DOM y en móvil, el flujo es Filamento→Tiempo→Gramos→Resultado→Cliente/referencia y descripción opcionales. En escritorio se conserva la composición de dos columnas y el grupo comercial continúa debajo del resultado. Los campos permanecen montados mientras se recalcula/guarda para no perder foco ni entradas. Se conserva el borrador único y su guardado automático.

## Contrato de preview agregado

- `POST /api/calculations/quote-aggregate-preview`.
- Request `QuoteAggregatePreviewRequest`: `{ lines: QuoteLineRequest[] }`.
- Response `QuoteAggregatePreviewResult`: `{ aggregate: QuoteAggregateRecord, lines: QuoteLineRecord[], canUsePrice: boolean, warnings: PriceWarning[] }`.
- `QuoteWorkflowService.PreviewAggregateAsync(request, cancellationToken)` reutiliza la construcción de agregados que usa `CreateAsync`/`UpdateDraftAsync`, sin llamar a persistencia o al contador de código.
- Se conservan `/quote-preview`, `/quick-quote-preview` y el contrato de guardado existentes. No se agregan fórmulas financieras al frontend.
- El frontend usa este endpoint en Presupuesto completo incluso si hay una única línea; Cálculo avanzado conserva el preview individual. El resultado agregado usa sus valores autoritativos aplanados, no suma totales redondeados individuales.

## Enfoque elegido

La extensión aditiva del preview compartiendo el cálculo existente es la opción compatible con el producto: evita duplicar fórmulas y mantiene snapshots/guardado. Calcular precios en React contradice la autoridad del backend; guardar documentos sólo para previsualizar introduciría escrituras y duplicados. No se cambia el motor de dominio ni la distribución de impuestos fuera del alcance auditado.

Decisiones rutinarias del implementador: separar helpers de construcción de líneas si facilita probar contratos; usar estilos locales existentes para el grupo comercial y el reflow. No se pide elegir paleta, tipografía, presets o una nueva navegación.

## Verificación

- Regresiones de importación limpia, invalidación inmediata, respuesta fuera de orden, fallo/offline y copia vigente. Incluir 131,04g/3h40m y submit nativo del navegador con horas periódicas.
- Igualdad entre agregado preview y guardado con dos líneas, costos fijos, mínimo/redondeo y condiciones globales; comprobar que preview no escribe.
- Alta UI con Gs.140.000 y rechazo de cero/negativo; IDs y etiquetas distinguibles de rollos similares.
- Navegador en escritorio1440 y móvil390/320: recorrido rápido, metadatos tras resultado, compartir, importación, preview/guardado multilínea, foco no tapado y Auditoría sin overflow. Ronda conjunta, correcciones en lote y confirmación.
- Suites pertinentes, tipos/build, dominio y contratos afectados. Detector Impeccable una vez sobre los archivos web cambiados, revisión independiente y evidencia privada en `.impeccable/`.
- Conservar datos y accesos; al terminar dejar API5080 y web5173 actualizados y comprobar salud y pantalla servida. Sin push ni despliegue por esta tarea.
