import { ROUNDS, type RoundKey } from "@/data/worldcup2026";
import type { Pick, Team } from "@prisma/client";

// All rounds in order, e.g. ["GROUP","R32","R16","QF","SF","FINAL"]
const ROUND_ORDER: RoundKey[] = ROUNDS.map((r) => r.key);
const POINTS: Record<RoundKey, number> = Object.fromEntries(
  ROUNDS.map((r) => [r.key, r.points]),
) as Record<RoundKey, number>;

// A team has "reached" round R if their `reachedRound` is R or later in ROUND_ORDER.
// We treat GROUP as the starting state — every team that played is in GROUP.
function teamReached(team: Team, round: RoundKey): boolean {
  if (!team.reachedRound) return false;
  const idx = ROUND_ORDER.indexOf(team.reachedRound as RoundKey);
  const needed = ROUND_ORDER.indexOf(round);
  return idx >= needed;
}

export interface ScoredPick {
  pick: Pick;
  correct: boolean;
  points: number;
}

// Returns the points awarded for a single pick given current results.
export function scorePick(pick: Pick, team: Team): ScoredPick {
  const round = pick.round as RoundKey;
  let correct = false;

  if (round === "GROUP") {
    // GROUP picks are "I think team X wins group G". Awarded if Team.wonGroup is true
    // AND the team is actually in that group (defense against bad data).
    correct = team.wonGroup && team.group === pick.groupId;
  } else if (round === "FINAL") {
    // FINAL picks are "I think team X wins the whole tournament".
    correct = team.isChampion;
  } else {
    correct = teamReached(team, round);
  }

  return { pick, correct, points: correct ? POINTS[round] : 0 };
}

export function scoreAllPicks(
  picks: Pick[],
  teamsByCode: Record<string, Team>,
): { byRound: Record<RoundKey, number>; total: number; scored: ScoredPick[] } {
  const byRound: Record<RoundKey, number> = {
    GROUP: 0, R32: 0, R16: 0, QF: 0, SF: 0, FINAL: 0,
  };
  let total = 0;
  const scored: ScoredPick[] = [];
  for (const p of picks) {
    const team = teamsByCode[p.teamCode];
    if (!team) continue;
    const s = scorePick(p, team);
    scored.push(s);
    byRound[p.round as RoundKey] += s.points;
    total += s.points;
  }
  return { byRound, total, scored };
}

export { ROUND_ORDER, POINTS };
