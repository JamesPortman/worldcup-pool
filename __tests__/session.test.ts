import { describe, it, expect } from "vitest";
import { generateJoinCode } from "@/lib/session";

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
