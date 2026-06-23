import { NextRequest, NextResponse } from "next/server";
import {
  buildResolver,
  deriveResults,
  type ProviderStanding,
  type ProviderMatch,
} from "@/lib/results";

export const dynamic = "force-dynamic";

const API_BASE = "https://api.football-data.org/v4";
const COMPETITION = process.env.FOOTBALL_COMPETITION ?? "WC"; // World Cup

// Token-gated. Fetches standings + knockout matches from football-data.org and
// returns PROPOSED result flags per team (it does NOT write anything) — the admin
// reviews them and applies via /api/admin/results. Needs a free FOOTBALL_API_KEY.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Invalid admin token." }, { status: 401 });
  }
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Results API not configured — set FOOTBALL_API_KEY (free key from football-data.org)." },
      { status: 400 },
    );
  }

  try {
    const headers = { "X-Auth-Token": key };
    const [standingsRes, matchesRes] = await Promise.all([
      fetch(`${API_BASE}/competitions/${COMPETITION}/standings`, { headers, cache: "no-store" }),
      fetch(`${API_BASE}/competitions/${COMPETITION}/matches`, { headers, cache: "no-store" }),
    ]);

    if (!standingsRes.ok || !matchesRes.ok) {
      const status = !standingsRes.ok ? standingsRes.status : matchesRes.status;
      return NextResponse.json(
        { error: `Results API returned ${status}. Check the key and that your plan covers the World Cup.` },
        { status: 502 },
      );
    }

    const standingsData = await standingsRes.json();
    const matchesData = await matchesRes.json();

    const standings: ProviderStanding[] = (standingsData.standings ?? []).map(
      (s: {
        table?: { position: number; playedGames?: number | null; team?: { name?: string; tla?: string | null } }[];
      }) => ({
        table: (s.table ?? []).map((row) => ({
          position: row.position,
          playedGames: row.playedGames ?? null,
          team: { name: row.team?.name ?? "", tla: row.team?.tla ?? null },
        })),
      }),
    );

    const matches: ProviderMatch[] = (matchesData.matches ?? []).map(
      (m: {
        stage: string;
        status: string;
        homeTeam?: { name?: string; tla?: string | null };
        awayTeam?: { name?: string; tla?: string | null };
        score?: { winner?: string | null };
      }) => ({
        stage: m.stage,
        status: m.status,
        homeTeam: { name: m.homeTeam?.name ?? "", tla: m.homeTeam?.tla ?? null },
        awayTeam: { name: m.awayTeam?.name ?? "", tla: m.awayTeam?.tla ?? null },
        score: { winner: m.score?.winner ?? null },
      }),
    );

    const { proposed, unmapped } = deriveResults(standings, matches, buildResolver());
    return NextResponse.json({ proposed, unmapped });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/admin/fetch-results]", message);
    return NextResponse.json({ error: "Couldn't reach the results API — please try again." }, { status: 502 });
  }
}
