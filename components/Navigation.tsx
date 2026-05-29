"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

export default function Navigation({ poolCode }: { poolCode?: string }) {
  const pathname = usePathname();
  const base = poolCode ? `/pools/${poolCode}` : null;
  const howItWorksHref = poolCode
    ? `/how-it-works?pool=${poolCode}`
    : "/how-it-works";
  const architectureHref = poolCode
    ? `/architecture?pool=${poolCode}`
    : "/architecture";

  // Highlight the link for the page we're currently on. Compare against the
  // pathname only (query strings like ?player= don't change the active tab).
  const isActive = (href: string) => pathname === href;
  const linkClass = (href: string) =>
    `whitespace-nowrap hover:underline ${
      isActive(href)
        ? "font-semibold text-[color:var(--color-brand)] underline underline-offset-4 decoration-2"
        : ""
    }`;
  const ariaCurrent = (href: string) => (isActive(href) ? ("page" as const) : undefined);

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* Logo — not clickable */}
        <span className="font-semibold text-brand text-base sm:text-lg select-none">
          ⚽ World Cup Pool
        </span>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
          {base && (
            <>
              <Link href={base} aria-current={ariaCurrent(base)} className={linkClass(base)}>Pool</Link>
              <Link href={`${base}/picks`} aria-current={ariaCurrent(`${base}/picks`)} className={linkClass(`${base}/picks`)}>Picks</Link>
              <Link href={`${base}/leaderboard`} aria-current={ariaCurrent(`${base}/leaderboard`)} className={linkClass(`${base}/leaderboard`)}>Leaderboard</Link>
            </>
          )}
          <Link href={howItWorksHref} target="_blank" rel="noopener noreferrer" aria-current={ariaCurrent("/how-it-works")} className={linkClass("/how-it-works")}>
            How it works
          </Link>
          <Link href={architectureHref} target="_blank" rel="noopener noreferrer" aria-current={ariaCurrent("/architecture")} className={linkClass("/architecture")}>
            Architecture
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
