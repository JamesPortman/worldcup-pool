import { notFound } from "next/navigation";
import Navigation from "@/components/Navigation";
import { prisma } from "@/lib/db";
import { scoreAllPicks } from "@/lib/scoring";
import { ROUNDS, type RoundKey } from "@/data/worldcup2026";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: {
      players: { include: { picks: true }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!pool) notFound();

  const teams = await prisma.team.findMany();
  const teamsByCode = Object.fromEntries(teams.map((t) => [t.code, t]));

  const rows = pool.players.map((p) => {
    const { total, byRound } = scoreAllPicks(p.picks, teamsByCode);
    return { id: p.id, name: p.displayName, total, byRound, count: p.picks.length };
  });
  rows.sort((a, b) => b.total - a.total);

  return (
    <>
      <Navigation poolCode={pool.joinCode} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Updated as the admin enters real-world results.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-neutral-300 dark:border-neutral-700">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Player</th>
                {ROUNDS.map((r) => (
                  <th key={r.key} className="py-2 px-2 text-right">{r.label}</th>
                ))}
                <th className="py-2 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td className="py-4 text-neutral-500" colSpan={ROUNDS.length + 3}>No players yet.</td></tr>
              )}
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-3 text-neutral-500">{idx + 1}</td>
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  {ROUNDS.map((r) => (
                    <td key={r.key} className="py-2 px-2 text-right tabular-nums">
                      {row.byRound[r.key as RoundKey]}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-right font-semibold tabular-nums">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
