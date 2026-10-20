# Despliegue productivo aislado

## Variables pendientes

- GitHub variable `APP_HOSTNAME` (no puede ser el hostname de GymQuest).
- GitHub variable `PRINTCOST_HOST_PORT` (no puede ser 5020).
- `/opt/printcost/printcost.env` con ambos PINs bootstrap y hostname.

## Preparación

```bash
sudo install -d -o github-runner -g github-runner /opt/printcost/{data,keys,deploy,backups}
sudo chown 10001:github-runner /opt/printcost/data /opt/printcost/keys
sudo chmod 770 /opt/printcost/data /opt/printcost/keys
sudo install -m 600 deploy/printcost.env.example /opt/printcost/printcost.env
ss -ltn
```

Elegir un puerto loopback libre y documentarlo. El runner debe tener la etiqueta `printcost` y permisos de Docker. La aplicación usa exclusivamente:

- `/opt/printcost`, `/opt/printcost/data`, `/opt/printcost/keys`, `/opt/printcost/deploy`;
- `printcost.db`, contenedor `printcost`, variable `PRINTCOST_HOST_PORT`;
- concurrency `printcost-production` y tunnel independiente.

No tocar `/opt/gymquest`, `gymchall.db`, el contenedor/puerto/tunnel/llaves/env de GymQuest ni detenerlo.

## Cloudflare Tunnel

1. Crear un tunnel nuevo para PrintCost.
2. Copiar `deploy/cloudflared-printcost.example.yml` y sustituir UUID, hostname y puerto.
3. Crear el DNS route del hostname nuevo al tunnel nuevo.
4. Ejecutar cloudflared con un servicio/configuración independiente.
5. Probar `curl http://127.0.0.1:PUERTO/health` antes del hostname público.

## CI/CD

Push a `main`: restore/test .NET, `npm ci`, test/build web, build/push GHCR con tags SHA y latest, deploy en runner `[self-hosted, printcost]`, preflight y health con 30 reintentos. Una imagen por SHA permite rollback.

El usuario de la imagen es `10001:10001`. La prueba `test -w` del runner sobre las carpetas no acredita que ese usuario pueda escribir. El workflow ejecuta `deploy/check-storage.sh` dentro del contenedor con su identidad habitual, antes de reemplazar una instancia activa y después del despliegue. Comprueba permisos de carpetas, base y archivos auxiliares existentes; no realiza una transacción ni sustituye la verificación funcional.

```bash
docker exec -i printcost sh -s < deploy/check-storage.sh
```

## Consultas de SQLite y permisos

En la base activa, usar una herramienta ejecutada con la identidad de la aplicación (`10001:10001`), conexión `mode=ro` y `PRAGMA query_only=ON`. No abrirla con Python/SQLite como el usuario SSH ni como root: en modo WAL, incluso una conexión de lectura puede crear `printcost.db-wal` y `printcost.db-shm` con otro propietario, bloqueando las escrituras de la aplicación. Ver [SQLite: bases WAL de solo lectura](https://www.sqlite.org/wal.html#read_only_databases).

Si la herramienta necesaria no está disponible con esa identidad, preparar un lector compatible antes de consultar. No usar `immutable=1` sobre una base en uso: no garantiza incorporar las transacciones pendientes del WAL. No eliminar WAL/SHM ni aplicar permisos globales para desbloquear el acceso.

Ante un error de solo lectura, comprobar primero los propietarios y el acceso con el usuario real del contenedor. Una reparación debe limitarse a los archivos identificados. Las conexiones ya abiertas pueden seguir fallando después de reparar permisos; verificar el login y, si persiste, reiniciar únicamente `printcost` con su imagen vigente. Incidente y validación: [login del 2026-10-20](changes/2026-10-20-production-login.md).

## Rollback

```bash
cd /opt/printcost/deploy
export PRINTCOST_IMAGE=ghcr.io/OWNER/REPO:SHA_ANTERIOR
export PRINTCOST_HOST_PORT=PUERTO
docker compose up -d --pull always
curl -fsS "http://127.0.0.1:${PRINTCOST_HOST_PORT}/health"
```

Actualizar repite el workflow. La base y llaves sobreviven en bind mounts. Antes de cambios importantes ejecutar backup.

