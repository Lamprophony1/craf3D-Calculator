# Recuperación automática de una sesión anterior en Cotizar

El usuario informó el mensaje de presupuesto confirmado o descartado mientras cargaba tres platos, sin realizar esas acciones durante ese trabajo. La investigación encontró que la identidad de Cotizar se conserva al navegar y recargar, incluso cuando su presupuesto anterior pasó a otro estado. Escribir otro trabajo sobre ese formulario reutilizaba la identidad vieja. El guardado espera que todos los platos sean válidos y por eso puede fallar al completar el tercero. **Nuevo cálculo** permitía salir de ese estado, pero limpiaba los platos cargados.

El servidor identifica ese conflicto con `quick_session_closed`. Cotizar desvincula automáticamente la sesión vieja y, si hubo una edición en la visita actual, reintenta una vez con otra identidad y conserva los filamentos, tiempos, gramos, cantidades y datos comerciales de todos los platos. Si se pierde la respuesta de ese guardado, **Reintentar guardado** conserva la identidad nueva para recuperar el mismo registro. Al restaurar entradas sin editarlas, se calcula un preview sin crear otro presupuesto. Las respuestas tardías o abortadas no pueden cambiar la sesión vigente.

## Verificación local

Pasaron 20 pruebas de API y las 24 pruebas web afectadas, además de TypeScript y el build de Vite. La regresión de API cubre presupuesto confirmado y descartado, inmutabilidad del registro anterior y conflictos de secuencia o de edición comercial. Las regresiones web cubren tres platos con cantidades y metadatos, restauración pasiva de una identidad cerrada, edición posterior, respuesta perdida, recuperación limitada y conflictos tardíos. El detector Impeccable terminó sin hallazgos en la revisión final.

La evidencia privada se guarda en `.impeccable/quick-session-recovery-2026-11-13/`. La primera revisión probó una acción explícita de recuperación. La aclaración del usuario llevó a sustituirla por recuperación automática y ampliar la reproducción a la identidad de un trabajo anterior y a navegación, recarga y duplicación de pestañas.

El diagnóstico de la versión anterior reprodujo el mensaje exacto al cargar tres platos con la identidad heredada de un pedido entregado, sin transiciones durante la visita actual. Los otros cinco escenarios de inicio limpio, ida y vuelta, recarga, reinicio de API y pestaña duplicada conservaron borradores válidos. `diagnostic.json` guarda esas trazas.

La confirmación final de Chrome a 1440 y 390 px recuperó automáticamente identidades anteriores confirmadas o entregadas, mantuvo íntegros los tres platos y creó un único borrador nuevo. En móvil se perdió la respuesta después de guardar y el reintento conservó la identidad y secuencia. La recarga mantuvo el mismo borrador. Restaurar pasivamente una identidad descartada mostró el preview sin crear registros. `after.json` y sus tres capturas documentan esa comprobación.

La corrección quedó disponible en el preview local `http://127.0.0.1:5173/`, con API saludable en `http://127.0.0.1:5080/health`.
