# Backups y restore

## Backup

Requiere `sqlite3`, `sha256sum` y `tar`:

```bash
sudo -u github-runner env PRINTCOST_BACKUP_RETENTION_DAYS=30 bash scripts/backup-printcost.sh
```

El script usa `.backup` de SQLite sobre la base activa, ejecuta `PRAGMA integrity_check`, crea checksums, empaqueta las llaves Data Protection y aplica retención solo dentro del directorio validado de backups. Nunca copia la base activa con `cp`.

Copiar el backup resultante a almacenamiento externo cifrado y probar periódicamente un restore en un entorno aislado.

## Restore

```bash
sudo -u github-runner bash scripts/restore-printcost.sh /opt/printcost/backups/20260806T120000Z
```

El script valida ruta, checksums e integridad antes de detener únicamente `printcost`, restaura base/llaves y reinicia únicamente ese servicio. Después verificar `/health`, login y una cotización histórica. GymQuest no se detiene ni recibe datos.

Conservar juntos base y llaves permite mantener cookies existentes; aun así, tras un incidente de seguridad se deben rotar llaves y sesiones deliberadamente.
