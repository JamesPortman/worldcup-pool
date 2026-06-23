import { teams as SEED_TEAMS } from "@/data/worldcup2026";

// Maps a results-provider team (name + optional 3-letter code) to our Team.code.
// Strategy: try the TLA against our codes, then the normalized name, then a small
// alias table for names that differ between providers and our seed data.
const NAME_ALIASES: Record<string, string> = {
  "korearepublic": "KOR",
  "czechia": "CZE",
  "iriran": "IRN",
  "cotedivoire": "CIV",
  "turkiye": "TUR",
  "caboverde": "CPV",
  "congodr": "COD",
  "bosniaherzegovina": "BIH",
  "usa": "USA",
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z]/g, "");
}

/** Builds a resolver from the seed teams + alias table. */
export function buildResolver(): (name: string, tla?: string | null) => string | null {
  const codes = new Set(SEED_TEAMS.map((t) => t.code.toUpperCase()));
  const byName = new Map(SEED_TEAMS.map((t) => [norm(t.name), t.code]));
  return (name, tla) => {
    if (tla && codes.has(tla.toUpperCase())) return tla.toUpperCase();
    const n = norm(name ?? "");
    return byName.get(n) ?? NAME_ALIASES[n] ?? null;
  };
}

// ── Provider response shapes (the subset we read) ───────────────────────────
export interface ProviderStanding {
  table: { position: number; playedGames?: number | null; team: { name: string; tla?: string | null } }[];
}
export interface ProviderMatch {
  stage: string;
  status: string;
  homeTeam: { name: string; tla?: string | null };
  awayTeam: { name: string; tla?: string | null };
  score: { winner?: string | null };
}

export type ReachedRound = "FINAL4" | "SEMIFINAL" | null;

export interface ProposedResult {
  code: string;
  name: string;
  wonGroup: boolean;
  reachedRound: ReachedRound; // FINAL4 = reached last 4, SEMIFINAL = reached final
  isChampion: boolean;
}

/**
 * Derives each team's result flags from group standings + knockout matches.
 * - wonGroup: 1st place in a group standings table.
 * - reachedRound FINAL4: played in a semi-final.
 * - reachedRound SEMIFINAL: played in the final (cumulative — also implies FINAL4).
 * - isChampion: won the final.
 * Only teams with at least one positive result are returned.
 */
export function deriveResults(
  standings: ProviderStanding[],
  matches: ProviderMatch[],
  resolve: (name: string, tla?: string | null) => string | null,
): { proposed: ProposedResult[]; unmapped: string[] } {
  const unmapped = new Set<string>();
  const result = new Map<string, ProposedResult>();

  const ensure = (name: string, tla?: string | null): ProposedResult | null => {
    const code = resolve(name, tla);
    if (!code) {
      if (name) unmapped.add(name);
      return null;
    }
    if (!result.has(code)) {
      const seed = SEED_TEAMS.find((t) => t.code === code);
      result.set(code, {
        code,
        name: seed?.name ?? code,
        wonGroup: false,
        reachedRound: null,
        isChampion: false,
      });
    }
    return result.get(code)!;
  };

  // Group winners — only once the group is FINISHED (every team has played all
  // its round-robin games). This avoids proposing a provisional mid-stage leader.
  for (const s of standings) {
    const table = s.table ?? [];
    if (table.length < 2) continue;
    const gamesPerTeam = table.length - 1; // round-robin: each team plays N-1
    const finished = table.every((row) => (row.playedGames ?? 0) >= gamesPerTeam);
    if (!finished) continue;
    const top = table.find((row) => row.position === 1);
    if (top?.team) {
      const r = ensure(top.team.name, top.team.tla);
      if (r) r.wonGroup = true;
    }
  }

  // Knockout progression.
  const semifinalists = new Set<string>();
  const finalists = new Set<string>();
  let champion: string | null = null;

  for (const m of matches) {
    const stage = m.stage?.toUpperCase();
    if (stage === "SEMI_FINALS" || stage === "SEMI_FINAL") {
      for (const t of [m.homeTeam, m.awayTeam]) {
        const r = ensure(t.name, t.tla);
        if (r) semifinalists.add(r.code);
      }
    } else if (stage === "FINAL") {
      const home = ensure(m.homeTeam.name, m.homeTeam.tla);
      const away = ensure(m.awayTeam.name, m.awayTeam.tla);
      if (home) finalists.add(home.code);
      if (away) finalists.add(away.code);
      if (m.status === "FINISHED") {
        const w = m.score?.winner === "HOME_TEAM" ? home : m.score?.winner === "AWAY_TEAM" ? away : null;
        if (w) champion = w.code;
      }
    }
  }

  for (const code of semifinalists) {
    const r = result.get(code);
    if (r) r.reachedRound = "FINAL4";
  }
  for (const code of finalists) {
    const r = result.get(code);
    if (r) r.reachedRound = "SEMIFINAL";
  }
  if (champion) {
    const r = result.get(champion);
    if (r) {
      r.isChampion = true;
      if (!r.reachedRound) r.reachedRound = "SEMIFINAL";
    }
  }

  return { proposed: [...result.values()], unmapped: [...unmapped] };
}
