import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/site";

// The app is served at www.portman.ca/worldcup, so it is built for that path rather
// than for a domain root. basePath is build-time: it applies on every domain this
// deployment answers on, including its own *.vercel.app URL.
const nextConfig: NextConfig = {
  basePath: BASE_PATH,
};

export default nextConfig;
