import { describe, expect, it } from "vitest";
import { margeFacture, totauxAchats } from "./suiviDeviseMarge";
import type { SuiviDeviseFacture } from "@/types";

const facture = (patch: Partial<SuiviDeviseFacture>): SuiviDeviseFacture => ({
  id: "f", suiviId: "s", lotId: null, ordre: 1, nFacture: "1", nSecondaire: "", dateFacture: null, modePaiement: "",
  designationProduit: "", fournisseur: "", qteTonnes: 0, pu: 0, montantTotal: 0, avoirMontant: null, avoirDate: null,
  mouvementStockId: "m", achatNumFacture: "A1", achatDate: null, achatDevise: "EUR", achatMontant: 0, ...patch,
});

describe("marge des factures reprises du stock", () => {
  it("est la vente moins l'achat, dans la devise de la fiche", () => {
    expect(margeFacture(facture({ montantTotal: 55000, achatMontant: 52000 }), "EUR")).toBe(3000);
    expect(margeFacture(facture({ montantTotal: 100, achatMontant: 130.5 }), "EUR")).toBe(-30.5);
  });

  it("n'existe pas sans achat lié, ni quand l'achat est dans une autre devise, ni pour une facture manuelle", () => {
    expect(margeFacture(facture({ montantTotal: 100, achatMontant: 0 }), "EUR")).toBeNull();
    expect(margeFacture(facture({ montantTotal: 100, achatMontant: 80, achatDevise: "USD" }), "EUR")).toBeNull();
    expect(margeFacture(facture({ montantTotal: 100, achatMontant: 80, mouvementStockId: null }), "EUR")).toBeNull();
    expect(margeFacture(facture({ montantTotal: 100, achatMontant: null }), "EUR")).toBeNull();
  });

  it("totalise achats et marge des seules factures comparables", () => {
    const fs = [
      facture({ id: "1", montantTotal: 55000, achatMontant: 52000 }),
      facture({ id: "2", montantTotal: 3200, achatMontant: 3000 }),
      facture({ id: "3", montantTotal: 999, achatMontant: 0 }),
      facture({ id: "4", montantTotal: 10, achatMontant: 5, achatDevise: "TND" }),
    ];
    expect(totauxAchats(fs, "EUR")).toEqual({ achats: 55000, marge: 3200, nb: 2 });
  });
});
