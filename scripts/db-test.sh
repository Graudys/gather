#!/usr/bin/env bash
# Recria um banco Postgres local descartável, aplica as migrações e roda o
# teste de isolamento. Precisa de psql e de um Postgres rodando.
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:test
set -euo pipefail
cd "$(dirname "$0")/../supabase"
URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
DB="gather_test_$$"
psql "$URL" -qc "CREATE DATABASE $DB"
trap 'psql "$URL" -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)"' EXIT
TURL="${URL%/*}/$DB"
psql "$TURL" -v ON_ERROR_STOP=1 -q -f tests/00_stub_supabase.sql >/dev/null
for f in $(ls migrations/*.sql | sort); do psql "$TURL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null; done
psql "$TURL" -v ON_ERROR_STOP=1 -f tests/01_rls_isolamento.sql 2>&1 | grep -E "ok |FALHOU|passaram"
