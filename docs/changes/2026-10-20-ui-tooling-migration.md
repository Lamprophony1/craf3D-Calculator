# Migración de herramientas UI/UX

Pedido del usuario, 2026-10-20: dejar TypeUI, adoptar la forma de trabajo de SorteoApp y conservar diseño y colores de craf3D Calculator para continuar las funcionalidades.

## Cambio realizado

- Retiradas las guías activas `typeui-design-system` y `typeui-fundamentals`, recuperables desde Git.
- Incorporados sin cambios los skills locales Impeccable 4.5.2 y shadcn del referente; motor Impeccable 0.1.14 verificado por hash y `engine-probe`.
- CLI shadcn 4.21.0 y Skills CLI 1.7.0 fijados en un paquete de herramientas separado. Se reutiliza Node 24.19.0/npm 11.17.0 ya disponibles en este proyecto.
- Se omite el CLI npm antiguo de Impeccable del referente. Su launcher activo es la entrada al motor; `--version` imprime la versión de compatibilidad 4.0.0, mientras `engine-probe` identifica el motor 0.1.14.
- Nuevo `AGENTS.md`, procedimiento `docs/ui-ux.md`, documentación de restauración y manifiesto de procedencia/hashes en `tools/ui/`.
- `PRODUCT.md` identifica plataforma web y el compromiso de conservar la identidad. `DESIGN.md` incorpora los 19 colores reales del CSS y corrige valores obsoletos de paleta, ancho de sidebar y tamaño de título.
- Nuevo sidecar `.impeccable/design.json` y contrato de la superficie del cotizador, derivados de código y documentación existentes.
- Herramientas, binario, cachés y evidencia privada separados de Git o del contexto Docker según corresponda. Sin hooks automáticos.

La aplicación conserva React/CSS propios; la guía de shadcn no implica una migración del frontend a Tailwind ni un reemplazo de controles. No se copiaron identidad, configuración operativa, usuarios, datos o credenciales de SorteoApp.

## Verificación

- 79 archivos de skills, incluido el binario local ignorado, comprobados por SHA-256 contra el referente.
- `engine-probe`: `impeccable-engine 0.1.14`.
- `context --target web/src/screens/QuickQuoteScreen.tsx`: correcto; carga `PRODUCT.md`, `DESIGN.md`, plataforma web y el contrato local por slug. El motor devuelve `hasVisualImplementation=false` para ese target TSX; esto no convierte la aplicación existente en un proyecto nuevo. Se conserva la implementación como referencia visual.
- CLI shadcn: 4.21.0; CLI Skills: 1.7.0. `shadcn info --json` identifica Vite/TypeScript, sin Tailwind, preset ni componentes shadcn instalados.
- Lockfile adaptado y dependencias sobrantes podadas offline, sin scripts de instalación; `npm ls --depth=0` correcto.
- Los 19 colores documentados coinciden con `tokens.css`, incluidos los alias resueltos.
- 133 archivos versionados de producto, pruebas, despliegue y CI conservan sus hashes previos. No cambiaron componentes, CSS, recursos visuales, contratos API ni dependencias del frontend.
- `npm test -- --reporter=dot`: 13 archivos, 88 pruebas correctas. Hay avisos de React sobre `act()` en pruebas del cotizador; no se modificaron esas pruebas.
- `npm run build`: TypeScript y Vite correctos.
- Pruebas/build iniciales bloqueados por `EPERM` en `web/node_modules/.vite-temp`; ambas comprobaciones se completaron con acceso ampliado, sin cambiar configuración o código del producto.

No se ejecutó una nueva auditoría visual, detector de UI, backend ni suite E2E: el incremento cambia herramientas y documentación. Los resultados anteriores registrados en `DESIGN.md` pertenecen al trabajo histórico y no se presentan como nuevas comprobaciones.

## Preferencia futura opcional

El motor informa que `buildPath` no está definido para nuevas superficies Persuade/Experience. Podrá elegirse construir directamente en código o partir de un mockup cuando exista un pedido de esa clase. Las pantallas Operate se desarrollan en código; esta preferencia no impide continuar funcionalidades de la aplicación.

Guía de trabajo: [UI/UX](../ui-ux.md). Restauración y comandos: [tools/ui](../../tools/ui/README.md). Procedencia: [installation.json](../../tools/ui/installation.json).
