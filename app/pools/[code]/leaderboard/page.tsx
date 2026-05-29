import { notFound } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
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

    // Build the Final 4 picks summary for display
    const final4Teams = p.picks
      .filter((pk) => pk.round === "FINAL4")
      .map((pk) => teamsByCode[pk.teamCode])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    const semifinalCodes = new Set(
      p.picks.filter((pk) => pk.round === "SEMIFINAL").map((pk) => pk.teamCode),
    );

    const winnerCode =
      p.picks.find((pk) => pk.round === "WINNER")?.teamCode ?? null;

    return {
      id: p.id,
      name: p.displayName,
      total,
      byRound,
      final4Teams,
      semifinalCodes,
      winnerCode,
    };
  });
  rows.sort((a, b) => b.total - a.total);

  return (
    <>
      <Navigation poolCode={pool.joinCode} />
      <HeroBanner />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Updated as the admin enters real-world results.
        </p>

        <div className="mt-6 overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[360px]">
            <thead>
              <tr className="text-left border-b border-neutral-300 dark:border-neutral-700">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Player</th>
                {ROUNDS.map((r) => (
                  <th key={r.key} className="py-2 px-2 text-right whitespace-nowrap">
                    {r.key === "GROUP" ? "Group Wins" : r.label}
                  </th>
                ))}
                <th className="py-2 px-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="py-4 text-neutral-500" colSpan={ROUNDS.length + 3}>
                    No players yet.
                  </td>
                </tr>
              )}
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-3 text-neutral-500 align-top">{idx + 1}</td>

                  {/* Player name + Final 4 picks summary */}
                  <td className="py-2 pr-3 align-top">
                    <Link
                      href={`/pools/${pool.joinCode}/picks?player=${row.id}`}
                      className="font-medium hover:underline text-[color:var(--color-brand)]"
                    >
                      {row.name}
                    </Link>

                    {row.final4Teams.length > 0 && (
                      <div className="text-xs mt-0.5 text-neutral-500 leading-relaxed">
                        [
                        {row.final4Teams.map((t, i) => (
                          <span key={t.code}>
                            {i > 0 && ", "}
                            {row.winnerCode === t.code ? (
                              <strong className="text-red-600 dark:text-red-400">{t.name}</strong>
                            ) : row.semifinalCodes.has(t.code) ? (
                              <strong className="text-neutral-700 dark:text-neutral-300">{t.name}</strong>
                            ) : (
                              t.name
                            )}
                          </span>
                        ))}
                        ]
                      </div>
                    )}
                  </td>

                  {ROUNDS.map((r) => (
                    <td key={r.key} className="py-2 px-2 text-right tabular-nums align-top">
                      {row.byRound[r.key as RoundKey]}
                    </td>
                  ))}
                  <td className="py-2 px-2 text-right font-semibold tabular-nums align-top">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
