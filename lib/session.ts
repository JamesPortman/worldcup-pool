import { cookies } from "next/headers";

// We identify a player just by their playerId cookie. The pool join code lives
// in the URL, so the cookie value alone never grants access to a wrong pool —
// API routes check that the playerId belongs to the pool in the URL.
const COOKIE = "wcpool_pid";

export async function getPlayerIdCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setPlayerIdCookie(playerId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, playerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
}

export async function clearPlayerIdCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

// 6-char A-Z + 2-9 (no easily-confused chars) join codes.
export function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
