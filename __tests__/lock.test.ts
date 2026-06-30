import { describe, it, expect, afterEach, vi } from "vitest";
import {
  picksLocked,
  effectiveLockAt,
  roundLocked,
  lockedRounds,
  editDeadline,
  PICKS_LOCK_AT,
  ROUND_LOCK_AT,
} from "@/lib/lock";

const before = new Date(PICKS_LOCK_AT.getTime() - 60_000);
const after = new Date(PICKS_LOCK_AT.getTime() + 60_000);

describe("picksLocked", () => {
  it("is open before the deadline when the pool is not manually locked", () => {
    expect(picksLocked({ locked: false }, before)).toBe(false);
  });

  it("respects a manual admin lock even before the deadline", () => {
    expect(picksLocked({ locked: true }, before)).toBe(true);
  });

  it("auto-locks once the deadline passes", () => {
    expect(picksLocked({ locked: false }, after)).toBe(true);
  });

  it("is locked exactly at the deadline", () => {
    expect(picksLocked({ locked: false }, PICKS_LOCK_AT)).toBe(true);
  });
});

describe("per-round locks — Group of 8 editing window", () => {
  const final8At = ROUND_LOCK_AT.FINAL8!;
  const afterGlobal = new Date(PICKS_LOCK_AT.getTime() + 60_000); // past Jun 11, before Jul 4
  const afterFinal8 = new Date(final8At.getTime() + 60_000);

  it("keeps Group of 8 open past the global deadline, while other rounds lock", () => {
    expect(roundLocked({ locked: false }, "FINAL8", afterGlobal)).toBe(false);
    expect(roundLocked({ locked: false }, "GROUP", afterGlobal)).toBe(true);
    expect(roundLocked({ locked: false }, "WINNER", afterGlobal)).toBe(true);
  });

  it("locks Group of 8 once its own deadline passes", () => {
    expect(roundLocked({ locked: false }, "FINAL8", afterFinal8)).toBe(true);
  });

  it("a manual admin lock closes every round, including Group of 8", () => {
    expect(roundLocked({ locked: true }, "FINAL8", afterGlobal)).toBe(true);
  });

  it("lockedRounds: only FINAL8 is open between the two deadlines", () => {
    const map = lockedRounds({ locked: false }, afterGlobal);
    expect(map).toEqual({ GROUP: true, FINAL8: false, FINAL4: true, SEMIFINAL: true, WINNER: true });
  });

  it("editDeadline is the Group-of-8 close while only it is open, then null", () => {
    expect(editDeadline({ locked: false }, afterGlobal)?.getTime()).toBe(final8At.getTime());
    expect(editDeadline({ locked: false }, afterFinal8)).toBeNull();
  });
});

describe("effectiveLockAt — PICKS_LOCK_AT_OVERRIDE", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the constant when no override is set", () => {
    vi.stubEnv("PICKS_LOCK_AT_OVERRIDE", "");
    expect(effectiveLockAt().getTime()).toBe(PICKS_LOCK_AT.getTime());
  });

  it("honours a valid override (e.g. a far-future test deadline)", () => {
    vi.stubEnv("PICKS_LOCK_AT_OVERRIDE", "2027-01-01T00:00:00Z");
    const override = new Date("2027-01-01T00:00:00Z");
    expect(effectiveLockAt().getTime()).toBe(override.getTime());
    // With the deadline pushed out, a real "now" before it leaves picks open.
    expect(picksLocked({ locked: false }, new Date("2026-06-30T00:00:00Z"))).toBe(false);
  });

  it("falls back to the constant when the override is not a valid date", () => {
    vi.stubEnv("PICKS_LOCK_AT_OVERRIDE", "not-a-date");
    expect(effectiveLockAt().getTime()).toBe(PICKS_LOCK_AT.getTime());
  });
});

describe("PICKS_LOCK_AT", () => {
  it("falls before the 2026 World Cup opener on June 11", () => {
    expect(PICKS_LOCK_AT.getTime()).toBeLessThan(
      new Date("2026-06-11T16:00:00Z").getTime(),
    );
  });

  it("is on June 10 in US Eastern time", () => {
    const eastern = PICKS_LOCK_AT.toLocaleString("en-US", { timeZone: "America/New_York" });
    expect(eastern).toMatch(/6\/10\/2026/);
  });
});
