import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import HomeClient from "./HomeClient";

export default function HomePage() {
  return (
    <>
      <Navigation />
      <HeroBanner />
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
