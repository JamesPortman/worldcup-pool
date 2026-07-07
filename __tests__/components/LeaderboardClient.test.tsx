import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import LeaderboardClient, { type LeaderboardRow } from "@/app/pools/[code]/leaderboard/LeaderboardClient";

const rows: LeaderboardRow[] = [
  { id: "a", name: "Alice", total: 10, byRound: { GROUP: 10, FINAL4: 0, SEMIFINAL: 0, WINNER: 0 },
    final4Teams: [], semifinalCodes: [], winnerCode: null, winPct: 20 },
  { id: "b", name: "Bob", total: 5, byRound: { GROUP: 5, FINAL4: 0, SEMIFINAL: 0, WINNER: 0 },
    final4Teams: [], semifinalCodes: [], winnerCode: null, winPct: 80 },
];

// Player display order = order of the name links in the table body.
function order(): string[] {
  const table = screen.getByRole("table");
  return within(table).getAllByRole("link").map((el) => el.textContent ?? "");
}

describe("LeaderboardClient sorting", () => {
  it("defaults to Total, highest first", () => {
    render(<LeaderboardClient rows={rows} poolCode="ABC234" showWin />);
    expect(order()).toEqual(["Alice", "Bob"]); // 10 > 5
  });

  it("re-sorts by Win % when that header is clicked", () => {
    render(<LeaderboardClient rows={rows} poolCode="ABC234" showWin />);
    fireEvent.click(screen.getByRole("button", { name: /win %/i }));
    expect(order()).toEqual(["Bob", "Alice"]); // 80% > 20%
  });

  it("toggles direction on a second click of the active column", () => {
    render(<LeaderboardClient rows={rows} poolCode="ABC234" showWin />);
    const winBtn = screen.getByRole("button", { name: /win %/i });
    fireEvent.click(winBtn); // desc → Bob, Alice
    fireEvent.click(winBtn); // asc  → Alice, Bob
    expect(order()).toEqual(["Alice", "Bob"]);
  });

  it("hides the Win % control when showWin is false", () => {
    render(<LeaderboardClient rows={rows} poolCode="ABC234" showWin={false} />);
    expect(screen.queryByRole("button", { name: /win %/i })).toBeNull();
    expect(screen.getByRole("button", { name: /total/i })).toBeInTheDocument();
  });
});
