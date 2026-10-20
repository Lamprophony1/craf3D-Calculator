# Presupuestos pendientes → pedidos confirmados — 2026-10-20

El usuario aclaró el recorrido tras probar el incremento inicial: Presupuestos debe ser la bandeja de borradores pendientes de aceptación, desde donde se confirman o descartan. No necesita crear otro borrador manual en Pedidos. Ajuste acotado sobre el flujo implementado, autorizado por esa corrección; se reutilizan registros, componentes y precios existentes.

## Comportamiento

- Cotizar guarda automáticamente en **Presupuestos → Pendientes**. El cotizador ofrece **Abrir presupuesto** y **Ver presupuesto**.
- Cada pendiente permite **Confirmar pedido** o **Descartar**. Si faltan referencia o importe, **Completar y confirmar** abre la ficha del mismo registro; la confirmación mantiene ID, presupuesto vinculado e importe.
- **Con pedido** conserva los presupuestos que ya dieron lugar a pedidos. **Descartados** permite recuperarlos a Pendientes.
- **Pedidos** contiene Confirmados e Historial. Se retiran sus vistas Borradores/Descartados y la acción de crear un borrador desde cero. El alta independiente con precio fijo crea un pedido confirmado, también al enviar el formulario con Enter; el registro de trabajos anteriores sigue admitiendo datos desconocidos.
- El documento de presupuesto conserva su ruta y tiene acceso a confirmar o abrir el pedido vinculado. La nueva ficha pendiente vive en `/quotes/pending/:commercialId`; los enlaces anteriores permanecen compatibles.
- Navegación móvil: Cotizar, Presupuestos, Pedidos y Más. Filamentos pasa a Más. Se mantienen la paleta, fuente y composición existentes.

El cambio no recalcula al confirmar, no crea otro pedido, no inicia producción ni descuenta stock. No modifica esquema, elimina borradores anteriores ni escribe producción. Los registros incompletos anteriores siguen accesibles desde Pendientes.

## Validación

Las regresiones se ejecutaron antes de la implementación. Cubren confirmación del mismo registro, conservación del total, exclusión de pedidos manuales en presupuestos con pedido, navegación desde rápido/lista/documento, alta directa sin borrador y envío por teclado. La revisión visual detectó que la validación de referencia faltante ofrecía incorrectamente actualizar versión; ahora esa recuperación aparece sólo ante 409, con regresión específica.

Backend: 88 pruebas correctas (32 dominio, 25 aplicación, 6 infraestructura y 25 API). Frontend: 102 correctas en 15 archivos; TypeScript/Vite correcto. Chrome con API y base locales aisladas: 10 comprobaciones correctas, sin errores de página, incluyendo confirmación, descarte/recuperación, datos faltantes y alta directa. Capturas de escritorio/móvil a 1440/390 px y reflow a 320 px en `.impeccable/previews/budget-acceptance/`. Detector del incremento ejecutado una vez: `[]`.

La revisión independiente detectó dos incompatibilidades con las rutas anteriores: cancelar/rechazar no actualizaba la nueva bandeja y duplicar no agregaba el vínculo comercial. Ambas se reprodujeron con pruebas antes de corregirlas. Ahora cancelación/rechazo archivan un pendiente en la misma transacción; recuperar explícitamente devuelve el presupuesto a Draft sin recalcular. La cancelación desde presupuesto rechaza un pedido ya confirmado para que se gestione desde su ficha. Duplicar crea cotización y registro comercial juntos, conservando la referencia libre. También se eliminó una acción de recuperación duplicada.

La suite Playwright completa pasó sus 21 pruebas. Cuatro comprobaciones adicionales contra la API local verifican cancelación sincronizada desde el documento, duplicado visible al instante, una sola recuperación y protección del pedido ya confirmado. Evidencia y recapturas específicas en `legacy-evidence.json` junto a las capturas del incremento.

El pase final de la revisión independiente dio disposición **ship**, con los dos hallazgos importantes y el menor resueltos. El dictamen se limita a esas correcciones; no constituye una auditoría nueva de toda la aplicación. Cambios y contratos documentados, servicios locales actualizados y salud verificada al cierre.

Una ejecución inicial de la suite web tuvo un fallo de temporización en el dialog compatible de guardado; el mismo test pasó en la ejecución dirigida y en las suites completas posteriores, sin modificarlo ni desactivarlo. No se acredita validación en dispositivos físicos ni despliegue.

Servicios locales: <http://127.0.0.1:5173/quotes> y <http://127.0.0.1:5080/health>, con base de pruebas persistente. Continúa la regla de dejar ambos levantados y verificados al cerrar cada corrida.
