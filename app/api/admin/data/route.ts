import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns the admin dashboard data (teams + pools, including join codes) ONLY to
// a caller who presents the correct ADMIN_TOKEN. This keeps pool join codes and
// player data out of the public /admin HTML — the page renders nothing sensitive
// until the token is verified here.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Invalid admin token." }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    orderBy: [{ group: "asc" }, { name: "asc" }],
  });
  const pools = await prisma.pool.findMany({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({
    teams,
    pools: pools.map((p) => ({
      id: p.id,
      name: p.name,
      joinCode: p.joinCode,
      locked: p.locked,
    })),
  });
}
