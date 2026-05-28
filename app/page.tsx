import Navigation from "@/components/Navigation";
import HomeClient from "./HomeClient";

export default function HomePage() {
  return (
    <>
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">World Cup Pool</h1>
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
