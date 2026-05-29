import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────
// Prisma and the cookie/session helpers are mocked so the route handlers run in
// isolation (no DB, no next/headers request scope). lib/lock and the static data
// are used for real.
const { prismaMock, sessionMock } = vi.hoisted(() => ({
  prismaMock: {
    pool: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    player: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    team: { update: vi.fn(), findMany: vi.fn() },
    pick: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
  sessionMock: {
    getPlayerIdCookie: vi.fn(),
    setPlayerIdCookie: vi.fn(),
    clearPlayerIdCookie: vi.fn(),
    generateJoinCode: vi.fn(() => "ABC234"),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/session", () => sessionMock);

import { POST as createPool } from "@/app/api/pools/route";
import { POST as joinPool } from "@/app/api/pools/[code]/join/route";
import { POST as savePicks } from "@/app/api/pools/[code]/picks/route";
import { POST as adminResults } from "@/app/api/admin/results/route";
import { POST as adminData } from "@/app/api/admin/data/route";

// ── Helpers ───────────────────────────────────────────────────────────────────
function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(headers),
  } as unknown as NextRequest;
}
const params = (code: string) => ({ params: Promise.resolve({ code }) });

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.setPlayerIdCookie.mockResolvedValue(undefined);
  sessionMock.generateJoinCode.mockReturnValue("ABC234");
  vi.stubEnv("ADMIN_TOKEN", "test-token");
});

// ── POST /api/pools (create) ──────────────────────────────────────────────────
describe("POST /api/pools", () => {
  it("rejects a missing pool name or display name", async () => {
    const res = await createPool(req({ poolName: "", displayName: "James" }));
    expect(res.status).toBe(400);
  });

  it("creates a pool + creator and sets the player cookie", async () => {
    prismaMock.pool.findUnique.mockResolvedValue(null); // join code is free
    prismaMock.pool.create.mockResolvedValue({
      id: "pool_1",
      joinCode: "ABC234",
      players: [{ id: "player_1" }],
    });

    const res = await createPool(req({ poolName: "Crew", displayName: "James" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ joinCode: "ABC234", poolId: "pool_1" });
    expect(sessionMock.setPlayerIdCookie).toHaveBeenCalledWith("player_1");
  });
});

// ── POST /api/pools/[code]/join ─────────────────────────────────────────────────
describe("POST /api/pools/[code]/join", () => {
  it("rejects an empty display name", async () => {
    const res = await joinPool(req({ displayName: "  " }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("404s when the pool does not exist", async () => {
    prismaMock.pool.findUnique.mockResolvedValue(null);
    const res = await joinPool(req({ displayName: "Sam" }), params("ZZZ999"));
    expect(res.status).toBe(404);
  });

  it("rejects joining a locked pool", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: true });
    const res = await joinPool(req({ displayName: "Sam" }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("reuses an existing player with the same name (returning visitor)", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false });
    prismaMock.player.findUnique.mockResolvedValue({ id: "player_9" });
    const res = await joinPool(req({ displayName: "Sam" }), params("ABC234"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.playerId).toBe("player_9");
    expect(prismaMock.player.create).not.toHaveBeenCalled();
    expect(sessionMock.setPlayerIdCookie).toHaveBeenCalledWith("player_9");
  });

  it("creates a new player when the name is new", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false });
    prismaMock.player.findUnique.mockResolvedValue(null);
    prismaMock.player.create.mockResolvedValue({ id: "player_new" });
    const res = await joinPool(req({ displayName: "New" }), params("ABC234"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.playerId).toBe("player_new");
  });
});

// ── POST /api/pools/[code]/picks ────────────────────────────────────────────────
describe("POST /api/pools/[code]/picks", () => {
  const member = { id: "pool_1", locked: false, players: [{ id: "player_1" }] };

  it("401s when not signed in", async () => {
    sessionMock.getPlayerIdCookie.mockResolvedValue(null);
    const res = await savePicks(req({ picks: [] }), params("ABC234"));
    expect(res.status).toBe(401);
  });

  it("403s when the player is not a member of the pool", async () => {
    sessionMock.getPlayerIdCookie.mockResolvedValue("player_1");
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false, players: [] });
    const res = await savePicks(req({ picks: [] }), params("ABC234"));
    expect(res.status).toBe(403);
  });

  it("rejects writes when the pool is locked", async () => {
    sessionMock.getPlayerIdCookie.mockResolvedValue("player_1");
    prismaMock.pool.findUnique.mockResolvedValue({ ...member, locked: true });
    const res = await savePicks(req({ picks: [] }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("rejects too many picks for a round", async () => {
    sessionMock.getPlayerIdCookie.mockResolvedValue("player_1");
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const picks = [
      { round: "WINNER", teamCode: "BRA" },
      { round: "WINNER", teamCode: "ARG" }, // WINNER allows only 1
    ];
    const res = await savePicks(req({ picks }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("rejects a GROUP pick without a groupId", async () => {
    sessionMock.getPlayerIdCookie.mockResolvedValue("player_1");
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const res = await savePicks(req({ picks: [{ round: "GROUP", teamCode: "BRA" }] }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("atomically replaces picks on a valid submission", async () => {
    sessionMock.getPlayerIdCookie.mockResolvedValue("player_1");
    prismaMock.pool.findUnique.mockResolvedValue(member);
    prismaMock.$transaction.mockResolvedValue([]);
    const picks = [
      { round: "GROUP", teamCode: "BRA", groupId: "C" },
      { round: "WINNER", teamCode: "ARG" },
    ];
    const res = await savePicks(req({ picks }), params("ABC234"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, count: 2 });
    expect(prismaMock.pick.deleteMany).toHaveBeenCalledWith({ where: { playerId: "player_1" } });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});

// ── POST /api/admin/results ─────────────────────────────────────────────────────
describe("POST /api/admin/results", () => {
  it("401s without the admin token", async () => {
    const res = await adminResults(req({ kind: "team", code: "BRA", patch: {} }));
    expect(res.status).toBe(401);
  });

  it("updates a team's result columns with a valid token", async () => {
    prismaMock.team.update.mockResolvedValue({ code: "BRA", wonGroup: true });
    const res = await adminResults(
      req({ kind: "team", code: "BRA", patch: { wonGroup: true } }, { "x-admin-token": "test-token" }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.team.update).toHaveBeenCalledWith({ where: { code: "BRA" }, data: { wonGroup: true } });
  });

  it("rejects an invalid reachedRound value", async () => {
    const res = await adminResults(
      req({ kind: "team", code: "BRA", patch: { reachedRound: "NONSENSE" } }, { "x-admin-token": "test-token" }),
    );
    expect(res.status).toBe(400);
  });

  it("locks a pool with a valid token", async () => {
    prismaMock.pool.update.mockResolvedValue({ id: "pool_1", locked: true });
    const res = await adminResults(
      req({ kind: "pool", id: "pool_1", patch: { locked: true } }, { "x-admin-token": "test-token" }),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.pool.update).toHaveBeenCalledWith({ where: { id: "pool_1" }, data: { locked: true } });
  });
});

// ── POST /api/admin/data ─────────────────────────────────────────────────────────
describe("POST /api/admin/data", () => {
  it("401s without the admin token", async () => {
    const res = await adminData(req({}, {}));
    expect(res.status).toBe(401);
    expect(prismaMock.pool.findMany).not.toHaveBeenCalled();
  });

  it("returns teams and pools with a valid token", async () => {
    prismaMock.team.findMany.mockResolvedValue([{ code: "BRA" }]);
    prismaMock.pool.findMany.mockResolvedValue([
      { id: "pool_1", name: "Crew", joinCode: "ABC234", locked: false },
    ]);
    const res = await adminData(req({}, { "x-admin-token": "test-token" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.teams).toHaveLength(1);
    expect(data.pools[0]).toEqual({ id: "pool_1", name: "Crew", joinCode: "ABC234", locked: false });
  });
});
