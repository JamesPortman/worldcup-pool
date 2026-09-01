/** Where this app is served.
 *
 *  It lives under a path, not at a domain root: www.portman.ca/worldcup. Next's
 *  `basePath` covers routing, <Link> and /_next assets — but it does NOT rewrite
 *  `fetch()`, so a bare fetch("/api/...") would resolve against the host root, where
 *  `/api` belongs to no app in particular. Every API call goes through apiUrl().
 *
 *  next.config.ts imports BASE_PATH from here so the two cannot drift; a test asserts it. */
export const BASE_PATH = "/worldcup";

/** Absolute URL for an API route, carrying the base path. */
export const apiUrl = (path: string) => `${BASE_PATH}${path}`;
