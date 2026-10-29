// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SuiviDeviseMouvementFormSheet } from "./SuiviDeviseMouvementFormSheet";
import type { EncaissementCandidat } from "@/lib/suiviDeviseBanque";
import type { MouvementBancaire, SuiviDeviseFacture } from "@/types";

const facture = (id: string, nFacture: string, reste: number, ordre: number) =>
  ({ id, nFacture, lotId: null, dateFacture: "2026-01-10", montantTotal: reste, regle: 0, reste, ordre }) as unknown as SuiviDeviseFacture;
const factures = [facture("f1", "130/2026", 400, 1), facture("f2", "131/2026", 500, 2), facture("f3", "132/2026", 300, 3)];
const mouvement = (id: string, libelle: string, credit: number) =>
  ({ id, compteId: "c", dateOp: "2026-02-10", dateValeur: null, libelle, details: "", reference: "", numPiece: "", debit: 0, credit, type: "encaissement_client", aRevoir: false, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null }) as MouvementBancaire;
const candidat = (m: MouvementBancaire): EncaissementCandidat => ({ mouvement: m, devise: "EUR", reste: m.credit, nommeLeClient: true });

afterEach(cleanup);

describe("règlement client depuis le suivi bancaire", () => {
  it("à l'ouverture, l'encaissement venu de la banque est choisi : date, libellé, montant et répartition sur les factures citées", async () => {
    const e = candidat(mouvement("m1", "ENCAISSEMENT RUSPINA FACT 131/2026", 600));
    const autre = candidat(mouvement("m2", "VIREMENT AUTRE", 50));
    const onSubmit = vi.fn();
    render(<SuiviDeviseMouvementFormSheet open onOpenChange={() => {}} lots={[]} factures={factures} devise="EUR" encaissements={[autre, e]} encaissementInitial="m1" onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.queryByDisplayValue("ENCAISSEMENT RUSPINA FACT 131/2026")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /enregistrer|ajouter/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      type: "reglement",
      date: "2026-02-10",
      montant: 600,
      mouvementBancaireId: "m1",
      // la facture citée (131) est payée d'abord, le reste va à la plus ancienne
      affectations: expect.arrayContaining([{ factureId: "f2", montant: 500 }, { factureId: "f1", montant: 100 }]),
    });
    expect(onSubmit.mock.calls[0][0].affectations).toHaveLength(2);
  });

  it("sans encaissement venu de la banque, le formulaire reste vide", async () => {
    const e = candidat(mouvement("m1", "ENCAISSEMENT", 600));
    render(<SuiviDeviseMouvementFormSheet open onOpenChange={() => {}} lots={[]} factures={factures} devise="EUR" encaissements={[e]} onSubmit={vi.fn()} />);
    expect(screen.queryByDisplayValue("ENCAISSEMENT")).toBeNull();
  });
});
