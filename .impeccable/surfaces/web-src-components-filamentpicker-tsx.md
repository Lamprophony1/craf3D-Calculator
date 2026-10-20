---
version: 1
slug: "web-src-components-filamentpicker-tsx"
primary_target: "web/src/components/FilamentPicker.tsx"
related_targets: ["web/src/screens/FilamentsScreen.tsx","web/src/components/QuickQuoteDialogs.tsx"]
---

# Selección visual de filamento

Modo Operate. Componente web/src/components/FilamentPicker.tsx dentro del cotizador rápido, con alta/edición simple de marcas como apoyo. Extensión del sistema propio, no nueva identidad ni nuevo motor.

Trabajo: Rafa o Clari encuentran un rollo por marca, material y color, o vuelven a uno reciente, sin leer un select largo. Mantener la selección identificada aunque no coincida con la búsqueda; sólo elegir otro ID cambia las entradas de la cotización.

Composición: resumen del seleccionado con muestra y texto; explorador inline desplegable, filtros combinables de marca/material, buscador por varias palabras y opciones de color con nombre/variante/costo/lote. Seis resultados iniciales ampliables. Recientes en filas compactas. Dos columnas de opciones; una debajo de360px. Sin modal ni tres etapas obligatorias.

Identidad: tokens crema/naranja/ámbar, Chakra Petch y controles rectos. Colores físicos de muestras son contenido, no paleta estructural. Nombres desconocidos conservan texto e icono neutro. Sin logos/fotos inventados.

Estados: carga/bloqueo cierran e inhabilitan exploración; catálogo vacío conserva acción Agregar filamento; filtros vacíos ofrecen limpiar sin modificar selección; activo con borde+check, nombres accesibles, botones nativos y Escape con retorno de foco. Guardado y costo autoritativos continúan en backend.

Datos: manufacturer opcional; omitir conserva la marca, quitarla explícitamente usa Sin fabricante y la UI agrupa Sin marca. No migrar/reescribir marcas inferidas. Una edición simple conserva variante distinta del color. Validación: docs/changes/2026-10-20-filament-picker.md; capturas privadas .impeccable/previews/filament-picker/.
