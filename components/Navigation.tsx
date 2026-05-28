import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Navigation({ poolCode }: { poolCode?: string }) {
  const base = poolCode ? `/pools/${poolCode}` : null;
  const howItWorksHref = poolCode
    ? `/how-it-works?pool=${poolCode}`
    : "/how-it-works";

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo — not clickable */}
        <span className="font-semibold text-brand text-lg select-none">
          ⚽ World Cup Pool
        </span>
        <nav className="flex items-center gap-4 text-sm">
          {base && (
            <>
              <Link href={base} className="hover:underline">Pool</Link>
              <Link href={`${base}/picks`} className="hover:underline">My picks</Link>
              <Link href={`${base}/leaderboard`} className="hover:underline">Leaderboard</Link>
            </>
          )}
          <Link href={howItWorksHref} target="_blank" rel="noopener noreferrer" className="hover:underline">
            How it works
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
