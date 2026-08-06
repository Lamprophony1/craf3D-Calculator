#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${PRINTCOST_ROOT:-/opt/printcost}"
DB_PATH="${PRINTCOST_DB_PATH:-${APP_ROOT}/data/printcost.db}"
KEYS_PATH="${PRINTCOST_KEYS_PATH:-${APP_ROOT}/keys}"
BACKUP_ROOT="${PRINTCOST_BACKUP_ROOT:-${APP_ROOT}/backups}"
RETENTION_DAYS="${PRINTCOST_BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DESTINATION="${BACKUP_ROOT}/${STAMP}"

test -f "${DB_PATH}"
test -d "${KEYS_PATH}"
mkdir -p "${DESTINATION}"
sqlite3 "${DB_PATH}" ".timeout 10000" ".backup '${DESTINATION}/printcost.db'"
test "$(sqlite3 "${DESTINATION}/printcost.db" 'PRAGMA integrity_check;')" = "ok"
sha256sum "${DESTINATION}/printcost.db" > "${DESTINATION}/SHA256SUMS"
tar -C "${KEYS_PATH}" -czf "${DESTINATION}/data-protection-keys.tar.gz" .
sha256sum "${DESTINATION}/data-protection-keys.tar.gz" >> "${DESTINATION}/SHA256SUMS"

BACKUP_ROOT_REAL="$(realpath "${BACKUP_ROOT}")"
while IFS= read -r -d '' candidate; do
  candidate_real="$(realpath "${candidate}")"
  case "${candidate_real}" in
    "${BACKUP_ROOT_REAL}"/*) rm -rf -- "${candidate_real}" ;;
    *) echo "Refusing to remove path outside backup root: ${candidate_real}" >&2; exit 1 ;;
  esac
done < <(find "${BACKUP_ROOT_REAL}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print0)

echo "Backup completed: ${DESTINATION}"

