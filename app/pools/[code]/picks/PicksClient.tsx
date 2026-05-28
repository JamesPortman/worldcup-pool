"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUNDS, PICKS_PER_ROUND, groups, type RoundKey } from "@/data/worldcup2026";

interface TeamLite { code: string; name: string; group: string; }
interface ExistingPick { round: string; teamCode: string; groupId: string | null; }

// FINAL4 is hidden from the UI — picks go GROUP → SEMIFINAL → WINNER
const SEMIFINAL_META = ROUNDS.find((r) => r.key === "SEMIFINAL")!;
const WINNER_META    = ROUNDS.find((r) => r.key === "WINNER")!;

export default function PicksClient({
  poolCode,
  locked,
  teams,
  existingPicks,
}: {
  poolCode: string;
  locked: boolean;
  teams: TeamLite[];
  existingPicks: ExistingPick[];
}) {
  const router = useRouter();
  const teamsByGroup = useMemo(() => {
    const m: Record<string, TeamLite[]> = {};
    for (const t of teams) (m[t.group] ??= []).push(t);
    return m;
  }, [teams]);

  const teamByCode = useMemo(() => {
    const m: Record<string, TeamLite> = {};
    for (const t of teams) m[t.code] = t;
    return m;
  }, [teams]);

  // GROUP picks keyed by groupId → teamCode
  const initialGroupPicks: Record<string, string> = {};
  for (const p of existingPicks)
    if (p.round === "GROUP" && p.groupId) initialGroupPicks[p.groupId] = p.teamCode;
  const [groupPicks, setGroupPicks] = useState<Record<string, string>>(initialGroupPicks);

  // SEMIFINAL picks: Set of selected team codes
  const initialSemifinal = new Set<string>();
  for (const p of existingPicks)
    if (p.round === "SEMIFINAL") initialSemifinal.add(p.teamCode);

  // WINNER picks: Set (max 1)
  const initialWinner = new Set<string>();
  for (const p of existingPicks)
    if (p.round === "WINNER") initialWinner.add(p.teamCode);

  const [semifinalPicks, setSemifinalPicks] = useState<Set<string>>(initialSemifinal);
  const [winnerPick,     setWinnerPick]     = useState<Set<string>>(initialWinner);

  const [saving,       setSaving]       = useState(false);
  const [resetting,    setResetting]    = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [saved,        setSaved]        = useState(false);

  // Derived: how many groups have been picked
  const groupPickCount = useMemo(
    () => Object.values(groupPicks).filter(Boolean).length,
    [groupPicks],
  );

  // The 12 (or fewer) group-winner teams available for SEMIFINAL
  const semifinalOptions = useMemo(
    () =>
      groups
        .map((g) => groupPicks[g])
        .filter(Boolean)
        .map((code) => teamByCode[code])
        .filter(Boolean) as TeamLite[],
    [groupPicks, teamByCode],
  );

  // The 2 (or fewer) finalist teams available for WINNER
  const winnerOptions = useMemo(
    () =>
      Array.from(semifinalPicks)
        .map((code) => teamByCode[code])
        .filter(Boolean) as TeamLite[],
    [semifinalPicks, teamByCode],
  );

  // Progressive reveal flags
  const semifinalUnlocked = groupPickCount === 12;
  const winnerUnlocked    = semifinalPicks.size === PICKS_PER_ROUND.SEMIFINAL;

  // ── Group pick handler (with cascade clear) ──────────────────────────────
  function handleGroupChange(groupId: string, teamCode: string) {
    if (locked) return;
    const newGroupPicks = { ...groupPicks, [groupId]: teamCode };
    setGroupPicks(newGroupPicks);

    // Cascade: remove any SEMIFINAL picks no longer in the new group-winner set
    const newWinners = new Set(Object.values(newGroupPicks).filter(Boolean));
    setSemifinalPicks((prev) => {
      const filtered = new Set([...prev].filter((c) => newWinners.has(c)));
      // Also cascade to WINNER
      setWinnerPick((prevW) => new Set([...prevW].filter((c) => filtered.has(c))));
      return filtered;
    });
    setSaved(false);
  }

  // ── Semifinal toggle (with cascade clear on WINNER) ──────────────────────
  function toggleSemifinal(code: string) {
    if (locked || !semifinalUnlocked) return;
    setSemifinalPicks((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        // Clear winner if it was this team
        setWinnerPick((prevW) => new Set([...prevW].filter((c) => next.has(c))));
      } else {
        if (next.size >= PICKS_PER_ROUND.SEMIFINAL) return prev;
        next.add(code);
      }
      return next;
    });
    setSaved(false);
  }

  // ── Winner toggle ─────────────────────────────────────────────────────────
  function toggleWinner(code: string) {
    if (locked || !winnerUnlocked) return;
    setWinnerPick((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        if (next.size >= PICKS_PER_ROUND.WINNER) return prev;
        next.add(code);
      }
      return next;
    });
    setSaved(false);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  async function resetPicks() {
    if (locked) return;
    setResetting(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/pools/${poolCode}/picks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ picks: [] }),
    });
    const data = await res.json();
    setResetting(false);
    if (!res.ok) { setError(data.error ?? "Reset failed"); return; }
    setGroupPicks({});
    setSemifinalPicks(new Set());
    setWinnerPick(new Set());
    setConfirmReset(false);
    router.refresh();
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    if (locked) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const picks: Array<{ round: string; teamCode: string; groupId?: string }> = [];
    for (const [groupId, teamCode] of Object.entries(groupPicks)) {
      if (teamCode) picks.push({ round: "GROUP", teamCode, groupId });
    }
    for (const code of semifinalPicks) picks.push({ round: "SEMIFINAL", teamCode: code });
    for (const code of winnerPick)     picks.push({ round: "WINNER",    teamCode: code });

    const res = await fetch(`/api/pools/${poolCode}/picks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ picks }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Save failed"); return; }
    setSaved(true);
    router.refresh();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 sm:mt-6 space-y-8 sm:space-y-10 pb-24">

      {/* ── Group Winners ── */}
      <section>
        <SectionHeader
          title="Group Winners"
          subtitle={`Pick the team you think wins each group. (${ROUNDS[0].points} pt each) — ${groupPickCount}/12 picked.`}
        />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g} className="rounded-lg border border-neutral-300 dark:border-neutral-700 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Group {g}</div>
              <select
                disabled={locked}
                value={groupPicks[g] ?? ""}
                onChange={(e) => handleGroupChange(g, e.target.value)}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-2 text-sm"
              >
                <option value="">— pick winner —</option>
                {(teamsByGroup[g] ?? []).map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* ── Semi-Final (unlocks after all 12 groups) ── */}
      {semifinalUnlocked && (
        <section>
          <SectionHeader
            title={SEMIFINAL_META.label}
            subtitle={`Pick the 2 teams that reach the Final from your group winners. (${SEMIFINAL_META.points} pts each) — ${semifinalPicks.size}/${PICKS_PER_ROUND.SEMIFINAL} selected.`}
          />
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {semifinalOptions.map((t) => {
              const selected = semifinalPicks.has(t.code);
              const full     = semifinalPicks.size >= PICKS_PER_ROUND.SEMIFINAL;
              const disabled = locked || (!selected && full);
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => toggleSemifinal(t.code)}
                  disabled={disabled}
                  className={[
                    "text-left rounded-md border px-3 py-2.5 text-sm transition-colors",
                    selected
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/10"
                      : "border-neutral-300 dark:border-neutral-700",
                    disabled && !selected
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:border-[color:var(--color-brand)] cursor-pointer",
                  ].join(" ")}
                >
                  <span className="font-medium block">{t.name}</span>
                  <span className="text-xs text-neutral-500">Group {t.group}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Winner / Final (unlocks after 2 semifinal picks) ── */}
      {winnerUnlocked && (
        <section>
          <SectionHeader
            title={WINNER_META.label}
            subtitle={`Pick the tournament champion from your two finalists. (${WINNER_META.points} pts) — ${winnerPick.size}/${PICKS_PER_ROUND.WINNER} selected.`}
          />
          <div className="grid gap-2 grid-cols-2">
            {winnerOptions.map((t) => {
              const selected = winnerPick.has(t.code);
              const full     = winnerPick.size >= PICKS_PER_ROUND.WINNER;
              const disabled = locked || (!selected && full);
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => toggleWinner(t.code)}
                  disabled={disabled}
                  className={[
                    "text-left rounded-md border px-4 py-3 text-sm transition-colors",
                    selected
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/10"
                      : "border-neutral-300 dark:border-neutral-700",
                    disabled && !selected
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:border-[color:var(--color-brand)] cursor-pointer",
                  ].join(" ")}
                >
                  <span className="font-semibold block text-base">{t.name}</span>
                  <span className="text-xs text-neutral-500">Group {t.group}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Locked-but-incomplete sections: show helpful hints ── */}
      {!semifinalUnlocked && (
        <div className="rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-4 py-3 text-sm text-neutral-500">
          Complete all 12 Group Winner picks to unlock the Semi-Final section. ({groupPickCount}/12 done)
        </div>
      )}
      {semifinalUnlocked && !winnerUnlocked && (
        <div className="rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-4 py-3 text-sm text-neutral-500">
          Pick both Semi-Final teams to unlock the Winner section. ({semifinalPicks.size}/2 done)
        </div>
      )}

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3 bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Reset picks — always visible, disabled when locked */}
            {confirmReset && !locked ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-red-600 dark:text-red-400">Clear all picks?</span>
                <button
                  type="button"
                  onClick={resetPicks}
                  disabled={resetting}
                  className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                >
                  {resetting ? "Clearing…" : "Yes, clear"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setConfirmReset(true); setSaved(false); }}
                disabled={locked}
                className="rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reset picks
              </button>
            )}
            {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {saved && !error && (
              <span className="text-sm text-[color:var(--color-brand)] font-medium">✓ Picks saved!</span>
            )}
            {saved && (
              <Link
                href={`/pools/${poolCode}/leaderboard`}
                className="rounded-md border border-[color:var(--color-brand)] text-[color:var(--color-brand)] px-3 py-1.5 text-sm font-medium hover:bg-[color:var(--color-brand)]/5 whitespace-nowrap"
              >
                Leaderboard →
              </Link>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || locked}
              className="rounded-md bg-[color:var(--color-brand)] text-white px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : locked ? "Locked" : "Save picks"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p>
    </div>
  );
}
