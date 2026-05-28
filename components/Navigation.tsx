import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Navigation({ poolCode }: { poolCode?: string }) {
  const base = poolCode ? `/pools/${poolCode}` : null;
  const howItWorksHref = poolCode
    ? `/how-it-works?pool=${poolCode}`
    : "/how-it-works";

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
              <Link href={base} className="hover:underline">Pool</Link>
              <Link href={`${base}/picks`} className="hover:underline">Picks</Link>
              <Link href={`${base}/leaderboard`} className="hover:underline">Leaderboard</Link>
            </>
          )}
          <Link href={howItWorksHref} target="_blank" rel="noopener noreferrer" className="hover:underline whitespace-nowrap">
            How it works
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
