// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CollecteFull } from "@/types";
import { RecapTab } from "./RecapTab";

const { sendRecapSection } = vi.hoisted(() => ({ sendRecapSection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/store/collectes", () => ({
  useCollectes: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ sendRecapSection, closeRecapSection: vi.fn(), addNote: vi.fn() }),
}));

const collecte = {
  id: "c1",
  societeId: "s1",
  periode: "2026",
  statut: "brouillon",
  onglets: ["souche_cheques", "virements_recus"],
  devise: "TND",
  sections: [],
  lignes: [
    { id: "l1", onglet: "souche_cheques", ordre: 0, data: { date: "2026-01-06", num_cheque: "", beneficiaire: "X", motif: "", montant: 100, compte_bancaire: "ZITO" } },
  ],
  notes: [],
  fichiers: [],
} as unknown as CollecteFull;

afterEach(() => {
  cleanup();
  sendRecapSection.mockClear();
});

const rendre = (c = collecte) => render(<RecapTab collecte={c} canManageRecap isClient={false} onNavigate={vi.fn()} />);
const detailBoutons = () => screen.getAllByRole("button", { name: /Voir le détail de/ });

describe("Récap : détail d'un tableau avant l'envoi", () => {
  it("n'envoie plus directement : la ligne s'ouvre d'abord sur le détail des cases à compléter", () => {
    rendre();
    expect(screen.queryByRole("button", { name: /Envoyer/ })).toBeNull();
    fireEvent.click(detailBoutons()[0]);
    const detail = screen.getAllByRole("region", { name: /Détail de « État des chèques émis »/ })[0];
    expect(within(detail).getByText("Ligne 1")).toBeTruthy();
    expect(within(detail).getByText("N° Chèque")).toBeTruthy();
    expect(within(detail).getByText("Motif / Objet")).toBeTruthy();
    expect(within(detail).getByText(/Ce que le client devra compléter dans « État des chèques émis » \(3 cases\)/)).toBeTruthy();
  });

  it("envoie depuis le détail, avec le nombre de cases lues", async () => {
    rendre();
    fireEvent.click(detailBoutons()[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Envoyer ces 3 cases au client/ })[0]);
    await waitFor(() => expect(sendRecapSection).toHaveBeenCalledWith("c1", "souche_cheques", 3));
  });

  it("dit qu'un tableau sans ligne est à remplir en entier", () => {
    rendre();
    fireEvent.click(detailBoutons()[1]);
    expect(screen.getAllByText(/Aucune ligne n'est saisie dans ce tableau/).length).toBeGreaterThan(0);
  });

  it("ouvre et referme un seul détail à la fois", () => {
    rendre();
    fireEvent.click(detailBoutons()[0]);
    fireEvent.click(detailBoutons()[1]);
    const noms = new Set(screen.getAllByRole("region", { name: /Détail de/ }).map((r) => r.getAttribute("aria-label")));
    expect([...noms]).toEqual(["Détail de « Virements reçus »"]);
    fireEvent.click(screen.getAllByRole("button", { name: /Masquer le détail de/ })[0]);
    expect(screen.queryByRole("region", { name: /Détail de/ })).toBeNull();
  });
});
