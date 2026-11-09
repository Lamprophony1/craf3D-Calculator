---
version: 1
slug: "web-src-components-filamentpicker-tsx"
primary_target: "web/src/components/FilamentPicker.tsx"
related_targets: ["web/src/screens/FilamentsScreen.tsx","web/src/components/QuickQuoteDialogs.tsx"]
---

# Selección visual de filamento

Modo Operate. Componente web/src/components/FilamentPicker.tsx dentro del cotizador rápido, con alta/edición simple de marcas como apoyo. Extensión del sistema propio, no nueva identidad ni nuevo motor.

Rafa o Clari reconocen un rollo por el color y pueden acotar el catálogo por marca y material o volver a un rollo reciente. La selección sigue identificada al filtrar y sólo elegir otro ID cambia las entradas de la cotización.

El resumen muestra la muestra y el texto del rollo seleccionado. Al abrir, dos selectores compactos de Marca y Material anteceden a seis opciones ampliables en una cuadrícula de dos columnas. Muestra y nombre del color comparten línea, con variante, costo y lote disponibles debajo. Los recientes quedan debajo del catálogo al abrir sin filtros y bajo el resumen del primer plato al cerrar.

Identidad: tokens crema/naranja/ámbar, Chakra Petch y controles rectos. Colores físicos de muestras son contenido, no paleta estructural. Nombres desconocidos conservan texto e icono neutro. Sin logos/fotos inventados.

Estados: carga/bloqueo cierran e inhabilitan exploración; catálogo vacío conserva acción Agregar filamento; filtros vacíos ofrecen limpiar sin modificar selección; activo con borde+check, nombres accesibles, botones nativos y Escape con retorno de foco. Guardado y costo autoritativos continúan en backend.

Datos: manufacturer opcional; omitir conserva la marca, quitarla explícitamente usa Sin fabricante y la UI agrupa Sin marca. No migrar/reescribir marcas inferidas. Una edición simple conserva variante distinta del color. Validación: docs/changes/2026-10-20-filament-picker.md; capturas privadas .impeccable/previews/filament-picker/.
