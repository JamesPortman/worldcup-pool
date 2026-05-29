"use client";

import { useEffect, useState } from "react";

// Theme is stored in localStorage("theme") = "dark" | "light".
// We toggle the `dark` class on <html> so Tailwind v4's `@variant dark` rule applies.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as
      | "light"
      | "dark"
      | null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored ?? (prefersDark ? "dark" : "light");
    // Intentional one-time init from client-only state (localStorage / media
    // query) after mount — needed for hydration safety, not a cascading-render bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      {theme === "dark" ? "Day" : "Night"} mode
    </button>
  );
}
