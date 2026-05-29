import { ROUNDS, type RoundKey } from "@/data/worldcup2026";
import type { Pick, Team } from "@prisma/client";

const ROUND_ORDER: RoundKey[] = ROUNDS.map((r) => r.key);
const POINTS: Record<RoundKey, number> = Object.fromEntries(
  ROUNDS.map((r) => [r.key, r.points]),
) as Record<RoundKey, number>;

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
    // Correct if the team won their group AND the pick was for that group.
    correct = team.wonGroup && team.group === pick.groupId;
  } else if (round === "WINNER") {
    correct = team.isChampion;
  } else {
    // FINAL4 / SEMIFINAL are cumulative: a team that advanced *past* this round
    // still satisfies it. A finalist (reachedRound = SEMIFINAL) still earns its
    // Final-4 points; the champion earns both. reachedRound marks the team's
    // furthest stage, and being champion implies it reached the final too.
    correct = teamReachedRank(team) >= ROUND_ORDER.indexOf(round);
  }

  return { pick, correct, points: correct ? POINTS[round] : 0 };
}

// How far a team advanced, as an index into ROUND_ORDER
// (GROUP=0, FINAL4=1, SEMIFINAL=2, WINNER=3); -1 if not yet marked.
function teamReachedRank(team: Team): number {
  let rank = team.reachedRound
    ? ROUND_ORDER.indexOf(team.reachedRound as RoundKey)
    : -1;
  if (team.isChampion) rank = Math.max(rank, ROUND_ORDER.indexOf("WINNER"));
  return rank;
}

export function scoreAllPicks(
  picks: Pick[],
  teamsByCode: Record<string, Team>,
): { byRound: Record<RoundKey, number>; total: number; scored: ScoredPick[] } {
  const byRound: Record<RoundKey, number> = {
    GROUP: 0, FINAL4: 0, SEMIFINAL: 0, WINNER: 0,
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

export { POINTS };
// kept for potential future use
export { ROUND_ORDER };
