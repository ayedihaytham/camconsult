import { describe, expect, it } from "vitest";
import { propositionsChange, resumeChange } from "./banqueChange";
import { coursAvant } from "./banque";
import type { CompteBancaire, MouvementBancaire } from "@/types";

const compte = (id: string, devise: string): CompteBancaire => ({ id, banque: "BTL", devise, numero: "", soldeDepart: 0, dateDepart: null, soldeReel: null, dateReel: null });
const comptes = [compte("eur", "EUR"), compte("tnd", "TND")];
const mvt = (id: string, compteId: string, dateOp: string, debit: number, credit: number, extra: Partial<MouvementBancaire> = {}): MouvementBancaire => ({
  id, compteId, dateOp, dateValeur: null, libelle: "ACHAT VENTE DEVISE", details: "", reference: "", numPiece: "", debit, credit, type: "change", aRevoir: false, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null, ...extra,
});

describe("jambes d'un même change", () => {
  it("300 000 EUR sortent le 02/09, 1 011 300 TND entrent le même jour : la paire est sûre (seule possible), cours réel 3,371", () => {
    const p = propositionsChange([mvt("a", "eur", "2026-09-02", 300000, 0), mvt("b", "tnd", "2026-09-02", 0, 1011300)], comptes);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ coursReel: 3.371, ecartJours: 0, sure: true });
  });

  it("un cours lu dans un libellé confirmé par les montants rend la paire sûre même à deux jours d'écart", () => {
    const p = propositionsChange([mvt("a", "eur", "2026-09-02", 100000, 0, { cours: 3.37 }), mvt("b", "tnd", "2026-09-04", 0, 337000)], comptes);
    expect(p[0].sure).toBe(true);
    expect(p[0].ecartJours).toBe(2);
  });

  it("deux sorties et deux entrées possibles : la paire au cours confirmé est choisie, l'autre reste libre", () => {
    const lignes = [
      mvt("a1", "eur", "2026-09-02", 100000, 0, { cours: 3.37 }),
      mvt("a2", "eur", "2026-09-02", 50000, 0),
      mvt("b1", "tnd", "2026-09-02", 0, 337000),
      mvt("b2", "tnd", "2026-09-02", 0, 168500),
    ];
    const p = propositionsChange(lignes, comptes);
    expect(p.find((x) => x.a.id === "a1" || x.b.id === "a1")?.sure).toBe(true);
    expect(new Set(p.flatMap((x) => [x.a.id, x.b.id])).size).toBe(p.length * 2);
  });

  it("rien : même sens, même devise, trop loin, cours absurde, déjà relié, pas un change", () => {
    expect(propositionsChange([mvt("a", "eur", "2026-09-02", 100, 0), mvt("b", "tnd", "2026-09-02", 337, 0)], comptes)).toEqual([]);
    expect(propositionsChange([mvt("a", "eur", "2026-09-02", 100, 0), mvt("b", "eur", "2026-09-02", 0, 100)], [compte("eur", "EUR")])).toEqual([]);
    expect(propositionsChange([mvt("a", "eur", "2026-09-02", 100, 0), mvt("b", "tnd", "2026-09-10", 0, 337)], comptes)).toEqual([]);
    expect(propositionsChange([mvt("a", "eur", "2026-09-02", 100, 0), mvt("b", "tnd", "2026-09-02", 0, 90000)], comptes)).toEqual([]);
    const lie = { id: "b", compteId: "tnd", devise: "TND", montant: 337, dateOp: "2026-09-02", coursReel: 3.37 };
    expect(propositionsChange([mvt("a", "eur", "2026-09-02", 100, 0, { changeLie: lie }), mvt("b", "tnd", "2026-09-02", 0, 337)], comptes)).toEqual([]);
    expect(propositionsChange([mvt("a", "eur", "2026-09-02", 100, 0, { type: "frais" }), mvt("b", "tnd", "2026-09-02", 0, 337)], comptes)).toEqual([]);
  });

  it("le résumé dit ce qui sort, ce qui entre et le cours, quelle que soit la jambe regardée", () => {
    const devises = new Map([["eur", "EUR"], ["tnd", "TND"]]);
    const a = mvt("a", "eur", "2026-09-02", 300000, 0, { changeLie: { id: "b", compteId: "tnd", devise: "TND", montant: 1011300, dateOp: "2026-09-02", coursReel: 3.371 } });
    const b = mvt("b", "tnd", "2026-09-02", 0, 1011300, { changeLie: { id: "a", compteId: "eur", devise: "EUR", montant: 300000, dateOp: "2026-09-02", coursReel: 3.371 } });
    const attendu = { sortie: "300 000,000 EUR", entree: "1 011 300,000 TND", cours: 3.371 };
    const espaces = (r: ReturnType<typeof resumeChange>) => r && { ...r, sortie: r.sortie.replace(/[  ]/g, " "), entree: r.entree.replace(/[  ]/g, " ") };
    expect(espaces(resumeChange(a, devises))).toEqual(attendu);
    expect(espaces(resumeChange(b, devises))).toEqual(attendu);
    expect(resumeChange(mvt("c", "eur", "2026-09-02", 1, 0), devises)).toBeNull();
  });

  it("le cours proposé pour un règlement fournisseur : le cours réel d'un change relié passe avant celui lu dans un libellé", () => {
    const lignes = [
      { type: "change" as const, cours: 3.4, coursReel: null, dateOp: "2026-09-01" },
      { type: "change" as const, cours: 3.37, coursReel: 3.3712, dateOp: "2026-09-02" },
      { type: "frais" as const, cours: null, coursReel: null, dateOp: "2026-09-03" },
    ];
    expect(coursAvant(lignes, "2026-09-10")).toBe(3.3712);
    expect(coursAvant(lignes, "2026-09-01")).toBe(3.4);
    expect(coursAvant(lignes, "2026-08-01")).toBeUndefined();
  });
});
