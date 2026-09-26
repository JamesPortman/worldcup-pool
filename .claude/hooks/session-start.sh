#!/bin/bash
# SessionStart hook — prepares a Claude Code on the web container for this repo.
#
# A web session starts from a fresh clone: no node_modules, no generated Prisma
# client, no .env.local. Without those, `npm run lint`, `npm run test` and
# `npm run build` all fail before they do any real work, and the session burns
# its first few turns rediscovering that. This sets them up once, up front.
#
# Local sessions are left alone — your own machine already has its setup.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO_ROOT"

# `npm ci`, not `npm install`: it installs exactly what package-lock.json pins
# and never rewrites it. `npm install` with the container's npm quietly
# reformatted the lockfile (dropping `libc` fields), leaving a dirty tree in
# every new session.
echo "[session-start] installing npm dependencies…"
npm ci --no-audit --no-fund

# `postinstall` already runs this, but npm skips lifecycle scripts when
# node_modules comes back warm from the container cache. Regenerating is cheap
# and idempotent, and a missing client breaks every import of lib/db.ts.
echo "[session-start] generating the Prisma client…"
npx prisma generate

# Prisma refuses to instantiate without DATABASE_URL, even on code paths that
# never open a connection — which is all of them here: the unit tests mock
# Prisma, and every page is force-dynamic so nothing queries at build time.
# CI sets the same placeholders for the same reason (.github/workflows/ci.yml).
#
# These are deliberately NOT a real database. Nothing in a web session should
# be able to reach production data.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -q '^export DATABASE_URL=' "$CLAUDE_ENV_FILE" 2>/dev/null; then
  echo "[session-start] registering placeholder database URLs…"
  {
    echo 'export DATABASE_URL="postgresql://user:pass@localhost:5432/db"'
    echo 'export DATABASE_URL_UNPOOLED="postgresql://user:pass@localhost:5432/db"'
    echo 'export ADMIN_TOKEN="test-token"'
  } >> "$CLAUDE_ENV_FILE"
fi

echo "[session-start] ready — npm run lint / npm run test / npm run build"
