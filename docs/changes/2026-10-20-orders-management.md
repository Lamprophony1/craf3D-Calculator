# Gestión de pedidos — 2026-10-20

Implementación local del [diseño aprobado](../superpowers/specs/2026-10-20-orders-management-design.md) y su [plan](../superpowers/plans/2026-10-20-orders-management.md). Rama `feat/orders-workflow`. Conserva los cambios previos de herramientas y la identidad crema/naranja/ámbar de craf3D.

Este informe describe el incremento inicial. El usuario corrigió después la ubicación del borrador: **Presupuestos pendientes → Pedidos confirmados**, sin alta manual de borrador en Pedidos. El comportamiento vigente y su validación están en [aceptación de presupuestos](2026-10-20-budget-acceptance.md).

## Recorrido disponible

- Cada cotización rápida válida que se edita se guarda automáticamente como pedido **Borrador**, con su presupuesto y el mismo importe mostrado. Editarla actualiza ese borrador; **Nuevo cálculo** inicia otro. Restaurar entradas sin sesión activa solo muestra el preview hasta editar o compartir/copiar.
- **Cliente / referencia** es texto libre y **Qué se va a imprimir** es opcional. Aparecen en el presupuesto, la imagen y el texto completo para compartir, sin crear clientes en un catálogo.
- **Pedidos → Nuevo pedido** permite cargar un precio acordado directamente, con cantidad inicial 1. El importe es el total: cantidad 3 e importe 100.000 conserva 100.000. Se puede guardar incompleto o confirmar con referencia e importe.
- Los borradores se descartan con un botón y se recuperan desde **Descartados**. La cola **Confirmados** permite subir, bajar o poner primero; conserva la prioridad al buscar, paginar o recargar.
- La ficha avanza Confirmado → En proceso → Listo para entregar → Entregado. Guarda notas pendientes antes de cambiar estado. **Historial** permite registrar trabajos anteriores con los datos conocidos y completarlos después.
- El acceso móvil directo ahora incluye **Pedidos**; **Presupuestos** sigue disponible en **Más**. La conversión anterior de presupuesto aceptado a trabajo técnico se conserva, enlazada al mismo pedido comercial.

## Precios y datos

El motor decimal del backend continúa siendo autoritativo. Guardar desde rápido usa el snapshot de esa misma respuesta, sin un segundo cálculo con otras tarifas. Editar solo referencia o descripción conserva los importes y registra una revisión de metadatos. Copiar utiliza el resultado autoritativo del guardado.

Los pedidos directos y comerciales no fabrican cotizaciones, costos, ganancias ni movimientos de stock. El consumo físico y los costos reales conservan el flujo técnico existente. Una fecha o costo desconocido permanece sin definir. La ampliación SQLite es aditiva y repetible e incorpora vínculos únicos con presupuestos y trabajos anteriores.

Las escrituras de la ficha usan versión para detectar cambios concurrentes. Permite actualizar la versión conservando las entradas pendientes, con aviso de revisión antes de guardar. La sesión rápida rechaza actualizaciones después de edición comercial, confirmación o descarte; **Nuevo cálculo** queda accesible en ese conflicto. Duplicar una pestaña crea una sesión independiente; recargar conserva la original con Web Locks. Sin esa API del navegador, se inicia otra sesión al navegar para evitar un escritor compartido.

## Validación

- Backend: 84 pruebas correctas (32 Domain, 25 Application, 6 Infrastructure, 21 API), incluyendo actualización de esquema anterior con SQLite real.
- Frontend: 97 pruebas correctas en 15 archivos; compilación TypeScript y Vite correcta.
- Playwright: 21 pruebas correctas de recorridos y comportamiento responsive.
- Chrome contra la API local y una base aislada: 15 comprobaciones de alta manual, prioridad, caso rápido, descarte/recuperación e historial; otras 6 de notas, imagen y reflow; 3 sobre pestañas duplicadas, recarga y recuperación tras confirmar. Evidencia privada en `.artifacts/orders-implementation/` y capturas en `.impeccable/`.
- Caso real de referencia: PLA Creality blanco, rollo 132.000 Gs./1.000 g, 131,04 g y 3 h 40 min: 60.000 Gs. con los ajustes auditados. La prueba usa sus parámetros en una base temporal, sin escribir producción.
- Revisión visual de escritorio/móvil a 1440/390 px y reflow a 320 px. Se corrigió el recorte de especificaciones y pie de la imagen al incluir referencia/descripción. Detector Impeccable ejecutado una vez: sin hallazgos.

La revisión independiente encontró seis casos importantes y uno menor. Se reprodujeron y corrigieron con regresiones; el pase final dio disposición **ship** y marcó los siete como resueltos. Ese dictamen evalúa la tanda de correcciones y no constituye una segunda auditoría general. No se acredita prueba en dispositivos físicos ni rendimiento con grandes volúmenes.

## Entorno de prueba

Web: <http://127.0.0.1:5173/jobs>. API: <http://127.0.0.1:5080/health>. Base local persistente y aislada en `.artifacts/local-preview/data/printcost.db`, ejemplos identificados como **PRUEBA LOCAL**, acceso `DevSelector`.

`tools/local-preview.ps1` publica la API actual, reutiliza Vite y verifica ambos servicios. La regla permanente de dejarlos levantados al terminar cada corrida está en `AGENTS.md`, por instrucción expresa del usuario. Procesos y logs registrados en `.artifacts/local-preview/`.

Sin push, despliegue ni escritura en la base productiva. El desarrollo sigue pendiente de publicación. La calculadora avanzada conserva su pendiente prioritario de usabilidad y correcciones ya auditadas; no forma parte de este incremento.
