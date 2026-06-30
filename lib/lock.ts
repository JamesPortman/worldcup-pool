import { ROUNDS, type RoundKey } from "@/data/worldcup2026";

// Picks auto-close ahead of kickoff so nobody can edit once games begin.
//
// The 2026 World Cup opens June 11, 2026. Entries lock at the end of June 10
// (Eastern time) — i.e. 23:59 EDT on Jun 10 == 03:59 UTC on Jun 11.
// Move this single constant to change the global deadline.
export const PICKS_LOCK_AT = new Date("2026-06-11T03:59:00Z");

// Per-round editing windows. A round not listed here uses PICKS_LOCK_AT.
// Group of 8 stays editable until 23:59 EDT on Jul 3, 2026 (== 03:59 UTC Jul 4),
// while every other round remains closed at the June 11 global deadline.
export const ROUND_LOCK_AT: Partial<Record<RoundKey, Date>> = {
  FINAL8: new Date("2026-07-04T03:59:00Z"),
};

// Optional test/staging override: a single deadline applied to every round so the
// full pre-deadline editing flow can be exercised. Invalid values are ignored.
function envOverride(): Date | null {
  const o = process.env.PICKS_LOCK_AT_OVERRIDE;
  if (o) {
    const d = new Date(o);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

// The effective global deadline (rounds with no specific window use this).
export function effectiveLockAt(): Date {
  return envOverride() ?? PICKS_LOCK_AT;
}

// The deadline for a specific round.
export function roundLockAt(round: RoundKey): Date {
  return envOverride() ?? ROUND_LOCK_AT[round] ?? PICKS_LOCK_AT;
}

// A pool's picks are globally closed if the admin manually locked it OR the
// global deadline has passed. `now` is injectable so the behaviour is testable.
export function picksLocked(
  pool: { locked: boolean },
  now: Date = new Date(),
): boolean {
  return pool.locked || now.getTime() >= effectiveLockAt().getTime();
}

// Is a specific round closed for editing? (admin lock OR that round's deadline.)
export function roundLocked(
  pool: { locked: boolean },
  round: RoundKey,
  now: Date = new Date(),
): boolean {
  return pool.locked || now.getTime() >= roundLockAt(round).getTime();
}

// Every round → locked?, server-computed for the picks UI.
export function lockedRounds(
  pool: { locked: boolean },
  now: Date = new Date(),
): Record<RoundKey, boolean> {
  return Object.fromEntries(
    ROUNDS.map((r) => [r.key, roundLocked(pool, r.key, now)]),
  ) as Record<RoundKey, boolean>;
}

// The latest deadline among still-editable rounds, or null if all are locked.
export function editDeadline(
  pool: { locked: boolean },
  now: Date = new Date(),
): Date | null {
  const open = ROUNDS.map((r) => r.key).filter((k) => !roundLocked(pool, k, now));
  if (open.length === 0) return null;
  return open.map(roundLockAt).reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
}
