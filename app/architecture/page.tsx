import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";

export const metadata = { title: "Architecture — World Cup Pool" };

// Static, server-rendered reference page. No database access — safe to render
// anywhere. Audience: a senior engineer/architect onboarding to the codebase.
export default async function ArchitecturePage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool } = await searchParams;

  return (
    <>
      <Navigation poolCode={pool} />
      <HeroBanner />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Architecture</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-3xl">
            A deep-dive into how the World Cup Pool is built, from the request
            path down to the database, plus the CI/CD topology and the domain
            model. Written for engineers extending or operating the system.
          </p>
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ["Framework", "Next.js 16 (App Router)"],
              ["Runtime", "React 19 · Node"],
              ["Data", "Prisma 6 · Neon Postgres"],
              ["Host", "Vercel (CI + CDN)"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3"
              >
                <dt className="text-xs uppercase tracking-wide text-neutral-500">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ── Runtime request path ───────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-1">1 · Runtime request path</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Every page is a React Server Component that reads through a single
            Prisma client into Neon. Interactive surfaces hydrate as client
            components and mutate state through <code>/api</code> route handlers.
          </p>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 overflow-x-auto text-neutral-800 dark:text-neutral-100">
            <RuntimeDiagram />
          </div>
        </section>

        {/* ── CI/CD & deployment topology ────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-1">2 · CI/CD &amp; deployment topology</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            <code>main</code> is branch-protected; all work lands via PRs. Each
            push builds on Vercel, and the build is gated by the unit-test suite
            before Next.js compiles.
          </p>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 overflow-x-auto text-neutral-800 dark:text-neutral-100">
            <PipelineDiagram />
          </div>
        </section>

        {/* ── Domain / data model ────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-3">3 · Data model</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Four entities. <code>Team</code> is reference data seeded from{" "}
            <code>data/worldcup2026.ts</code>; the admin mutates only its result
            columns. A <code>Pick</code> is the join between a player and a team
            for a given round.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <EntityCard
              title="Pool"
              subtitle="A shared bracket competition"
              fields={[
                ["id", "cuid, PK"],
                ["name", "string"],
                ["joinCode", "string, unique (6-char)"],
                ["locked", "boolean — freezes picks"],
                ["createdAt", "datetime"],
              ]}
              relations={["1 → N Player"]}
            />
            <EntityCard
              title="Player"
              subtitle="A person in one pool (no auth)"
              fields={[
                ["id", "cuid, PK — stored in cookie"],
                ["displayName", "string"],
                ["poolId", "FK → Pool (cascade)"],
                ["joinedAt", "datetime"],
                ["@@unique", "(poolId, displayName)"],
              ]}
              relations={["N → 1 Pool", "1 → N Pick"]}
            />
            <EntityCard
              title="Pick"
              subtitle="Player predicts Team reaches Round"
              fields={[
                ["id", "cuid, PK"],
                ["playerId", "FK → Player (cascade)"],
                ["teamCode", "FK → Team"],
                ["round", "GROUP|FINAL4|SEMIFINAL|WINNER"],
                ["groupId", "string? — only for GROUP"],
                ["@@unique", "(playerId, round, groupId, teamCode)"],
              ]}
              relations={["N → 1 Player", "N → 1 Team"]}
            />
            <EntityCard
              title="Team"
              subtitle="Seeded reference data (48 rows)"
              fields={[
                ["code", "string, PK (e.g. BRA)"],
                ["name", "string"],
                ["group", '"A".."L"'],
                ["reachedRound", "string? — set by admin"],
                ["wonGroup", "boolean — set by admin"],
                ["isChampion", "boolean — set by admin"],
              ]}
              relations={["1 → N Pick"]}
            />
          </div>
        </section>

        {/* ── Request lifecycle ──────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-3">4 · Key flows</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FlowCard
              title="Create / join a pool"
              steps={[
                "HomeClient POSTs to /api/pools or /api/pools/[code]/join.",
                "Route handler creates the Pool/Player and calls setPlayerIdCookie().",
                "wcpool_pid (httpOnly, 90-day) is written; client routes to /pools/[code].",
              ]}
            />
            <FlowCard
              title="Make / edit picks"
              steps={[
                "PicksClient builds the full pick set client-side with progressive reveal.",
                "Save POSTs the entire set to /api/pools/[code]/picks.",
                "Handler validates round counts, then $transaction([deleteMany, createMany]) — an atomic replace.",
                "Reset = POST an empty array → deletes all picks.",
              ]}
            />
            <FlowCard
              title="Admin enters results"
              steps={[
                "AdminClient submits to /api/admin/results with the ADMIN_TOKEN.",
                "Handler verifies the token server-side, then updates Team result columns.",
                "Locking a pool flips Pool.locked; the picks API then rejects writes.",
              ]}
            />
            <FlowCard
              title="Leaderboard"
              steps={[
                "Server component loads players + picks + teams in one pass.",
                "scoreAllPicks() computes per-round and total points purely in memory.",
                "Rows sort by total desc, then alphabetically by name as a tie-break.",
              ]}
            />
          </div>
        </section>

        {/* ── Scoring ────────────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-3">5 · Scoring engine</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            <code>lib/scoring.ts</code> is pure and deterministic — no I/O — which
            makes it trivial to unit test. Knockout rounds are{" "}
            <strong>cumulative</strong>: a team that advances further also
            satisfies the earlier rounds (a finalist still earns its Final-4
            points; the champion earns all three). Correctness is round-specific:
          </p>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                  <th className="py-2 px-3">Round</th>
                  <th className="py-2 px-3">Correct when…</th>
                  <th className="py-2 px-3 text-right">Pts</th>
                  <th className="py-2 px-3 text-right">×</th>
                  <th className="py-2 px-3 text-right">Max</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["GROUP", "team.wonGroup && team.group === pick.groupId", 1, 12, 12],
                  ["FINAL4", "team reached ≥ Final 4 (cumulative)", 4, 4, 16],
                  ["SEMIFINAL", "team reached ≥ Semi-Final (cumulative)", 8, 2, 16],
                  ["WINNER", "team.isChampion", 16, 1, 16],
                ].map(([r, cond, pts, mult, max]) => (
                  <tr key={r as string} className="border-b border-neutral-100 dark:border-neutral-900">
                    <td className="py-2 px-3 font-medium">{r}</td>
                    <td className="py-2 px-3 font-mono text-xs">{cond}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{pts}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{mult}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{max}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 px-3" colSpan={4}>Maximum achievable</td>
                  <td className="py-2 px-3 text-right tabular-nums">60</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Cross-cutting concerns ─────────────────────────────────────── */}
        <section className="mb-12 grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold mb-3">6 · Security &amp; sessions</h2>
            <ul className="text-sm space-y-2 text-neutral-700 dark:text-neutral-300 list-disc pl-5">
              <li>No passwords. Identity = the <code>wcpool_pid</code> cookie (httpOnly, SameSite=Lax).</li>
              <li>The cookie alone grants nothing: every API route verifies the player belongs to the pool named in the URL.</li>
              <li>Admin writes are gated by a server-checked <code>ADMIN_TOKEN</code> env var; the page UI never trusts the client.</li>
              <li>Viewing another player&apos;s picks reuses <code>PicksClient</code> in a <code>locked</code> (read-only) mode.</li>
              <li>Picks close when the admin locks the pool <em>or</em> the global deadline in <code>lib/lock.ts</code> passes (end of Jun 10, 2026) — enforced in both the picks API and UI.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-3">7 · Connection &amp; build notes</h2>
            <ul className="text-sm space-y-2 text-neutral-700 dark:text-neutral-300 list-disc pl-5">
              <li><code>DATABASE_URL</code> is the pooled (PgBouncer) Neon URL for app queries.</li>
              <li><code>DATABASE_URL_UNPOOLED</code> (<code>directUrl</code>) is used for migrations.</li>
              <li>Prisma is a global singleton to survive serverless function reuse and avoid connection storms.</li>
              <li>Pages use <code>export const dynamic = &quot;force-dynamic&quot;</code> so picks/leaderboards are never statically cached.</li>
              <li>Build: <code>prisma generate → vitest run → next build</code> — a failing test blocks the deploy.</li>
            </ul>
          </div>
        </section>

        {/* ── Directory map ──────────────────────────────────────────────── */}
        <section className="mb-4">
          <h2 className="text-xl font-semibold mb-3">8 · Repository map</h2>
          <pre className="text-xs leading-relaxed overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900">
{`app/
  page.tsx · HomeClient.tsx        create / join a pool
  pools/[code]/
    page.tsx                       pool dashboard
    picks/  page.tsx · PicksClient  progressive bracket picker
    leaderboard/page.tsx           scored standings (server-computed)
  how-it-works/ · architecture/    static reference pages
  admin/  page.tsx · AdminClient    results entry (token-gated)
  api/
    pools/route.ts                 create pool
    pools/[code]/join/route.ts     join pool
    pools/[code]/picks/route.ts    atomic replace of a player's picks
    admin/results/route.ts         set team results / lock pool
components/   Navigation · HeroBanner · ThemeToggle
lib/          db.ts (Prisma singleton) · session.ts (cookie) · scoring.ts (pure)
data/         worldcup2026.ts (48 teams, rounds, points)
prisma/       schema.prisma · seed.ts
__tests__/    vitest unit + component tests
e2e/          playwright smoke tests`}
          </pre>
        </section>
      </main>
    </>
  );
}

// ── Reusable presentation pieces ───────────────────────────────────────────

function EntityCard({
  title,
  subtitle,
  fields,
  relations,
}: {
  title: string;
  subtitle: string;
  fields: [string, string][];
  relations: string[];
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-neutral-500">{subtitle}</div>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {fields.map(([name, type]) => (
            <tr key={name} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-1.5 px-4 font-mono">{name}</td>
              <td className="py-1.5 px-4 text-neutral-500 text-right">{type}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 text-xs text-neutral-500 flex flex-wrap gap-x-3 gap-y-1">
        {relations.map((r) => (
          <span key={r} className="font-mono">↔ {r}</span>
        ))}
      </div>
    </div>
  );
}

function FlowCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <ol className="text-sm space-y-1.5 text-neutral-700 dark:text-neutral-300 list-decimal pl-5">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

// ── Diagrams (self-contained inline SVG, dark-mode aware via currentColor) ──

function RuntimeDiagram() {
  // Host-nation palette: blue / red / green.
  const layers: {
    y: number;
    h: number;
    color: string;
    title: string;
    lines: string[];
  }[] = [
    {
      y: 8, h: 92, color: "#002868",
      title: "Browser — React 19 client",
      lines: [
        "Client components: HomeClient · PicksClient · AdminClient · ThemeToggle",
        "State: useState/useMemo bracket model · wcpool_pid cookie (httpOnly)",
      ],
    },
    {
      y: 148, h: 100, color: "#BF0A30",
      title: "Next.js 16 App Router  ·  Vercel (Node runtime)",
      lines: [
        "Server Components render pages (dynamic = force-dynamic)",
        "Route Handlers /api/* — pools · join · picks · admin/results",
        "lib/session.ts reads/writes the player cookie",
      ],
    },
    {
      y: 296, h: 66, color: "#9a6700",
      title: "Prisma 6 Client  (global singleton)",
      lines: ["Type-safe queries · generated at build · pooled connections"],
    },
    {
      y: 410, h: 96, color: "#006847",
      title: "Neon Postgres  (serverless)",
      lines: [
        "Tables: Pool · Player · Pick · Team",
        "DATABASE_URL (pooled) · DATABASE_URL_UNPOOLED (migrations)",
      ],
    },
  ];

  const arrows: { y1: number; y2: number; label: string }[] = [
    { y1: 100, y2: 148, label: "HTTPS · fetch() / navigation" },
    { y1: 248, y2: 296, label: "prisma.* query" },
    { y1: 362, y2: 410, label: "SQL over TCP" },
  ];

  return (
    <svg
      viewBox="0 0 760 516"
      className="w-full h-auto min-w-[600px]"
      role="img"
      aria-label="Runtime request path: browser to Next.js to Prisma to Neon Postgres"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>

      {layers.map((l) => (
        <g key={l.title}>
          <rect
            x="20" y={l.y} width="720" height={l.h} rx="12"
            fill={l.color} fillOpacity="0.12" stroke={l.color} strokeWidth="1.5"
          />
          <text x="40" y={l.y + 26} fontSize="15" fontWeight="700" fill={l.color}>
            {l.title}
          </text>
          {l.lines.map((line, i) => (
            <text key={i} x="40" y={l.y + 48 + i * 18} fontSize="12" fill="currentColor" fillOpacity="0.85">
              {line}
            </text>
          ))}
        </g>
      ))}

      {arrows.map((a) => (
        <g key={a.y1}>
          <line
            x1="380" y1={a.y1} x2="380" y2={a.y2}
            stroke="currentColor" strokeWidth="1.5" markerEnd="url(#arrow)"
          />
          <text x="396" y={(a.y1 + a.y2) / 2 + 4} fontSize="11" fill="currentColor" fillOpacity="0.7">
            {a.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function PipelineDiagram() {
  const stages: { x: number; title: string; lines: string[]; color: string }[] = [
    { x: 8, title: "Developer", lines: ["feature branch", "local: npm run build"], color: "#002868" },
    { x: 196, title: "GitHub", lines: ["main (protected)", "PR + checks"], color: "#444" },
    { x: 384, title: "Vercel Build", lines: ["prisma generate", "vitest run (gate)", "next build"], color: "#BF0A30" },
    { x: 572, title: "Production", lines: ["CDN + Node fns", "→ Neon Postgres"], color: "#006847" },
  ];

  return (
    <svg
      viewBox="0 0 740 150"
      className="w-full h-auto min-w-[640px]"
      role="img"
      aria-label="CI/CD pipeline: developer to GitHub to Vercel build to production"
    >
      <defs>
        <marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>

      {stages.map((s) => (
        <g key={s.title}>
          <rect
            x={s.x} y="20" width="160" height="92" rx="12"
            fill={s.color} fillOpacity="0.12" stroke={s.color} strokeWidth="1.5"
          />
          <text x={s.x + 16} y="46" fontSize="14" fontWeight="700" fill={s.color}>
            {s.title}
          </text>
          {s.lines.map((line, i) => (
            <text key={i} x={s.x + 16} y={66 + i * 16} fontSize="11" fill="currentColor" fillOpacity="0.85">
              {line}
            </text>
          ))}
        </g>
      ))}

      {[176, 364, 552].map((x) => (
        <line
          key={x} x1={x} y1="66" x2={x + 18} y2="66"
          stroke="currentColor" strokeWidth="1.5" markerEnd="url(#arrow2)"
        />
      ))}
    </svg>
  );
}
