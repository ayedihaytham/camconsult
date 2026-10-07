// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { soldesCourants } from "@/lib/banque";
import type { CompteBancaire, MouvementBancaire } from "@/types";
import { MouvementsTable } from "./MouvementsTable";

const compte: CompteBancaire = { id: "c", banque: "BTL", devise: "EUR", numero: "", soldeDepart: 100, dateDepart: "2026-07-31", soldeReel: null, dateReel: null };
const mvt = (patch: Partial<MouvementBancaire>): MouvementBancaire => ({
  id: "m", compteId: "c", dateOp: "2026-08-06", dateValeur: "2026-08-06", libelle: "", details: "", reference: "", numPiece: "",
  debit: 0, credit: 0, type: "autre", reglementId: null, fournisseurCle: null, ...patch,
});

const liste = [
  mvt({ id: "1", libelle: "DEBLOCAGE CREDIT MCNE EN DEVISES", numPiece: "LD2621800686", credit: 35280, type: "credit" }),
  mvt({ id: "2", libelle: "TVA/COMM", numPiece: "LD2621800686", debit: 0.29, type: "frais" }),
  mvt({ id: "3", libelle: "REGLEMENT INNORPI FAC N 263500", details: "CHEQUE 3200117", debit: 893.5, type: "paiement_fournisseur" }),
  mvt({ id: "4", libelle: "REGLEMENT CHAMBRE FAC N 6306", debit: 10, type: "paiement_fournisseur", reglementId: "r1", fournisseurCle: "chambre" }),
];

function afficher(options: { vueSociete?: boolean; lectureSeule?: boolean } = {}) {
  const actions = { onEdit: vi.fn(), onDelete: vi.fn(), onRapprocher: vi.fn() };
  render(
    <MemoryRouter>
      <MouvementsTable
        societeId="s1"
        mouvements={liste}
        soldes={soldesCourants(compte, liste)}
        vueSociete={options.vueSociete ?? false}
        lectureSeule={options.lectureSeule ?? false}
        {...actions}
      />
    </MemoryRouter>,
  );
  return actions;
}

describe("mouvements d'un compte bancaire", () => {
  afterEach(cleanup);

  it("affiche le solde courant et n'écrit le N° pièce qu'une fois pour une opération et ses frais", () => {
    afficher();
    expect(screen.getAllByText("LD2621800686")).toHaveLength(1);
    expect(screen.getByText("35 380,000")).toBeTruthy();
    expect(screen.getByText("35 379,710")).toBeTruthy();
  });

  it("propose « Créer le règlement » pour un paiement fournisseur non rapproché, et « Rapproché » sinon", () => {
    const actions = afficher();
    const ligne = screen.getByText("REGLEMENT INNORPI FAC N 263500").closest("tr") as HTMLElement;
    fireEvent.click(within(ligne).getByText("Créer le règlement"));
    expect(actions.onRapprocher).toHaveBeenCalledWith(liste[2]);
    const rapproche = screen.getByText("REGLEMENT CHAMBRE FAC N 6306").closest("tr") as HTMLElement;
    expect(within(rapproche).getByText("Rapproché").closest("a")?.getAttribute("href")).toBe("/fournisseurs/s1");
    expect(within(rapproche).queryByText("Créer le règlement")).toBeNull();
  });

  it("inverse débit et crédit dans la vue société", () => {
    afficher({ vueSociete: true });
    expect(screen.getByText("Débit société")).toBeTruthy();
    const ligne = screen.getByText("DEBLOCAGE CREDIT MCNE EN DEVISES").closest("tr") as HTMLElement;
    const cellules = within(ligne).getAllByRole("cell");
    // Un crédit en banque (entrée) est un débit pour la société.
    expect(cellules[6].textContent?.replace(/\s/g, " ")).toBe("35 280,000");
    expect(cellules[7].textContent).toBe("—");
  });

  it("n'offre ni modification ni rapprochement en lecture seule", () => {
    afficher({ lectureSeule: true });
    expect(screen.queryByLabelText("Modifier ce mouvement")).toBeNull();
    expect(screen.queryByText("Créer le règlement")).toBeNull();
    expect(screen.getByText("Non rapproché")).toBeTruthy();
  });
});
