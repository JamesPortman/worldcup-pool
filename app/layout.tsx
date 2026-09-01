import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BASE_PATH } from "@/lib/site";

// The pool answers on two URLs: this deployment's own Vercel domain and
// www.portman.ca/worldcup, where it is mounted. portman.ca is the one of record, so both
// consolidate there rather than competing as duplicates, and a shared link previews as
// it. Static by necessity — the unfurlers that read og:url do not run JavaScript.
//
// Built from BASE_PATH so the canonical URL cannot drift from where the app is mounted,
// and written as an explicit string: passing a URL object equal to metadataBase makes
// Next emit the origin alone, silently dropping the /worldcup this exists to name.
const SITE_ORIGIN = "https://www.portman.ca";
const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "2026 FIFA World Cup Pool — USA · Mexico · Canada",
  description: "Pick your bracket for the 2026 FIFA World Cup hosted by USA, Mexico & Canada. Create a pool and share the join code with friends.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "2026 World Cup Pool",
    title: "2026 FIFA World Cup Pool — USA · Mexico · Canada",
    description: "Pick your bracket for the 2026 FIFA World Cup hosted by USA, Mexico & Canada. Create a pool and share the join code with friends.",
  },
};

// Inline script: set the dark class before paint to avoid a flash of light theme.
const themeBootScript = `(function(){try{var s=localStorage.getItem('theme');var p=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s?s==='dark':p;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
