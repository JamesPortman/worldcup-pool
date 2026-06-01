"use client";

import { useMemo, useState } from "react";
import { groups } from "@/data/worldcup2026";

interface TeamRow {
  code: string;
  name: string;
  group: string;
  reachedRound: string | null;
  wonGroup: boolean;
  isChampion: boolean;
}
interface PlayerRow { id: string; displayName: string; pickCount: number; }
interface PoolRow { id: string; name: string; joinCode: string; locked: boolean; players: PlayerRow[]; }

// The four stages the admin can mark, in plain language. Each maps to the
// underlying scoring flags so the admin never has to think about reachedRound /
// isChampion or the cumulative model — picking "Champion" awards everything.
type Stage = "NONE" | "FINAL4" | "SEMIFINAL" | "CHAMPION";

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: "NONE", label: "Out / not yet" },
  { value: "FINAL4", label: "Final 4 (last 4)" },
  { value: "SEMIFINAL", label: "Final (last 2)" },
  { value: "CHAMPION", label: "Champion 🏆" },
];

function teamStage(t: TeamRow): Stage {
  if (t.isChampion) return "CHAMPION";
  if (t.reachedRound === "SEMIFINAL") return "SEMIFINAL";
  if (t.reachedRound === "FINAL4") return "FINAL4";
  return "NONE";
}

// What to persist for each stage. The champion is also a finalist, so it gets
// reachedRound = SEMIFINAL; cumulative scoring then awards Final-4 + Final +
// Winner automatically.
function stagePatch(stage: Stage): Pick<TeamRow, "reachedRound" | "isChampion"> {
  switch (stage) {
    case "FINAL4": return { reachedRound: "FINAL4", isChampion: false };
    case "SEMIFINAL": return { reachedRound: "SEMIFINAL", isChampion: false };
    case "CHAMPION": return { reachedRound: "SEMIFINAL", isChampion: true };
    default: return { reachedRound: null, isChampion: false };
  }
}

export default function AdminClient() {
  const [token, setToken] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Teams bucketed by group, alphabetical within each — matches the picks UI.
  const teamsByGroup = useMemo(() => {
    const map = new Map<string, TeamRow[]>();
    for (const t of teams) {
      const arr = map.get(t.group) ?? [];
      arr.push(t);
      map.set(t.group, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [teams]);

  // Verify the token by loading admin data; nothing sensitive renders until this
  // succeeds. The same token is then reused for every write below.
  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Invalid admin token.");
        return;
      }
      setTeams(data.teams);
      setPools(data.pools);
      setUnlocked(true);
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTeam(code: string, patch: Partial<TeamRow>) {
    setMsg(null);
    const res = await fetch("/api/admin/results", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ kind: "team", code, patch }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? "Update failed"); return; }
    setTeams((prev) => prev.map((t) => (t.code === code ? { ...t, ...patch } : t)));
    const name = teams.find((t) => t.code === code)?.name ?? code;
    setMsg(`Saved ${name}.`);
  }

  async function togglePoolLock(id: string, locked: boolean) {
    setMsg(null);
    const res = await fetch("/api/admin/results", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ kind: "pool", id, patch: { locked } }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? "Update failed"); return; }
    setPools((prev) => prev.map((p) => (p.id === id ? { ...p, locked } : p)));
    setMsg(`${locked ? "Locked" : "Unlocked"} pool.`);
  }

  // Permanently removes a player and their picks (Pick cascades in the DB).
  async function deletePlayer(poolId: string, playerId: string, name: string) {
    setMsg(null);
    const res = await fetch(`/api/admin/players/${playerId}`, {
      method: "DELETE",
      headers: { "x-admin-token": token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.error ?? "Delete failed"); return; }
    setPools((prev) =>
      prev.map((p) =>
        p.id === poolId ? { ...p, players: p.players.filter((pl) => pl.id !== playerId) } : p,
      ),
    );
    setConfirmDelete(null);
    setMsg(`Removed ${name}.`);
  }

  // ── Locked: only the token prompt is shown (no pool/team data) ─────────────
  if (!unlocked) {
    return (
      <form onSubmit={unlock} className="max-w-sm space-y-3">
        <label className="block text-sm" htmlFor="admin-token">Admin token</label>
        <input
          id="admin-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste ADMIN_TOKEN"
          autoComplete="off"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy || !token}
          className="rounded-md bg-[color:var(--color-brand)] text-white px-4 py-2 font-medium disabled:opacity-50"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        {msg && <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>}
      </form>
    );
  }

  // ── Unlocked: full admin dashboard ─────────────────────────────────────────
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-2">Pools</h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-800">
          {pools.map((p) => (
            <li key={p.id} className="px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{p.name}</span>{" "}
                  <span className="font-mono text-neutral-500">[{p.joinCode}]</span>
                </span>
                <button
                  onClick={() => togglePoolLock(p.id, !p.locked)}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {p.locked ? "Unlock picks" : "Lock picks"}
                </button>
              </div>

              {p.players.length > 0 ? (
                <ul className="mt-2 ml-1 space-y-1">
                  {p.players.map((pl) => (
                    <li key={pl.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {pl.displayName}{" "}
                        <span className="text-neutral-400">· {pl.pickCount} picks</span>
                      </span>
                      {confirmDelete === pl.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => deletePlayer(p.id, pl.id, pl.displayName)}
                            className="rounded border border-red-600 bg-red-600 text-white px-2 py-0.5"
                          >
                            Confirm remove
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-0.5"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(pl.id)}
                          className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 ml-1 text-xs text-neutral-400">No players yet.</p>
              )}
            </li>
          ))}
          {pools.length === 0 && <li className="px-3 py-2 text-neutral-500 text-sm">No pools yet.</li>}
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          Picks also lock automatically at the end of June 10, 2026 (the day before kickoff).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Results</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          After the group stage, mark the <strong>group winner</strong> in each group.
          As the knockout rounds resolve, set <strong>how far each team got</strong> — pick
          the team&apos;s furthest stage and the app awards all earlier-round points for you.
          Only one team should be <strong>Champion</strong>. Changes save instantly.
        </p>

        <div className="space-y-6">
          {groups
            .filter((g) => (teamsByGroup.get(g)?.length ?? 0) > 0)
            .map((g) => (
              <div key={g}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                  Group {g}
                </h3>
                <ul className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
                  {teamsByGroup.get(g)!.map((t) => (
                    <li
                      key={t.code}
                      className="px-3 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                    >
                      <span className="font-medium">{t.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={t.wonGroup}
                          onClick={() => updateTeam(t.code, { wonGroup: !t.wonGroup })}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            t.wonGroup
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {t.wonGroup ? "✓ Group winner" : "Group winner"}
                        </button>
                        <label className="sr-only" htmlFor={`stage-${t.code}`}>
                          {t.name} stage reached
                        </label>
                        <select
                          id={`stage-${t.code}`}
                          value={teamStage(t)}
                          onChange={(e) => updateTeam(t.code, stagePatch(e.target.value as Stage))}
                          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm"
                        >
                          {STAGE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </section>

      {msg && <p className="text-sm text-neutral-700 dark:text-neutral-300">{msg}</p>}
    </div>
  );
}
