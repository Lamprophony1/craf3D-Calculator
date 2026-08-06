#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /opt/printcost/backups/YYYYMMDDTHHMMSSZ" >&2
  exit 2
fi

APP_ROOT="${PRINTCOST_ROOT:-/opt/printcost}"
BACKUP_ROOT_REAL="$(realpath "${PRINTCOST_BACKUP_ROOT:-${APP_ROOT}/backups}")"
SOURCE_REAL="$(realpath "$1")"
case "${SOURCE_REAL}" in "${BACKUP_ROOT_REAL}"/*) ;; *) echo "Backup must be under ${BACKUP_ROOT_REAL}" >&2; exit 1;; esac
test -f "${SOURCE_REAL}/printcost.db"
test -f "${SOURCE_REAL}/data-protection-keys.tar.gz"
(cd "${SOURCE_REAL}" && sha256sum --check SHA256SUMS)
test "$(sqlite3 "${SOURCE_REAL}/printcost.db" 'PRAGMA integrity_check;')" = "ok"

cd "${APP_ROOT}/deploy"
docker compose stop printcost
sqlite3 "${APP_ROOT}/data/printcost.db" ".restore '${SOURCE_REAL}/printcost.db'"
find "${APP_ROOT}/keys" -mindepth 1 -maxdepth 1 -type f -delete
tar -C "${APP_ROOT}/keys" -xzf "${SOURCE_REAL}/data-protection-keys.tar.gz"
docker compose up -d printcost
echo "Restore completed. Verify /health and application login. GymQuest was not touched."

