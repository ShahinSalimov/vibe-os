#!/usr/bin/env bash
# Spins up a throwaway PostgreSQL, applies the migration, runs the RLS/security tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-5499}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown postgres "$DATA"; RUN_AS=(runuser -u postgres --); fi

cleanup() { "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -w start >/dev/null

PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At)
"${PSQL[@]}" -f "$ROOT/tests/db/supabase_stub.sql"
if [ "${SETUP_ALL:-0}" = "1" ]; then "${PSQL[@]}" -f "$ROOT/supabase/setup_all.sql"
else for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done; fi
"${PSQL[@]}" -f "$ROOT/tests/db/rls.test.sql" 2>&1 | sed -E "s/^psql:[^ ]+ NOTICE:  //; s/^NOTICE:  //" | grep -v "^$"
