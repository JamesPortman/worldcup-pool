// 2026 FIFA World Cup draw (held December 5, 2025).
// Source: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_draw
// If FIFA later updates any team (e.g. playoff resolution), edit this file and re-run `npm run db:seed`.

export type GroupId =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

export interface SeedTeam {
  code: string;          // short ISO-style code, used as the Team.code primary key
  name: string;          // display name
  group: GroupId;
}

export const groups: GroupId[] = ["A","B","C","D","E","F","G","H","I","J","K","L"];

export const teams: SeedTeam[] = [
  // Group A
  { code: "MEX", name: "Mexico",              group: "A" },
  { code: "RSA", name: "South Africa",        group: "A" },
  { code: "KOR", name: "South Korea",         group: "A" },
  { code: "CZE", name: "Czech Republic",      group: "A" },

  // Group B
  { code: "CAN", name: "Canada",              group: "B" },
  { code: "BIH", name: "Bosnia and Herzegovina", group: "B" },
  { code: "QAT", name: "Qatar",               group: "B" },
  { code: "SUI", name: "Switzerland",         group: "B" },

  // Group C
  { code: "BRA", name: "Brazil",              group: "C" },
  { code: "MAR", name: "Morocco",             group: "C" },
  { code: "HAI", name: "Haiti",               group: "C" },
  { code: "SCO", name: "Scotland",            group: "C" },

  // Group D
  { code: "USA", name: "United States",       group: "D" },
  { code: "PAR", name: "Paraguay",            group: "D" },
  { code: "AUS", name: "Australia",           group: "D" },
  { code: "TUR", name: "Turkey",              group: "D" },

  // Group E
  { code: "GER", name: "Germany",             group: "E" },
  { code: "CUW", name: "Curaçao",             group: "E" },
  { code: "CIV", name: "Ivory Coast",         group: "E" },
  { code: "ECU", name: "Ecuador",             group: "E" },

  // Group F
  { code: "NED", name: "Netherlands",         group: "F" },
  { code: "JPN", name: "Japan",               group: "F" },
  { code: "SWE", name: "Sweden",              group: "F" },
  { code: "TUN", name: "Tunisia",             group: "F" },

  // Group G
  { code: "BEL", name: "Belgium",             group: "G" },
  { code: "EGY", name: "Egypt",               group: "G" },
  { code: "IRN", name: "Iran",                group: "G" },
  { code: "NZL", name: "New Zealand",         group: "G" },

  // Group H
  { code: "ESP", name: "Spain",               group: "H" },
  { code: "CPV", name: "Cape Verde",          group: "H" },
  { code: "KSA", name: "Saudi Arabia",        group: "H" },
  { code: "URU", name: "Uruguay",             group: "H" },

  // Group I
  { code: "FRA", name: "France",              group: "I" },
  { code: "SEN", name: "Senegal",             group: "I" },
  { code: "IRQ", name: "Iraq",                group: "I" },
  { code: "NOR", name: "Norway",              group: "I" },

  // Group J
  { code: "ARG", name: "Argentina",           group: "J" },
  { code: "ALG", name: "Algeria",             group: "J" },
  { code: "AUT", name: "Austria",             group: "J" },
  { code: "JOR", name: "Jordan",              group: "J" },

  // Group K
  { code: "POR", name: "Portugal",            group: "K" },
  { code: "COD", name: "DR Congo",            group: "K" },
  { code: "UZB", name: "Uzbekistan",          group: "K" },
  { code: "COL", name: "Colombia",            group: "K" },

  // Group L
  { code: "ENG", name: "England",             group: "L" },
  { code: "CRO", name: "Croatia",             group: "L" },
  { code: "GHA", name: "Ghana",               group: "L" },
  { code: "PAN", name: "Panama",              group: "L" },
];

// Round identifiers, in tournament order. Used in DB rows and in scoring.
export const ROUNDS = [
  { key: "GROUP",  label: "Group Stage",     points: 1  }, // per correct group winner pick
  { key: "R32",    label: "Round of 32",     points: 2  }, // per correct team in R32
  { key: "R16",    label: "Round of 16",     points: 4  },
  { key: "QF",     label: "Quarter-finals",  points: 8  },
  { key: "SF",     label: "Semi-finals",     points: 16 },
  { key: "FINAL",  label: "Final",           points: 32 }, // awarded for correct champion
] as const;

export type RoundKey = (typeof ROUNDS)[number]["key"];

// How many teams the user picks for each round.
// GROUP: 12 (one winner per group)
// R32: 32 teams advance (top 2 per group + 8 best 3rd-placers)
// R16, QF, SF, FINAL follow standard knockout halving.
export const PICKS_PER_ROUND: Record<RoundKey, number> = {
  GROUP: 12,
  R32:   32,
  R16:   16,
  QF:     8,
  SF:     4,
  FINAL:  1, // the champion
};
