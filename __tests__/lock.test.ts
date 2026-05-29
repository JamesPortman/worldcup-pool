import { describe, it, expect } from "vitest";
import { picksLocked, PICKS_LOCK_AT } from "@/lib/lock";

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
