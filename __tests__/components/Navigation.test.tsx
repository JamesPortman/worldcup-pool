import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Navigation from "@/components/Navigation";

describe("Navigation", () => {
  it("links to How it works and Architecture when no pool is set", () => {
    render(<Navigation />);

    const howItWorks = screen.getByRole("link", { name: /how it works/i });
    expect(howItWorks).toHaveAttribute("href", "/how-it-works");

    const architecture = screen.getByRole("link", { name: /architecture/i });
    expect(architecture).toHaveAttribute("href", "/architecture");
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
});
