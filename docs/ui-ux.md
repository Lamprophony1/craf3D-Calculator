# Flujo UI/UX de craf3D Calculator

Decisión del usuario, 2026-10-20: abandonar TypeUI y traer el método de SorteoApp, conservando el diseño de craf3D Calculator para seguir desarrollando funcionalidades.

## Autoridades

- **Impeccable independiente:** diseño, jerarquía, recorridos, crítica, accesibilidad y refinamiento. Skill local: [`impeccable`](../.agents/skills/impeccable/SKILL.md).
- **shadcn/ui:** apoyo técnico para componentes cuando haga falta. Skill local: [`shadcn`](../.agents/skills/shadcn/SKILL.md).
- **Producto:** [`PRODUCT.md`](../PRODUCT.md), reglas del dominio y contratos existentes.
- **Identidad:** [`DESIGN.md`](../DESIGN.md), [`tokens.css`](../web/src/styles/tokens.css), componentes y estilos reales. El sidecar [`.impeccable/design.json`](../.impeccable/design.json) complementa los tokens con metadatos de diseño.

El sistema visual anterior de TypeUI se llamaba «Impeccable». Ese nombre no convierte al skill independiente en proveedor de la paleta. A partir de esta migración, la identidad pertenece al proyecto y la herramienta ayuda a desarrollarla y revisarla.

## Adaptación del método de SorteoApp

| Patrón recuperado | Aplicación en craf3D |
| --- | --- |
| Contexto antes de diseñar | Leer las decisiones actuales; evitar nuevas entrevistas sobre hechos ya confirmados. |
| Impeccable como guía principal | Refinar y extender la identidad existente. |
| shadcn como apoyo técnico | Reutilizar primero los componentes React/CSS presentes; agregar componentes sólo por necesidad. |
| Herramientas locales y fijadas | Skill 4.5.2, motor 0.1.14 y CLI shadcn 4.21.0 recuperados del referente. |
| Sistema visual documentado | Tokens reales crema/naranja/ámbar, Chakra Petch y geometría rectangular. |
| Revisión proporcional | Navegador, estados, accesibilidad, detector y evidencia según lo que cambie. |

La aplicación mantiene sus dependencias y estilos actuales. Una incorporación futura de shadcn necesita resolver su integración técnica y preservar los tokens; su instalación como guía no implica que hoy haya componentes shadcn o Tailwind en el frontend.

## Trabajo por superficie

1. Leer producto, diseño y documentación del frente. Ejecutar desde la raíz una vez por sesión:

   ```powershell
   .\.agents\skills\impeccable\scripts\impeccable.cmd context
   ```

2. Precisar el recorrido y los criterios de aceptación del incremento. Para una superficie nueva, resolver sólo las decisiones materiales que falten. Elegir el modo por superficie: Operate para cotizar/gestionar, Read para instrucciones y Persuade para contenido comercial cuando corresponda.
3. Cargar sólo las referencias pertinentes del skill. Antes de editar UI, leer `reference/craft-floor.md`; conservar lo que el usuario pidió mantener.
4. Reutilizar `AppShell`, `ModalDialog`, los controles y módulos CSS. Consultar shadcn si falta una solución pertinente:

   ```powershell
   .\tools\ui\ui.cmd --project-root .\web shadcn docs button
   ```

5. Implementar con tokens semánticos, nombres accesibles, foco y estados reales de carga, vacío, error, éxito y offline cuando apliquen. Conservar entradas ante errores recuperables.
6. Ejecutar pruebas y build pertinentes. Para cambios visuales o de interacción, inspeccionar los estados afectados conjuntamente en móvil y escritorio, corregir en un lote y confirmar en una segunda ronda como máximo; ampliar por un problema nuevo concreto.
7. Sin hooks automáticos, ejecutar una vez el detector sobre los archivos web modificados:

   ```powershell
   .\.agents\skills\impeccable\scripts\impeccable.cmd detect --json web/src/components/Componente.tsx web/src/styles/modulo.css
   ```

   Sustituir esas rutas por las del incremento. Contrastar hallazgos con el diseño vigente y el comportamiento renderizado.

8. Registrar cambios y evidencia en `docs/changes/`. Capturas, sesiones y revisiones privadas de `.impeccable/` quedan fuera de Git; contratos de `surfaces/`, configuración y sidecar pueden versionarse. Actualizar `DESIGN.md` al cambiar una regla visual real.

## Criterios de revisión

- Prioridad del cotizador: filamento, tiempo y gramos; una cifra dominante y detalle avanzado subordinado.
- Paleta y tipografía actuales; sin introducir la identidad azul/amarilla de SorteoApp.
- Foco visible, teclado, Escape y retorno de foco de dialogs; texto o icono además del color.
- Objetivo WCAG 2.2 AA: texto normal 4.5:1, texto grande y controles significativos 3:1, reducción de movimiento y controles táctiles de al menos 44px cuando corresponda.
- Móvil 360/390px, tablet 768px y escritorio 1440px para los flujos afectados; reflow a 320px y texto al 200% cuando el cambio lo amerite.
- No afirmar conformidad global de WCAG, prueba en dispositivo físico o aprobación visual del usuario a partir de pruebas automáticas o capturas.

No se requieren TypeUI, un MCP comercial ni una suscripción. No se activan hooks automáticamente. Restauración y procedencia en [`tools/ui/README.md`](../tools/ui/README.md).
