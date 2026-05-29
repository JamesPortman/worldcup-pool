import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlayerIdCookie } from "@/lib/session";
import { picksLocked } from "@/lib/lock";
import { ROUNDS, PICKS_PER_ROUND, type RoundKey } from "@/data/worldcup2026";

export const dynamic = "force-dynamic";

interface IncomingPick {
  round: RoundKey;
  teamCode: string;
  groupId?: string | null;
}

const VALID_ROUNDS = new Set<string>(ROUNDS.map((r) => r.key));

// Replaces the player's entire pick set with whatever is posted. Pool must not be locked.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const playerId = await getPlayerIdCookie();
  if (!playerId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const pool = await prisma.pool.findUnique({
    where: { joinCode: code.toUpperCase() },
    include: { players: { where: { id: playerId } } },
  });
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404 });
  if (pool.players.length === 0) {
    return NextResponse.json({ error: "You're not a member of this pool." }, { status: 403 });
  }
  if (picksLocked(pool)) return NextResponse.json({ error: "Picks are closed." }, { status: 400 });

  const body = (await req.json()) as { picks?: IncomingPick[] };
  const picks = body.picks ?? [];

  // Validate
  for (const p of picks) {
    if (!VALID_ROUNDS.has(p.round)) {
      return NextResponse.json({ error: `Invalid round: ${p.round}` }, { status: 400 });
    }
  }

  // Enforce per-round counts (only when the player submits picks for that round).
  const byRound = new Map<RoundKey, IncomingPick[]>();
  for (const p of picks) {
    const arr = byRound.get(p.round) ?? [];
    arr.push(p);
    byRound.set(p.round, arr);
  }
  for (const [round, arr] of byRound) {
    const expected = PICKS_PER_ROUND[round];
    if (arr.length > expected) {
      return NextResponse.json(
        { error: `Too many picks for ${round}: ${arr.length} (max ${expected}).` },
        { status: 400 },
      );
    }
    if (round === "GROUP") {
      // Each GROUP pick must have a groupId, and each group can appear at most once.
      const seen = new Set<string>();
      for (const p of arr) {
        if (!p.groupId) return NextResponse.json({ error: "GROUP picks require groupId." }, { status: 400 });
        if (seen.has(p.groupId)) {
          return NextResponse.json({ error: `Duplicate group winner for ${p.groupId}.` }, { status: 400 });
        }
        seen.add(p.groupId);
      }
    } else {
      // Non-group rounds: no duplicate teams.
      const seen = new Set<string>();
      for (const p of arr) {
        if (seen.has(p.teamCode)) {
          return NextResponse.json({ error: `Duplicate team in ${round}.` }, { status: 400 });
        }
        seen.add(p.teamCode);
      }
    }
  }

  // Replace the player's picks atomically.
  await prisma.$transaction([
    prisma.pick.deleteMany({ where: { playerId } }),
    prisma.pick.createMany({
      data: picks.map((p) => ({
        playerId,
        round: p.round,
        teamCode: p.teamCode,
        groupId: p.round === "GROUP" ? p.groupId ?? null : null,
      })),
      skipDuplicates: true,
    }),
  ]);

  return NextResponse.json({ ok: true, count: picks.length });
}
