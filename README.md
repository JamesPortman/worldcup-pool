# World Cup Pool

A bracket pool for the 2026 FIFA World Cup. Anyone with a 6-character pool code can join with a display name, make picks, and see a live leaderboard. No accounts, no passwords.

- **Stack:** Next.js 16, React 19, Tailwind v4, Prisma + Postgres (Neon)
- **Hosting:** Vercel (free tier is plenty)
- **Auth:** name + pool code (cookie-based player session)
- **Scoring:** Group winner=1, Final 4=4, Semi-Final=8, Winner=16 (max 60)

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in DATABASE_URL with a Postgres connection string (Neon, local Postgres, etc.)
npm run db:push      # create tables
npm run db:seed      # load the 48 teams + 12 groups
npm run dev          # http://localhost:3000
```

## Testing

```bash
npm run test         # Vitest unit + component tests (jsdom)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright smoke tests (auto-starts a dev server)
```

- **Unit/component tests** live in `__tests__/` — pure logic (`lib/scoring.ts`,
  `data/worldcup2026.ts`, join-code generation) plus React component render
  tests via `@testing-library/react`.
- **End-to-end tests** live in `e2e/` and cover the public, no-database pages
  (home, how-it-works, architecture) and navigation wiring. Run
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

You'll need this string on the `/admin` page to enter results and lock pools.

### 5. Deploy

Click **Deploy**. The build runs `prisma generate && vitest run && next build` — unit tests must pass before Next.js compiles.

### 6. Create the schema in Neon

After the first successful deploy, push the Prisma schema to Neon and seed the teams. From your laptop:

```bash
# Pull the production env vars into a local .env file
npx vercel env pull .env.production.local

# Push schema and seed teams using that env
DATABASE_URL=$(grep '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '"') npm run db:push
DATABASE_URL=$(grep '^DATABASE_URL=' .env.production.local | cut -d= -f2- | tr -d '"') npm run db:seed
```

(`npx vercel env pull` will prompt you to install + link the project the first time.)

### 7. Try it

- Open the deployed URL → create a pool → share the join code.
- Visit `/admin` and paste your `ADMIN_TOKEN` to mark teams as advancing or lock a pool.

## Running the pool day-to-day

- **Before kickoff:** each player joins with the code and submits picks. Picks can be edited until you lock the pool from `/admin`.
- **After each round:** in `/admin`, set each surviving team's "reached round" to the round they reached. Check **won group** for the 12 group winners after the group stage. Check **champion** for the team that wins the final. The leaderboard updates instantly.

## Updating the team list

If FIFA changes a team (e.g. playoff resolution), edit `data/worldcup2026.ts` and run:

```bash
npm run db:seed
```

The seed script upserts, so it won't wipe existing picks.
