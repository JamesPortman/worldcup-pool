import { notFound, redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import { prisma } from "@/lib/db";
import { getPlayerIdCookie } from "@/lib/session";
import { picksLocked } from "@/lib/lock";
import PicksClient from "./PicksClient";

export const dynamic = "force-dynamic";

export default async function PicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ player?: string }>;
}) {
  const [{ code }, { player: playerParam }] = await Promise.all([params, searchParams]);

  const pool = await prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
  });
  if (!pool) notFound();

  const viewerId = await getPlayerIdCookie();
  const teams = await prisma.team.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }] });

  // ── Viewing another player's picks (read-only) ────────────────────────────
  if (playerParam && playerParam !== viewerId) {
    const target = await prisma.player.findFirst({
      where: { id: playerParam, poolId: pool.id },
      include: { picks: true },
    });
    if (!target) notFound();

    return (
      <>
        <Navigation poolCode={pool.joinCode} />
        <HeroBanner />
        <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
          <h1 className="text-3xl font-bold">{target.displayName}&apos;s picks</h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            Read-only view — you can only edit your own picks.
          </p>
          <PicksClient
            poolCode={pool.joinCode}
            locked={true}
            teams={teams}
            existingPicks={target.picks.map((p) => ({
              round: p.round,
              teamCode: p.teamCode,
              groupId: p.groupId,
            }))}
          />
        </main>
      </>
    );
  }

  // ── Own picks ─────────────────────────────────────────────────────────────
  if (!viewerId) redirect(`/pools/${pool.joinCode}`);

  const me = await prisma.player.findFirst({
    where: { id: viewerId, poolId: pool.id },
    include: { picks: true },
  });
  if (!me) redirect(`/pools/${pool.joinCode}`);

  return (
    <>
      <Navigation poolCode={pool.joinCode} />
      <HeroBanner />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <h1 className="text-3xl font-bold">Your picks</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Hi {me.displayName}.{" "}
          {picksLocked(pool)
            ? "Picks are locked — read-only."
            : "Save anytime. You can edit until entries close on June 10, 2026."}
        </p>
        <PicksClient
          poolCode={pool.joinCode}
          locked={picksLocked(pool)}
          teams={teams}
          existingPicks={me.picks.map((p) => ({
            round: p.round,
            teamCode: p.teamCode,
            groupId: p.groupId,
          }))}
        />
      </main>
    </>
  );
}
