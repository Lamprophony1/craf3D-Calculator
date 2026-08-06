# Despliegue productivo aislado

## Variables pendientes

- GitHub variable `APP_HOSTNAME` (no puede ser el hostname de GymQuest).
- GitHub variable `PRINTCOST_HOST_PORT` (no puede ser 5020).
- `/opt/printcost/printcost.env` con ambos PINs bootstrap y hostname.

## Preparación

```bash
sudo install -d -o github-runner -g github-runner /opt/printcost/{data,keys,deploy,backups}
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

## Rollback

```bash
cd /opt/printcost/deploy
export PRINTCOST_IMAGE=ghcr.io/OWNER/REPO:SHA_ANTERIOR
export PRINTCOST_HOST_PORT=PUERTO
docker compose up -d --pull always
curl -fsS "http://127.0.0.1:${PRINTCOST_HOST_PORT}/health"
```

Actualizar repite el workflow. La base y llaves sobreviven en bind mounts. Antes de cambios importantes ejecutar backup.

