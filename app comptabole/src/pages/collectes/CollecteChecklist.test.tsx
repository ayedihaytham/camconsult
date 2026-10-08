// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  { onglet: "virements_recus", pieceLabel: "Détail des virements reçus", tabLabel: "Virements reçus", recu: true, recuAuto: true, statutLabel: "Reçu", dateReception: "18/09/2026", dateSuivi: "2026-09-18", total: 4250, nbLignes: 1, commentaire: "Vérifié" },
  { onglet: "achats", pieceLabel: "Détail des achats", tabLabel: "Détail des achats", recu: false, recuAuto: false, statutLabel: "En attente", dateReception: null, dateSuivi: null, total: null, nbLignes: 0, commentaire: "" },
  { onglet: "etat_caisse", pieceLabel: "État de caisse", tabLabel: "État de caisse", recu: true, recuAuto: false, statutLabel: "Reçu", dateReception: "01/10/2026", dateSuivi: "2026-10-01", total: 80, nbLignes: 0, commentaire: "" },
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
    expect(screen.getAllByText("Détail des virements reçus").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4 250,000").length).toBeGreaterThan(0);
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(screen.getAllByText(/Ouvrir « Virements reçus »/).length).toBeGreaterThan(0);
  });

  it("filtre les pièces par statut avec leur effectif", () => {
    monter();
    const groupe = screen.getByRole("group", { name: "Filtrer les pièces" });
    expect(groupe.textContent).toContain("Toutes3");
    expect(groupe.textContent).toContain("En attente1");
    expect(groupe.textContent).toContain("Reçues2");
    fireEvent.click(within(groupe).getByRole("button", { name: /En attente/ }));
    expect(screen.queryByText("Détail des virements reçus")).toBeNull();
    expect(screen.getAllByText("Détail des achats").length).toBeGreaterThan(0);
    fireEvent.click(within(groupe).getByRole("button", { name: /Reçues/ }));
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
    fireEvent.click(screen.getAllByText(/Ouvrir « Détail des achats »/)[0]);
    expect(onSelectTab).toHaveBeenCalledWith("achats");
  });

  it("en lecture seule : ni case active, ni marquage, et le message est affiché", () => {
    monter({ editable: false, notice: "Collecte validée : rouvrez-la pour modifier les pièces." });
    expect(screen.queryByRole("button", { name: "Tout marquer comme reçu" })).toBeNull();
    expect(screen.getAllByLabelText("Pièce reçue : Détail des achats")[0].hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Collecte validée : rouvrez-la pour modifier les pièces.")).toBeTruthy();
  });
});
