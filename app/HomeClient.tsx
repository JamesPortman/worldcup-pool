"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomeClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [poolName, setPoolName] = useState("");
  const [creatorName, setCreatorName] = useState("");

  // join form
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  async function createPool(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ poolName, displayName: creatorName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create pool");
      router.push(`/pools/${data.joinCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function joinPool(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`/api/pools/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: joinName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join pool");
      router.push(`/pools/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 p-1 mb-6">
        <button
          className={`px-4 py-1.5 text-sm rounded-md ${mode === "create" ? "bg-[color:var(--color-brand)] text-white" : ""}`}
          onClick={() => setMode("create")}
        >
          Create a pool
        </button>
        <button
          className={`px-4 py-1.5 text-sm rounded-md ${mode === "join" ? "bg-[color:var(--color-brand)] text-white" : ""}`}
          onClick={() => setMode("join")}
        >
          Join with code
        </button>
      </div>

      {mode === "create" ? (
        <form onSubmit={createPool} className="space-y-3 max-w-md">
          <Field label="Pool name" value={poolName} onChange={setPoolName} placeholder="Friday-night football crew" required />
          <Field label="Your display name" value={creatorName} onChange={setCreatorName} placeholder="James" required />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-[color:var(--color-brand)] text-white py-2 font-medium disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create pool"}
          </button>
        </form>
      ) : (
        <form onSubmit={joinPool} className="space-y-3 max-w-md">
          <Field label="Join code" value={joinCode} onChange={(v) => setJoinCode(v.toUpperCase())} placeholder="ABC234" required />
          <Field label="Your display name" value={joinName} onChange={setJoinName} placeholder="James" required />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-[color:var(--color-brand)] text-white py-2 font-medium disabled:opacity-60"
          >
            {busy ? "Joining…" : "Join pool"}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm mb-1 text-neutral-700 dark:text-neutral-300">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
      />
    </label>
  );
}
