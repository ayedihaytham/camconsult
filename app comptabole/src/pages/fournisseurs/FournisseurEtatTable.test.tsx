// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { lignesEtat } from "@/lib/fournisseurs";
import type { FactureFournisseur, ReglementFournisseur } from "@/types";
import { FournisseurEtatTable } from "./FournisseurEtatTable";

const facture = (id: string, num: string, montant: number): FactureFournisseur => ({
  id,
  fournisseur: "SOTACIB",
  fournisseurCle: "sotacib",
  numFacture: num,
  date: "2026-01-02",
  devise: "TND",
  cours: 0,
  quantite: 100,
  designation: "CEM I 52,5 N",
  prixUnitaire: montant / 100,
  montant,
  montantTnd: montant,
  venteNumFacture: "2026001",
  douaneNumDeclaration: "405821",
  suivi: { numProforma: "", dateProforma: null, montantProforma: 0, etatProforma: "", numTitre: "", etatChargement: "CHARGEE", vuPasse: "OUI" },
});

const factures = [facture("1", "902032379", 20077.68), facture("2", "902032392", 27163.92), facture("3", "902032385", 500)];
const reglement: ReglementFournisseur = {
  id: "r1",
  fournisseurCle: "sotacib",
  date: "2026-01-08",
  mode: "virement",
  reference: "",
  banque: "BTL",
  devise: "TND",
  cours: 0,
  rsTaux: 0.5,
  rsNumero: "20260002",
  rsMontant: 236.208,
  note: "",
  brut: 47241.6,
  vire: 47005.392,
  affectations: [
    { mouvementId: "1", montant: 20077.68 },
    { mouvementId: "2", montant: 27163.92 },
  ],
};

function afficher(lectureSeule = false) {
  const actions = { onEditReglement: vi.fn(), onDeleteReglement: vi.fn(), onSuivi: vi.fn() };
  render(
    <FournisseurEtatTable
      lignes={lignesEtat("sotacib", factures, [reglement])}
      factures={factures}
      lectureSeule={lectureSeule}
      {...actions}
    />,
  );
  return actions;
}

describe("état d'un fournisseur", () => {
  afterEach(cleanup);

  it("fusionne le règlement sur les deux factures qu'il couvre et affiche le virement net de RS", () => {
    afficher();
    expect(screen.getAllByText("47 005,392")).toHaveLength(1);
    const cellule = screen.getByText("47 005,392").closest("td") as HTMLTableCellElement;
    expect(cellule.rowSpan).toBe(2);
    expect(screen.getByText("20260002")).toBeTruthy();
    expect(screen.getByText("236,208")).toBeTruthy();
    expect(screen.getByText("BTL")).toBeTruthy();
  });

  it("montre la facture non réglée avec son reste", () => {
    afficher();
    const ligne = screen.getByText("902032385").closest("tr") as HTMLElement;
    expect(within(ligne).getByText("Non réglé")).toBeTruthy();
    // Montant de la facture et reste à régler : le même, la facture n'a reçu aucun règlement.
    expect(within(ligne).getAllByText("500,000")).toHaveLength(2);
  });

  it("garde la vente, la déclaration et le suivi de chargement sur la ligne de la facture", () => {
    afficher();
    const ligne = screen.getByText("902032379").closest("tr") as HTMLElement;
    expect(within(ligne).getByText("2026001")).toBeTruthy();
    expect(within(ligne).getByText("405821")).toBeTruthy();
    expect(within(ligne).getByText("CHARGEE · Vu OUI")).toBeTruthy();
  });

  it("propose modifier, supprimer et suivi à l'équipe, rien en lecture seule", () => {
    const actions = afficher();
    fireEvent.click(screen.getByLabelText("Modifier ce règlement"));
    fireEvent.click(screen.getByLabelText("Supprimer ce règlement"));
    fireEvent.click(screen.getByLabelText("Suivi de la facture 902032379"));
    expect(actions.onEditReglement).toHaveBeenCalledWith(reglement);
    expect(actions.onDeleteReglement).toHaveBeenCalledWith(reglement);
    expect(actions.onSuivi).toHaveBeenCalledTimes(1);
    cleanup();
    afficher(true);
    expect(screen.queryByLabelText("Modifier ce règlement")).toBeNull();
    expect(screen.queryByLabelText("Suivi de la facture 902032379")).toBeNull();
  });
});
