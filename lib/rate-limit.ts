// Best-effort in-memory fixed-window rate limiter.
//
// NOTE: serverless functions don't share memory across instances, so this is a
// per-instance safeguard against bursts/abuse, not a global guarantee. For a
// hard global limit, back it with Upstash Redis (or similar) — the call sites
// would stay the same.

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

/**
 * Returns true if the action is allowed for `key`, false if the limit is hit.
 * `now` is injectable for deterministic tests.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Best-guess client identifier from proxy headers (Vercel sets x-forwarded-for). */
export function clientKey(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Clears all buckets — used to keep tests isolated. */
export function resetRateLimit(): void {
  buckets.clear();
}
