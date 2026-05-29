import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminClient from "@/app/admin/AdminClient";

const teams = [
  { code: "MEX", name: "Mexico", group: "A", reachedRound: null, wonGroup: false, isChampion: false },
  { code: "KOR", name: "South Korea", group: "A", reachedRound: "FINAL4", wonGroup: true, isChampion: false },
  { code: "CAN", name: "Canada", group: "B", reachedRound: "SEMIFINAL", wonGroup: false, isChampion: true },
];
const pools = [{ id: "p1", name: "Test Pool", joinCode: "ABC234", locked: false }];

function mockFetch(ok: boolean, body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdminClient — token gate", () => {
  it("shows only the token prompt and no sensitive data before unlocking", () => {
    render(<AdminClient />);
    expect(screen.getByLabelText(/admin token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();

    // Nothing sensitive is rendered until the token is verified.
    expect(screen.queryByText("Group A")).toBeNull();
    expect(screen.queryByText("Mexico")).toBeNull();
    expect(screen.queryByText(/ABC234/)).toBeNull();
  });

  it("verifies the token against /api/admin/data before revealing anything", () => {
    const fetchMock = mockFetch(true, { teams, pools });
    render(<AdminClient />);
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/data",
      expect.objectContaining({
        method: "POST",
        headers: { "x-admin-token": "secret" },
      }),
    );
  });

  it("reveals pools and grouped results after a successful unlock", async () => {
    mockFetch(true, { teams, pools });
    render(<AdminClient />);
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText("Group A")).toBeInTheDocument();
    expect(screen.getByText("Group B")).toBeInTheDocument();
    expect(screen.getByText("Mexico")).toBeInTheDocument();
    expect(screen.getByText("Canada")).toBeInTheDocument();
    expect(screen.getByText(/ABC234/)).toBeInTheDocument(); // pool join code now visible
    expect(screen.getAllByRole("option", { name: /Final 4 \(last 4\)/ }).length).toBeGreaterThan(0);
  });

  it("shows an error and stays locked on an invalid token", async () => {
    mockFetch(false, { error: "Invalid admin token." });
    render(<AdminClient />);
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText(/invalid admin token/i)).toBeInTheDocument();
    expect(screen.queryByText("Group A")).toBeNull();
    expect(screen.queryByText(/ABC234/)).toBeNull();
  });
});
