---
version: 1
slug: "web-src-screens-quickquotescreen-tsx"
primary_target: "web/src/screens/QuickQuoteScreen.tsx"
related_targets: ["web/src/components/ClientQuoteShareDialog.tsx","web/src/components/FilamentPicker.tsx"]
---

# Cotización rápida — web/src/screens/QuickQuoteScreen.tsx

Modo: Operate. Ruta `/`, aplicación autenticada. Extensión implementada el 2026-10-20, conservando la identidad y composición existentes.

Tarea: elegir filamento, horas/minutos y gramos; obtener y compartir un precio autoritativo. Cliente/referencia libre y descripción opcional identifican lo presupuestado sin alta de cliente.

Jerarquía: tres grupos de cálculo más metadatos comerciales, una cifra dominante y desglose colapsado. Formulario/resultado en dos columnas desde 1200px y una debajo; shell compacto hasta 1100px. Presupuesto compartido mantiene cliente, descripción, material, gramos, duración y pie dentro del cuadrado.

Continuidad: una edición válida guarda automáticamente en Presupuestos como pendiente de aceptación; responder tarde o reintentar no duplica. Abrir presupuesto lleva a `/quotes/pending/:id`, desde donde se completa y confirma el mismo registro en Pedidos. Metadatos y confirmación conservan el precio. Nuevo cálculo preserva el anterior y sigue disponible ante conflicto. Web Locks distinguen recarga de pestaña duplicada; el fallback inicia otra sesión al navegar. Restaurar entradas pasivamente no crea registro.

Estados: vacío, calculando/guardando, guardado con enlace, error y reintento, pendiente sin conexión, costos faltantes. Conservar entradas; no mostrar precio o guardado como verificado antes de respuesta. Copiar usa el resultado del guardado vigente. Confirmar/descartar/editar comercialmente bloquea escrituras de la sesión antigua.

Identidad: DESIGN.md y tokens propios, sin cambio de paleta, tipografía o geometría. Evidencia y límites: docs/changes/2026-10-20-orders-management.md. No se acredita auditoría global de accesibilidad ni dispositivos físicos.

Selección de filamento actualizada el 2026-10-20: resumen compacto del rollo exacto, filtros combinables Marca/Material, muestras de color con nombre y búsqueda de varias palabras. Abrir/filtrar no modifica el borrador; elegir sí aplica su ID al cálculo existente. Resultados de seis en seis y recientes locales de activos. Marca opcional editable, sin inferencias desde nombres; variantes, costo y lote conservan la identificación. Cierre por Escape y por pérdida de disponibilidad. Contrato específico del componente y docs/changes/2026-10-20-filament-picker.md completan esta superficie.
