#!/bin/sh
# Run inside printcost as its normal application user, never as root.
set -eu

if test "$(id -u)" -eq 0; then
    printf 'Run this check as the normal application user, not root.\n' >&2
    exit 1
fi

failed=0
for directory in /var/lib/printcost/data /var/lib/printcost/keys; do
    if ! test -d "$directory" || ! test -r "$directory" || ! test -w "$directory" || ! test -x "$directory"; then
        printf 'Storage inaccessible to the application user: %s\n' "$directory" >&2
        failed=1
    fi
done

for file in /var/lib/printcost/data/printcost.db /var/lib/printcost/data/printcost.db-wal /var/lib/printcost/data/printcost.db-shm; do
    # WAL and SHM may legitimately be absent; SQLite creates them beside the DB.
    if test -e "$file" && { ! test -f "$file" || ! test -r "$file" || ! test -w "$file"; }; then
        printf 'SQLite file inaccessible to the application user: %s\n' "$file" >&2
        failed=1
    fi
done

if test "$failed" -ne 0; then
    printf 'Check ownership of the bind mounts, DB, WAL and SHM; do not delete SQLite files.\n' >&2
    exit 1
fi
printf 'Storage permissions OK for application uid=%s gid=%s.\n' "$(id -u)" "$(id -g)"
