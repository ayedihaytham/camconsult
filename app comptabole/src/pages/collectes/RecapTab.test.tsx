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
    const detail = screen.getAllByRole("region", { name: /Détail de « Souche de chèques »/ })[0];
    expect(within(detail).getByText("Ligne 1")).toBeTruthy();
    expect(within(detail).getByText("N° Chèque")).toBeTruthy();
    expect(within(detail).getByText("Motif / Objet")).toBeTruthy();
    expect(within(detail).getByText(/Ce que le client devra compléter dans « Souche de chèques » \(3 cases\)/)).toBeTruthy();
  });

  it("envoie depuis le détail, avec le nombre de cases lues", async () => {
    rendre();
    fireEvent.click(detailBoutons()[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /Envoyer ces 3 cases au client/ })[0]);
    await waitFor(() => expect(sendRecapSection).toHaveBeenCalledWith("c1", "souche_cheques", 3));
  });

  it("ne liste pas un tableau vide : le cabinet n'envoie que le nécessaire", () => {
    rendre();
    // Seul « Souche de chèques » a des lignes ; « Virements reçus » est vide.
    expect(screen.queryAllByText("Virements reçus")).toHaveLength(0);
    expect(screen.getAllByText("Souche de chèques").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 tableau vide non listé/)).toBeTruthy();
    expect(screen.getByText(/3 cases importantes à compléter, réparties sur 1 tableau/)).toBeTruthy();
  });

  it("garde un tableau vide dont une demande a déjà été envoyée, pour pouvoir la clore", () => {
    const envoye = { ...collecte, sections: [{ onglet: "virements_recus", recapStatut: "envoye" }] } as unknown as CollecteFull;
    rendre(envoye);
    expect(screen.getAllByText("Virements reçus").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Clore/ }).length).toBeGreaterThan(0);
  });

  it("dit qu'il n'y a rien à envoyer quand tous les tableaux sont vides", () => {
    rendre({ ...collecte, lignes: [] } as unknown as CollecteFull);
    expect(screen.getByText("Aucun tableau à envoyer pour le moment.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Voir le détail/ })).toBeNull();
  });

  it("ouvre et referme un seul détail à la fois", () => {
    const deux = {
      ...collecte,
      lignes: [...collecte.lignes, { id: "l9", onglet: "virements_recus", ordre: 0, data: { date: "2026-01-06", emetteur: "", reference: "", montant: 5, compte_bancaire: "" } }],
    } as unknown as CollecteFull;
    rendre(deux);
    fireEvent.click(detailBoutons()[0]);
    fireEvent.click(detailBoutons()[1]);
    const noms = new Set(screen.getAllByRole("region", { name: /Détail de/ }).map((r) => r.getAttribute("aria-label")));
    expect([...noms]).toEqual(["Détail de « Virements reçus »"]);
    fireEvent.click(screen.getAllByRole("button", { name: /Masquer le détail de/ })[0]);
    expect(screen.queryByRole("region", { name: /Détail de/ })).toBeNull();
  });
});
