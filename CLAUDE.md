# World Cup Pool — working notes

A bracket pool for the 2026 World Cup. Next.js 16 (App Router) + React 19 +
Tailwind v4, Prisma/Postgres on Neon, deployed to Vercel. No accounts: players
join with a 6-character pool code and a display name, held in a cookie session.

The README covers setup, deploy and day-to-day operation. This file covers the
things that are easy to get wrong.

## Commands

```bash
npm run lint      # eslint .
npm run test      # vitest, __tests__/ only (jsdom)
npm run build     # prisma generate && vitest run && next build
npm run test:e2e  # playwright, e2e/
```

`npm run build` runs the **unit suite before** `next build`, so a failing test
blocks the production deploy. That also means "the build is slow" is usually
the tests, not the compile — reach for `npm run test` while iterating.

## The app is mounted at a path, not a domain root

It is served at `/worldcup` (canonical home `www.portman.ca/worldcup`). `BASE_PATH`
in `lib/site.ts` is the single source of truth; `next.config.ts` imports it, and
`__tests__/base-path.test.ts` pins the two together.

**Next's `basePath` does not rewrite `fetch()`.** It covers routing, `<Link>`
and `/_next` assets, and nothing else. So:

```ts
fetch("/api/pools")           // ✗ resolves against the host root — wrong app
fetch(apiUrl("/api/pools"))   // ✓ lib/site.ts
```

Every client-side API call goes through `apiUrl()`. The failure mode is quiet:
links keep working while API calls land somewhere that belongs to no app.

Anything else that assumes a root — a hardcoded path, a Playwright `baseURL`
with a path in it, a readiness probe on `/` — breaks the same way. `/` itself
404s; the Playwright config probes `${BASE_PATH}` for exactly that reason.

## DATABASE_URL must exist, but nothing connects

`lib/db.ts` instantiates `PrismaClient` at import, and Prisma refuses to
construct without `DATABASE_URL` — even though no test or build step opens a
connection. Unit tests mock `@/lib/db` (`__tests__/api-routes.test.ts`), and
every page and route is `force-dynamic`, so nothing queries at build time.

So lint, test and build all need a *placeholder* `DATABASE_URL` and nothing
more. CI sets one (`.github/workflows/ci.yml`); the SessionStart hook sets the
same one for web sessions. Never point local or CI work at the production Neon
database.

## Scoring is data-driven

Round keys and their point values live in `ROUNDS` in `data/worldcup2026.ts`
(GROUP 1, FINAL4 4, SEMIFINAL 8, WINNER 16 — max 60), alongside
`PICKS_PER_ROUND`. `lib/scoring.ts` derives everything from that array. Change
the table, not the scoring logic.

FINAL4 and SEMIFINAL are **cumulative**: a team that advanced past a round still
satisfies it, so a finalist earns its Final-4 points and the champion earns
both. `lib/win-probability.ts` must never simulate against a TBD opponent — that
was a real bug (commit `a7bd071`); keep the regression tests in
`__tests__/win-probability.test.ts` honest.

## Keep the architecture page in sync

`app/architecture/page.tsx` is a hand-written reference page for engineers, and
it is part of the product — it documents the request path, scoring, the Win %
mechanics and the CI/CD topology. Nothing regenerates it. When you change
scoring, win probability, the data model or the deploy pipeline, update that
page in the same commit.

## Tests

- `__tests__/` — pure logic (scoring, bracket, win probability, rate limiting,
  sessions) plus React component tests via `@testing-library/react`. Prisma is
  mocked. These run anywhere.
- `e2e/` — `smoke.spec.ts` and `admin.spec.ts` hit public pages;
  `flow.spec.ts` drives a real create-pool → picks → leaderboard flow against a
  **real database**. CI gives it an ephemeral Postgres service
  (`.github/workflows/e2e.yml`). A cloud session has no Postgres server, so the
  flow spec can't run there — leave it to CI rather than working around it.
- `vitest.config.mts` excludes `e2e/`, so `vitest` never tries to run Playwright
  specs.

## Conventions

- One change per branch, one PR per branch — that's the existing history, and
  both CI workflows run on every PR.
- Secrets live in Vercel env vars (`ADMIN_TOKEN`, `FOOTBALL_API_KEY`,
  `SENTRY_DSN`), never in the repo. `.env*` is gitignored.
- Sentry is scaffolded but inert until its DSN vars are set; don't assume it's
  reporting.
- `lib/rate-limit.ts` is in-memory and per-instance — best-effort, not a global
  limit. Don't rely on it for anything that needs a hard guarantee.
