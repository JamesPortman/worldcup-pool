#!/usr/bin/env bash
# Restore a backup created by scripts/backup-db.sh.
#   npm run db:restore -- backups/worldcup-YYYYMMDD-HHMMSS.sql.gz
# Target DB is resolved like the backup script. WARNING: this overwrites it.
# Set FORCE=1 to skip the confirmation prompt.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/db-url.sh
source scripts/db-url.sh

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: npm run db:restore -- <path-to-backup.sql.gz>" >&2
  exit 1
fi

URL="$(resolve_db_url || true)"
if [[ -z "${URL:-}" ]]; then
  echo "❌ No database URL found (set DATABASE_URL_UNPOOLED or pull .env.production.local)." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql not found. macOS: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

HOST="$(printf '%s' "$URL" | sed -E 's#.*@([^/?]+).*#\1#')"
echo "⚠️  This will OVERWRITE the database at: ${HOST}"
if [[ "${FORCE:-}" != "1" ]]; then
  read -r -p "Type 'yes' to continue: " ans
  [[ "$ans" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

echo "♻️  Restoring ${FILE} ..."
gunzip -c "$FILE" | psql "$URL" -v ON_ERROR_STOP=1
echo "✅ Restore complete."
