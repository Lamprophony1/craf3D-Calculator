# PrintCost — sistema de experiencia y diseño

Este documento aplica el skill TypeUI **Impeccable** a una superficie **PRODUCT**. Los fundamentos de accesibilidad, interacción, tipografía, espaciado, responsive y seguridad UX prevalecen; los tokens de Impeccable definen la dirección visual concreta. Los prompts de layout nunca sustituyen el trabajo principal descrito en `PRODUCT.md`.

## Diagnóstico UX previo

La interfaz inicial exponía el modelo técnico en vez de la intención del usuario:

- navegación de escritorio con demasiadas rutas cotidianas y técnicas mezcladas;
- cuatro métricas compitiendo con el precio recomendado;
- jerga como overhead, política, perfil y tarifa en el flujo normal;
- configuración general basada en entidades completas;
- formularios avanzados como cuadrículas continuas de más de veinte controles;
- CSS concentrado en un archivo casi minificado, con valores arbitrarios, radios y sombras inconsistentes;
- códigos técnicos visibles junto a cada warning;
- navegación móvil con exceso de destinos dentro de “Más” y sin contrato completo de foco;
- estado vacío de filamentos sin una acción dentro del flujo principal;
- ausencia de cálculo automático con cancelación de respuestas anteriores;
- guardar presupuesto obliga a una estructura más técnica de lo necesario.

La corrección prioriza reconocimiento sobre memoria, una acción primaria por superficie y progressive disclosure. El precio es la respuesta; el desglose es evidencia opcional.

## Jerarquía de información

### Nivel 1 — tarea

1. ¿Qué filamento?
2. ¿Cuánto tarda?
3. ¿Cuántos gramos?
4. ¿Cuánto cobrar?

### Nivel 2 — acciones del resultado

Copiar, guardar y reiniciar. “Ver cómo se calculó” y “Necesito ajustar algo” quedan subordinadas.

### Nivel 3 — explicación humana

Material, impresión, preparación, embalaje, reserva por fallas, costos generales y ganancia incluida.

### Nivel 4 — detalle técnico

Potencia, tarifa, IDs, política, warnings y códigos. Siempre colapsado o en configuración avanzada.

## Mapa de navegación

```text
PrintCost
├── Cotizar (/)
├── Presupuestos (/quotes)
│   ├── Guardar rápido (dialog)
│   ├── Detalle (/quotes/:id)
│   └── Presupuesto completo (/quotes/new)
├── Pedidos (/jobs)
│   └── Detalle y costos reales (/jobs/:id)
├── Filamentos (/filaments)
│   ├── Nuevo filamento (dialog)
│   └── Detalles avanzados
└── Ajustes (/settings)
    ├── Ajustes de precio
    ├── Restaurar recomendados (confirmación)
    └── Configuración avanzada (/settings/advanced)
        ├── Impresoras y energía
        ├── Tarifas y políticas
        ├── Impuestos y comisiones
        ├── Clientes y plantillas
        ├── Inventario
        ├── Resumen y reportes
        └── Auditoría
```

## Composición mobile-first

Referencia primaria: 390 × 844. Validaciones: 360 × 800, 768 × 1024 y 1440 × 900; además reflow funcional a 320 CSS px y zoom de texto al 200%.

### 390 × 844

- Encabezado compacto con marca, estado de conexión y usuario.
- Título y apoyo alineados al inicio.
- Formulario de una columna, sin cards anidadas.
- Selector de filamento como control ancho.
- Horas y minutos en dos columnas iguales.
- Gramos en una fila.
- CTA de submit táctil ≥44 px.
- Resultado debajo del formulario, sin salto durante loading.
- Navegación inferior con cuatro destinos: Cotizar, Presupuestos, Filamentos y Más.
- Dialogs se presentan como bottom sheets rectangulares.

### Tablet

- Mantiene una columna para el flujo principal cuando favorece la lectura.
- Listas usan filas responsivas de dos zonas.
- Dialogs centrados con ancho limitado.

### Desktop

- Shell con sidebar cotidiana de 264 px y encabezado compacto.
- Formulario y resultado forman dos bloques; resultado visible sin parecer dashboard.
- El bloque de resultado puede permanecer sticky sin ocultar foco.
- El contenido de aplicación es fluido y no usa el contenedor de marketing de 1280 px.

## Sistema visual Impeccable para PRODUCT

### Paleta semántica

- Fondo principal crema: `#F8E9D1` (`neutral-primary-soft`).
- Superficie: `#FFFFFF` (`neutral-primary`).
- Bloque estructural naranja quemado: `#BE3F00`.
- Acción principal ámbar: `#CC8800`.
- Acción ámbar hover/accesible: variante fuerte `#8F5F00` cuando el contraste lo requiere.
- Texto principal: `#1A0F05`.
- Texto secundario: `#4F3220`.
- Bordes: `#D4B27A` o variantes más fuertes según contraste no textual.
- Estados usan las familias success/danger/warning de Impeccable y siempre incluyen icono o texto.

No hay gradientes, glassmorphism, blur, blobs ni sombras. La profundidad usa superficies sólidas, bordes y bloques de color. Las secciones funcionales no alternan artificialmente como una landing; el naranja quemado se reserva a estructura y al panel dominante de precio.

### Tipografía

- Chakra Petch como familia de producto, bundled mediante dependencia del build.
- Pesos usados: 400, 500, 600 y 700.
- JetBrains Mono sólo para códigos e importes técnicos tabulares.
- Base de producto: 1rem, line-height 1.5.
- Títulos de aplicación: máximo 1.75rem/28 px, line-height 1, `text-wrap: balance`.
- Títulos de componentes: 1–1.25rem; no compiten con la página.
- Texto primario y botones: mínimo 1rem.
- Ayuda: mínimo .875rem/14 px.
- Medida de lectura: 45–75 caracteres.
- Sentence case en español; mayúsculas sólo en etiquetas breves con tracking.

### Espaciado

Escala base de 8 px compatible con la grilla de 4:

- 4 px: micro separación de iconos.
- 8 px: label a control.
- 16 px: elementos relacionados.
- 24 px: subgrupos.
- 32 px: título a apoyo cuando corresponde.
- 48 px: grupos mayores en móvil.
- 64/96 px: separación de secciones cuando el contenido lo requiere.

La separación externa de un grupo es mayor que sus gaps internos. Los labels permanecen más cerca de su campo que del grupo siguiente.

### Geometría y profundidad

- Radio del sistema Impeccable: `0` en controles, panels, dialogs y badges.
- Sombras: `none`.
- Borde normal: 1 px; énfasis/foco: 2 px; acento estructural: 3 px.
- Las superficies anidadas evitan cards dentro de cards; cuando son necesarias comparten una única cadena de tokens.

## Componentes

### AppHeader y PrimaryNavigation

- Header compacto con marca y sesión.
- Sidebar desktop de 264 px sólo con cinco destinos cotidianos.
- Activo: superficie ámbar suave + borde de 3 px + `aria-current="page"`.
- Bottom nav móvil de cuatro destinos con targets ≥44 px y safe area.
- “Más” abre dialog/drawer con focus trap, Escape y retorno de foco.
- Primer foco de la página: skip link a `#main-content`.

### QuickQuoteForm

- `form` con tres grupos directos y labels visibles.
- FilamentPicker: combobox/select buscable con acción “Agregar filamento”.
- DurationInput: fieldset con Horas y Minutos.
- Gramos: input numérico con ayuda asociada.
- Submit alternativo visible.
- Validación inline sólo después de interacción o submit.

### PriceResult

- Bloque naranja quemado, rectangular, de alto contraste.
- Una sola cifra dominante, `aria-live="polite"` y `aria-busy` durante cálculo.
- Loading conserva altura y usa “Calculando el mejor precio…”.
- Acciones no envuelven texto y se apilan en móvil si falta ancho.
- Información financiera secundaria sólo dentro de `details`.

### Dialog

- Overlay sólido oscuro al 60%; sin blur.
- Superficie blanca, borde fuerte de 2 px, sin radio ni sombra.
- Focus trap; título accesible; botón cerrar ≥44 px; Escape; click exterior; retorno al trigger.
- En móvil se alinea al fondo como sheet, respetando safe area.

### FilamentRow

- Fila/card editorial compacta, no tabla densa.
- Nombre/color y material dominan; costo por gramo y rollo son secundarios.
- Estado activo/inactivo combina texto e icono.
- Inventario sólo existe visualmente si `isInventoryTracked=true`.

### PricingSettingCard y AdvancedSection

- Una fila por concepto, valor editable y explicación breve.
- Preparación muestra costo derivado como lectura, no campo duplicado.
- Acordeones para configuración avanzada; no se montan veinte formularios simultáneamente.

### InlineNotice y Toast

- Warning no usa código como título.
- Incluye qué falta, por qué importa y acción concreta.
- Código y campo sólo en `details` técnico.
- Toast confirma acciones rutinarias sin bloquear; errores de formulario permanecen junto al control.

### TypeUI Panel

El workflow de TypeUI tiene el panel habilitado. Se implementa como herramienta minimizable indicada por TypeUI, con contenido restringido a logo y texto “TypeUI”, sin estado de cuenta, enlaces ni consumo. No reemplaza navegación ni acciones de producto.

## Estados por flujo

| Flujo | Vacío | Loading | Error | Éxito |
|---|---|---|---|---|
| Cotización | Instrucción de tres datos | Mantiene el panel de precio | Conserva entradas y ofrece reintentar | Precio + copiar/guardar/nuevo |
| Filamentos | “Agregá tu primer filamento…” | Filas skeleton | Mensaje y recarga | Nuevo rollo seleccionado |
| Guardar presupuesto | Campos opcionales vacíos | Botón “Guardando…” deshabilitado | Mantiene valores | Código guardado y cierre |
| Ajustes | Valores actuales | Controles bloqueados con feedback | Error junto a sección | “Cambios guardados” |
| Offline | Borrador recuperado | No simula cálculo | Explica que no puede verificarse | Recalcula al reconectar |

## Contrato de interacción

- Botones: default, hover, active, focus-visible, disabled y loading; success/error cuando aplica.
- Hover 100–150 ms; active 80–120 ms; foco instantáneo.
- Reduced motion elimina transforms y deja cambios de color/borde inmediatos.
- Labels de botones no envuelven; botones no se encogen.
- Selects reemplazan la flecha nativa con chevron consistente.
- Inputs móviles usan al menos 1rem para evitar autozoom.
- No se usa `pointer-events: none` como único disabled.

## Accesibilidad medible

- Texto normal ≥4.5:1; texto grande ≥3:1.
- Bordes, iconos, focus rings y objetos significativos ≥3:1.
- Focus ring de 2–3 px, offset 2 px, visible sobre control y fondo.
- Targets táctiles ≥44 × 44 px y 8 px entre acciones adyacentes.
- Color nunca es el único canal.
- Un único `h1` por vista; niveles sin saltos.
- Dialogs con semántica nativa/ARIA correcta.
- Resize 200%, text spacing overrides, teclado, 320 px y RTL lógico no pierden contenido.

Las relaciones de contraste se calculan para los pares realmente renderizados, incluyendo alpha y estados. Se registran en el QA final.

## CSS

```text
web/src/styles/
├── tokens.css
├── base.css
├── layout.css
├── components.css
├── forms.css
├── screens.css
└── print.css
```

Los colores y medidas repetidos usan variables semánticas. `styles.css` sólo importa módulos. No se introducen utilities arbitrarias ni CSS minificado.

## Arquitectura frontend/backend

- React sólo recoge inputs, presenta resultados y maneja interacción.
- `POST /api/calculations/quick-quote-preview` sigue siendo la fuente del precio.
- `GET/PUT/POST /api/pricing/simple-settings` es una fachada sobre entidades existentes.
- Los dialogs de filamento usan `/api/filaments`.
- Guardar rápido usa `/api/quotes` con el `advancedRequest` resuelto por backend.
- Los detalles avanzados conservan rutas y DTO existentes.
- PWA mantiene API network-only y draft local.

## Checklist de QA visual

- Login.
- Cotización vacía, loading, completa, bloqueada y offline.
- Nuevo filamento y selección automática.
- Guardar presupuesto.
- Ajustes y restauración confirmada.
- Presupuestos y pedidos en español.
- Móvil 360/390, tablet 768, desktop 1440.
- 200% zoom y 320 CSS px.
- Teclado completo, Escape/retorno de foco y reduced motion.
- Impresión de presupuesto.

