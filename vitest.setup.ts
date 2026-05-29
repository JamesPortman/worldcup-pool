import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React 19 + @testing-library: unmount rendered trees between tests so DOM
// assertions don't leak across test cases.
afterEach(() => {
  cleanup();
});

// ── jsdom polyfills ─────────────────────────────────────────────────────────
// Under Node 22+ the experimental global `localStorage` is disabled (and
// shadows jsdom's), and `window.matchMedia` isn't implemented. Components like
// ThemeToggle touch both on mount, so provide minimal stand-ins.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
