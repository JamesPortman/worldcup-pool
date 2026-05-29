import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setPlayerIdCookie } from "@/lib/session";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  if (!rateLimit(`pool-join:${clientKey(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
  }
  const { code } = await ctx.params;
  const { displayName } = await req.json();
  const name = displayName?.trim();
  if (!name) return NextResponse.json({ error: "Display name is required." }, { status: 400 });

  const pool = await prisma.pool.findUnique({ where: { joinCode: code.toUpperCase() } });
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404 });
  if (pool.locked) return NextResponse.json({ error: "Pool is locked — picks closed." }, { status: 400 });

  // If a player with this name already exists in this pool, treat the request as
  // "I'm coming back as that player" and re-issue their cookie.
  const existing = await prisma.player.findUnique({
    where: { poolId_displayName: { poolId: pool.id, displayName: name } },
  });
  const player = existing
    ?? (await prisma.player.create({ data: { poolId: pool.id, displayName: name } }));

  await setPlayerIdCookie(player.id);
  return NextResponse.json({ playerId: player.id, poolId: pool.id });
}
