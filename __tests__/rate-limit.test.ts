import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientKey, resetRateLimit } from "@/lib/rate-limit";

beforeEach(() => resetRateLimit());

describe("rateLimit", () => {
  it("allows up to the limit within the window, then blocks", () => {
    const t = 1_000;
    expect(rateLimit("k", 3, 60_000, t)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t)).toBe(false); // 4th in-window → blocked
  });

  it("resets after the window elapses", () => {
    expect(rateLimit("k", 1, 1_000, 0)).toBe(true);
    expect(rateLimit("k", 1, 1_000, 500)).toBe(false); // still in window
    expect(rateLimit("k", 1, 1_000, 2_000)).toBe(true); // window passed
  });

  it("tracks separate keys independently", () => {
    expect(rateLimit("a", 1, 1_000, 0)).toBe(true);
    expect(rateLimit("b", 1, 1_000, 0)).toBe(true);
    expect(rateLimit("a", 1, 1_000, 0)).toBe(false);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string>) => ({
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  });

  it("uses the first x-forwarded-for hop", () => {
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientKey(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientKey(req({}))).toBe("unknown");
  });
});
