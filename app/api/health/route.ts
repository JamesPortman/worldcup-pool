import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const teamCount = await prisma.team.count();
    return NextResponse.json({ ok: true, teams: teamCount });
  } catch (err) {
    // Log the detail server-side; the endpoint is public, so don't echo it.
    console.error("[GET /api/health]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 500 });
  }
}
