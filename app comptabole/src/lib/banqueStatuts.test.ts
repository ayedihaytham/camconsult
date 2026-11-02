import { describe, expect, it } from "vitest";
import { statutsMoisCompte } from "../../shared/banqueStatuts.js";
import { aUnEcart, synthesePeriodes } from "./banqueMois";
import type { CompteBancaire, MouvementBancaire, OperationEnCoursBancaire, ReleveMensuel } from "@/types";

const compte: CompteBancaire = { id: "c", banque: "BTL", devise: "TND", numero: "", soldeDepart: 1000, dateDepart: "2026-01-01", soldeReel: null, dateReel: null };
const mvt = (id: string, dateOp: string, debit: number, credit: number): MouvementBancaire => ({
  id, compteId: "c", dateOp, dateValeur: null, libelle: id, details: "", reference: "", numPiece: "", debit, credit, type: "autre", aRevoir: false, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null,
});
const releve = (mois: string, soldeReel: number | null): ReleveMensuel => ({ compteId: "c", mois, soldeReel, note: "" });
const enCours = (mois: string): OperationEnCoursBancaire => ({ id: `o${mois}`, compteId: "c", mois, designation: "CHEQ", debit: 0, credit: 10 });

/** Totaux par mois tels que le serveur les calcule (sum des débits et des crédits par mois). */
function totauxParMois(mouvements: MouvementBancaire[]) {
  const par = new Map<string, { mois: string; debit: number; credit: number }>();
  for (const m of mouvements) {
    const mois = m.dateOp.slice(0, 7);
    const t = par.get(mois) ?? { mois, debit: 0, credit: 0 };
    t.debit += m.debit;
    t.credit += m.credit;
    par.set(mois, t);
  }
  return [...par.values()];
}

describe("statut des mois d'un compte (calcul partagé avec le serveur)", () => {
  it("tombe juste, écart, solde réel à saisir : le départ d'un mois est la fin du précédent", () => {
    const m = [mvt("a", "2026-01-05", 100, 0), mvt("b", "2026-01-20", 0, 500), mvt("c", "2026-02-03", 50, 0), mvt("d", "2026-03-04", 0, 10)];
    const s = statutsMoisCompte(compte, totauxParMois(m), [{ mois: "2026-01", soldeReel: 1400 }, { mois: "2026-02", soldeReel: 1360 }]);
    expect(s.map((x) => [x.mois, x.statut, x.ecart])).toEqual([["2026-01", "ok", 0], ["2026-02", "ecart", 10], ["2026-03", "saisir", null]]);
    // février part de 1 400 (réel de janvier) : 1 400 − 50 = 1 350 ; réel 1 360 → écart 10 ; mars part de 1 360
    expect(s[1].calcule).toBe(1350);
    expect(s[2].calcule).toBe(1370);
  });

  it("un mois qui n'a qu'une opération en cours existe aussi", () => {
    const s = statutsMoisCompte(compte, [], [], ["2026-04"]);
    expect(s).toEqual([{ mois: "2026-04", calcule: 1000, soldeReel: null, ecart: null, statut: "saisir" }]);
  });

  it("donne exactement les mêmes soldes, écarts et verdicts que le rapprochement mensuel de l'écran", () => {
    const m = [
      mvt("1", "2026-01-02", 12.5, 0), mvt("2", "2026-01-31", 0, 3000.125), mvt("3", "2026-02-10", 700.3, 0), mvt("4", "2026-02-11", 0.95, 0),
      mvt("5", "2026-04-01", 0, 20), mvt("6", "2026-06-09", 5, 0), mvt("7", "2026-06-30", 3.57, 0),
    ];
    const releves = [releve("2026-01", 3987.625), releve("2026-02", 3000), releve("2026-04", null), releve("2026-06", 3000.4), releve("2026-07", 3000.4)];
    const oc = [enCours("2026-08")];
    const ecran = synthesePeriodes(compte, m, releves, oc);
    const partage = statutsMoisCompte(compte, totauxParMois(m), releves, ["2026-08"]);
    expect(partage.map((x) => x.mois)).toEqual(ecran.map((p) => p.mois));
    expect(partage.map((x) => x.calcule)).toEqual(ecran.map((p) => p.calcule));
    expect(partage.map((x) => x.ecart)).toEqual(ecran.map((p) => p.ecart));
    expect(partage.map((x) => x.statut === "ecart")).toEqual(ecran.map((p) => aUnEcart(p)));
    expect(partage.map((x) => x.statut === "saisir")).toEqual(ecran.map((p) => p.soldeReel === null));
  });
});
