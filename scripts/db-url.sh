# Shared helper for the backup/restore scripts — resolves a Postgres connection
# string and prints it on stdout via resolve_db_url. Prefers the direct
# (unpooled) URL, which pg_dump / psql handle better than the PgBouncer URL.
#
# Resolution order: $DATABASE_URL_UNPOOLED, $DATABASE_URL, then a matching
# line in .env.production.local / .env.local / .env.
resolve_db_url() {
  if [[ -n "${DATABASE_URL_UNPOOLED:-}" ]]; then printf '%s' "$DATABASE_URL_UNPOOLED"; return 0; fi
  if [[ -n "${DATABASE_URL:-}" ]]; then printf '%s' "$DATABASE_URL"; return 0; fi
  local f key line
  for f in .env.production.local .env.local .env; do
    [[ -f "$f" ]] || continue
    for key in DATABASE_URL_UNPOOLED DATABASE_URL; do
      line=$(grep -E "^${key}=" "$f" | head -1 || true)
      if [[ -n "$line" ]]; then
        line="${line#${key}=}"
        printf '%s' "$line" | tr -d '"\r'
        return 0
      fi
    done
  done
  return 1
}
