import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

    // Each pool links to its leaderboard (new tab, so the admin session is kept).
    const leaderboard = screen.getByRole("link", { name: /leaderboard/i });
    expect(leaderboard).toHaveAttribute("href", "/pools/ABC234/leaderboard");
    expect(leaderboard).toHaveAttribute("target", "_blank");
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

describe("AdminClient — fetch & apply results", () => {
  // Unlock the dashboard, then return the per-URL fetch mock for assertions.
  function unlockWith(handler: (url: string) => { ok: boolean; body: unknown }) {
    const fetchMock = mockFetchByUrl(handler);
    render(<AdminClient />);
    fireEvent.change(screen.getByLabelText(/admin token/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));
    return fetchMock;
  }

  it("fetches results, shows the proposed diff, and only writes on Apply", async () => {
    // MEX is stored with no result; the API proposes it as a group winner — a real change.
    const proposed = [{ code: "MEX", name: "Mexico", wonGroup: true, reachedRound: null, isChampion: false }];
    const fetchMock = unlockWith((url) => {
      if (url === "/api/admin/data") return { ok: true, body: { teams, pools } };
      if (url === "/api/admin/fetch-results") return { ok: true, body: { proposed, unmapped: [] } };
      if (url === "/api/admin/results") return { ok: true, body: { ok: true } };
      return { ok: false, body: {} };
    });

    fireEvent.click(await screen.findByRole("button", { name: /fetch latest results/i }));

    // The review panel stages the single change for confirmation.
    const heading = await screen.findByText(/1 change to apply/i);
    const panel = heading.closest("div")!;
    expect(within(panel).getByText("Mexico")).toBeInTheDocument();
    expect(within(panel).getByText(/group winner/i)).toBeInTheDocument();

    // Human-in-the-loop: nothing is written until the admin confirms.
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/results", expect.anything());

    fireEvent.click(screen.getByRole("button", { name: /apply 1 change/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/results",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-admin-token": "secret" }),
        }),
      ),
    );
    expect(await screen.findByText(/applied 1 result update/i)).toBeInTheDocument();
  });

  it("reports nothing-to-update when the API matches, and warns about unmapped teams", async () => {
    // KOR is already stored as wonGroup + FINAL4, so this proposal is a no-op diff.
    const proposed = [{ code: "KOR", name: "South Korea", wonGroup: true, reachedRound: "FINAL4", isChampion: false }];
    const fetchMock = unlockWith((url) => {
      if (url === "/api/admin/data") return { ok: true, body: { teams, pools } };
      if (url === "/api/admin/fetch-results") return { ok: true, body: { proposed, unmapped: ["Wakanda"] } };
      return { ok: false, body: {} };
    });

    fireEvent.click(await screen.findByRole("button", { name: /fetch latest results/i }));

    expect(await screen.findByText(/nothing to update/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^apply/i })).toBeNull(); // no write offered
    expect(screen.getByText(/couldn't match 1 team/i)).toBeInTheDocument();
    expect(screen.getByText(/Wakanda/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/results", expect.anything());
  });
});
