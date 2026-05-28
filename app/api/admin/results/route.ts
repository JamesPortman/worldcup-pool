import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ROUNDS } from "@/data/worldcup2026";

export const dynamic = "force-dynamic";

const VALID_ROUNDS = new Set<string>(ROUNDS.map((r) => r.key));

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json();

  if (body.kind === "team") {
    const { code, patch } = body as {
      code: string;
      patch: { reachedRound?: string | null; wonGroup?: boolean; isChampion?: boolean };
    };
    if (!code) return NextResponse.json({ error: "Missing team code." }, { status: 400 });
    if (patch.reachedRound !== undefined && patch.reachedRound !== null && !VALID_ROUNDS.has(patch.reachedRound)) {
      return NextResponse.json({ error: "Invalid round." }, { status: 400 });
    }
    const updated = await prisma.team.update({ where: { code }, data: patch });
    return NextResponse.json({ ok: true, team: updated });
  }

  if (body.kind === "pool") {
    const { id, patch } = body as { id: string; patch: { locked?: boolean } };
    if (!id) return NextResponse.json({ error: "Missing pool id." }, { status: 400 });
    const updated = await prisma.pool.update({ where: { id }, data: patch });
    return NextResponse.json({ ok: true, pool: { id: updated.id, locked: updated.locked } });
  }

  return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
}
