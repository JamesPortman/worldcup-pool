import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// ── Mocks ───────────────────────────────────────────────────────────────────
// Prisma and the cookie/session helpers are mocked so the route handlers run in
// isolation (no DB, no next/headers request scope). lib/lock and the static data
// are used for real.
const { prismaMock, sessionMock } = vi.hoisted(() => ({
  prismaMock: {
    pool: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    player: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    team: { update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    pick: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  sessionMock: {
    getSession: vi.fn(),
    getPlayerIdCookie: vi.fn(),
    setPlayerIdCookie: vi.fn(),
    clearPlayerIdCookie: vi.fn(),
    generateJoinCode: vi.fn(() => "ABC234"),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/session", () => sessionMock);
// picksLocked() also enforces the calendar deadline; mock it so these route
// tests reflect the mock pool's `locked` flag regardless of the real date.
vi.mock("@/lib/lock", () => ({
  picksLocked: (pool: { locked: boolean }) => pool.locked,
  PICKS_LOCK_AT: new Date("2026-06-11T03:59:00Z"),
}));

import { POST as createPool } from "@/app/api/pools/route";
import { POST as joinPool } from "@/app/api/pools/[code]/join/route";
import { POST as savePicks } from "@/app/api/pools/[code]/picks/route";
import { POST as adminResults } from "@/app/api/admin/results/route";
import { POST as adminData } from "@/app/api/admin/data/route";
import { DELETE as deletePlayer } from "@/app/api/admin/players/[id]/route";
import { POST as fetchResults } from "@/app/api/admin/fetch-results/route";
import { GET as health } from "@/app/api/health/route";
import { resetRateLimit } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";

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
  resetRateLimit();
  sessionMock.setPlayerIdCookie.mockResolvedValue(undefined);
  sessionMock.generateJoinCode.mockReturnValue("ABC234");
  vi.stubEnv("ADMIN_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals(); // clear any stubbed global fetch between tests
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

  it("rate-limits repeated pool creation from the same client (429)", async () => {
    prismaMock.pool.findUnique.mockResolvedValue(null);
    prismaMock.pool.create.mockResolvedValue({ id: "p", joinCode: "ABC234", players: [{ id: "x" }] });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await createPool(req({ poolName: "P", displayName: "J" }))).status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });

  it("returns a generic 500 without leaking the underlying error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.pool.findUnique.mockRejectedValue(new Error("connect ECONNREFUSED db.internal:5432"));
    const res = await createPool(req({ poolName: "Crew", displayName: "James" }));
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(data)).not.toMatch(/ECONNREFUSED|db\.internal/);
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

  it("rejects a NEW player joining a locked pool", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: true });
    prismaMock.player.findUnique.mockResolvedValue(null); // no one with this name yet
    const res = await joinPool(req({ displayName: "Sam" }), params("ABC234"));
    expect(res.status).toBe(400);
    expect(prismaMock.player.create).not.toHaveBeenCalled();
  });

  it("lets an existing member sign back in even when the pool is locked", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: true });
    prismaMock.player.findUnique.mockResolvedValue({ id: "player_9" });
    const res = await joinPool(req({ displayName: "James" }), params("ABC234"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.playerId).toBe("player_9");
    expect(prismaMock.player.create).not.toHaveBeenCalled();
  });

  it("signs a returning name back in view-only (a name alone can't unlock edits)", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false });
    prismaMock.player.findUnique.mockResolvedValue({ id: "player_9" });
    sessionMock.getSession.mockResolvedValue(null); // a different device
    const res = await joinPool(req({ displayName: "Sam" }), params("ABC234"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ playerId: "player_9", viewOnly: true });
    expect(prismaMock.player.create).not.toHaveBeenCalled();
    expect(sessionMock.setPlayerIdCookie).toHaveBeenCalledWith("player_9", { canEdit: false });
  });

  it("keeps editing rights when the player's own editing session rejoins", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false });
    prismaMock.player.findUnique.mockResolvedValue({ id: "player_9" });
    sessionMock.getSession.mockResolvedValue({ playerId: "player_9", canEdit: true });
    const data = await (await joinPool(req({ displayName: "Sam" }), params("ABC234"))).json();
    expect(data.viewOnly).toBe(false);
    expect(sessionMock.setPlayerIdCookie).toHaveBeenCalledWith("player_9", { canEdit: true });
  });

  it("does not upgrade someone else's editing session to this player", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false });
    prismaMock.player.findUnique.mockResolvedValue({ id: "player_9" });
    sessionMock.getSession.mockResolvedValue({ playerId: "player_other", canEdit: true });
    const data = await (await joinPool(req({ displayName: "Sam" }), params("ABC234"))).json();
    expect(data.viewOnly).toBe(true);
    expect(sessionMock.setPlayerIdCookie).toHaveBeenCalledWith("player_9", { canEdit: false });
  });

  it("creates a new player with an editing session when the name is new", async () => {
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false });
    prismaMock.player.findUnique.mockResolvedValue(null);
    prismaMock.player.create.mockResolvedValue({ id: "player_new" });
    const res = await joinPool(req({ displayName: "New" }), params("ABC234"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ playerId: "player_new", viewOnly: false });
    expect(sessionMock.setPlayerIdCookie).toHaveBeenCalledWith("player_new");
  });

  it("returns a clean 500 (not a raw crash) if the DB throws", async () => {
    prismaMock.pool.findUnique.mockRejectedValue(new Error("db down"));
    const res = await joinPool(req({ displayName: "Sam" }), params("ABC234"));
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBeTruthy();
  });
});

// ── POST /api/pools/[code]/picks ────────────────────────────────────────────────
describe("POST /api/pools/[code]/picks", () => {
  const member = { id: "pool_1", locked: false, players: [{ id: "player_1" }] };

  it("401s when not signed in", async () => {
    sessionMock.getSession.mockResolvedValue(null);
    const res = await savePicks(req({ picks: [] }), params("ABC234"));
    expect(res.status).toBe(401);
  });

  it("403s when the player is not a member of the pool", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue({ id: "pool_1", locked: false, players: [] });
    const res = await savePicks(req({ picks: [] }), params("ABC234"));
    expect(res.status).toBe(403);
  });

  it("403s a view-only session (signed back in by name) without writing", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: false });
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const res = await savePicks(req({ picks: [{ round: "WINNER", teamCode: "BRA" }] }), params("ABC234"));
    expect(res.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects writes when the pool is locked", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue({ ...member, locked: true });
    const res = await savePicks(req({ picks: [] }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("rejects too many picks for a round", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const picks = [
      { round: "WINNER", teamCode: "BRA" },
      { round: "WINNER", teamCode: "ARG" }, // WINNER allows only 1
    ];
    const res = await savePicks(req({ picks }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("rejects a GROUP pick without a groupId", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const res = await savePicks(req({ picks: [{ round: "GROUP", teamCode: "BRA" }] }), params("ABC234"));
    expect(res.status).toBe(400);
  });

  it("atomically replaces picks on a valid submission", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
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

  it("400s on a malformed JSON body", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const bad = { json: async () => { throw new SyntaxError("Unexpected token"); }, headers: new Headers() };
    const res = await savePicks(bad as unknown as NextRequest, params("ABC234"));
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("400s when picks is not an array", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const res = await savePicks(req({ picks: { round: "WINNER", teamCode: "BRA" } }), params("ABC234"));
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("400s on an unknown team code (instead of a 500 from the FK)", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue(member);
    const res = await savePicks(req({ picks: [{ round: "WINNER", teamCode: "XXX" }] }), params("ABC234"));
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("400s on a non-object pick or an unknown group", async () => {
    sessionMock.getSession.mockResolvedValue({ playerId: "player_1", canEdit: true });
    prismaMock.pool.findUnique.mockResolvedValue(member);
    expect((await savePicks(req({ picks: [null] }), params("ABC234"))).status).toBe(400);
    const res = await savePicks(req({ picks: [{ round: "GROUP", teamCode: "BRA", groupId: "Z" }] }), params("ABC234"));
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// ── POST /api/admin/results ─────────────────────────────────────────────────────
describe("POST /api/admin/results", () => {
  it("401s without the admin token", async () => {
    const res = await adminResults(req({ kind: "team", code: "BRA", patch: {} }));
    expect(res.status).toBe(401);
  });

  it("401s with a wrong admin token (including a prefix of the real one)", async () => {
    for (const token of ["nope", "test-toke", "test-token-extra"]) {
      const res = await adminResults(req({ kind: "team", code: "BRA", patch: {} }, { "x-admin-token": token }));
      expect(res.status).toBe(401);
    }
    expect(prismaMock.team.update).not.toHaveBeenCalled();
  });

  it("401s for everyone when ADMIN_TOKEN is unset", async () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    const res = await adminResults(req({ kind: "team", code: "BRA", patch: {} }, { "x-admin-token": "" }));
    expect(res.status).toBe(401);
  });

  it("only writes whitelisted result columns", async () => {
    prismaMock.team.update.mockResolvedValue({ code: "BRA" });
    prismaMock.pool.update.mockResolvedValue({ id: "pool_1", locked: true });
    const auth = { "x-admin-token": "test-token" };
    await adminResults(req({
      kind: "team", code: "BRA",
      patch: { wonGroup: true, reachedRound: "FINAL4", isChampion: false, name: "Hacked", group: "Z", code: "XXX" },
    }, auth));
    expect(prismaMock.team.update).toHaveBeenCalledWith({
      where: { code: "BRA" },
      data: { wonGroup: true, reachedRound: "FINAL4", isChampion: false },
    });
    await adminResults(req({ kind: "pool", id: "pool_1", patch: { locked: true, joinCode: "OWNED1", name: "x" } }, auth));
    expect(prismaMock.pool.update).toHaveBeenCalledWith({ where: { id: "pool_1" }, data: { locked: true } });
  });

  it("400s on a malformed JSON body", async () => {
    const bad = { json: async () => { throw new SyntaxError("bad"); }, headers: new Headers({ "x-admin-token": "test-token" }) };
    const res = await adminResults(bad as unknown as NextRequest);
    expect(res.status).toBe(400);
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
      {
        id: "pool_1", name: "Crew", joinCode: "ABC234", locked: false,
        players: [{ id: "pl1", displayName: "Alice", _count: { picks: 19 } }],
      },
    ]);
    const res = await adminData(req({}, { "x-admin-token": "test-token" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.teams).toHaveLength(1);
    expect(data.pools[0]).toEqual({
      id: "pool_1", name: "Crew", joinCode: "ABC234", locked: false,
      players: [{ id: "pl1", displayName: "Alice", pickCount: 19 }],
    });
  });
});

// ── DELETE /api/admin/players/[id] ────────────────────────────────────────────────
describe("DELETE /api/admin/players/[id]", () => {
  const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it("401s without the admin token", async () => {
    const res = await deletePlayer(req({}, {}), idParams("pl1"));
    expect(res.status).toBe(401);
    expect(prismaMock.player.delete).not.toHaveBeenCalled();
  });

  it("deletes the player with a valid token", async () => {
    prismaMock.player.delete.mockResolvedValue({ id: "pl1" });
    const res = await deletePlayer(req({}, { "x-admin-token": "test-token" }), idParams("pl1"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(prismaMock.player.delete).toHaveBeenCalledWith({ where: { id: "pl1" } });
  });

  it("404s when the player does not exist", async () => {
    prismaMock.player.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion: "6.0.0" }),
    );
    const res = await deletePlayer(req({}, { "x-admin-token": "test-token" }), idParams("nope"));
    expect(res.status).toBe(404);
  });
});

// ── POST /api/admin/fetch-results ─────────────────────────────────────────────────
describe("POST /api/admin/fetch-results", () => {
  it("401s without the admin token", async () => {
    const res = await fetchResults(req({}, {}));
    expect(res.status).toBe(401);
  });

  it("400s when FOOTBALL_API_KEY is not configured", async () => {
    vi.stubEnv("FOOTBALL_API_KEY", "");
    const res = await fetchResults(req({}, { "x-admin-token": "test-token" }));
    expect(res.status).toBe(400);
  });

  // Stubs football-data.org: /standings and /matches both resolve from this mock.
  function mockFootballApi(opts: {
    standings?: unknown[];
    matches?: unknown[];
    standingsOk?: boolean;
    matchesOk?: boolean;
  }) {
    const { standings = [], matches = [], standingsOk = true, matchesOk = true } = opts;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const isStandings = String(url).includes("/standings");
        const ok = isStandings ? standingsOk : matchesOk;
        const body = isStandings ? { standings } : { matches };
        return Promise.resolve({ ok, status: ok ? 200 : 503, json: async () => body });
      }),
    );
  }

  it("returns proposed results from a successful API fetch (normalize → derive)", async () => {
    vi.stubEnv("FOOTBALL_API_KEY", "key");
    mockFootballApi({
      standings: [
        { table: [
          { position: 1, playedGames: 3, team: { name: "Brazil", tla: "BRA" } },
          { position: 2, playedGames: 3, team: { name: "Morocco", tla: "MAR" } },
          { position: 3, playedGames: 3, team: { name: "Haiti", tla: "HAI" } },
          { position: 4, playedGames: 3, team: { name: "Scotland", tla: "SCO" } },
        ] },
      ],
      matches: [
        { stage: "FINAL", status: "FINISHED",
          homeTeam: { name: "Argentina", tla: "ARG" }, awayTeam: { name: "France", tla: "FRA" },
          score: { winner: "HOME_TEAM" } },
      ],
    });
    const res = await fetchResults(req({}, { "x-admin-token": "test-token" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const byCode = Object.fromEntries(data.proposed.map((p: { code: string }) => [p.code, p]));
    expect(byCode.BRA.wonGroup).toBe(true);            // finished group → winner staged
    expect(byCode.ARG.isChampion).toBe(true);          // won the final
    expect(byCode.FRA.reachedRound).toBe("SEMIFINAL"); // beaten finalist
    expect(data.unmapped).toEqual([]);
  });

  it("502s when the results API returns an error status", async () => {
    vi.stubEnv("FOOTBALL_API_KEY", "key");
    mockFootballApi({ standingsOk: false });
    const res = await fetchResults(req({}, { "x-admin-token": "test-token" }));
    expect(res.status).toBe(502);
  });

  it("502s when the results API is unreachable", async () => {
    vi.stubEnv("FOOTBALL_API_KEY", "key");
    vi.spyOn(console, "error").mockImplementation(() => {}); // swallow the logged error
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));
    const res = await fetchResults(req({}, { "x-admin-token": "test-token" }));
    expect(res.status).toBe(502);
  });
});

// ── GET /api/health ──────────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("reports ok with the team count", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    prismaMock.team.count.mockResolvedValue(48);
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, teams: 48 });
  });

  it("returns a generic error without leaking the DB message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.$queryRaw.mockRejectedValue(new Error("password authentication failed for user neondb_owner"));
    const res = await health();
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(JSON.stringify(data)).not.toMatch(/password|neondb_owner/);
  });
});
