import { notFound, redirect } from "next/navigation";
import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import { prisma } from "@/lib/db";
import { getPlayerIdCookie } from "@/lib/session";
import PicksClient from "./PicksClient";

export const dynamic = "force-dynamic";

export default async function PicksPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pool = await prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
  });
  if (!pool) notFound();

  const playerId = await getPlayerIdCookie();
  if (!playerId) redirect(`/pools/${pool.joinCode}`);

  const me = await prisma.player.findFirst({
    where: { id: playerId, poolId: pool.id },
    include: { picks: true },
  });
  if (!me) redirect(`/pools/${pool.joinCode}`);

  const teams = await prisma.team.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }] });

  return (
    <>
      <Navigation poolCode={pool.joinCode} />
      <HeroBanner />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <h1 className="text-3xl font-bold">Your picks</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Hi {me.displayName}. {pool.locked
            ? "Picks are locked — read-only."
            : "Save anytime. You can edit until the pool is locked."}
        </p>
        <PicksClient
          poolCode={pool.joinCode}
          locked={pool.locked}
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
