import { describe, it, expect } from "vitest";
import type { Pick, Team } from "@prisma/client";
import { scorePick, scoreAllPicks, POINTS } from "@/lib/scoring";

// ── Test factories ─────────────────────────────────────────────────────────
// scorePick/scoreAllPicks only read a handful of Team/Pick fields, but we build
// fully-typed objects so the tests fail loudly if the Prisma models change.
function team(overrides: Partial<Team> & Pick<Team, "code" | "name" | "group">): Team {
  return {
    reachedRound: null,
    wonGroup: false,
    isChampion: false,
    ...overrides,
  } as Team;
}

function pick(overrides: Partial<Pick> & { round: string; teamCode: string }): Pick {
  return {
    id: `pick_${Math.random().toString(36).slice(2)}`,
    playerId: "player_1",
    groupId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Pick;
}

describe("scorePick — GROUP round", () => {
  it("awards 1 point when the team won the group it was picked for", () => {
    const t = team({ code: "BRA", name: "Brazil", group: "C", wonGroup: true });
    const p = pick({ round: "GROUP", teamCode: "BRA", groupId: "C" });
    const result = scorePick(p, t);
    expect(result.correct).toBe(true);
    expect(result.points).toBe(1);
  });

  it("awards 0 when the team won a group but the pick was filed under the wrong group", () => {
    const t = team({ code: "BRA", name: "Brazil", group: "C", wonGroup: true });
    const p = pick({ round: "GROUP", teamCode: "BRA", groupId: "D" });
    const result = scorePick(p, t);
    expect(result.correct).toBe(false);
    expect(result.points).toBe(0);
  });

  it("awards 0 when the team did not win its group", () => {
    const t = team({ code: "SCO", name: "Scotland", group: "C", wonGroup: false });
    const p = pick({ round: "GROUP", teamCode: "SCO", groupId: "C" });
    expect(scorePick(p, t).points).toBe(0);
  });
});

describe("scorePick — WINNER round", () => {
  it("awards 16 points when the picked team is the champion", () => {
    const t = team({ code: "ARG", name: "Argentina", group: "J", isChampion: true });
    const p = pick({ round: "WINNER", teamCode: "ARG" });
    const result = scorePick(p, t);
    expect(result.correct).toBe(true);
    expect(result.points).toBe(16);
  });

  it("awards 0 when the picked team is not the champion", () => {
    const t = team({ code: "ARG", name: "Argentina", group: "J", isChampion: false });
    const p = pick({ round: "WINNER", teamCode: "ARG" });
    expect(scorePick(p, t).points).toBe(0);
  });
});

describe("scorePick — FINAL4 / SEMIFINAL rounds", () => {
  it("awards 4 points for a correct FINAL4 pick", () => {
    const t = team({ code: "ESP", name: "Spain", group: "H", reachedRound: "FINAL4" });
    const p = pick({ round: "FINAL4", teamCode: "ESP" });
    expect(scorePick(p, t).points).toBe(4);
  });

  it("awards 8 points for a correct SEMIFINAL pick", () => {
    const t = team({ code: "FRA", name: "France", group: "I", reachedRound: "SEMIFINAL" });
    const p = pick({ round: "SEMIFINAL", teamCode: "FRA" });
    expect(scorePick(p, t).points).toBe(8);
  });

  it("does not award SEMIFINAL points when the team only reached FINAL4", () => {
    const t = team({ code: "FRA", name: "France", group: "I", reachedRound: "FINAL4" });
    const p = pick({ round: "SEMIFINAL", teamCode: "FRA" });
    expect(scorePick(p, t).points).toBe(0);
  });

  it("awards 0 when the team has not been marked as reaching any round", () => {
    const t = team({ code: "ESP", name: "Spain", group: "H", reachedRound: null });
    const p = pick({ round: "FINAL4", teamCode: "ESP" });
    expect(scorePick(p, t).points).toBe(0);
  });
});

describe("scoreAllPicks", () => {
  const teamsByCode: Record<string, Team> = {
    BRA: team({ code: "BRA", name: "Brazil", group: "C", wonGroup: true, reachedRound: "SEMIFINAL" }),
    ESP: team({ code: "ESP", name: "Spain", group: "H", reachedRound: "FINAL4" }),
    ARG: team({ code: "ARG", name: "Argentina", group: "J", wonGroup: true, isChampion: true, reachedRound: "SEMIFINAL" }),
    SCO: team({ code: "SCO", name: "Scotland", group: "C", wonGroup: false }),
  };

  it("aggregates points per round and a correct total", () => {
    const picks = [
      pick({ round: "GROUP", teamCode: "BRA", groupId: "C" }), // +1 correct
      pick({ round: "GROUP", teamCode: "SCO", groupId: "C" }), // +0 wrong
      pick({ round: "FINAL4", teamCode: "ESP" }),              // +4 correct
      pick({ round: "FINAL4", teamCode: "BRA" }),              // +0 (Brazil reached SEMIFINAL, not FINAL4)
      pick({ round: "SEMIFINAL", teamCode: "ARG" }),           // +8 correct
      pick({ round: "WINNER", teamCode: "ARG" }),              // +16 correct
    ];
    const { byRound, total, scored } = scoreAllPicks(picks, teamsByCode);
    expect(byRound.GROUP).toBe(1);
    expect(byRound.FINAL4).toBe(4);
    expect(byRound.SEMIFINAL).toBe(8);
    expect(byRound.WINNER).toBe(16);
    expect(total).toBe(29);
    expect(scored).toHaveLength(6);
  });

  it("returns all-zero rounds and total 0 when there are no picks", () => {
    const { byRound, total, scored } = scoreAllPicks([], teamsByCode);
    expect(total).toBe(0);
    expect(byRound).toEqual({ GROUP: 0, FINAL4: 0, SEMIFINAL: 0, WINNER: 0 });
    expect(scored).toHaveLength(0);
  });

  it("skips picks whose team code is unknown rather than throwing", () => {
    const picks = [
      pick({ round: "WINNER", teamCode: "ARG" }),  // +16
      pick({ round: "WINNER", teamCode: "XXX" }),  // unknown team — skipped
    ];
    const { total, scored } = scoreAllPicks(picks, teamsByCode);
    expect(total).toBe(16);
    expect(scored).toHaveLength(1);
  });
});

describe("POINTS table", () => {
  it("matches the documented scoring scale", () => {
    expect(POINTS).toEqual({ GROUP: 1, FINAL4: 4, SEMIFINAL: 8, WINNER: 16 });
  });
});
