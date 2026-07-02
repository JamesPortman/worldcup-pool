import { describe, it, expect } from "vitest";
import type { Pick, Team } from "@prisma/client";
import { computeWinPercents, type KnockoutState, type PlayerPicks } from "@/lib/win-probability";
import { eloWinProb } from "@/data/ratings";

// ── Factories ────────────────────────────────────────────────────────────────
function team(code: string, overrides: Partial<Team> = {}): Team {
  return {
    code, name: code, group: "A",
    reachedRound: null, wonGroup: false, isChampion: false,
    ...overrides,
  } as Team;
}
function pick(round: string, teamCode: string, groupId: string | null = null): Pick {
  return {
    id: `pk_${Math.random().toString(36).slice(2)}`,
    playerId: "p", teamCode, round, groupId,
    createdAt: new Date(), updatedAt: new Date(),
  } as Pick;
}
function player(id: string, picks: Pick[]): PlayerPicks {
  return { id, name: id, picks };
}

// Deterministic RNG (mulberry32) so Monte-Carlo assertions are reproducible.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("eloWinProb", () => {
  it("favours the higher-rated team and is symmetric", () => {
    expect(eloWinProb("ARG", "NZL")).toBeGreaterThan(0.9); // huge gap
    expect(eloWinProb("NZL", "ARG")).toBeLessThan(0.1);
    expect(eloWinProb("BRA", "ARG") + eloWinProb("ARG", "BRA")).toBeCloseTo(1, 10);
  });
});

describe("computeWinPercents", () => {
  const teams = [
    team("ARG", { group: "J" }), team("BRA", { group: "C" }),
    team("NZL", { group: "G" }), team("FRA", { group: "I" }),
  ];

  it("returns a deterministic result when the bracket is already decided", () => {
    // Final already played: ARG beat BRA. No simulation needed.
    const state: KnockoutState = {
      frontier: [{ a: "BRA", b: "ARG", winner: "ARG" }],
      settledReached: { BRA: "SEMIFINAL" },
      settledChampion: "ARG",
    };
    const players = [
      player("champ_arg", [pick("WINNER", "ARG")]),
      player("champ_bra", [pick("WINNER", "BRA")]),
    ];
    const pct = computeWinPercents(players, teams, state, 20_000, seeded(1));
    expect(pct.champ_arg).toBe(100);
    expect(pct.champ_bra).toBe(0);
  });

  it("makes the heavy favourite far more likely to win an undecided final", () => {
    const state: KnockoutState = {
      frontier: [{ a: "ARG", b: "NZL", winner: null }],
      settledReached: {},
      settledChampion: null,
    };
    const players = [
      player("picked_arg", [pick("WINNER", "ARG")]),
      player("picked_nzl", [pick("WINNER", "NZL")]),
    ];
    const pct = computeWinPercents(players, teams, state, 20_000, seeded(7));
    expect(pct.picked_arg).toBeGreaterThan(90);
    expect(pct.picked_nzl).toBeLessThan(10);
    expect(pct.picked_arg + pct.picked_nzl).toBeCloseTo(100, 6);
  });

  it("splits the win credit evenly between players with identical picks", () => {
    const state: KnockoutState = {
      frontier: [{ a: "ARG", b: "BRA", winner: null }],
      settledReached: {},
      settledChampion: null,
    };
    const players = [
      player("a", [pick("WINNER", "ARG")]),
      player("b", [pick("WINNER", "ARG")]),
    ];
    const pct = computeWinPercents(players, teams, state, 5_000, seeded(3));
    expect(pct.a).toBeCloseTo(50, 5);
    expect(pct.b).toBeCloseTo(50, 5);
  });

  it("credits every semifinalist with reaching the last 4 (FINAL4 picks score)", () => {
    // Frontier is the two semifinals: ARG–FRA and BRA–NZL. All four reach the
    // last 4 in every simulation, so a FINAL4 pick on any of them always scores.
    const state: KnockoutState = {
      frontier: [
        { a: "ARG", b: "FRA", winner: null },
        { a: "BRA", b: "NZL", winner: null },
      ],
      settledReached: {},
      settledChampion: null,
    };
    // NZL is the weakest, sure to lose its SF — but a FINAL4 pick on it still wins,
    // beating a rival whose only pick (NZL as champion) almost never hits.
    const players = [
      player("final4_nzl", [pick("FINAL4", "NZL")]),
      player("champ_nzl", [pick("WINNER", "NZL")]),
    ];
    const pct = computeWinPercents(players, teams, state, 10_000, seeded(11));
    expect(pct.final4_nzl).toBeGreaterThan(95);
  });
});
