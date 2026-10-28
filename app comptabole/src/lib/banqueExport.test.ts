import { describe, expect, it } from "vitest";
import type { CompteBancaire, MouvementBancaire, OperationEnCoursBancaire, ReleveMensuel } from "@/types";
import { synthesePeriodes } from "./banqueMois";
import { feuilleMois } from "./banqueExport";

const compte: CompteBancaire = { id: "c", banque: "BTL", devise: "TND", numero: "", soldeDepart: 1000, dateDepart: "2026-01-01", soldeReel: null, dateReel: null };
const mvt = (id: string, dateOp: string, debit: number, credit: number, aRevoir = false): MouvementBancaire => ({
  id, compteId: "c", dateOp, dateValeur: null, libelle: `L${id}`, details: "", reference: "", numPiece: "P", debit, credit, type: "frais", aRevoir, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null,
});
const mouvements = [mvt("1", "2026-01-05", 100, 0, true), mvt("2", "2026-01-20", 0, 500), mvt("3", "2026-02-03", 50, 0)];
const releves: ReleveMensuel[] = [{ compteId: "c", mois: "2026-01", soldeReel: 1390, note: "" }];
const enCours: OperationEnCoursBancaire[] = [{ id: "o", compteId: "c", mois: "2026-01", designation: "CHEQ 1", debit: 0, credit: 200 }];

describe("export d'un compte : une feuille par mois", () => {
  const periodes = synthesePeriodes(compte, mouvements, releves, enCours);
  const feuille = feuilleMois(compte, mouvements, periodes[0]);

  it("reprend la disposition du cabinet : départ, blocs société puis banque, solde courant du mois, TOTAL", () => {
    expect(feuille[1]).toEqual(["START DATE", "01/01/2026", "BANK BALANCE", 1000]);
    expect(feuille[3].slice(0, 3)).toEqual(["DATE OP", "VALUE DATE", "DESCRIPTION"]);
    // le bloc société est le miroir de la banque
    expect(feuille[5].slice(7)).toEqual([0, 100, 100, 0, 900]);
    expect(feuille[6].slice(7)).toEqual([500, 0, 0, 500, 1400]);
    expect(feuille[7].slice(0, 1)).toEqual(["TOTAL"]);
  });

  it("la ligne à revoir est signalée, et le pied donne solde calculé, solde réel, écart, opérations en cours et solde théorique", () => {
    expect(String(feuille[5][6])).toContain("À REVOIR");
    expect(feuille).toContainEqual(["SOLDE CALCULÉ", 1400, "SOLDE RÉEL (RELEVÉ)", 1390, "ÉCART", -10]);
    expect(feuille).toContainEqual(["CHEQ 1", "", "", "", "", "", "", 0, 200]);
    expect(feuille.at(-1)).toEqual(["SOLDE THÉORIQUE", 1190]);
  });

  it("le mois suivant part du solde réel du mois précédent", () => {
    expect(feuilleMois(compte, mouvements, periodes[1])[1]).toEqual(["START DATE", "01/02/2026", "BANK BALANCE", 1390]);
  });
});
