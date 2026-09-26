# World Cup Pool

Built with [Claude Code](https://claude.com/claude-code) — [`CLAUDE.md`](CLAUDE.md) holds the project notes it works from.

A bracket pool for the 2026 FIFA World Cup. Anyone with a 6-character pool code can join with a display name, make picks, and see a live leaderboard. No accounts, no passwords.

- **Stack:** Next.js 16, React 19, Tailwind v4, Prisma + Postgres (Neon)
- **Hosting:** Vercel (free tier is plenty)
- **Auth:** name + pool code (HMAC-signed cookie player session)
- **Path:** served under `/worldcup` (`BASE_PATH` in `lib/site.ts`), not at a domain root
- **Scoring:** Group winner=1, Final 4=4, Semi-Final=8, Winner=16 (max 60)

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in DATABASE_URL with a Postgres connection string (Neon, local Postgres, etc.),
# and add DATABASE_URL_UNPOOLED — the schema's directUrl, which Prisma requires.
# Locally both can be the same string.
npm run db:push      # create tables
npm run db:seed      # load the 48 teams (A–L groups)
npm run dev          # http://localhost:3000/worldcup
```

The app is mounted at `/worldcup`, so `http://localhost:3000/` itself 404s —
that's expected. Locally, with no `SESSION_SECRET` or `ADMIN_TOKEN`, player
cookies are signed with a built-in dev key; production refuses to start a
session without one of them.

## Testing

```bash
npm run test         # Vitest unit + component tests (jsdom)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright e2e tests (auto-starts a dev server)
```

- **Unit/component tests** live in `__tests__/` — pure logic (scoring, the
  team data, bracket, win probability, results mapping, pick locking, rate
  limiting, signed sessions), the API routes with Prisma mocked, plus React
  component render tests via `@testing-library/react`.
- **End-to-end tests** live in `e2e/` — public-page smoke tests
  (`smoke.spec.ts`: home, how-it-works, architecture, nav) plus two specs that
  exercise the real DB: a **full create-pool → picks → leaderboard flow**
  (`flow.spec.ts`) and the **admin token gate → lock a pool** path
  (`admin.spec.ts`, which uses `ADMIN_TOKEN`, defaulting to `test-token`). Both
  run in CI against an ephemeral Postgres service (`.github/workflows/e2e.yml`);
  locally they need a throwaway database (don't point them at production). Run
  `npx playwright install chromium` once before the first e2e run.
- `npm run build` runs the unit suite **before** `next build`, so a failing
  test blocks the production deploy.

## Deploy to Vercel

### 1. Push to GitHub

```bash
gh repo create worldcup-pool --public --source=. --remote=origin --push
```

### 2. Create the Vercel project

1. Go to https://vercel.com/new and import `JamesPortman/worldcup-pool`.
2. Framework preset: **Next.js** (auto-detected).
3. **Don't deploy yet** — set up the database first.

### 3. Provision the Neon Postgres database

1. In the new Vercel project, go to **Storage → Create Database → Neon (Postgres)**.
2. Pick a region close to your users (e.g. `iad1`/Washington for North America).
3. Vercel auto-creates `DATABASE_URL` + related env vars in the project. No copy/paste needed.

### 4. Add the admin token

In **Settings → Environment Variables**, add:

| Key           | Value                                  | Environments        |
|---------------|----------------------------------------|---------------------|
| `ADMIN_TOKEN` | a long random string (you choose)      | Production, Preview |
| `SESSION_SECRET` | *optional* — a long random string   | Production, Preview |

You'll need `ADMIN_TOKEN` on the `/worldcup/admin` page to enter results and lock pools.
Player session cookies are HMAC-signed with `SESSION_SECRET`, or, when that isn't
set, with a key derived from `ADMIN_TOKEN` — so set `SESSION_SECRET` if you want
to rotate the admin token without signing every player out. Changing whichever
key is in use signs everyone out; players get back in by re-joining with the same
name, but only view-only (see below).

### 5. Deploy

Click **Deploy**. The build runs `prisma generate && vitest run && next build` — unit tests must pass before Next.js compiles.

### 6. Create the schema in Neon

After the first successful deploy, push the Prisma schema to Neon and seed the teams. From your laptop,
using the **direct** Neon URL (see [Backups](#backups) for where to find it —
`vercel env pull` returns the database vars empty because Vercel stores them as
sensitive):

```bash
export DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require"   # from Neon
export DATABASE_URL_UNPOOLED="$DATABASE_URL"                           # Prisma's directUrl
npm run db:push
npm run db:seed
```

### 7. Try it

- Open `<deployed-url>/worldcup` → create a pool → share the join code. (The bare
  domain root 404s — the app only lives under `/worldcup`.)
- Visit `/worldcup/admin` and paste your `ADMIN_TOKEN` to mark teams as advancing or lock a pool.
- `/worldcup/api/health` returns `{ ok, teams }` — a quick check that the database
  is reachable and seeded (expect `teams: 48`).

## Running the pool day-to-day

- **Before kickoff:** each player joins with the code and submits picks. Picks can be edited until the pool locks — either when you lock it from `/worldcup/admin`, or automatically at the fixed deadline in `lib/lock.ts` (`PICKS_LOCK_AT`: end of June 10, 2026 Eastern, the day before kickoff), whichever comes first. Once locked, new players can't join, but existing players can still sign back in (same name) to view their picks and the leaderboard.
- **Signing back in is view-only.** There are no passwords, so typing an existing display name gives a read-only session; only the device the player joined on can edit their picks. A player who loses that cookie before the deadline (new phone, cleared browser) can still see their picks but can't change them.
- **After each round:** in `/worldcup/admin`, toggle **Group winner** on the 12 group winners after the group stage. As the knockouts resolve, set each team's **stage reached** dropdown to the furthest stage it got to (Final 4, Final, or **Champion** for the team that wins the final) — earlier-round points are awarded automatically. Changes save instantly and the leaderboard reflects them on the next load. The admin page can also remove a player from a pool.
- **Auto-fetch results (optional):** in `/worldcup/admin`, the **"Fetch latest results"** button pulls live standings + knockout results from [football-data.org](https://www.football-data.org/) and **stages the changes for you to review** (group winners, Final-4, finalists, champion) — nothing is saved until you click **Apply**. It maps the provider's teams to ours by 3-letter code / name; any it can't match are flagged so you can set them by hand. Enable it by setting a free **`FOOTBALL_API_KEY`** env var on Vercel (the World Cup competition is on the free tier).

## Backups

Pools, players, and picks live only in Neon, so keep your own dumps — especially
**right after picks lock on June 10**, when the user data is effectively frozen.

> **Where to get the connection string:** Vercel stores the database vars as
> *sensitive* (write-only), so `vercel env pull` returns them empty and the
> dashboard won't reveal them. Copy the URL from the **Neon console** instead:
> Project → **Connection Details** → turn the **"Pooled connection" toggle off**
> to get the **direct** URL (host has no `-pooler`), e.g.
> `postgresql://…@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`.

**On demand (local):**

```bash
export DATABASE_URL_UNPOOLED="postgresql://…neon.tech/neondb?sslmode=require"  # from Neon
npm run db:backup                                          # → backups/worldcup-<timestamp>.sql.gz
npm run db:restore -- backups/worldcup-<timestamp>.sql.gz  # restore (OVERWRITES the target!)
```

Requires the Postgres client tools: `brew install libpq && brew link --force libpq`.
(You can also drop `DATABASE_URL_UNPOOLED=…` into `.env.production.local` instead
of exporting it.)

**Automated (GitHub Actions):** `.github/workflows/backup.yml` runs `pg_dump`
daily (and on demand), **encrypts** it with gpg (AES-256), and stores each
encrypted dump as a **90-day workflow artifact**. This repo is public, so artifacts
can be downloaded by any signed-in GitHub user — which is why the dump is encrypted
and why the job **fails rather than upload plaintext** if the passphrase is missing.
It needs two repository secrets under **GitHub → Settings → Secrets and variables →
Actions**:

- **`DATABASE_URL_UNPOOLED`** — the direct Neon URL above
  (`gh secret set DATABASE_URL_UNPOOLED --body "<paste-neon-url>"`).
- **`BACKUP_PASSPHRASE`** — a long random passphrase
  (`gh secret set BACKUP_PASSPHRASE --body "$(openssl rand -base64 32)"` — but
  generate it yourself first and **keep a copy somewhere safe**: GitHub won't show
  it again, and a backup can't be restored without it).

Then trigger a run from the **Actions** tab to verify, and download the artifact
from the run page. To restore one:

```bash
unzip db-backup-<run-id>.zip
gpg --decrypt worldcup-<timestamp>.sql.gz.gpg > worldcup-<timestamp>.sql.gz  # prompts for BACKUP_PASSPHRASE
npm run db:restore -- worldcup-<timestamp>.sql.gz                            # OVERWRITES the target!
```

Neon also offers point-in-time restore from its console, but the free-plan window
is short — treat these dumps as the durable copy.

## Error monitoring & rate limiting

- **Sentry** is scaffolded (`instrumentation.ts`, `instrumentation-client.ts`,
  `app/global-error.tsx`) but **off by default** — it's a no-op until you set the
  DSN env vars on Vercel: **`SENTRY_DSN`** (server) and **`NEXT_PUBLIC_SENTRY_DSN`**
  (client), from a Sentry project. (Source-map upload via `withSentryConfig` can be
  added later with a `SENTRY_AUTH_TOKEN`.)
- **Rate limiting** (`lib/rate-limit.ts`) guards pool creation (5/min) and joining
  (15/min) per client IP. It's an in-memory, best-effort, per-instance limiter — for
  a hard global limit, back it with Upstash Redis (the call sites stay the same).

## Updating the team list

If FIFA changes a team (e.g. playoff resolution), edit `data/worldcup2026.ts` and run:

```bash
npm run db:seed
```

The seed script upserts, so it won't wipe existing picks.

## License

MIT — see [`LICENSE`](LICENSE).
