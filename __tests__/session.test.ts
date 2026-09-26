import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateJoinCode, signPlayerId, verifyPlayerId } from "@/lib/session";

const ALLOWED = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

describe("generateJoinCode", () => {
  it("always returns a 6-character code", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateJoinCode()).toHaveLength(6);
    }
  });

  it("only uses unambiguous characters (no 0/O/1/I)", () => {
    const allowedSet = new Set(ALLOWED);
    for (let i = 0; i < 200; i++) {
      for (const ch of generateJoinCode()) {
        expect(allowedSet.has(ch), `unexpected char "${ch}"`).toBe(true);
      }
    }
    // sanity-check the alphabet itself excludes the confusable characters
    for (const bad of ["0", "O", "1", "I"]) {
      expect(ALLOWED.includes(bad)).toBe(false);
    }
  });

  it("produces varied codes (not a constant)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ── Signed player cookie ────────────────────────────────────────────────────────
describe("signPlayerId / verifyPlayerId", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("ADMIN_TOKEN", "test-token");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips a signed playerId", () => {
    const value = signPlayerId("player_1");
    expect(value.startsWith("player_1.")).toBe(true);
    expect(verifyPlayerId(value)).toBe("player_1");
  });

  it("rejects a bare (unsigned) playerId — the old cookie format", () => {
    expect(verifyPlayerId("player_1")).toBeNull();
  });

  it("rejects missing, empty and malformed values", () => {
    expect(verifyPlayerId(undefined)).toBeNull();
    expect(verifyPlayerId(null)).toBeNull();
    expect(verifyPlayerId("")).toBeNull();
    expect(verifyPlayerId(".abc")).toBeNull();
    expect(verifyPlayerId("player_1.")).toBeNull();
  });

  it("rejects a signature moved onto a different playerId", () => {
    const sig = signPlayerId("player_1").split(".").pop();
    expect(verifyPlayerId(`player_2.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const value = signPlayerId("player_1");
    const flipped = value.slice(0, -1) + (value.endsWith("A") ? "B" : "A");
    expect(verifyPlayerId(flipped)).toBeNull();
  });

  it("rejects a cookie signed under a different key", () => {
    const value = signPlayerId("player_1");
    vi.stubEnv("ADMIN_TOKEN", "rotated-token");
    expect(verifyPlayerId(value)).toBeNull();
  });

  it("prefers SESSION_SECRET over the ADMIN_TOKEN-derived key", () => {
    const derived = signPlayerId("player_1");
    vi.stubEnv("SESSION_SECRET", "explicit-secret");
    const explicit = signPlayerId("player_1");
    expect(explicit).not.toBe(derived);
    expect(verifyPlayerId(explicit)).toBe("player_1");
    expect(verifyPlayerId(derived)).toBeNull();
  });

  it("throws in production when no key is configured", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => signPlayerId("player_1")).toThrow(/SESSION_SECRET/);
    expect(() => verifyPlayerId("player_1.abc")).toThrow(/SESSION_SECRET/);
  });

  it("falls back to a dev key outside production", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(verifyPlayerId(signPlayerId("player_1"))).toBe("player_1");
  });
});
