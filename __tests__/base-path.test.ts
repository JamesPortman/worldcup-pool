import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";
import { BASE_PATH, apiUrl } from "../lib/site";

// The app is served under a path, not at a domain root. Two things have to agree about
// that path, and nothing else enforces it: Next's basePath (routing, <Link>, /_next) and
// apiUrl (fetch, which basePath does not touch). If they drift, links keep working while
// every API call quietly lands on the host's own root — the failure this pins down.
describe("base path", () => {
  it("next.config and the client helper name the same path", () => {
    expect(nextConfig.basePath).toBe(BASE_PATH);
  });

  it("apiUrl carries the base path onto API routes", () => {
    expect(apiUrl("/api/pools")).toBe("/worldcup/api/pools");
    expect(apiUrl("/api/pools/ABC/join")).toBe("/worldcup/api/pools/ABC/join");
  });

  it("the base path is a path, not a bare segment or a trailing-slash path", () => {
    expect(BASE_PATH.startsWith("/")).toBe(true);
    expect(BASE_PATH.endsWith("/")).toBe(false);
  });
});
