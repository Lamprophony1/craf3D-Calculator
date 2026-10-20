# Publicación autorizada del 2026-10-20

El usuario pidió desplegar los cambios pendientes después de comprobar el login productivo. La entrega incluye el flujo Presupuestos → Pedidos, alta directa con precio acordado, prioridad manual, cliente libre y descripción, selector visual de filamentos y control de permisos SQLite. Conserva el motor de precios, los ajustes productivos y la identidad de craf3D. La mejora de la calculadora avanzada permanece pendiente.

## Recursos y versión

- Origen: `https://craf3d.crg-dev.com`, loopback `127.0.0.1:5030`.
- VM: `gc@10.4.28.21`, directorio `/opt/printcost`, contenedor `printcost`, UID/GID10001.
- Repositorio: `Lamprophony1/craf3D-Calculator`, rama productiva `main`.
- Pipeline: [PrintCost CI/CD](https://github.com/Lamprophony1/craf3D-Calculator/actions/workflows/ci-cd.yml), runner `craf3d-production-vm` con etiqueta `printcost`.
- Imagen previa: `ghcr.io/lamprophony1/craf3d-calculator:b225e80d3afae2dce9b17afc554fdebcecc52891`.

Este documento registra la preparación. El despliegue se acredita comprobando el resultado del workflow, la imagen por SHA instalada y la verificación posterior del origen público; no inferirlo únicamente de un push.

## Verificación previa

Suite local sobre el árbol de entrega: backend89 (Domain32, Application25, Infrastructure6, API26), frontend108 y navegador21; tipos y build web correctos. Se conservan las revisiones independientes de pedidos, filamentos y reparación de login realizadas durante sus incrementos.

Respaldo consistente mediante `SqliteConnection.BackupDatabase`, ejecutado como UID10001 dentro del contenedor, sin detener el servicio. Copias de SQLite, claves de Data Protection, configuración, Compose, metadatos de recuperación y checksums conservadas exclusivamente en `/opt/printcost/backups/20261020T230128Z`, con carpeta0700 y archivos0600. No se exportan a Git ni al equipo local.

La copia devolvió integridad `ok` y cero errores de claves foráneas. Sobre otra copia temporal se ejecutaron las mismas rutinas `OrderSchema.EnsureAsync` y `OrderService.ImportExistingAsync` del arranque: dos registros incorporados, segunda importación cero, dos cotizaciones/siete revisiones/un trabajo/un movimiento preservados. Las huellas de los catálogos y de los requests/snapshots/desgloses financieros coincidieron antes y después. Estas huellas no incluyen credenciales.

El auxiliar temporal queda fuera del producto y de Git. Las lecturas sobre la base activa usan su identidad10001 y `mode=ro` con `query_only`, según [procedimiento SQLite](../deployment.md#consultas-de-sqlite-y-permisos). Los datos de la copia de ensayo no se usan para producción.

## Comprobaciones posteriores y recuperación

Comprobar el estado del contenedor y permisos, login/logout de ambos usuarios, respuesta del origen público, nuevas vistas y selector, caso131,04g/220min/Gs.60.000 mediante preview sin guardado, integridad y conservación de catálogos/precios históricos. No crear presupuestos ni pedidos sintéticos en producción. Conservar también los servicios locales activos.

La versión anterior queda identificada en `recovery.json` dentro del respaldo. Si la actualización de esquema o la importación falla, detener únicamente `printcost` y restaurar de manera consistente la copia completa verificada antes de volver a esa imagen. No sobrescribir una base activa ni eliminar WAL/SHM para forzar recuperación. Si ya hubo trabajo real posterior, resguardarlo y decidir su recuperación antes de restaurar. Claves y configuración del respaldo son sensibles y deben permanecer restringidas.

La tabla de pedidos y las columnas comerciales son aditivas, pero una vuelta de imagen por sí sola no garantiza recuperar la operativa anterior después de nuevas escrituras. Los demás contenedores, sus datos, puertos y servicios quedan fuera de esta actualización.
