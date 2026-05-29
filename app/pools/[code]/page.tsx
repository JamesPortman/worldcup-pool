import { notFound } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import { prisma } from "@/lib/db";
import { getPlayerIdCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PoolDashboard({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: {
      players: {
        include: { _count: { select: { picks: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!pool) notFound();

  const playerId = await getPlayerIdCookie();
  const me = pool.players.find((p) => p.id === playerId) ?? null;
  const players = [...pool.players].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  return (
    <>
      <Navigation poolCode={pool.joinCode} />
      <HeroBanner />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold">{pool.name}</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Join code: <span className="font-mono font-bold text-lg tracking-widest text-[color:var(--color-brand)]">{pool.joinCode}</span>
          {" — share this with friends to invite them."}
        </p>

        {pool.locked && (
          <p className="mt-4 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-3 py-2 text-sm">
            Picks are locked — the tournament has started.
          </p>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href={`/pools/${pool.joinCode}/picks`}
            className="block rounded-lg border border-neutral-300 dark:border-neutral-700 p-4 hover:border-[color:var(--color-brand)]"
          >
            <h2 className="font-semibold text-lg">My picks</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {me
                ? `You have ${me._count.picks} picks saved.`
                : "Join this pool to make picks."}
            </p>
          </Link>
          <Link
            href={`/pools/${pool.joinCode}/leaderboard`}
            className="block rounded-lg border border-neutral-300 dark:border-neutral-700 p-4 hover:border-[color:var(--color-brand)]"
          >
            <h2 className="font-semibold text-lg">Leaderboard</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              See where everyone stands.
            </p>
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="font-semibold mb-2">Players ({pool.players.length})</h2>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-800">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  <Link
                    href={`/pools/${pool.joinCode}/picks?player=${p.id}`}
                    className="font-medium hover:underline text-[color:var(--color-brand)]"
                  >
                    {p.displayName}
                  </Link>
                  {p.id === playerId && <span className="text-neutral-500"> (you)</span>}
                </span>
                <span className="text-neutral-500">{p._count.picks} picks</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
