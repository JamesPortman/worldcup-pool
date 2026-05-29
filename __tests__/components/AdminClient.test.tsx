import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminClient from "@/app/admin/AdminClient";

const teams = [
  { code: "MEX", name: "Mexico", group: "A", reachedRound: null, wonGroup: false, isChampion: false },
  { code: "KOR", name: "South Korea", group: "A", reachedRound: "FINAL4", wonGroup: true, isChampion: false },
  { code: "CAN", name: "Canada", group: "B", reachedRound: "SEMIFINAL", wonGroup: false, isChampion: true },
];

describe("AdminClient — simplified results entry", () => {
  it("buckets teams under their group headings", () => {
    render(<AdminClient teams={teams} pools={[]} />);
    expect(screen.getByText("Group A")).toBeInTheDocument();
    expect(screen.getByText("Group B")).toBeInTheDocument();
    expect(screen.getByText("Mexico")).toBeInTheDocument();
    expect(screen.getByText("South Korea")).toBeInTheDocument();
    expect(screen.getByText("Canada")).toBeInTheDocument();
  });

  it("offers plain-language stage options instead of raw round keys", () => {
    render(<AdminClient teams={teams} pools={[]} />);
    expect(screen.getAllByRole("option", { name: /Final 4 \(last 4\)/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: /Final \(last 2\)/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("option", { name: /Champion/ }).length).toBeGreaterThan(0);
  });

  it("reflects a champion via the single stage selector", () => {
    render(<AdminClient teams={teams} pools={[]} />);
    const canadaStage = screen.getByLabelText("Canada stage reached") as HTMLSelectElement;
    expect(canadaStage.value).toBe("CHAMPION");
  });

  it("shows the group-winner toggle as pressed for the marked winner", () => {
    render(<AdminClient teams={teams} pools={[]} />);
    // South Korea won its group → the toggle reads as confirmed.
    expect(screen.getByRole("button", { name: /✓ Group winner/ })).toBeInTheDocument();
  });
});
