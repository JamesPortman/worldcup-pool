import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import { ROUNDS, PICKS_PER_ROUND } from "@/data/worldcup2026";

const DISPLAY_ROUNDS = ROUNDS.filter((r) => r.key !== "FINAL4");

export const metadata = { title: "How it works — World Cup Pool" };

export default async function HowItWorks({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool } = await searchParams;
  return (
    <>
      <Navigation poolCode={pool} />
      <HeroBanner />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10 prose dark:prose-invert">
        <h1 className="text-3xl font-bold mb-6">How it works</h1>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. Create or join a pool</h2>
        <p>One person creates the pool and gets a 6-character join code. Share the code with friends — they enter it plus their display name to join. No accounts, no passwords.</p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Make your picks before kickoff</h2>
        <p>You make three sets of picks:</p>
        <ul>
          <li><strong>Group Winners</strong> — pick who wins each of the 12 groups</li>
          <li><strong>Semi-Final</strong> — from your group winners, pick the 2 finalists</li>
          <li><strong>Winner</strong> — from your finalists, pick the tournament champion</li>
        </ul>
        <p>You can edit your picks any time until the admin locks the pool before kickoff.</p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Points scale with each round</h2>
        <p>Later rounds are worth more — pick a champion right and you score big.</p>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left border-b border-neutral-300 dark:border-neutral-700">
              <th className="py-2 pr-3">Round</th>
              <th className="py-2 pr-3">Picks</th>
              <th className="py-2 pr-3 text-right">Points each</th>
              <th className="py-2 pr-3 text-right">Round max</th>
            </tr>
          </thead>
          <tbody>
            {DISPLAY_ROUNDS.map((r) => (
              <tr key={r.key} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pr-3">{r.label}</td>
                <td className="py-2 pr-3">{PICKS_PER_ROUND[r.key]}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.points}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{PICKS_PER_ROUND[r.key] * r.points}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-2 pr-3 font-semibold" colSpan={3}>Maximum possible</td>
              <td className="pt-2 pr-3 text-right font-semibold tabular-nums">
                {DISPLAY_ROUNDS.reduce((sum, r) => sum + PICKS_PER_ROUND[r.key] * r.points, 0)}
              </td>
            </tr>
          </tfoot>
        </table>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Leaderboard updates as results come in</h2>
        <p>The pool admin marks teams as advancing after each round. The leaderboard recalculates automatically — no resubmission needed.</p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Day &amp; night mode</h2>
        <p>Use the toggle in the top-right to switch. Your preference is saved on this device.</p>
      </main>
    </>
  );
}
