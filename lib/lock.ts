// Picks auto-close ahead of kickoff so nobody can edit once games begin.
//
// The 2026 World Cup opens June 11, 2026. Entries lock at the end of June 10
// (Eastern time) — i.e. 23:59 EDT on Jun 10 == 03:59 UTC on Jun 11.
// Move this single constant to change the deadline.
export const PICKS_LOCK_AT = new Date("2026-06-11T03:59:00Z");

// A pool's picks are closed if the admin manually locked it OR the global
// deadline has passed. `now` is injectable so the behaviour is unit-testable.
export function picksLocked(
  pool: { locked: boolean },
  now: Date = new Date(),
): boolean {
  return pool.locked || now.getTime() >= PICKS_LOCK_AT.getTime();
}
