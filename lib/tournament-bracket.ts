import type { Team, Pick } from "@prisma/client";
import { buildResolver } from "@/lib/results";
import {
  computeWinPercents,
  type KnockoutState,
  type BracketMatch,
  type PlayerPicks,
} from "@/lib/win-probability";

// football-data.org knockout stages, earliest → latest. The 2026 format has a
// round of 32; THIRD_PLACE is ignored (it doesn't affect pool scoring).
const KNOCKOUT_ORDER = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

export interface ProviderMatch {
  id: number;
  stage: string;
  status: string;
  homeTeam: { name?: string | null; tla?: string | null };
  awayTeam: { name?: string | null; tla?: string | null };
  score: { winner?: string | null };
}

type Resolve = (name: string, tla?: string | null) => string | null;

/**
 * Pure: turn a flat list of knockout matches into a {@link KnockoutState}.
 * - settledReached/settledChampion come from FINISHED semifinals/final.
 * - frontier is the earliest round with an undecided match, in bracket order
 *   (sorted by match id); winners of adjacent matches meet in the next round.
 * Returns null if there are no mappable knockout matches.
 */
export function buildKnockoutState(matches: ProviderMatch[], resolve: Resolve): KnockoutState | null {
  const knockout = matches.filter((m) => KNOCKOUT_ORDER.includes(m.stage?.toUpperCase?.()));
  if (knockout.length === 0) return null;

  const code = (t: { name?: string | null; tla?: string | null }) =>
    t?.name || t?.tla ? resolve(t?.name ?? "", t?.tla) : null;
  const winnerCode = (m: ProviderMatch): string | null => {
    if (m.status !== "FINISHED") return null;
    if (m.score?.winner === "HOME_TEAM") return code(m.homeTeam);
    if (m.score?.winner === "AWAY_TEAM") return code(m.awayTeam);
    return null; // draw/penalties the free tier doesn't disambiguate → leave open
  };

  // Settled milestones for teams eliminated in finished rounds.
  const settledReached: Record<string, "FINAL4" | "SEMIFINAL"> = {};
  let settledChampion: string | null = null;
  for (const m of knockout) {
    if (m.status !== "FINISHED") continue;
    const stage = m.stage.toUpperCase();
    if (stage === "SEMI_FINALS") {
      for (const t of [m.homeTeam, m.awayTeam]) { const c = code(t); if (c) settledReached[c] = "FINAL4"; }
    } else if (stage === "FINAL") {
      for (const t of [m.homeTeam, m.awayTeam]) { const c = code(t); if (c) settledReached[c] = "SEMIFINAL"; }
      settledChampion = winnerCode(m);
    }
  }

  // Frontier = earliest stage that has matches and isn't fully finished.
  let frontier: BracketMatch[] = [];
  for (const stage of KNOCKOUT_ORDER) {
    const inStage = knockout
      .filter((m) => m.stage.toUpperCase() === stage)
      .sort((a, b) => a.id - b.id);
    if (inStage.length === 0) continue;
    if (inStage.every((m) => m.status === "FINISHED")) continue; // round done → look later
    frontier = inStage.map((m) => ({ a: code(m.homeTeam), b: code(m.awayTeam), winner: winnerCode(m) }));
    break;
  }

  return { frontier, settledReached, settledChampion };
}

// ── Live fetch + caching ─────────────────────────────────────────────────────
const API_BASE = "https://api.football-data.org/v4";
const COMPETITION = process.env.FOOTBALL_COMPETITION ?? "WC";
const STATE_TTL = 15 * 60 * 1000; // don't re-hit the API more than ~4×/hour
const RESULT_TTL = 10 * 60 * 1000;

let stateCache: { at: number; state: KnockoutState | null } | null = null;
const resultCache = new Map<string, { at: number; pct: Record<string, number> }>();

async function fetchKnockoutState(): Promise<KnockoutState | null> {
  if (stateCache && Date.now() - stateCache.at < STATE_TTL) return stateCache.state;
  let state: KnockoutState | null = null;
  const key = process.env.FOOTBALL_API_KEY;
  if (key) {
    try {
      const res = await fetch(`${API_BASE}/competitions/${COMPETITION}/matches`, {
        headers: { "X-Auth-Token": key },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        state = buildKnockoutState(data.matches ?? [], buildResolver());
      }
    } catch (err) {
      console.error("[win-prob] fetch failed", err instanceof Error ? err.message : err);
    }
  }
  stateCache = { at: Date.now(), state };
  return state;
}

/**
 * Win % per player for a pool, or null if the live bracket is unavailable
 * (no FOOTBALL_API_KEY, fetch failure, or no knockout data yet). Cached per pool.
 */
export async function getWinPercents(
  poolCode: string,
  players: { id: string; displayName: string; picks: Pick[] }[],
  teams: Team[],
): Promise<Record<string, number> | null> {
  const cached = resultCache.get(poolCode);
  if (cached && Date.now() - cached.at < RESULT_TTL) return cached.pct;

  const state = await fetchKnockoutState();
  if (!state) return null;

  const playerPicks: PlayerPicks[] = players.map((p) => ({ id: p.id, name: p.displayName, picks: p.picks }));
  const pct = computeWinPercents(playerPicks, teams, state);
  resultCache.set(poolCode, { at: Date.now(), pct });
  return pct;
}
