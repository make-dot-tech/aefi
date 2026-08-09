#!/usr/bin/env bash
# Apply versioned SQL migrations (idempotent CREATE IF NOT EXISTS files).
# Requires: DATABASE_URL, psql. Optional: MIGRATIONS_DIR.
set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-}"
if [[ -z "$MIGRATIONS_DIR" ]]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  MIGRATIONS_DIR="${ROOT}/services/indexer/migrations"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

shopt -s nullglob
for f in "$MIGRATIONS_DIR"/*.sql; do
  id="$(basename "$f")"
  applied="$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM schema_migrations WHERE id = '$id'")"
  if [[ "$applied" == "1" ]]; then
    echo "skip $id"
    continue
  fi
  echo "apply $id"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (id) VALUES ('$id')"
done

echo "migrations complete"
