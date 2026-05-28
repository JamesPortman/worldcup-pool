"use client";

import { useState } from "react";
import { ROUNDS } from "@/data/worldcup2026";

interface TeamRow {
  code: string;
  name: string;
  group: string;
  reachedRound: string | null;
  wonGroup: boolean;
  isChampion: boolean;
}
interface PoolRow { id: string; name: string; joinCode: string; locked: boolean; }

export default function AdminClient({
  teams: initialTeams,
  pools: initialPools,
}: {
  teams: TeamRow[];
  pools: PoolRow[];
}) {
  const [token, setToken] = useState("");
  const [teams, setTeams] = useState(initialTeams);
  const [pools, setPools] = useState(initialPools);
  const [msg, setMsg] = useState<string | null>(null);

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
    setMsg(`Updated ${code}.`);
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

  return (
    <div className="space-y-8">
      <div>
        <label className="block text-sm mb-1">Admin token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste ADMIN_TOKEN"
          className="w-full max-w-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
        />
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-2">Pools</h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-800">
          {pools.map((p) => (
            <li key={p.id} className="px-3 py-2 flex items-center justify-between text-sm">
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
            </li>
          ))}
          {pools.length === 0 && <li className="px-3 py-2 text-neutral-500 text-sm">No pools yet.</li>}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Teams</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          As each round resolves, set each surviving team&apos;s &ldquo;reached round&rdquo; to that round.
          Check &ldquo;won group&rdquo; for the 12 group winners and &ldquo;champion&rdquo; for the winner of the final.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-neutral-300 dark:border-neutral-700">
                <th className="py-2 pr-3">Team</th>
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3">Reached round</th>
                <th className="py-2 pr-3">Won group?</th>
                <th className="py-2 pr-3">Champion?</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.code} className="border-b border-neutral-200 dark:border-neutral-800">
                  <td className="py-1.5 pr-3 font-medium">{t.name}</td>
                  <td className="py-1.5 pr-3">{t.group}</td>
                  <td className="py-1.5 pr-3">
                    <select
                      value={t.reachedRound ?? ""}
                      onChange={(e) =>
                        updateTeam(t.code, { reachedRound: e.target.value || null })
                      }
                      className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1"
                    >
                      <option value="">— none —</option>
                      {ROUNDS.map((r) => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      checked={t.wonGroup}
                      onChange={(e) => updateTeam(t.code, { wonGroup: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      type="checkbox"
                      checked={t.isChampion}
                      onChange={(e) => updateTeam(t.code, { isChampion: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {msg && <p className="text-sm text-neutral-700 dark:text-neutral-300">{msg}</p>}
    </div>
  );
}

