"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUNDS, PICKS_PER_ROUND, groups, type RoundKey } from "@/data/worldcup2026";
import { PICKS_LOCK_AT } from "@/lib/lock";

interface TeamLite { code: string; name: string; group: string; }
interface ExistingPick { round: string; teamCode: string; groupId: string | null; }

const GROUP_META     = ROUNDS.find((r) => r.key === "GROUP")!;
const FINAL4_META    = ROUNDS.find((r) => r.key === "FINAL4")!;
const SEMIFINAL_META = ROUNDS.find((r) => r.key === "SEMIFINAL")!;
const WINNER_META    = ROUNDS.find((r) => r.key === "WINNER")!;

// Total picks a complete bracket needs: 12 + 4 + 2 + 1 = 19.
const TOTAL_EXPECTED =
  PICKS_PER_ROUND.GROUP + PICKS_PER_ROUND.FINAL4 + PICKS_PER_ROUND.SEMIFINAL + PICKS_PER_ROUND.WINNER;

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
    for (const g of Object.keys(m)) m[g].sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [teams]);

  const teamByCode = useMemo(() => {
    const m: Record<string, TeamLite> = {};
    for (const t of teams) m[t.code] = t;
    return m;
  }, [teams]);

  // ── Initial state from existing picks ────────────────────────────────────
  const initialGroupPicks: Record<string, string> = {};
  for (const p of existingPicks)
    if (p.round === "GROUP" && p.groupId) initialGroupPicks[p.groupId] = p.teamCode;

  const initialFinal4 = new Set<string>();
  for (const p of existingPicks) if (p.round === "FINAL4") initialFinal4.add(p.teamCode);

  const initialSemifinal = new Set<string>();
  for (const p of existingPicks) if (p.round === "SEMIFINAL") initialSemifinal.add(p.teamCode);

  const initialWinner = new Set<string>();
  for (const p of existingPicks) if (p.round === "WINNER") initialWinner.add(p.teamCode);

  const [groupPicks,    setGroupPicks]    = useState<Record<string, string>>(initialGroupPicks);
  const [final4Picks,   setFinal4Picks]   = useState<Set<string>>(initialFinal4);
  const [semifinalPicks, setSemifinalPicks] = useState<Set<string>>(initialSemifinal);
  const [winnerPick,    setWinnerPick]    = useState<Set<string>>(initialWinner);

  const [saving,       setSaving]       = useState(false);
  const [resetting,    setResetting]    = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [saved,        setSaved]        = useState(false);

  // ── Derived counts & unlock flags ─────────────────────────────────────────
  const groupPickCount = useMemo(
    () => Object.values(groupPicks).filter(Boolean).length,
    [groupPicks],
  );

  const final4Unlocked    = groupPickCount === PICKS_PER_ROUND.GROUP;          // 12
  const semifinalUnlocked = final4Picks.size === PICKS_PER_ROUND.FINAL4;       // 4
  const winnerUnlocked    = semifinalPicks.size === PICKS_PER_ROUND.SEMIFINAL; // 2

  const totalPicks =
    groupPickCount + final4Picks.size + semifinalPicks.size + winnerPick.size;

  // ── Filtered option lists ─────────────────────────────────────────────────
  // Final 4 options = the 12 group winners you picked, sorted alphabetically
  const final4Options = useMemo(
    () =>
      groups
        .map((g) => groupPicks[g])
        .filter(Boolean)
        .map((code) => teamByCode[code])
        .filter(Boolean)
        .sort((a, b) => (a as TeamLite).name.localeCompare((b as TeamLite).name)) as TeamLite[],
    [groupPicks, teamByCode],
  );

  // Semi-Final options = the 4 Final 4 picks, sorted alphabetically
  const semifinalOptions = useMemo(
    () =>
      Array.from(final4Picks)
        .map((code) => teamByCode[code])
        .filter(Boolean)
        .sort((a, b) => (a as TeamLite).name.localeCompare((b as TeamLite).name)) as TeamLite[],
    [final4Picks, teamByCode],
  );

  // Winner options = the 2 Semi-Final picks, sorted alphabetically
  const winnerOptions = useMemo(
    () =>
      Array.from(semifinalPicks)
        .map((code) => teamByCode[code])
        .filter(Boolean)
        .sort((a, b) => (a as TeamLite).name.localeCompare((b as TeamLite).name)) as TeamLite[],
    [semifinalPicks, teamByCode],
  );

  // ── Handlers (each cascades to clear downstream invalid picks) ────────────
  function handleGroupChange(groupId: string, teamCode: string) {
    if (locked) return;
    const newGroupPicks = { ...groupPicks, [groupId]: teamCode };
    setGroupPicks(newGroupPicks);

    const newWinners = new Set(Object.values(newGroupPicks).filter(Boolean));
    setFinal4Picks((prev) => {
      const filtered = new Set([...prev].filter((c) => newWinners.has(c)));
      // Cascade → semifinal
      setSemifinalPicks((prevSF) => {
        const filteredSF = new Set([...prevSF].filter((c) => filtered.has(c)));
        // Cascade → winner
        setWinnerPick((prevW) => new Set([...prevW].filter((c) => filteredSF.has(c))));
        return filteredSF;
      });
      return filtered;
    });
    setSaved(false);
  }

  function toggleFinal4(code: string) {
    if (locked || !final4Unlocked) return;
    setFinal4Picks((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        // Cascade → semifinal → winner
        setSemifinalPicks((prevSF) => {
          const filteredSF = new Set([...prevSF].filter((c) => next.has(c)));
          setWinnerPick((prevW) => new Set([...prevW].filter((c) => filteredSF.has(c))));
          return filteredSF;
        });
      } else {
        if (next.size >= PICKS_PER_ROUND.FINAL4) return prev;
        next.add(code);
      }
      return next;
    });
    setSaved(false);
  }

  function toggleSemifinal(code: string) {
    if (locked || !semifinalUnlocked) return;
    setSemifinalPicks((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        // Cascade → winner
        setWinnerPick((prevW) => new Set([...prevW].filter((c) => next.has(c))));
      } else {
        if (next.size >= PICKS_PER_ROUND.SEMIFINAL) return prev;
        next.add(code);
      }
      return next;
    });
    setSaved(false);
  }

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
    setFinal4Picks(new Set());
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
    for (const [groupId, teamCode] of Object.entries(groupPicks))
      if (teamCode) picks.push({ round: "GROUP", teamCode, groupId });
    for (const code of final4Picks)    picks.push({ round: "FINAL4",    teamCode: code });
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

      {/* ── Progress + lock countdown ── */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[12rem]">
          <div className="text-sm font-medium">
            {totalPicks} of {TOTAL_EXPECTED} picks made
          </div>
          <div
            className="h-2 mt-1.5 w-full max-w-xs rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={totalPicks}
            aria-valuemin={0}
            aria-valuemax={TOTAL_EXPECTED}
          >
            <div
              className="h-full bg-[color:var(--color-brand)] transition-[width] duration-300"
              style={{ width: `${(totalPicks / TOTAL_EXPECTED) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            {locked ? "Entries" : "Entries close in"}
          </div>
          <div className="font-mono font-semibold tabular-nums text-sm">
            {locked ? "Closed" : <Countdown />}
          </div>
        </div>
      </div>

      {/* ── Group Winners ── */}
      <section>
        <SectionHeader
          title="Group Winners"
          subtitle={`Pick the winner of each group. (${GROUP_META.points} pt each) — ${groupPickCount}/12 picked.`}
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

        {!final4Unlocked && (
          <p className="mt-3 text-sm text-neutral-500">
            Pick all 12 group winners to unlock the Final 4 section. ({groupPickCount}/12 done)
          </p>
        )}
      </section>

      {/* ── Final 4 (unlocks after all 12 groups) ── */}
      {final4Unlocked && (
        <section>
          <SectionHeader
            title={FINAL4_META.label}
            subtitle={`Pick 4 semi-finalists from your group winners. (${FINAL4_META.points} pts each) — ${final4Picks.size}/${PICKS_PER_ROUND.FINAL4} selected.`}
          />
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {final4Options.map((t) => {
              const selected = final4Picks.has(t.code);
              const full     = final4Picks.size >= PICKS_PER_ROUND.FINAL4;
              const disabled = locked || (!selected && full);
              return (
                <TeamButton
                  key={t.code}
                  team={t}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => toggleFinal4(t.code)}
                  showGroup={false}
                />
              );
            })}
          </div>

          {!semifinalUnlocked && (
            <p className="mt-3 text-sm text-neutral-500">
              Pick all 4 Final 4 teams to unlock the Semi-Final section. ({final4Picks.size}/4 done)
            </p>
          )}
        </section>
      )}

      {/* ── Semi-Final (unlocks after all 4 Final 4 picks) ── */}
      {semifinalUnlocked && (
        <section>
          <SectionHeader
            title={SEMIFINAL_META.label}
            subtitle={`Pick the 2 finalists from your Final 4. (${SEMIFINAL_META.points} pts each) — ${semifinalPicks.size}/${PICKS_PER_ROUND.SEMIFINAL} selected.`}
          />
          <div className="grid gap-2 grid-cols-2">
            {semifinalOptions.map((t) => {
              const selected = semifinalPicks.has(t.code);
              const full     = semifinalPicks.size >= PICKS_PER_ROUND.SEMIFINAL;
              const disabled = locked || (!selected && full);
              return (
                <TeamButton
                  key={t.code}
                  team={t}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => toggleSemifinal(t.code)}
                  showGroup={false}
                />
              );
            })}
          </div>

          {!winnerUnlocked && (
            <p className="mt-3 text-sm text-neutral-500">
              Pick both finalists to unlock the Winner section. ({semifinalPicks.size}/2 done)
            </p>
          )}
        </section>
      )}

      {/* ── Winner (unlocks after both Semi-Final picks) ── */}
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
                <TeamButton
                  key={t.code}
                  team={t}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => toggleWinner(t.code)}
                  showGroup={false}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Fixed footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3 bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-2">

          <div className="flex flex-wrap items-center gap-2">
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

// ── Shared team toggle button ─────────────────────────────────────────────────
function TeamButton({
  team, selected, disabled, onClick, showGroup = true,
}: {
  team: TeamLite;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  showGroup?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      <span className="font-medium">{team.name}</span>
      {showGroup && <span className="block text-xs text-neutral-500">Group {team.group}</span>}
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p>
    </div>
  );
}

// ── Live countdown to the pick deadline (PICKS_LOCK_AT) ─────────────────────────
// Renders nothing until mounted to avoid a server/client hydration mismatch.
function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span aria-hidden>…</span>;

  const ms = PICKS_LOCK_AT.getTime() - now;
  if (ms <= 0) return <span>Closed</span>;

  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span>
      {days > 0 && `${days}d `}
      {pad(hours)}:{pad(mins)}:{pad(secs)}
    </span>
  );
}
