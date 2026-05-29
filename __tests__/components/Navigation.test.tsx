import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Navigation from "@/components/Navigation";

// Navigation calls usePathname() to highlight the active link; stub it so the
// component renders outside Next's router context.
const { mockPathname } = vi.hoisted(() => ({ mockPathname: vi.fn(() => "/") }));
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));

beforeEach(() => {
  mockPathname.mockReturnValue("/");
});

describe("Navigation", () => {
  it("links to How it works and Architecture when no pool is set", () => {
    render(<Navigation />);

    expect(screen.getByRole("link", { name: /how it works/i })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: /architecture/i })).toHaveAttribute(
      "href",
      "/architecture",
    );
  });

  it("does not show pool-specific links without a pool code", () => {
    render(<Navigation />);
    expect(screen.queryByRole("link", { name: /^picks$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /leaderboard/i })).toBeNull();
  });

  it("carries the pool code through every nav link", () => {
    render(<Navigation poolCode="ABC234" />);

    expect(screen.getByRole("link", { name: /^pool$/i })).toHaveAttribute(
      "href",
      "/pools/ABC234",
    );
    expect(screen.getByRole("link", { name: /^picks$/i })).toHaveAttribute(
      "href",
      "/pools/ABC234/picks",
    );
    expect(screen.getByRole("link", { name: /leaderboard/i })).toHaveAttribute(
      "href",
      "/pools/ABC234/leaderboard",
    );
    expect(screen.getByRole("link", { name: /how it works/i })).toHaveAttribute(
      "href",
      "/how-it-works?pool=ABC234",
    );
    expect(screen.getByRole("link", { name: /architecture/i })).toHaveAttribute(
      "href",
      "/architecture?pool=ABC234",
    );
  });

  it("marks the current page's link as active", () => {
    mockPathname.mockReturnValue("/pools/ABC234/picks");
    render(<Navigation poolCode="ABC234" />);

    expect(screen.getByRole("link", { name: /^picks$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /^pool$/i })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /leaderboard/i })).not.toHaveAttribute("aria-current");
  });
});
