// Approximate World-Football-Elo-style ratings for the 48 seed teams, used only
// as the strength prior in the win-probability simulation (lib/win-probability.ts).
// These are ballpark values — edit freely; only the *relative* gaps matter, and a
// ~100-point edge ≈ 64% to win a one-off knockout match.
//
// Any team missing here falls back to DEFAULT_RATING.
export const DEFAULT_RATING = 1700;

export const ELO: Record<string, number> = {
  // Group A
  MEX: 1795, RSA: 1685, KOR: 1760, CZE: 1755,
  // Group B
  CAN: 1770, BIH: 1700, QAT: 1650, SUI: 1850,
  // Group C
  BRA: 2030, MAR: 1865, HAI: 1520, SCO: 1745,
  // Group D
  USA: 1810, PAR: 1730, AUS: 1720, TUR: 1815,
  // Group E
  GER: 1945, CUW: 1490, CIV: 1745, ECU: 1790,
  // Group F
  NED: 1970, JPN: 1810, SWE: 1775, TUN: 1690,
  // Group G
  BEL: 1935, EGY: 1755, IRN: 1770, NZL: 1500,
  // Group H
  ESP: 2045, CPV: 1590, KSA: 1640, URU: 1895,
  // Group I
  FRA: 2055, SEN: 1815, IRQ: 1650, NOR: 1835,
  // Group J
  ARG: 2145, ALG: 1785, AUT: 1795, JOR: 1600,
  // Group K
  POR: 1980, COD: 1690, UZB: 1660, COL: 1885,
  // Group L
  ENG: 1985, CRO: 1900, GHA: 1700, PAN: 1660,
};

export function ratingFor(code: string): number {
  return ELO[code] ?? DEFAULT_RATING;
}

// Probability that team `a` beats team `b` in a single knockout match (logistic
// on the Elo difference — the standard Elo expected-score formula).
export function eloWinProb(a: string, b: string): number {
  return 1 / (1 + 10 ** ((ratingFor(b) - ratingFor(a)) / 400));
}
