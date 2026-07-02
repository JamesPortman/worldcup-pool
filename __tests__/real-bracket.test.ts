import { describe, it, expect } from "vitest";
import type { Team, Pick } from "@prisma/client";
import { buildKnockoutState, type ProviderMatch } from "@/lib/tournament-bracket";
import { buildResolver } from "@/lib/results";
import { computeWinPercents } from "@/lib/win-probability";
import { teams as SEED } from "@/data/worldcup2026";
import fixture from "./fixtures/wc-matches.json";

// A frozen, trimmed snapshot of the real football-data.org WC feed (captured at
// the Round-of-32 stage). Guards the live-bracket integration: the parser must
// keep handling the real stage names / team shapes, and the engine must keep
// producing a sane distribution from them.
const matches = fixture.matches as unknown as ProviderMatch[];

describe("live-bracket integration against a real API snapshot", () => {
  const state = buildKnockoutState(matches, buildResolver())!;

  it("parses a Round-of-32 frontier with every team resolved", () => {
    expect(state.frontier).toHaveLength(16);            // R32 = 16 matches
    for (const m of state.frontier) {
      expect(m.a).not.toBeNull();
      expect(m.b).not.toBeNull();
    }
    // Mid-round snapshot: some decided, some still to play; nothing settled yet.
    expect(state.frontier.filter((m) => m.winner)).toHaveLength(10);
    expect(state.settledChampion).toBeNull();
    expect(state.settledReached).toEqual({});
  });

  it("ignores non-knockout (group) rows in the feed", () => {
    // 32 knockout rows are present, but only the 16 R32 matches form the frontier.
    expect(matches.some((m) => m.stage === "GROUP_STAGE")).toBe(true);
    expect(state.frontier).toHaveLength(16);
  });

  it("produces a sane win-probability distribution from the snapshot", () => {
    const teams = SEED.map((t) => ({ ...t, reachedRound: null, wonGroup: false, isChampion: false })) as Team[];
    const pk = (round: string, teamCode: string): Pick =>
      ({ id: teamCode, playerId: "p", teamCode, round, groupId: null, createdAt: new Date(), updatedAt: new Date() }) as Pick;
    const players = [
      { id: "arg", name: "arg", picks: [pk("WINNER", "ARG")] },
      { id: "mar", name: "mar", picks: [pk("WINNER", "MAR")] },
    ];
    const pct = computeWinPercents(players, teams, state, 20_000, seeded(42));
    expect(pct.arg + pct.mar).toBeCloseTo(100, 5);
    expect(pct.arg).toBeGreaterThan(pct.mar); // Argentina is the stronger side
    expect(pct.arg).toBeGreaterThan(55);
  });
});

// Deterministic RNG (mulberry32) so the Monte-Carlo assertion is reproducible.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
