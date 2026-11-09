# Arreglos de Presupuestos y Pedidos

El usuario pidió avanzar con los nueve hallazgos de la [auditoría](../../changes/2026-11-06-orders-ux-audit.md). Se adopta el resumen con la próxima acción y edición bajo demanda para las fichas existentes. La creación directa conserva el formulario inicial. Es un incremento de la interfaz y usa las rutas, los estados y el motor de precios existentes.

- [x] O01, O02, O04 y O05. Mostrar estado, total, trabajo y próxima acción en la ficha. Proteger la salida con cambios pendientes y confirmar la cancelación. Aplicar la versión devuelta por el guardado antes de enviar la transición. Verificar salida explícita, navegación principal, Atrás, conflicto real, reintento y recorrido hasta entrega.
- [x] O06 y O09. Guardar vista, búsqueda y página en la URL de la lista. Restaurar posición al volver y mantener una acción enfocada en la fila después de reordenar. Verificar Historial, Pendientes, movimiento global bajo búsqueda y recuperación de descartados.
- [x] O07 y O08. Poner referencia libre y descripción después del resultado avanzado. Enlazar el presupuesto guardado. Separar visualmente el siguiente paso comercial de las acciones del documento y expresar sus estados en español. Verificar presupuesto nuevo, documento y transición existente.
- [x] O03. Mantener legibles navegación móvil y vistas de lista con texto ampliado. Medir a 320 y 390 px con tamaño normal y al 200 %. Validar teclado y zonas de foco alrededor de la barra fija.
- [x] Revisar las piezas juntas, ejecutar pruebas web y build. Inspeccionar el recorrido en escritorio y móvil con datos sintéticos y guardar evidencia privada. Ejecutar el detector al cerrar. Confirmar el preview habitual y registrar el incremento en `docs/changes/`.
