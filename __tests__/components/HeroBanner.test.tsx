import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HeroBanner from "@/components/HeroBanner";

describe("HeroBanner", () => {
  it("renders the tournament title", () => {
    render(<HeroBanner />);
    expect(
      screen.getByRole("heading", { name: /2026 FIFA World Cup Pool/i }),
    ).toBeInTheDocument();
  });

  it("names the three host nations and the dates", () => {
    render(<HeroBanner />);
    expect(screen.getByText(/USA/)).toBeInTheDocument();
    expect(screen.getByText(/Mexico/)).toBeInTheDocument();
    expect(screen.getByText(/Canada/)).toBeInTheDocument();
    expect(screen.getByText(/June 11/)).toBeInTheDocument();
  });
});
