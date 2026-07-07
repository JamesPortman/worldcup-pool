import { notFound } from "next/navigation";
import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import { prisma } from "@/lib/db";
import { scoreAllPicks } from "@/lib/scoring";
import { getWinPercents } from "@/lib/tournament-bracket";
import LeaderboardClient, { type LeaderboardRow } from "./LeaderboardClient";

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

  // Simulated chance of finishing 1st (null if no live bracket is available).
  const winPct = await getWinPercents(pool.joinCode, pool.players, teams);
  const showWin = winPct !== null;

  // Serializable rows for the client table (it handles sorting by Total / Win %).
  const rows: LeaderboardRow[] = pool.players.map((p) => {
    const { total, byRound } = scoreAllPicks(p.picks, teamsByCode);

    const final4Teams = p.picks
      .filter((pk) => pk.round === "FINAL4")
      .map((pk) => teamsByCode[pk.teamCode])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ code: t.code, name: t.name }));

    const semifinalCodes = p.picks
      .filter((pk) => pk.round === "SEMIFINAL")
      .map((pk) => pk.teamCode);

    const winnerCode = p.picks.find((pk) => pk.round === "WINNER")?.teamCode ?? null;

    return {
      id: p.id,
      name: p.displayName,
      total,
      byRound,
      final4Teams,
      semifinalCodes,
      winnerCode,
      winPct: winPct?.[p.id] ?? null,
    };
  });

  return (
    <>
      <Navigation poolCode={pool.joinCode} />
      <HeroBanner />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Updated as the admin enters real-world results. Tap <strong>Total</strong>
          {showWin ? " or Win %" : ""} to re-sort.
        </p>

        <LeaderboardClient rows={rows} poolCode={pool.joinCode} showWin={showWin} />

        {showWin && (
          <p className="mt-3 text-xs text-neutral-500">
            Win % is a Monte-Carlo estimate of each player&apos;s chance of finishing 1st — simulating
            the remaining matches from FIFA/Elo team ratings and the current knockout bracket.
          </p>
        )}
      </main>
    </>
  );
}
