---
name: craf3D Calculator
description: Calculadora de impresión 3D con fondo crema, naranja quemado y ámbar.
colors:
  cream: "#f8e9d1"
  cream-light: "#fff8ed"
  cream-deep: "#ead3b1"
  ink: "#26170f"
  ink-muted: "#654d3d"
  burnt: "#9f3500"
  burnt-strong: "#7c2900"
  amber: "#9a6500"
  amber-action: "#cc8800"
  white: "#fffdf8"
  danger: "#a52222"
  success: "#246b38"
  border: "#8c5d3d"
  surface: "#fffdf8"
  text-muted: "#654d3d"
  accent: "#9f3500"
  accent-contrast: "#fff"
  warning-bg: "#fff1cd"
  focus: "#174ea6"
typography:
  body:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "1rem"
  quick-heading:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    lineHeight: 1.08
  price:
    fontFamily: "Chakra Petch, system-ui, sans-serif"
    fontSize: "clamp(2.35rem, 5.5vw, 4.75rem)"
    lineHeight: 1
    letterSpacing: "-0.04em"
rounded:
  control: "0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-quote:
    backgroundColor: "{colors.amber-action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-default:
    backgroundColor: "{colors.burnt}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# craf3D Calculator — sistema de experiencia y diseño

Sistema visual propio, conservado por decisión del usuario del 2026-10-20 al migrar las herramientas de desarrollo. Impeccable independiente guía el diseño y la revisión; shadcn aporta apoyo técnico cuando haga falta. El código actual de `web/src/styles/tokens.css` y sus módulos es la evidencia de los valores implementados; el frontmatter refleja esos tokens, no una paleta del proveedor. Los prompts de layout nunca sustituyen el trabajo principal descrito en `PRODUCT.md`. Procedimiento en `docs/ui-ux.md`.

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
│   ├── Pendientes / Con pedido / Descartados
│   ├── Ficha pendiente (/quotes/pending/:id) → Confirmar pedido
│   ├── Detalle (/quotes/:id)
│   └── Presupuesto completo (/quotes/new)
├── Pedidos (/jobs)
│   ├── Nuevo pedido / trabajo anterior (/orders/new)
│   ├── Ficha comercial (/orders/:id)
│   └── Producción y costos reales (/jobs/:id)
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
- Navegación inferior con cuatro destinos: Cotizar, Presupuestos, Pedidos y Más. Filamentos permanece dentro de Más.
- Dialogs se presentan como bottom sheets rectangulares.

### Tablet

- Mantiene una columna para el flujo principal cuando favorece la lectura.
- Listas usan filas responsivas de dos zonas.
- Dialogs centrados con ancho limitado.

### Desktop

- Shell con sidebar cotidiana de 14rem (224px a base de 16px) y encabezado compacto de 4rem.
- Formulario y resultado forman dos bloques; resultado visible sin parecer dashboard.
- El bloque de resultado puede permanecer sticky sin ocultar foco.
- El contenido de aplicación es fluido y no usa el contenedor de marketing de 1280 px.

## Sistema visual de craf3D

### Paleta semántica

- Fondo principal: `cream`; formularios y navegación: `cream-light`; paneles secundarios: `cream-deep`.
- Superficies: `surface`/`white`, blanco cálido.
- Estructura y panel de precio: `burnt`; énfasis fuerte: `burnt-strong`.
- Acción destacada: `amber-action` con texto `ink`; `amber` es una variante más oscura existente.
- Texto principal: `ink`; secundario: `ink-muted`/`text-muted`.
- Bordes: `border`. Foco: `focus`, con contraste especial blanco en el encabezado naranja.
- Estados: `success`, `danger` y `warning-bg`, acompañados de icono o texto.

Los valores exactos figuran en el frontmatter y corresponden al CSS actual. Se sustituyeron los valores obsoletos de la guía sin modificar estilos renderizados. Los alias semánticos se resuelven en `tokens.css`; no son clases de un framework.

No hay gradientes, glassmorphism, blur, blobs ni sombras. La profundidad usa superficies sólidas, bordes y bloques de color. Las secciones funcionales no alternan artificialmente como una landing; el naranja quemado se reserva a estructura y al panel dominante de precio.

### Tipografía

- Chakra Petch como familia de producto, bundled mediante dependencia del build.
- Pesos usados: 400, 500, 600 y 700.
- JetBrains Mono para códigos e importes tabulares, incluido el precio de la tarjeta compartible para cliente.
- Base de producto: 1rem, line-height 1.5.
- El título del cotizador usa `quick-heading` (28–40px); los títulos generales usan `clamp(1.5rem, 3vw, 2.15rem)`. No aplicarles una escala de marketing por cambiar de herramienta.
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

- Radio del sistema propio: `0` en controles, panels, dialogs y badges, salvo un tratamiento particular ya implementado en su módulo.
- Sombras: `none`.
- Borde normal: 1 px; énfasis/foco: 2 px; acento estructural: 3 px.
- Las superficies anidadas evitan cards dentro de cards; cuando son necesarias comparten una única cadena de tokens.

## Componentes

### AppHeader y PrimaryNavigation

- Header compacto con marca y sesión.
- Sidebar desktop de 14rem con navegación cotidiana y utilidades existentes.
- Activo: superficie naranja quemado, texto blanco y borde de inicio de 3px; `aria-current="page"`.
- Bottom nav móvil de cuatro destinos con targets ≥44 px y safe area.
- Pedidos queda activo también al abrir una ficha `/orders/:id` o el alta `/orders/new`; Más contiene el acceso a Presupuestos.
- “Más” abre dialog/drawer con focus trap, Escape y retorno de foco.
- Primer foco de la página: skip link a `#main-content`.

### QuickQuoteForm

- `form` con tres grupos directos y labels visibles.
- FilamentPicker: control de apertura inline con resumen del rollo elegido; filtros combinables de Marca/Material, búsqueda por varias palabras y opciones con muestra de color y texto. No es un select de catálogo completo. Agregar filamento se mantiene al lado del flujo.
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
- Nombre/color, marca y material identifican el rollo; costo por gramo y rollo son secundarios.
- Estado activo/inactivo combina texto e icono.
- Inventario sólo existe visualmente si `isInventoryTracked=true`.

### Selección visual de filamento

- El resumen conserva la selección actual aunque los filtros no la incluyan. Abrir, buscar, filtrar o mostrar más no cambia el precio.
- Filtros con botones rectangulares y `aria-pressed`, en cualquier orden; se muestran sólo cuando hay varias marcas/materiales. Marca ausente se presenta como Sin marca.
- Resultados en dos columnas, o una a menos de 360px. Seis opciones inicialmente. Las muestras representan el material y no introducen colores de marca en la estructura de la app; siempre se acompañan de texto. Variantes, costo por gramo y lote conocido diferencian rollos parecidos.
- Selección activa combina borde y check. Botones nativos ≥44px, nombres accesibles que identifican rollo/costo, foco visible, Escape y retorno al control. Sin modal, foco atrapado ni pasos obligatorios de un asistente.
- Recientes usan filas compactas con el mismo lenguaje; son accesos locales a IDs de rollos activos, no una nueva lista de precios.
- Mantener fondo crema, Chakra Petch y geometría rectangular. No se incorporan fotografías, logos de fabricantes ni librerías nuevas. Evidencia y límites en `docs/changes/2026-10-20-filament-picker.md`.

### Lista y ficha comercial de pedidos

Modo Operate, como extensión del shell y los controles existentes. Confirmados, Borradores, Historial y Descartados son botones de vista con estado `aria-pressed`; la vista activa utiliza naranja quemado y texto blanco. La búsqueda permanece visible. **Nuevo pedido** es la acción principal; las acciones de fila quedan junto a su pedido.

- La fila prioriza referencia, descripción y código/cantidad/posición; entrega prevista e importe son un segundo grupo, y el estado siempre se escribe. **Sin definir** y **Sin fecha** expresan ausencias sin convertirlas en cero o fechas ficticias.
- En escritorio, identidad, datos y acciones forman tres zonas. En el shell compacto las acciones pasan debajo; hasta 600px las filas son de una columna, las vistas se distribuyen en dos columnas y las acciones admiten salto de línea. Subir, Bajar y Poner primero tienen nombres accesibles referidos al pedido y controles de al menos 44px.
- La ficha mantiene una columna de lectura con pares de cantidad/importe y fechas en escritorio, apilados en móvil. Referencias largas se parten sin desbordar a 320px. Labels visibles, ayuda de importe total y errores de confirmación junto al campo; el dato comercial libre no requiere selector de catálogo.
- Guardar/crear es la acción principal de la ficha. Confirmar y el seguimiento son acciones explícitas. **Presupuesto, producción y costos** queda colapsado; la falta de costos se comunica como ganancia sin calcular.
- Durante una escritura, el grupo de campos y las acciones quedan deshabilitados hasta la respuesta. Carga, vacío, búsqueda sin coincidencias y error son estados distintos. Los errores conservan las entradas y ofrecen recuperación; un conflicto permite actualizar la versión sin perder lo pendiente y exige revisar antes de guardar.

### Datos comerciales en el presupuesto de cliente

La referencia y la descripción opcionales aparecen bajo **Presupuesto personalizado**, antes del precio. Se conserva la tarjeta cuadrada, el logo, el panel naranja quemado con acento ámbar, JetBrains Mono para la cifra y las tres especificaciones de material, peso y tiempo. El espacio del precio se ajusta cuando hay datos comerciales para mantener las especificaciones y el pie completo con referencia, fechas y nota. La unidad de escala responde al ancho de la tarjeta; la vista previa móvil y la exportación conservan esa jerarquía sin recortar el pie. Este ajuste no crea una paleta, tipografía o composición global nuevas.

### PricingSettingCard y AdvancedSection

- Una fila por concepto, valor editable y explicación breve.
- Preparación muestra costo derivado como lectura, no campo duplicado.
- Acordeones para configuración avanzada; no se montan veinte formularios simultáneamente.

### InlineNotice y Toast

- Warning no usa código como título.
- Incluye qué falta, por qué importa y acción concreta.
- Código y campo sólo en `details` técnico.
- Toast confirma acciones rutinarias sin bloquear; errores de formulario permanecen junto al control.

### Herramientas de desarrollo

Impeccable independiente y la guía shadcn/ui se utilizan localmente con el método adaptado de SorteoApp. Los componentes React/CSS del proyecto se reutilizan primero; incorporar shadcn requiere una necesidad concreta y adaptación al sistema propio. Las herramientas están separadas del runtime y de la imagen de producción. Guías antiguas de TypeUI retiradas; instalación y procedencia en `tools/ui/`.

## Estados por flujo

| Flujo | Vacío | Loading | Error | Éxito |
|---|---|---|---|---|
| Cotización | Instrucción de tres datos | Mantiene el panel de precio | Conserva entradas y ofrece reintentar | Precio + copiar/guardar/nuevo |
| Filamentos | “Agregá tu primer filamento…” | Filas skeleton | Mensaje y recarga | Nuevo rollo seleccionado |
| Guardar presupuesto | Campos opcionales vacíos | Botón “Guardando…” deshabilitado | Mantiene valores | Código guardado y cierre |
| Presupuesto rápido | Explica que la cotización queda pendiente de aceptación en Presupuestos | “Calculando y guardando presupuesto…” | Reintentar guardado; Nuevo cálculo disponible sin resultado | “Borrador guardado en Presupuestos” + Abrir presupuesto |
| Pedidos | Mensaje propio de vista o búsqueda + siguiente acción | “Cargando pedidos…” | Actualizar lista sin fingir un vacío | Confirmación de estado/prioridad y lista actualizada |
| Ficha comercial | Alta parcial o trabajo anterior | Campos bloqueados durante escritura | Conserva datos; actualizar versión ante conflicto | Cambios guardados o estado actualizado |
| Ajustes | Valores actuales | Controles bloqueados con feedback | Error junto a sección | “Cambios guardados” |
| Offline | Borrador recuperado | No simula cálculo | Explica que no puede verificarse | Recalcula al reconectar |

## Contrato de interacción

Presupuestos es la bandeja de aceptación. Sus filas permiten confirmar el pedido o descartarlo; si faltan datos, abren la ficha del mismo presupuesto para completarlos. Pedidos muestra confirmados e historial; el alta directa crea un confirmado con precio acordado y no ofrece guardar un borrador desde cero. La recuperación de versión se ofrece sólo ante un conflicto 409, separada de la validación de datos faltantes. Este ajuste conserva filas, formularios, tipografía y tokens existentes; evidencia en `docs/changes/2026-10-20-budget-acceptance.md`.

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
├── forms.css
├── shell.css
├── quick-quote.css
├── dialogs.css
├── settings.css
├── filaments.css
├── orders.css
├── tables.css
├── resources.css
├── advanced.css
├── client-quote.css
├── public-product.css
└── print.css
```

Los colores y medidas repetidos usan variables semánticas. `styles.css` sólo importa módulos. No se introducen utilities arbitrarias ni CSS minificado.

## Arquitectura frontend/backend

- React sólo recoge inputs, presenta resultados y maneja interacción.
- `POST /api/calculations/quick-quote-preview` sigue siendo la fuente del precio.
- `GET/PUT/POST /api/pricing/simple-settings` es una fachada sobre entidades existentes.
- Los dialogs simples de filamento usan `/api/filaments/simple`; la edición avanzada conserva `/api/filaments`.
- El flujo comercial rápido coordina cálculo y guardado por `/api/orders/quick`; `/api/orders` gestiona la ficha, las vistas, estados y prioridad. El flujo compatible de guardado manual conserva `/api/quotes`.
- Los detalles avanzados conservan rutas y DTO existentes.
- PWA mantiene API network-only y draft local.

## Shell responsive corregido

- El shell es una grilla real de dos columnas en escritorio: header de 4 rem, sidebar de 14 rem y contenido con `min-width: 0`.
- Desde 1100 px hacia abajo se usa el shell compacto: sidebar oculta, header reducido, drawer de hasta 90vw y bottom nav de cuatro destinos con safe area.
- La cotización rápida usa dos columnas solo desde 1200 px; debajo de ese ancho formulario y resultado fluyen en una columna.
- La right rail fue eliminada. Resumen, Perfil y Ajustes permanecen disponibles en la navegación principal y en el menú Más.
- El main reserva una sola vez el espacio del bottom nav; las pantallas no agregan paddings inferiores duplicados.

Registro histórico de QA anterior a esta migración: se verificaron 360×800, 390×844, 768×1024, 1024×768, 1280×800 y 1440×900. Se inspeccionaron computed styles, bounding boxes, ausencia de overflow horizontal, superposiciones, foco del drawer, precio largo y capturas de login, cotización, filamentos, ajustes, presupuestos y cálculo avanzado. La migración de herramientas del 2026-10-20 no constituye una nueva auditoría visual; sus comprobaciones figuran en `docs/changes/2026-10-20-ui-tooling-migration.md`.

El incremento local de pedidos del 2026-10-20 extiende este sistema sin modificar sus tokens ni `.impeccable/design.json`. Las capturas de lista/ficha y presupuesto a 1440/390/320px documentan la composición afectada; el [registro del incremento](docs/changes/2026-10-20-orders-management.md) reúne pruebas, correcciones y límites. La revisión final dio **ship** para la tanda de correcciones, con sus siete hallazgos resueltos. No equivale a una nueva auditoría global de accesibilidad, dispositivos físicos o producción.

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
