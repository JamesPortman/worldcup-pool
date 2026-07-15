import { describe, it, expect } from "vitest";
import { buildKnockoutState, type ProviderMatch } from "@/lib/tournament-bracket";

// Test resolver: treat the provider tla as our code directly.
const resolve = (_name: string, tla?: string | null) => tla ?? null;

function m(
  id: number, stage: string, status: string,
  home: string | null, away: string | null, winner?: "HOME_TEAM" | "AWAY_TEAM",
): ProviderMatch {
  return {
    id, stage, status,
    homeTeam: { tla: home }, awayTeam: { tla: away },
    score: { winner: winner ?? null },
  };
}

describe("buildKnockoutState", () => {
  it("returns null when there are no knockout matches", () => {
    const matches = [m(1, "GROUP_STAGE", "FINISHED", "ARG", "NZL", "HOME_TEAM")];
    expect(buildKnockoutState(matches, resolve)).toBeNull();
  });

  it("uses the earliest undecided round as the frontier, in id order", () => {
    const matches = [
      m(2, "LAST_16", "FINISHED", "FRA", "SEN", "HOME_TEAM"),
      m(1, "LAST_16", "FINISHED", "ARG", "NZL", "HOME_TEAM"),
      m(11, "QUARTER_FINALS", "SCHEDULED", "ARG", "BRA"),
      m(10, "QUARTER_FINALS", "SCHEDULED", "FRA", "ESP"),
    ];
    const state = buildKnockoutState(matches, resolve)!;
    expect(state.frontier).toEqual([
      { a: "FRA", b: "ESP", winner: null }, // id 10 sorts first
      { a: "ARG", b: "BRA", winner: null },
    ]);
    expect(state.settledChampion).toBeNull();
    expect(state.settledReached).toEqual({});
  });

  it("captures finished-semifinal milestones and keeps the final as the frontier", () => {
    const matches = [
      m(1, "SEMI_FINALS", "FINISHED", "ARG", "FRA", "HOME_TEAM"),
      m(2, "SEMI_FINALS", "FINISHED", "BRA", "ESP", "AWAY_TEAM"),
      m(3, "FINAL", "SCHEDULED", "ARG", "ESP"),
    ];
    const state = buildKnockoutState(matches, resolve)!;
    // All four semifinalists reached the last 4.
    expect(state.settledReached).toEqual({ ARG: "FINAL4", FRA: "FINAL4", BRA: "FINAL4", ESP: "FINAL4" });
    expect(state.frontier).toEqual([{ a: "ARG", b: "ESP", winner: null }]);
    expect(state.settledChampion).toBeNull();
  });

  it("rebuilds a half-populated round from the previous round's winners", () => {
    // Both semifinals are decided (Spain and Argentina through), but the provider
    // hasn't back-filled the final's away slot yet — it still reads "ESP vs TBD".
    // Simulating that verbatim would hand Spain a walkover and rob Argentina of
    // its finalist credit, so the final must be rebuilt as ESP vs ARG.
    const matches = [
      m(1, "SEMI_FINALS", "FINISHED", "FRA", "ESP", "AWAY_TEAM"), // ESP through
      m(2, "SEMI_FINALS", "FINISHED", "ENG", "ARG", "AWAY_TEAM"), // ARG through
      m(3, "FINAL", "TIMED", "ESP", null),                        // away slot not filled
    ];
    const state = buildKnockoutState(matches, resolve)!;
    expect(state.frontier).toEqual([{ a: "ESP", b: "ARG", winner: null }]);
    // Both finalists must still be credited with reaching the last 4.
    expect(state.settledReached).toEqual({ FRA: "FINAL4", ESP: "FINAL4", ENG: "FINAL4", ARG: "FINAL4" });
    expect(state.settledChampion).toBeNull();
  });

  it("returns null rather than guessing when a round cannot be resolved", () => {
    // First knockout round is half-drawn and there's no earlier round to rebuild
    // from — better no Win % column than a confidently wrong one.
    const matches = [m(1, "LAST_32", "TIMED", "ESP", null)];
    expect(buildKnockoutState(matches, resolve)).toBeNull();
  });

  it("reports an empty frontier and a champion once the final is finished", () => {
    const matches = [
      m(1, "SEMI_FINALS", "FINISHED", "ARG", "FRA", "HOME_TEAM"),
      m(2, "SEMI_FINALS", "FINISHED", "BRA", "ESP", "AWAY_TEAM"),
      m(3, "FINAL", "FINISHED", "ARG", "ESP", "HOME_TEAM"),
    ];
    const state = buildKnockoutState(matches, resolve)!;
    expect(state.frontier).toEqual([]);
    expect(state.settledChampion).toBe("ARG");
    expect(state.settledReached.ARG).toBe("SEMIFINAL");
    expect(state.settledReached.ESP).toBe("SEMIFINAL");
  });
});
