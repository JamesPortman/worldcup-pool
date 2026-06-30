import { describe, it, expect } from "vitest";
import {
  teams,
  groups,
  ROUNDS,
  PICKS_PER_ROUND,
  type RoundKey,
} from "@/data/worldcup2026";

describe("2026 World Cup seed data", () => {
  it("has exactly 48 teams across 12 groups", () => {
    expect(groups).toHaveLength(12);
    expect(teams).toHaveLength(48);
  });

  it("places exactly 4 teams in every group A–L", () => {
    for (const g of groups) {
      const inGroup = teams.filter((t) => t.group === g);
      expect(inGroup, `group ${g}`).toHaveLength(4);
    }
  });

  it("uses a unique code for every team", () => {
    const codes = teams.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses a unique display name for every team", () => {
    const names = teams.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("only assigns teams to declared groups", () => {
    const valid = new Set(groups);
    for (const t of teams) {
      expect(valid.has(t.group), `${t.name} -> ${t.group}`).toBe(true);
    }
  });
});

describe("ROUNDS / PICKS_PER_ROUND", () => {
  it("lists the rounds in tournament order with escalating points", () => {
    expect(ROUNDS.map((r) => r.key)).toEqual(["GROUP", "FINAL8", "FINAL4", "SEMIFINAL", "WINNER"]);
    const points = ROUNDS.map((r) => r.points);
    expect(points).toEqual([1, 2, 4, 8, 16]);
    // strictly increasing
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThan(points[i - 1]);
    }
  });

  it("defines a pick count for every round", () => {
    for (const r of ROUNDS) {
      expect(PICKS_PER_ROUND[r.key as RoundKey]).toBeGreaterThan(0);
    }
    expect(PICKS_PER_ROUND).toEqual({ GROUP: 12, FINAL8: 8, FINAL4: 4, SEMIFINAL: 2, WINNER: 1 });
  });

  it("caps the maximum achievable score at 76 points", () => {
    const max = ROUNDS.reduce(
      (sum, r) => sum + PICKS_PER_ROUND[r.key as RoundKey] * r.points,
      0,
    );
    // 12*1 + 8*2 + 4*4 + 2*8 + 1*16 = 12 + 16 + 16 + 16 + 16
    expect(max).toBe(76);
  });
});
