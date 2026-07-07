"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ROUNDS, type RoundKey } from "@/data/worldcup2026";

export interface LeaderboardRow {
  id: string;
  name: string;
  total: number;
  byRound: Record<string, number>;
  final4Teams: { code: string; name: string }[];
  semifinalCodes: string[];
  winnerCode: string | null;
  winPct: number | null;
}

type SortKey = "total" | "winPct";

// "12.3%", "<0.1%", or "—" when the model has no live bracket to work from.
function formatPct(v: number | null): string {
  if (v === null) return "—";
  if (v > 0 && v < 0.1) return "<0.1%";
  return `${v.toFixed(1)}%`;
}

export default function LeaderboardClient({
  rows,
  poolCode,
  showWin,
}: {
  rows: LeaderboardRow[];
  poolCode: string;
  showWin: boolean;
}) {
  // Default order matches the old server-sorted view: Total, high → low.
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  }

  const sorted = useMemo(() => {
    const value = (r: LeaderboardRow) => (sortKey === "winPct" ? r.winPct : r.total);
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1; // rows without a value always sort last
      if (bv == null) return -1;
      return (dir === "desc" ? bv - av : av - bv) || a.name.localeCompare(b.name);
    });
  }, [rows, sortKey, dir]);

  const arrow = (key: SortKey) => (sortKey === key ? (dir === "desc" ? " ▼" : " ▲") : "");

  // A render helper (not a nested component) so the header elements stay stable
  // across re-renders instead of remounting on every sort change.
  const sortHeader = (k: SortKey, label: string) => (
    <th
      className="py-2 px-2 text-right whitespace-nowrap font-semibold"
      aria-sort={sortKey === k ? (dir === "desc" ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => toggleSort(k)}
        title={`Sort by ${label}`}
        className={`hover:underline ${sortKey === k ? "text-[color:var(--color-brand)]" : ""}`}
      >
        {label}
        <span aria-hidden>{arrow(k)}</span>
      </button>
    </th>
  );

  return (
    <div className="mt-6 overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm min-w-[360px]">
        <thead>
          <tr className="text-left border-b border-neutral-300 dark:border-neutral-700">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Player</th>
            {sortHeader("total", "Total")}
            {showWin && sortHeader("winPct", "Win %")}
            {ROUNDS.map((r) => (
              <th key={r.key} className="py-2 px-2 text-right whitespace-nowrap">
                {r.key === "GROUP" ? "Group Wins" : r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td className="py-4 text-neutral-500" colSpan={ROUNDS.length + 3 + (showWin ? 1 : 0)}>
                No players yet.
              </td>
            </tr>
          )}
          {sorted.map((row, idx) => (
            <tr
              key={row.id}
              className={`border-b border-neutral-200 dark:border-neutral-800 ${
                idx < 3 ? "bg-yellow-100 dark:bg-yellow-900/30" : ""
              }`}
            >
              <td className="py-2 pr-3 text-neutral-500 align-top">{idx + 1}</td>

              {/* Player name + Final 4 picks summary */}
              <td className="py-2 pr-3 align-top">
                <Link
                  href={`/pools/${poolCode}/picks?player=${row.id}`}
                  className="font-medium hover:underline text-[color:var(--color-brand)]"
                >
                  {row.name}
                </Link>

                {row.final4Teams.length > 0 && (
                  <div className="text-xs mt-0.5 text-neutral-500 leading-relaxed">
                    [
                    {row.final4Teams.map((t, i) => (
                      <span key={t.code}>
                        {i > 0 && ", "}
                        {row.winnerCode === t.code ? (
                          <strong className="text-red-600 dark:text-red-400">{t.name}</strong>
                        ) : row.semifinalCodes.includes(t.code) ? (
                          <strong className="text-neutral-700 dark:text-neutral-300">{t.name}</strong>
                        ) : (
                          t.name
                        )}
                      </span>
                    ))}
                    ]
                  </div>
                )}
              </td>

              <td className="py-2 px-2 text-right font-semibold tabular-nums align-top">{row.total}</td>
              {showWin && (
                <td className="py-2 px-2 text-right tabular-nums align-top font-medium text-[color:var(--color-brand)]">
                  {formatPct(row.winPct)}
                </td>
              )}

              {ROUNDS.map((r) => (
                <td key={r.key} className="py-2 px-2 text-right tabular-nums align-top">
                  {row.byRound[r.key as RoundKey]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
