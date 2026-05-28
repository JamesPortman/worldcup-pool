import Navigation from "@/components/Navigation";
import HomeClient from "./HomeClient";

export default function HomePage() {
  return (
    <>
      <Navigation />

      {/* Hero banner */}
      <div className="bg-gradient-to-br from-[#002868] via-[#BF0A30] to-[#006847] text-white">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center">
          <div className="text-4xl mb-3">🇺🇸 🇲🇽 🇨🇦</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
            2026 FIFA World Cup Pool
          </h1>
          <p className="text-lg font-medium opacity-90 mb-1">
            USA &middot; Mexico &middot; Canada
          </p>
          <p className="text-sm opacity-70">June 11 – July 19, 2026</p>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          Make your picks for the 2026 FIFA World Cup. Create a pool and share the
          join code with friends — everyone enters their bracket and the
          leaderboard updates as results come in.
        </p>
        <HomeClient />
      </main>
    </>
  );
}
