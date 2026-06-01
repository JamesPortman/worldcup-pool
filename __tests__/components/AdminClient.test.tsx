import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminClient from "@/app/admin/AdminClient";

const teams = [
  { code: "MEX", name: "Mexico", group: "A", reachedRound: null, wonGroup: false, isChampion: false },
  { code: "KOR", name: "South Korea", group: "A", reachedRound: "FINAL4", wonGroup: true, isChampion: false },
  { code: "CAN", name: "Canada", group: "B", reachedRound: "SEMIFINAL", wonGroup: false, isChampion: true },
];
const pools = [{
  id: "p1", name: "Test Pool", joinCode: "ABC234", locked: false,
  players: [
    { id: "pl1", displayName: "Alice", pickCount: 19 },
    { id: "pl2", displayName: "Bob", pickCount: 0 },
  ],
}];

function mockFetch(ok: boolean, body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

// Returns different responses per URL (unlock vs delete).
function mockFetchByUrl(handler: (url: string) => { ok: boolean; body: unknown }) {
  const fn = vi.fn(async (url: string) => {
    const { ok, body } = handler(url);
    return { ok, json: async () => body };
  });
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

  it("removes a player via a two-step confirm", async () => {
    const fetchMock = mockFetchByUrl((url) => {
      if (url === "/api/admin/data") return { ok: true, body: { teams, pools } };
      if (url.startsWith("/api/admin/players/")) return { ok: true, body: { ok: true } };
      return { ok: false, body: {} };
    });
    render(<AdminClient />);
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // First "Remove" is Alice's (sorted first). One click arms the confirm.
    fireEvent.click(screen.getAllByRole("button", { name: /^remove$/i })[0]);
    const confirm = await screen.findByRole("button", { name: /confirm remove/i });

    // Confirming deletes Alice via the API and drops her from the list.
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByText("Alice")).toBeNull());
    expect(screen.getByText("Bob")).toBeInTheDocument(); // others untouched
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/players/pl1",
      expect.objectContaining({ method: "DELETE", headers: { "x-admin-token": "secret" } }),
    );
  });
});
