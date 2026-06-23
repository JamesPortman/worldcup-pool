import { describe, it, expect } from "vitest";
import { buildResolver, deriveResults } from "@/lib/results";

describe("buildResolver", () => {
  const resolve = buildResolver();

  it("matches by TLA when it equals one of our codes", () => {
    expect(resolve("Whatever", "BRA")).toBe("BRA");
    expect(resolve("Whatever", "arg")).toBe("ARG"); // case-insensitive
  });

  it("matches by normalized name", () => {
    expect(resolve("Brazil")).toBe("BRA");
    expect(resolve("Ivory Coast")).toBe("CIV");
  });

  it("matches provider-specific names via the alias table", () => {
    expect(resolve("Korea Republic")).toBe("KOR");
    expect(resolve("Czechia")).toBe("CZE");
    expect(resolve("Côte d'Ivoire")).toBe("CIV");
    expect(resolve("Cabo Verde")).toBe("CPV");
  });

  it("returns null for an unknown team", () => {
    expect(resolve("Atlantis")).toBeNull();
  });
});

describe("deriveResults", () => {
  const standings = [
    { table: [{ position: 1, team: { name: "Brazil", tla: "BRA" } }, { position: 2, team: { name: "Morocco", tla: "MAR" } }] },
    { table: [{ position: 1, team: { name: "Argentina", tla: "ARG" } }] },
  ];
  const matches = [
    { stage: "GROUP_STAGE", status: "FINISHED", homeTeam: { name: "Brazil", tla: "BRA" }, awayTeam: { name: "Morocco", tla: "MAR" }, score: { winner: "HOME_TEAM" } },
    { stage: "SEMI_FINALS", status: "FINISHED", homeTeam: { name: "Argentina", tla: "ARG" }, awayTeam: { name: "Spain", tla: "ESP" }, score: { winner: "HOME_TEAM" } },
    { stage: "SEMI_FINALS", status: "FINISHED", homeTeam: { name: "France", tla: "FRA" }, awayTeam: { name: "England", tla: "ENG" }, score: { winner: "HOME_TEAM" } },
    { stage: "FINAL", status: "FINISHED", homeTeam: { name: "Argentina", tla: "ARG" }, awayTeam: { name: "France", tla: "FRA" }, score: { winner: "HOME_TEAM" } },
  ];

  it("derives group winners, finalists, semifinalists and the champion", () => {
    const { proposed, unmapped } = deriveResults(standings, matches, buildResolver());
    const byCode = Object.fromEntries(proposed.map((p) => [p.code, p]));

    expect(byCode.BRA.wonGroup).toBe(true);
    expect(byCode.ARG).toMatchObject({ wonGroup: true, reachedRound: "SEMIFINAL", isChampion: true });
    expect(byCode.FRA).toMatchObject({ reachedRound: "SEMIFINAL", isChampion: false }); // finalist, not champion
    expect(byCode.ESP.reachedRound).toBe("FINAL4"); // semifinalist
    expect(byCode.ENG.reachedRound).toBe("FINAL4");
    expect(unmapped).toHaveLength(0);
  });

  it("reports teams it can't map instead of crashing", () => {
    const odd = [{ stage: "FINAL", status: "FINISHED", homeTeam: { name: "Atlantis" }, awayTeam: { name: "Brazil", tla: "BRA" }, score: { winner: "AWAY_TEAM" } }];
    const { proposed, unmapped } = deriveResults([], odd, buildResolver());
    expect(unmapped).toContain("Atlantis");
    expect(proposed.find((p) => p.code === "BRA")?.isChampion).toBe(true);
  });
});
