import { describe, expect, it } from "vitest";
import { soldeMensuelDePdf } from "./releveMensuelPdf";

const m = (dateOp: string) => ({ dateOp });

describe("solde réel du mois d'un relevé PDF", () => {
  it("toutes les opérations du même mois : le solde final imprimé est le solde réel de ce mois, daté de la dernière opération", () => {
    expect(soldeMensuelDePdf([m("2026-09-01"), m("2026-09-30"), m("2026-09-09")], 1025703.52)).toEqual({ mois: "2026-09", soldeReel: 1025703.52, date: "2026-09-30" });
  });
  it("un relevé qui chevauche deux mois n'est rattaché à aucun mois", () => {
    expect(soldeMensuelDePdf([m("2026-08-31"), m("2026-09-02")], 100)).toBeNull();
  });
  it("sans solde imprimé ou sans opération : rien", () => {
    expect(soldeMensuelDePdf([m("2026-09-01")], null)).toBeNull();
    expect(soldeMensuelDePdf([], 5)).toBeNull();
  });
});
