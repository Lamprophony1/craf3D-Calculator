# Precios vigentes y accesibilidad móvil

Fecha: 2026-11-06, America/Asuncion.

El usuario eligió trabajar juntos los dos frentes prioritarios de la auditoría y ubicar los datos comerciales después del resultado. Este incremento resuelve F01–F08 del [informe UI/UX](2026-11-06-ui-ux-audit.md), conservando paleta, tipografía, logo, geometría y composición. No modifica precios/configuración comercial, credenciales, datos existentes o producción.

## Comportamiento resultante

- El resultado avanzado deja de estar disponible para copiar/compartir al editar una entrada económica, comenzar otro cálculo, fallar o desconectarse. Abort y versionado impiden que una respuesta anterior lo restaure. El estado de guardado permanece separado para no habilitar escrituras duplicadas al editar.
- Rápido→avanzado parte de un borrador limpio y conserva el request económico completo, incluidos cantidad/base, tiempos, energía, impuestos, scopes, costos y contexto. No hereda líneas u otros valores del presupuesto anterior.
- Los campos de horas aceptan precisión libre: 3h40m conserva su duración decimal, sin redondear a 3,66/3,67h ni bloquear el submit nativo. También se aplica al tiempo ocupado y las líneas adicionales.
- Presupuesto completo muestra y copia el agregado autoritativo de todas sus líneas. Preview y guardado reciben el mismo array; los costos fijos se declaran una vez. No se suman precios redondeados en React.
- Nuevo filamento acepta un costo entero positivo, por ejemplo Gs.140.000, y conserva la posibilidad de registrar centavos existentes. Cero y negativos siguen rechazados; el rollo guardado se selecciona automáticamente.
- Todos los selectores avanzados identifican marca/material/color/variante y costo del rollo/peso, conservando su ID exacto.
- El orden del cotizador es Filamento → Tiempo → Gramos → Resultado → Datos para el presupuesto. Cliente/referencia y descripción son opcionales y permanecen montados para conservar foco y entradas mientras se actualiza el mismo borrador. En escritorio quedan debajo del precio, en su columna; en móvil siguen al resultado.
- El documento contempla la cabecera y navegación fija al desplazar el foco. Auditoría apila propiedades en móvil y parte valores técnicos largos dentro del ancho disponible.

## Contrato y arquitectura

Se añadió `POST /api/calculations/quote-aggregate-preview`, con la autenticación y validación de los previews existentes. Recibe `{lines}` y devuelve `{aggregate, lines, canUsePrice, warnings}`. `QuoteWorkflowService.PreviewAggregateAsync` reutiliza `CalculateRevisionAsync`, utilizado por alta/edición; no guarda cotizaciones, consume códigos, registra auditoría ni altera stock.

Se mantienen las cuatro capas, los endpoints de preview individual/rápido y el contrato de guardado. No se añadieron dependencias ni se cambiaron lockfiles, motor decimal o esquema. La [definición](../superpowers/specs/2026-11-06-price-mobile-fixes-design.md) y el [plan](../superpowers/plans/2026-11-06-price-mobile-fixes.md) precedieron la implementación y tuvieron chequeo independiente de implementabilidad.

## Verificación

| Comprobación | Resultado |
|---|---|
| Backend completo | **103 correctas:** Domain 32, Application 37, Infrastructure 6, API 28. |
| Frontend completo | **124 correctas**, 18 archivos. |
| Tipos aplicación/Node y build Vite | Correctos. |
| Costo entero | Regresión RED→GREEN: antes no se enviaba Gs.140.000; ahora se guarda sin alterar el importe. Cero/negativos rechazados. |
| Preview agregado | Fixtures independientes con fijos, mínimo, redondeo e impuestos; igualdad con Create/Update. SQLite temporal confirma ausencia de escrituras y preserva el primer código0001. |
| Navegador integrado | Ocho checks F01–F08 sobre API real local y SQLite nueva, con datos sintéticos. |
| Rápido e importación avanzada | Mismo resultado Gs.75.000 con fixture recomendado; cantidad10/4kWh/líneas anteriores no se heredan. |
| Multilínea | Gs.135.000 en preview, portapapeles y agregado guardado; preview no incrementa la lista de cotizaciones. |
| Resultado obsoleto | Edición, respuesta tardía y error no dejan acciones de cliente disponibles. Desconexión cubierta por regresiones web. |
| Foco y reflow | Tab a390×832/844 sin controles de main completamente tapados. Auditoría con ancho de documento320/390/1440 igual al viewport. |
| Precisión de horas | Chrome nativo RED→GREEN con 3,6666… h en tres campos; formulario válido y POST agregado conserva ambas duraciones exactas. Regresión persistente añadida. |
| Detector Impeccable | Una ejecución sobre los seis targets web afectados: exit 0, 0 hallazgos. |
| Revisión independiente | **ship para F01–F08** después de resolver el único hallazgo de cierre sobre horas periódicas. |

Las pruebas relevantes observaron el fallo antes de implementar. El estado inicial ya tenía 108 pruebas web y 89 backend correctas. La primera ronda de aceptación generó 21 capturas y pasó los ocho checks; la revisión independiente encontró que las horas periódicas no estaban cubiertas por el ejemplo 5h24. Se corrigió ese punto y se agregó una confirmación focal con validación HTML real. La segunda ronda conjunta volvió a pasar los ocho checks, sin errores de JavaScript.

Los importes de aceptación pertenecen a una base aislada con recomendaciones iniciales. No sustituyen los ajustes productivos del caso131,04g/3h40m ni afirman haber consultado o cambiado producción.

## Evidencia

Capturas y trazas privadas: `.impeccable/price-mobile-fixes/`. `backend.md` y `advanced.md` registran RED/GREEN, comandos y límites; `acceptance.json` documenta los ocho recorridos y las capturas; `imported-hours-native-{red,green}.json` conserva la comprobación de precisión; `detector.json` contiene el resultado completo.

- [Cotizador en escritorio](../../.impeccable/price-mobile-fixes/captures/quick-result-1440.png).
- [Datos comerciales después del resultado en móvil](../../.impeccable/price-mobile-fixes/captures/commercial-saved-390.png).
- [Agregado multilínea](../../.impeccable/price-mobile-fixes/captures/multiline-aggregate-1440.png).
- [Auditoría a320px](../../.impeccable/price-mobile-fixes/captures/audit-reflow-320.png).

La revisión visual combinó escritorio1440 y móvil390, con reflow320 y alturas832/844 para foco. Las capturas fullPage no se interpretaron como prueba de superposición de elementos fijos; el foco se verificó también con bounds/estado del elemento activo.

## Operación y límites

Preview habitual: `http://127.0.0.1:5173`; API: `http://127.0.0.1:5080`, salud en `/health`. Se actualiza únicamente el proceso propio identificado por el launcher local y se conserva la base existente. Los guardados de aceptación se dirigieron a API5081 con una base nueva; ese proceso temporal se detiene al cerrar. No se hizo push ni despliegue.

No se probaron dispositivos físicos, Safari/Firefox, lector de pantalla, PWA instalada, login productivo, cámara/share nativos o impresión física. No se afirma conformidad global WCAG ni exactitud integral del motor. Las propuestas F09–F14 y la revisión de dominio fuera de estos recorridos permanecen en backlog. El informe de auditoría se conserva como registro histórico, sin reemplazar sus capturas por las posteriores.
