import { describe, it, expect, afterEach, vi } from "vitest";
import { picksLocked, effectiveLockAt, PICKS_LOCK_AT } from "@/lib/lock";

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
