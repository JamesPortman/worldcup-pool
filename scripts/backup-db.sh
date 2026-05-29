#!/usr/bin/env bash
# Logical backup of the World Cup Pool database.
# Writes a timestamped, gzipped plain-SQL dump to ./backups/.
#
# First pull production credentials locally (once):
#   npx vercel env pull .env.production.local
# then:  npm run db:backup
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/db-url.sh
source scripts/db-url.sh

URL="$(resolve_db_url || true)"
if [[ -z "${URL:-}" ]]; then
  echo "❌ No database URL found." >&2
  echo "   Set DATABASE_URL_UNPOOLED, or pull prod creds: npx vercel env pull .env.production.local" >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "❌ pg_dump not found. macOS: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

mkdir -p backups
OUT="backups/worldcup-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "📦 Dumping database → ${OUT}"
pg_dump "$URL" --no-owner --no-privileges --clean --if-exists | gzip > "$OUT"
echo "✅ Saved ${OUT} ($(du -h "$OUT" | cut -f1))"
