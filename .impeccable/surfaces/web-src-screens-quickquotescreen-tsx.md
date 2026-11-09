---
version: 1
slug: "web-src-screens-quickquotescreen-tsx"
primary_target: "web/src/screens/QuickQuoteScreen.tsx"
related_targets: ["web/src/components/ClientQuoteShareDialog.tsx","web/src/components/FilamentPicker.tsx"]
---

# Cotización rápida — web/src/screens/QuickQuoteScreen.tsx

Modo: Operate. Ruta `/`, aplicación autenticada. Extensión implementada el 2026-10-20, conservando la identidad y composición existentes.

Tarea: elegir filamento, horas/minutos y gramos; obtener y compartir un precio autoritativo. Cliente/referencia libre y descripción opcional identifican lo presupuestado sin alta de cliente.

**Agregar plato** permite extender el mismo trabajo con grupos numerados de filamento, horas/minutos y gramos. **Repeticiones** va junto al título de cada plato, parte en 1 y aplica los datos de ese plato a todas sus impresiones. La cotización se guarda cuando todos los platos son válidos. Hay un solo total del servidor y un resumen de impresiones, tiempo y peso. El documento y el ajuste conservan cada plato guardado y sus repeticiones.

Jerarquía: tres grupos de cálculo más metadatos comerciales, una cifra dominante y desglose colapsado. Formulario/resultado en dos columnas desde 1200px y una debajo; shell compacto hasta 1100px. Presupuesto compartido mantiene cliente, descripción, material, gramos, duración y pie dentro del cuadrado.

Decisión del 2026-11-06: Filamento → Tiempo → Gramos → Resultado → Datos comerciales opcionales. Cliente/referencia y descripción quedan después del resultado en DOM y móvil, y debajo de su panel en la columna derecha de escritorio. Los campos permanecen montados al recalcular y conservan foco/entradas mientras se actualiza el mismo borrador. El label de referencia explicita su condición opcional. El foco por teclado debe quedar visible fuera de la cabecera y navegación fija, incluso en alturas móviles reducidas.

Continuidad: una edición válida guarda automáticamente en Presupuestos como pendiente de aceptación; responder tarde o reintentar no duplica. Abrir presupuesto lleva a `/quotes/pending/:id`, desde donde se completa y confirma el mismo registro en Pedidos. Metadatos y confirmación conservan el precio. Nuevo cálculo preserva el anterior y sigue disponible ante conflicto. Web Locks distinguen recarga de pestaña duplicada; el fallback inicia otra sesión al navegar. Restaurar entradas pasivamente no crea registro.

Estados: vacío, calculando/guardando, guardado con enlace, error y reintento, pendiente sin conexión, costos faltantes. Conservar entradas; no mostrar precio o guardado como verificado antes de respuesta. Copiar usa el resultado del guardado vigente. Confirmar/descartar/editar comercialmente bloquea escrituras de la sesión antigua.

Identidad: DESIGN.md y tokens propios, sin cambio de paleta, tipografía o geometría. Evidencia y límites: docs/changes/2026-10-20-orders-management.md. No se acredita auditoría global de accesibilidad ni dispositivos físicos.

El selector de filamento muestra el rollo exacto y, al abrir, dos filtros compactos de Marca y Material con muestras de color inmediatamente debajo. Abrir o filtrar conserva el borrador. Elegir aplica el ID del rollo al cálculo. Los resultados se amplían de seis en seis. Los recientes quedan debajo del catálogo abierto. Variante, costo y lote conservan la identificación. Escape y pérdida de disponibilidad cierran el selector.
