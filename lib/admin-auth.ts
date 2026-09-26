import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** True when the request carries the correct `x-admin-token`. Fails closed when
 *  ADMIN_TOKEN is unset. Both sides are hashed first so the comparison is
 *  constant-time regardless of length. */
export function isAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const token = req.headers.get("x-admin-token");
  if (!expected || !token) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(token), digest(expected));
}
