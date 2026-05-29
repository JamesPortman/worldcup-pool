import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateJoinCode, setPlayerIdCookie } from "@/lib/session";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`pool-create:${clientKey(req)}`, 5, 60_000)) {
      return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
    }
    const { poolName, displayName } = await req.json();
    if (!poolName?.trim() || !displayName?.trim()) {
      return NextResponse.json({ error: "Pool name and display name are required." }, { status: 400 });
    }

    // Retry generating a join code a few times in the very unlikely event of a collision.
    let joinCode = "";
    for (let i = 0; i < 5; i++) {
      const candidate = generateJoinCode();
      const exists = await prisma.pool.findUnique({ where: { joinCode: candidate } });
      if (!exists) { joinCode = candidate; break; }
    }
    if (!joinCode) {
      return NextResponse.json({ error: "Could not generate a join code, try again." }, { status: 500 });
    }

    const pool = await prisma.pool.create({
      data: {
        name: poolName.trim(),
        joinCode,
        players: { create: { displayName: displayName.trim() } },
      },
      include: { players: true },
    });

    await setPlayerIdCookie(pool.players[0].id);
    return NextResponse.json({ joinCode: pool.joinCode, poolId: pool.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/pools]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
