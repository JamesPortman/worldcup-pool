"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUNDS, PICKS_PER_ROUND, groups, type RoundKey } from "@/data/worldcup2026";

interface TeamLite { code: string; name: string; group: string; }
interface ExistingPick { round: string; teamCode: string; groupId: string | null; }

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
  const byCode = useMemo(() => Object.fromEntries(teams.map((t) => [t.code, t])), [teams]);
  const teamsByGroup = useMemo(() => {
    const m: Record<string, TeamLite[]> = {};
    for (const t of teams) (m[t.group] ??= []).push(t);
    return m;
  }, [teams]);

  // GROUP picks keyed by groupId → teamCode
  const initialGroupPicks: Record<string, string> = {};
  for (const p of existingPicks) if (p.round === "GROUP" && p.groupId) initialGroupPicks[p.groupId] = p.teamCode;
  const [groupPicks, setGroupPicks] = useState<Record<string, string>>(initialGroupPicks);

  // Non-group rounds: Set of selected team codes per round
  const initialRoundPicks: Record<Exclude<RoundKey, "GROUP">, Set<string>> = {
    FINAL4: new Set(), SEMIFINAL: new Set(), WINNER: new Set(),
  };
  for (const p of existingPicks) {
    if (p.round !== "GROUP" && p.round in initialRoundPicks) {
      initialRoundPicks[p.round as Exclude<RoundKey, "GROUP">].add(p.teamCode);
    }
  }
  const [roundPicks, setRoundPicks] = useState(initialRoundPicks);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleRoundPick(round: Exclude<RoundKey, "GROUP">, code: string) {
    if (locked) return;
    setRoundPicks((prev) => {
      const next = { ...prev };
      const set = new Set(next[round]);
      if (set.has(code)) set.delete(code);
      else {
        if (set.size >= PICKS_PER_ROUND[round]) return prev;
        set.add(code);
      }
      next[round] = set;
      return next;
    });
  }

  async function save() {
    if (locked) return;
    setSaving(true);
    setMsg(null);
    const picks: Array<{ round: string; teamCode: string; groupId?: string }> = [];
    for (const [groupId, teamCode] of Object.entries(groupPicks)) {
      if (teamCode) picks.push({ round: "GROUP", teamCode, groupId });
    }
    for (const round of ["FINAL4","SEMIFINAL","WINNER"] as const) {
      for (const code of roundPicks[round]) picks.push({ round, teamCode: code });
    }
    const res = await fetch(`/api/pools/${poolCode}/picks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ picks }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(data.error ?? "Save failed"); return; }
    setMsg(`Saved ${data.count} picks.`);
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-10">
      {/* Group winners */}
      <section>
        <SectionHeader title="Group winners" subtitle={`Pick the team you think wins each group. (${ROUNDS[0].points} point each)`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g} className="rounded-lg border border-neutral-300 dark:border-neutral-700 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Group {g}</div>
              <select
                disabled={locked}
                value={groupPicks[g] ?? ""}
                onChange={(e) => setGroupPicks({ ...groupPicks, [g]: e.target.value })}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5"
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

      {/* Knockout rounds */}
      {(["FINAL4", "SEMIFINAL", "WINNER"] as const).map((round) => {
        const meta = ROUNDS.find((r) => r.key === round)!;
        const limit = PICKS_PER_ROUND[round];
        const picked = roundPicks[round];
        const label =
          round === "WINNER"
            ? "Pick the tournament winner. (16 points)"
            : round === "SEMIFINAL"
            ? `Pick the 2 teams that reach the final. (${meta.points} points each)`
            : `Pick the 4 semi-finalists. (${meta.points} points each)`;
        return (
          <section key={round}>
            <SectionHeader
              title={meta.label}
              subtitle={`${label} — ${picked.size}/${limit} selected.`}
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => {
                const selected = picked.has(t.code);
                const disabled = locked || (!selected && picked.size >= limit);
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => toggleRoundPick(round, t.code)}
                    disabled={disabled}
                    className={[
                      "text-left rounded-md border px-3 py-2 text-sm",
                      selected
                        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/10"
                        : "border-neutral-300 dark:border-neutral-700",
                      disabled && !selected ? "opacity-40 cursor-not-allowed" : "hover:border-[color:var(--color-brand)]",
                    ].join(" ")}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-neutral-500">{t.group}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{msg ?? " "}</span>
        <button
          type="button"
          onClick={save}
          disabled={saving || locked}
          className="rounded-md bg-[color:var(--color-brand)] text-white px-5 py-2 font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : locked ? "Locked" : "Save picks"}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p>
    </div>
  );
}
