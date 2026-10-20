# Login productivo: error al volver a entrar

Fecha: 2026-10-20. Solicitud: resolver «No se pudo completar la operación» al iniciar sesión con Rafa o Clari, antes de publicar los cambios locales.

## Causa comprobada

Los dos usuarios estaban activos, con credenciales válidas y sin bloqueo. La comparación dentro de la VM confirmó que los PINs bootstrap configurados coincidían con sus credenciales, devolviendo únicamente booleanos; no se exportaron PINs, hashes, cookies ni claves.

Los logs mostraban `SQLite Error 8: 'attempt to write a readonly database'` en `PrintCostRepository.UpsertCredentialAsync`, llamado por `PinAuthService.LoginAsync`. Iniciar sesión escribe el estado de intentos y la auditoría antes de emitir la cookie, por eso los PINs correctos terminaban en HTTP 500.

La base y el contenedor usan UID/GID `10001:10001`, pero `printcost.db-wal` y `printcost.db-shm` pertenecían al usuario SSH `1001:1001`, con modo `0644`. La comprobación desde el usuario habitual del contenedor confirmó que esos dos archivos no eran escribibles; la base, las carpetas y los montajes sí lo eran.

El WAL tenía fecha de creación/cambio de metadatos `2026-10-20T13:22:28Z`. Esto coincide con el procedimiento anterior de consulta desde Python como usuario SSH. Aunque las consultas usaron `mode=ro` y `query_only`, SQLite puede crear sus archivos auxiliares al abrir una base WAL de lectura; la consulta inicial de este diagnóstico también utilizó ese procedimiento. Ese efecto sobre el sistema de archivos no estaba contemplado. La atribución al procedimiento es una inferencia basada en identidad, fecha y comandos usados; no se dispone de auditoría de creación de archivos. Referencia: [SQLite, bases WAL de solo lectura](https://www.sqlite.org/wal.html#read_only_databases).

## Reparación aplicada en producción

- Se verificaron las rutas exactas, que los dos auxiliares fueran archivos regulares sin enlaces simbólicos y sus propietarios previos.
- Se restauró exclusivamente su propietario a `10001:10001`, conservando el modo `0644`.
- La comprobación de permisos pasó, pero un login seguía devolviendo el mismo error. Se reinició únicamente `printcost` para liberar sus conexiones existentes; después el recorrido funcionó. No se instrumentó el estado interno del pool, por lo que el mecanismo preciso de retención es una inferencia, no una medición.
- Se mantuvieron imagen, configuración, PINs, base y claves existentes. No se borraron archivos ni se ejecutaron migraciones. Las pruebas generaron cuatro eventos normales de login; no crearon presupuestos, pedidos ni movimientos de inventario.

## Verificación

Sobre `https://craf3d.crg-dev.com`, con secretos usados únicamente dentro de la VM:

| Usuario | Ciclos completos | Login | Sesión autenticada | Logout | Sesión posterior |
| --- | ---: | --- | --- | --- | --- |
| Clari | 2 | 200 | Usuario correcto | 204 | 401 |
| Rafa | 2 | 200 | Usuario correcto | 204 | 401 |

Cada ciclo comprobó cookie `Secure`, `HttpOnly` y `SameSite=Lax`. La sesión anónima inicial también devolvió 401. Es una prueba HTTP real del origen público, no una prueba visual con los navegadores o dispositivos particulares del usuario.

`deploy/check-storage.sh` detectó los dos auxiliares antes de la reparación y pasó después. La revisión independiente no encontró problemas bloqueantes y recomendó impedir su uso como root: se reprodujo el falso positivo y se añadió una guarda, verificada rechazando UID0 y aceptando UID10001. La sintaxis shell se comprobó localmente. Tras el reinicio, `/health` y `/api/auth/login-options` públicos devolvieron 200 y los logs no contenían nuevos errores SQLite de solo lectura. El workflow incorpora este control antes y después de desplegar; todavía no se ejecutó el workflow modificado en GitHub ni se publicaron los cambios locales de producto.

## Prevención

El procedimiento de [despliegue](../deployment.md) y `AGENTS.md` exigen ejecutar lectores de SQLite con la identidad de la aplicación, además de restringir las consultas. Los scripts privados históricos quedan protegidos para rechazar otro UID antes de abrir la base. El control de permisos no hace cambios automáticos y no equivale a comprobar una escritura SQL completa.

Evidencia privada y scripts acotados en `.artifacts/login-audit/`. Los servicios locales siguen disponibles en `http://127.0.0.1:5173` y `http://127.0.0.1:5080`; su modo DevSelector no se usó como prueba de autenticación productiva.
