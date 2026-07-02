import type { Pick, Team } from "@prisma/client";
import { eloWinProb } from "@/data/ratings";
import { scoreAllPicks } from "@/lib/scoring";

// ── Bracket model ────────────────────────────────────────────────────────────
// A single knockout match. `a`/`b` are team codes (null = TBD/bye). `winner` is
// set only for already-decided matches; undecided matches are simulated.
export interface BracketMatch {
  a: string | null;
  b: string | null;
  winner: string | null;
}

// The remaining knockout, plus milestones already locked in by finished matches
// for teams that have since been eliminated (so their pickers still score).
//  - frontier: the earliest not-fully-decided round, in bracket order. Winners of
//    adjacent matches meet in the next round, recursively, up to the final.
//  - settledReached / settledChampion: derived from finished matches.
export interface KnockoutState {
  frontier: BracketMatch[];
  settledReached: Record<string, "FINAL4" | "SEMIFINAL">;
  settledChampion: string | null;
}

type Reached = "FINAL4" | "SEMIFINAL";
const RANK: Record<Reached, number> = { FINAL4: 1, SEMIFINAL: 2 };
const deeper = (x: Reached | null, y: Reached | null): Reached | null => {
  if (!x) return y;
  if (!y) return x;
  return RANK[x] >= RANK[y] ? x : y;
};

// Resolve one match to a winner: a decided winner, an Elo coin-flip between two
// known teams, or the lone known side if the other is TBD.
function resolveMatch(m: BracketMatch, rnd: () => number): string | null {
  if (m.winner) return m.winner;
  if (m.a && m.b) return rnd() < eloWinProb(m.a, m.b) ? m.a : m.b;
  return m.a ?? m.b;
}

// Play the frontier forward once. Returns each team's furthest reached round
// (last 4 / last 2) and the champion. The two-match round is the semifinals
// (its four teams reach the last 4); the one-match round is the final.
function simulateOnce(
  frontier: BracketMatch[],
  rnd: () => number,
): { reached: Record<string, Reached>; champion: string | null } {
  const reached: Record<string, Reached> = {};
  let matches = frontier;
  let champion: string | null = null;

  while (matches.length >= 1) {
    if (matches.length === 2) {
      for (const m of matches) {
        if (m.a) reached[m.a] = deeper(reached[m.a] ?? null, "FINAL4")!;
        if (m.b) reached[m.b] = deeper(reached[m.b] ?? null, "FINAL4")!;
      }
    }
    if (matches.length === 1) {
      const m = matches[0];
      if (m.a) reached[m.a] = "SEMIFINAL";
      if (m.b) reached[m.b] = "SEMIFINAL";
      champion = resolveMatch(m, rnd);
      break;
    }
    const winners = matches.map((m) => resolveMatch(m, rnd));
    const next: BracketMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      next.push({ a: winners[i], b: winners[i + 1] ?? null, winner: null });
    }
    matches = next;
  }
  return { reached, champion };
}

// Build the per-team result flags for one simulation, merging settled milestones
// (eliminated teams) with the simulated ones. wonGroup stays as stored (settled).
function teamsForSim(
  baseTeams: Team[],
  state: KnockoutState,
  sim: { reached: Record<string, Reached>; champion: string | null },
): Record<string, Team> {
  const champion = sim.champion ?? state.settledChampion;
  const out: Record<string, Team> = {};
  for (const t of baseTeams) {
    const merged = deeper(state.settledReached[t.code] ?? null, sim.reached[t.code] ?? null);
    const isChampion = champion === t.code;
    out[t.code] = {
      ...t,
      reachedRound: isChampion ? "SEMIFINAL" : merged,
      isChampion,
    };
  }
  return out;
}

export interface PlayerPicks {
  id: string;
  name: string;
  picks: Pick[];
}

/**
 * Monte Carlo estimate of each player's probability of finishing 1st in the pool.
 * A tie for the lead splits the "win" credit evenly among those tied.
 * `rng` is injectable for deterministic tests.
 */
export function computeWinPercents(
  players: PlayerPicks[],
  teams: Team[],
  state: KnockoutState,
  trials = 20_000,
  rng: () => number = Math.random,
): Record<string, number> {
  const wins: Record<string, number> = {};
  for (const p of players) wins[p.id] = 0;
  if (players.length === 0) return wins;

  // A fully-decided bracket → no randomness; run a single deterministic pass.
  const decided = state.frontier.every((m) => m.winner);
  const n = decided ? 1 : trials;

  for (let i = 0; i < n; i++) {
    const sim = simulateOnce(state.frontier, rng);
    const teamsByCode = teamsForSim(teams, state, sim);

    let best = -Infinity;
    let leaders: string[] = [];
    for (const p of players) {
      const { total } = scoreAllPicks(p.picks, teamsByCode);
      if (total > best) {
        best = total;
        leaders = [p.id];
      } else if (total === best) {
        leaders.push(p.id);
      }
    }
    const share = 1 / leaders.length;
    for (const id of leaders) wins[id] += share;
  }

  const pct: Record<string, number> = {};
  for (const p of players) pct[p.id] = (wins[p.id] / n) * 100;
  return pct;
}
