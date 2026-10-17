// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CollecteChecklist } from "./CollecteChecklist";
import type { ChecklistRow } from "@/lib/collecte/checklist";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rows: ChecklistRow[] = [
  { onglet: "virements_recus", pieceLabel: "Détail des virements reçus", tabLabel: "Virements reçus", recu: true, recuAuto: true, statutLabel: "Reçu", circuitLabel: "À remplir", dateReception: "18/09/2026", dateSuivi: "2026-09-18", total: 4250, nbLignes: 1, commentaire: "Vérifié" },
  { onglet: "achats", pieceLabel: "Détail des achats", tabLabel: "Détail des achats", recu: false, recuAuto: false, statutLabel: "En attente", circuitLabel: "À remplir", dateReception: null, dateSuivi: null, total: null, nbLignes: 0, commentaire: "" },
  { onglet: "etat_caisse", pieceLabel: "État de caisse", tabLabel: "État de caisse", recu: true, recuAuto: false, statutLabel: "Reçu", circuitLabel: "À remplir", dateReception: "01/10/2026", dateSuivi: "2026-10-01", total: 80, nbLignes: 0, commentaire: "" },
];

function monter(props: Partial<React.ComponentProps<typeof CollecteChecklist>> = {}) {
  const onSaveSuivi = vi.fn().mockResolvedValue(undefined);
  const onMarkAll = vi.fn().mockResolvedValue(undefined);
  const onSelectTab = vi.fn();
  render(
    <CollecteChecklist rows={rows} devise="TND" editable onSelectTab={onSelectTab} onSaveComment={vi.fn()} onSaveSuivi={onSaveSuivi} onMarkAll={onMarkAll} {...props} />,
  );
  return { onSaveSuivi, onMarkAll, onSelectTab };
}

describe("CollecteChecklist", () => {
  it("affiche les pièces avec leur lien vers le tableau, le total calculé et le décompte des pièces reçues", () => {
    monter();
    // Le tableau (grand écran) et les cartes (mobile) sont tous deux dans le DOM : le CSS en masque un.
    expect(screen.getAllByText("Virements reçus").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4 250,000").length).toBeGreaterThan(0);
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Ouvrir « Virements reçus »" }).length).toBeGreaterThan(0);
  });

  it("filtre les pièces par statut avec leur effectif dans un sélecteur compact", () => {
    monter();
    const filtre = screen.getByRole("combobox", { name: "Filtrer les pièces" });
    expect(filtre.textContent).toContain("Toutes (3)");
    fireEvent.click(filtre);
    fireEvent.click(screen.getByRole("option", { name: "En attente (1)" }));
    expect(screen.queryByText("Virements reçus")).toBeNull();
    expect(screen.getAllByText("Détail des achats").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrer les pièces" }));
    fireEvent.click(screen.getByRole("option", { name: "Reçues (2)" }));
    expect(screen.queryByText("Détail des achats")).toBeNull();
  });

  it("coche une pièce reçue et enregistre tout de suite", () => {
    const { onSaveSuivi } = monter();
    fireEvent.click(screen.getAllByLabelText("Pièce reçue : Détail des achats")[0]);
    expect(onSaveSuivi).toHaveBeenCalledWith("achats", { recuManuel: true });
  });

  it("laisse une pièce dont le tableau contient des lignes cochée d'office, total non modifiable", () => {
    monter();
    const coche = screen.getAllByLabelText("Pièce reçue : Détail des virements reçus")[0];
    expect(coche.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByLabelText("Total pour Détail des virements reçus")).toBeNull();
  });

  it("enregistre la date de suivi et le total saisis en quittant la case", async () => {
    const { onSaveSuivi } = monter();
    const date = screen.getAllByLabelText("Date de suivi pour État de caisse")[0];
    fireEvent.change(date, { target: { value: "2026-10-05" } });
    fireEvent.blur(date);
    await waitFor(() => expect(onSaveSuivi).toHaveBeenCalledWith("etat_caisse", { dateSuivi: "2026-10-05" }));

    const total = screen.getAllByLabelText("Total pour État de caisse")[0];
    fireEvent.change(total, { target: { value: "125.5" } });
    fireEvent.blur(total);
    await waitFor(() => expect(onSaveSuivi).toHaveBeenCalledWith("etat_caisse", { totalSaisi: 125.5 }));
  });

  it("n'autorise pas la saisie d'une pièce non reçue", () => {
    monter();
    expect(screen.getAllByLabelText("Total pour Détail des achats")[0].hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByLabelText("Date de suivi pour Détail des achats")[0].hasAttribute("disabled")).toBe(true);
  });

  it("marque d'un coup toutes les pièces en attente", async () => {
    const { onMarkAll } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Tout marquer comme reçu" }));
    await waitFor(() => expect(onMarkAll).toHaveBeenCalledWith(["achats"]));
  });

  it("ouvre le tableau d'une pièce depuis son lien", () => {
    const { onSelectTab } = monter();
    fireEvent.click(screen.getAllByRole("button", { name: "Ouvrir « Détail des achats »" })[0]);
    expect(onSelectTab).toHaveBeenCalledWith("achats");
  });

  it("en lecture seule : ni case active, ni marquage, et le message est affiché", () => {
    monter({ editable: false, notice: "Collecte validée : rouvrez-la pour modifier les pièces." });
    expect(screen.queryByRole("button", { name: "Tout marquer comme reçu" })).toBeNull();
    expect(screen.getAllByLabelText("Pièce reçue : Détail des achats")[0].hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Collecte validée : rouvrez-la pour modifier les pièces.")).toBeTruthy();
  });
});

describe("CollecteChecklist : retirer un tableau de la collecte", () => {
  const retirables = ["achats"];

  it("propose le retrait seulement quand la page le permet, et pas pour un tableau verrouillé", () => {
    monter({ onRemove: vi.fn().mockResolvedValue(undefined), removable: (k) => retirables.includes(k) });
    expect(screen.getAllByRole("button", { name: "Retirer « Détail des achats » de la collecte" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Retirer « État de caisse » de la collecte" })).toBeNull();
  });

  it("sans droit (pas de onRemove) ou en lecture seule : aucun bouton de retrait", () => {
    monter();
    expect(screen.queryByRole("button", { name: /Retirer .* de la collecte/ })).toBeNull();
    cleanup();
    monter({ editable: false, onRemove: vi.fn() });
    expect(screen.queryByRole("button", { name: /Retirer .* de la collecte/ })).toBeNull();
  });

  it("demande confirmation, annonce les lignes perdues, et ne retire qu'à la confirmation", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    monter({ onRemove });
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer « Virements reçus » de la collecte" })[0]);
    expect(screen.getByText(/Ses 1 ligne\(s\) déjà saisie\(s\) seront supprimées définitivement/)).toBeTruthy();
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retirer le tableau" }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith("virements_recus"));
  });

  it("Annuler ne retire rien, et un tableau vide n'annonce aucune perte", () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    monter({ onRemove });
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer « Détail des achats » de la collecte" })[0]);
    expect(screen.getByText(/Aucune ligne n'est saisie dans ce tableau/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("si le retrait échoue, la fenêtre reste ouverte pour réessayer", async () => {
    const onRemove = vi.fn().mockRejectedValue(new Error("refusé"));
    monter({ onRemove });
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer « Détail des achats » de la collecte" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Retirer le tableau" }));
    await waitFor(() => expect(onRemove).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Retirer le tableau" })).toBeTruthy();
  });
});
