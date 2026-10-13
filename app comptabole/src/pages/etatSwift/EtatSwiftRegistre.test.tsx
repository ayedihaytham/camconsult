// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EtatSwiftRegistre } from "./EtatSwiftRegistre";

vi.mock("@/store/data", () => ({
  useData: (sel: (s: { hydrated: boolean }) => unknown) => sel({ hydrated: true }),
  useSocietes: () => [
    { id: "s1", raisonSociale: "05-I CARGO LINE", theme: "PME", rne: "1778030H", code: "CLI-0001" },
    { id: "s2", raisonSociale: "07-MS TRANSPORT", theme: "PME", rne: "1797090C", code: "CLI-0002" },
    { id: "s3", raisonSociale: "CAM", theme: "PME", rne: "311221M", code: "CLI-0003" },
  ],
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canSeeSociete: () => true }) }));
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue([
      { societeId: "s1", virements: 2, montant: 85975, justifies: 0, enCours: 0, aJustifier: 2, dernierVirement: "2026-10-02" },
      { societeId: "s3", virements: 2, montant: 16000, justifies: 1, enCours: 1, aJustifier: 0, dernierVirement: "2026-10-12" },
      { societeId: "s2", virements: 1, montant: 118420.5, justifies: 1, enCours: 0, aJustifier: 0, dernierVirement: "2026-09-12" },
    ]),
  },
}));

afterEach(cleanup);

describe("EtatSwiftRegistre", () => {
  it("trie par urgence, filtre par état et recherche une société", async () => {
    render(
      <MemoryRouter>
        <EtatSwiftRegistre />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("85 975,000")).toBeTruthy());
    const noms = screen.getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(noms[0]).toContain("05-I CARGO LINE");
    expect(noms[1]).toContain("CAM");
    expect(noms[2]).toContain("07-MS TRANSPORT");
    fireEvent.click(screen.getByRole("button", { name: /Tout justifié/ }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Toutes/ }));
    fireEvent.change(screen.getByLabelText("Rechercher une société"), { target: { value: "cam" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});
