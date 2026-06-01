import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Deletes a player (token-gated). Their picks cascade-delete via the schema
// (Pick.player onDelete: Cascade). The pool and other players are untouched.
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Invalid admin token." }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    await prisma.player.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }
    throw err;
  }
}
