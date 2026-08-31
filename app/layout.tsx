import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// The pool answers on two URLs: its own Vercel domain, and worldcup.portman.ca, which
// serves the same deployment. The subdomain is the one of record, so both consolidate
// there rather than competing as duplicates, and a shared link previews as the subdomain.
// metadataBase also resolves relative URLs in any Open Graph image added later.
const SITE = new URL("https://worldcup.portman.ca");

export const metadata: Metadata = {
  metadataBase: SITE,
  title: "2026 FIFA World Cup Pool — USA · Mexico · Canada",
  description: "Pick your bracket for the 2026 FIFA World Cup hosted by USA, Mexico & Canada. Create a pool and share the join code with friends.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
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
