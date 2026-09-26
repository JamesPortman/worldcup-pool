import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { BASE_PATH } from "@/lib/site";

// We identify a player by a signed playerId cookie. Two shapes:
//   `<playerId>.<hmac>`       — an editing session, issued when the player first
//                               joins (or creates) the pool;
//   `<playerId>.view.<hmac>`  — a view-only session, issued when someone signs
//                               back in by typing an existing display name.
// There are no passwords, so a display name alone must not unlock someone's
// picks: anyone with the pool code could type it. The HMAC covers the mode, so
// a view cookie can't be edited into an editing one, and an unsigned or
// tampered value is treated as "no session". The pool join code lives in the
// URL, and API routes still check that the playerId belongs to that pool.
const COOKIE = "wcpool_session";
// The pre-signing cookie (raw playerId, path "/"). No longer read; expired on the
// next sign-in. It had to be renamed, not reused: a browser sends both a "/" and
// a BASE_PATH cookie of the same name, and Next keeps the last one it parses —
// the stale "/" one — which would lock a returning player out.
const LEGACY_COOKIE = "wcpool_pid";

// Used only outside production when no secret is configured, so tests, local
// dev, the build and e2e work with zero config. Never used in production.
const DEV_KEY = "wcpool-dev-session-key";

// SESSION_SECRET if set; otherwise derived from ADMIN_TOKEN so existing
// deployments keep working without a config change.
function sessionKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  const admin = process.env.ADMIN_TOKEN;
  if (admin) return createHmac("sha256", admin).update("wcpool-session-v1").digest("hex");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Session signing key missing — set SESSION_SECRET (or ADMIN_TOKEN).");
  }
  return DEV_KEY;
}

const VIEW = "view";

function sign(payload: string): string {
  return createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

export interface Session {
  playerId: string;
  /** False for a view-only session (signed back in by name). */
  canEdit: boolean;
}

/** Cookie value for a session: `<playerId>.<sig>`, or `<playerId>.view.<sig>` when view-only. */
export function signSession(playerId: string, canEdit = true): string {
  const payload = canEdit ? playerId : `${playerId}.${VIEW}`;
  return `${payload}.${sign(payload)}`;
}

/** The session in a signed cookie value, or null if unsigned/invalid. */
export function verifySession(value: string | undefined | null): Session | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const viewOnly = payload.endsWith(`.${VIEW}`);
  const playerId = viewOnly ? payload.slice(0, -(VIEW.length + 1)) : payload;
  if (!playerId || playerId.includes(".")) return null;
  return { playerId, canEdit: !viewOnly };
}

/** Cookie value for an editing session. */
export function signPlayerId(playerId: string): string {
  return signSession(playerId, true);
}

/** The playerId from a signed cookie value (either mode), or null if unsigned/invalid. */
export function verifyPlayerId(value: string | undefined | null): string | null {
  return verifySession(value)?.playerId ?? null;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(COOKIE)?.value);
}

export async function getPlayerIdCookie(): Promise<string | null> {
  return (await getSession())?.playerId ?? null;
}

export async function setPlayerIdCookie(
  playerId: string,
  { canEdit = true }: { canEdit?: boolean } = {},
): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signSession(playerId, canEdit), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: BASE_PATH,
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
  if (store.has(LEGACY_COOKIE)) store.delete({ name: LEGACY_COOKIE, path: "/" });
}

export async function clearPlayerIdCookie(): Promise<void> {
  const store = await cookies();
  store.delete({ name: COOKIE, path: BASE_PATH });
}

// 6-char A-Z + 2-9 (no easily-confused chars) join codes.
export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
