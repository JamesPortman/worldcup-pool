import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { ROUNDS } from "@/data/worldcup2026";

export const dynamic = "force-dynamic";

const VALID_ROUNDS = new Set<string>(ROUNDS.map((r) => r.key));

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Unknown kind." }, { status: 400 });

  if (body.kind === "team") {
    const { code } = body as { code: string };
    const patch: { reachedRound?: string | null; wonGroup?: boolean; isChampion?: boolean } = body.patch ?? {};
    if (!code) return NextResponse.json({ error: "Missing team code." }, { status: 400 });
    if (patch.reachedRound !== undefined && patch.reachedRound !== null && !VALID_ROUNDS.has(patch.reachedRound)) {
      return NextResponse.json({ error: "Invalid round." }, { status: 400 });
    }
    // Only the result columns are writable — never name/group/code.
    const data: { reachedRound?: string | null; wonGroup?: boolean; isChampion?: boolean } = {};
    if (patch.reachedRound !== undefined) data.reachedRound = patch.reachedRound;
    if (typeof patch.wonGroup === "boolean") data.wonGroup = patch.wonGroup;
    if (typeof patch.isChampion === "boolean") data.isChampion = patch.isChampion;
    const updated = await prisma.team.update({ where: { code }, data });
    return NextResponse.json({ ok: true, team: updated });
  }

  if (body.kind === "pool") {
    const { id } = body as { id: string };
    const patch: { locked?: boolean } = body.patch ?? {};
    if (!id) return NextResponse.json({ error: "Missing pool id." }, { status: 400 });
    // Only `locked` is writable — never name/joinCode.
    const data = typeof patch.locked === "boolean" ? { locked: patch.locked } : {};
    const updated = await prisma.pool.update({ where: { id }, data });
    return NextResponse.json({ ok: true, pool: { id: updated.id, locked: updated.locked } });
  }

  return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
}
