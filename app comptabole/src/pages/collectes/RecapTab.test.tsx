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

  it("permet d'afficher les tableaux vides pour les envoyer au client, puis de les masquer", () => {
    rendre();
    expect(screen.queryAllByText("Virements reçus")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Afficher pour les envoyer" }));
    expect(screen.getAllByText("Virements reçus").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 tableau vide affiché : envoyez-le/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Masquer les tableaux vides" }));
    expect(screen.queryAllByText("Virements reçus")).toHaveLength(0);
  });

  it("garde un tableau vide dont une demande a déjà été envoyée, pour pouvoir la clore", () => {
    const envoye = { ...collecte, sections: [{ onglet: "virements_recus", recapStatut: "envoye" }] } as unknown as CollecteFull;
    rendre(envoye);
    expect(screen.getAllByText("Virements reçus").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Clore/ }).length).toBeGreaterThan(0);
  });

  it("opens the exact requested field for the client", () => {
    const requested = {
      ...collecte,
      statut: "valide",
      onglets: ["souche_cheques"],
      sections: [{ onglet: "souche_cheques", statut: "valide", recapStatut: "envoye" }],
    } as unknown as CollecteFull;
    const onNavigate = vi.fn();
    render(<RecapTab collecte={requested} canManageRecap={false} isClient onNavigate={onNavigate} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Aller à Ligne 1 · N° Chèque/ })[0]);
    expect(onNavigate).toHaveBeenCalledWith("souche_cheques", { ordre: 0, col: "num_cheque" });
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

describe("Récap : bordereaux à compléter", () => {
  it("signale au cabinet un bordereau dont le montant n'est pas atteint ou est dépassé", () => {
    const ligne = (ordre: number, data: Record<string, unknown>) => ({ id: `b${ordre}`, onglet: "bordereaux_remise_cheques", ordre, data });
    const base = { date_remise: "2026-10-10", num_bordereau: "3339", banque: "BIAT", num_cheque: "1", client_emetteur: "X", date_echeance: "2026-11-01", observations: "ok" };
    const c = {
      ...collecte,
      onglets: ["bordereaux_remise_cheques"],
      lignes: [ligne(0, { ...base, montant: 6660, montant_cheque: 40000 })],
    } as unknown as CollecteFull;
    rendre(c);
    expect(screen.getAllByText(/Bordereau 3339 : dépassé de 33\s340,000 TND/).length).toBeGreaterThan(0);
    cleanup();
    rendre({ ...c, lignes: [ligne(0, { ...base, montant: 6660, montant_cheque: 1000 })] } as unknown as CollecteFull);
    expect(screen.getAllByText(/Bordereau 3339 : il reste 5\s660,000 TND à répartir/).length).toBeGreaterThan(0);
  });

  it("ne dit rien d'un bordereau complet", () => {
    const ligne = { id: "b0", onglet: "bordereaux_remise_cheques", ordre: 0, data: { date_remise: "2026-10-10", num_bordereau: "1", montant: 100, montant_cheque: 100 } };
    rendre({ ...collecte, onglets: ["bordereaux_remise_cheques"], lignes: [ligne] } as unknown as CollecteFull);
    expect(screen.queryByText(/il reste|dépassé/)).toBeNull();
  });
});
