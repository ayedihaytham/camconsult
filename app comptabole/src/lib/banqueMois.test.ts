import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type { CompteBancaire, MouvementBancaire, OperationEnCoursBancaire, ReleveMensuel } from "@/types";
import { aUnEcart, rapprochementMois, synthesePeriodes } from "./banqueMois";
import { lireClasseurBancaire, type FeuilleLue, type FusionVerticale } from "./banqueClasseur";

const compte: CompteBancaire = { id: "c", banque: "BTL", devise: "TND", numero: "", soldeDepart: 1000, dateDepart: "2026-01-01", soldeReel: null, dateReel: null };
const mvt = (id: string, dateOp: string, debit: number, credit: number, aRevoir = false): MouvementBancaire => ({
  id, compteId: "c", dateOp, dateValeur: null, libelle: "", details: "", reference: "", numPiece: "", debit, credit, type: "autre", aRevoir, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null,
});
const releve = (mois: string, soldeReel: number | null): ReleveMensuel => ({ compteId: "c", mois, soldeReel, note: "" });
const enCours = (mois: string, debit: number, credit: number): OperationEnCoursBancaire => ({ id: `${mois}${debit}${credit}`, compteId: "c", mois, designation: "x", debit, credit });

describe("rapprochement mensuel d'un compte", () => {
  const mouvements = [mvt("1", "2026-01-05", 100, 0), mvt("2", "2026-01-20", 0, 500, true), mvt("3", "2026-02-03", 50, 0)];

  it("l'ouverture du premier mois est le solde de départ ; solde calculé = ouverture + crédits − débits", () => {
    const p = rapprochementMois(compte, mouvements, [], [], "2026-01")!;
    expect(p).toMatchObject({ ouverture: 1000, totalDebit: 100, totalCredit: 500, calcule: 1400, soldeReel: null, ecart: null, nbLignes: 2, aRevoir: 1 });
  });

  it("l'ouverture d'un mois est la fin du précédent : le solde réel de la banque s'il est saisi, sinon le solde calculé", () => {
    expect(rapprochementMois(compte, mouvements, [], [], "2026-02")!.ouverture).toBe(1400);
    const p = rapprochementMois(compte, mouvements, [releve("2026-01", 1397.5)], [], "2026-02")!;
    expect(p.ouverture).toBe(1397.5);
    expect(p.calcule).toBe(1347.5);
  });

  it("l'écart est solde réel − solde calculé ; hors TVA, c'est l'écart ÷ 1,19 ; aucun écart sans solde réel", () => {
    const p = rapprochementMois(compte, mouvements, [releve("2026-01", 1397.619)], [], "2026-01")!;
    expect(p.ecart).toBe(-2.381);
    expect(p.ecartHorsTva).toBe(2.001);
    expect(aUnEcart(p)).toBe(true);
    const juste = rapprochementMois(compte, mouvements, [releve("2026-01", 1400)], [], "2026-01")!;
    expect(juste.ecart).toBe(0);
    expect(juste.ecartHorsTva).toBeNull();
    expect(aUnEcart(juste)).toBe(false);
    expect(aUnEcart(rapprochementMois(compte, mouvements, [], [], "2026-01")!)).toBe(false);
  });

  it("solde théorique = solde réel (sinon calculé) + débits − crédits des opérations en cours", () => {
    const ops = [enCours("2026-01", 84250, 0), enCours("2026-01", 0, 78606.274)];
    const p = rapprochementMois(compte, mouvements, [releve("2026-01", 18842.626)], ops, "2026-01")!;
    expect(p).toMatchObject({ enCoursDebit: 84250, enCoursCredit: 78606.274, theorique: 24486.352 });
    expect(rapprochementMois(compte, mouvements, [], ops, "2026-01")!.theorique).toBe(1400 + 5643.726);
  });

  it("un mois qui n'a que des opérations en cours ou un solde réel apparaît aussi ; un mois inconnu non", () => {
    expect(synthesePeriodes(compte, mouvements, [releve("2026-03", 10)], [], ).map((p) => p.mois)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(rapprochementMois(compte, mouvements, [], [], "2025-12")).toBeNull();
  });
});

function feuilles(fichier: string): FeuilleLue[] {
  if (!existsSync(`samples/${fichier}`)) return [];
  const wb = XLSX.read(readFileSync(`samples/${fichier}`), { type: "buffer", cellDates: true });
  return wb.SheetNames.map((nom) => {
    const ws = wb.Sheets[nom];
    const ref = XLSX.utils.decode_range(ws["!ref"]!);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: ref.e }) });
    const fusions: FusionVerticale[] = (ws["!merges"] ?? []).filter((m) => m.s.c === m.e.c && m.e.r > m.s.r).map((m) => ({ ligne1: m.s.r, ligne2: m.e.r, colonne: m.s.c }));
    return { nom, rows, fusions };
  });
}

describe.skipIf(!existsSync("samples/BTL TND PETRA 2026.xlsx"))("rapprochement mensuel sur le classeur BTL TND", () => {
  const c = lireClasseurBancaire(feuilles("BTL TND PETRA 2026.xlsx"));
  const cpt: CompteBancaire = { ...compte, soldeDepart: (c.ouverture?.montant ?? 0) };
  const mouvs = c.mouvements.map((m, i) => ({ ...mvt(String(i), m.dateOp, m.debit, m.credit), numPiece: m.numPiece }));
  const rels = c.feuilles.filter((f) => f.mois && f.soldeBanque !== null).map((f) => releve(f.mois!, f.soldeBanque));
  const ops = c.feuilles.flatMap((f) => f.enCours.map((o, i) => ({ id: `${f.mois}${i}`, compteId: "c", mois: f.mois!, ...o })));
  const periodes = synthesePeriodes(cpt, mouvs, rels, ops);

  it("huit mois ; les écarts à expliquer sont ceux de juin (3,57) et juillet (5) : les autres mois tombent juste", () => {
    expect(periodes.map((p) => p.mois)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(periodes.filter(aUnEcart).map((p) => [p.mois, p.ecart])).toEqual([["2026-06", 3.57], ["2026-07", 5]]);
  });

  it("le solde théorique de janvier tient compte du virement et du chèque en circulation (24 486,352 dans le classeur)", () => {
    expect(periodes[0].theorique).toBe(24486.352);
  });
});
