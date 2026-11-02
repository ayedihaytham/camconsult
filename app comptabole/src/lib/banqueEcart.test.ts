import { describe, expect, it } from "vitest";
import { pistesEcart } from "./banqueEcart";
import type { MouvementBancaire, OperationEnCoursBancaire } from "@/types";
import type { RapprochementMois } from "./banqueMois";

const mvt = (id: string, dateOp: string, debit: number, credit: number, extra: Partial<MouvementBancaire> = {}): MouvementBancaire => ({
  id, compteId: "c", dateOp, dateValeur: null, libelle: id.toUpperCase(), details: "", reference: "", numPiece: "", debit, credit, type: "autre", aRevoir: false, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null, ...extra,
});
const periode = (mois: string, ecart: number | null, extra: Partial<RapprochementMois> = {}): RapprochementMois => ({
  mois, ouverture: 0, totalDebit: 0, totalCredit: 0, calcule: 0, soldeReel: ecart, ecart, ecartHorsTva: null, enCours: [], enCoursDebit: 0, enCoursCredit: 0, theorique: 0, nbLignes: 0, aRevoir: 0, ...extra,
});
const textes = (p: ReturnType<typeof pistesEcart>) => p.map((x) => x.texte);

describe("où chercher l'écart d'un mois", () => {
  it("sans écart : aucune piste", () => {
    expect(pistesEcart(periode("2026-06", 0), [])).toEqual([]);
    expect(pistesEcart(periode("2026-06", null), [])).toEqual([]);
  });

  it("juin du classeur BTL (3,570) : le sens, puis « 3,000 + TVA 19 % », puis le pointage", () => {
    const t = textes(pistesEcart(periode("2026-06", 3.57), [mvt("a", "2026-06-05", 10, 0)]));
    expect(t[0]).toMatch(/La banque a 3,570 de plus/);
    expect(t.some((x) => /3,570 = 3,000 \+ TVA 19 %/.test(x))).toBe(true);
    expect(t[t.length - 1]).toMatch(/Pointez le relevé/);
  });

  it("juillet du classeur BTL (5,000 = cinq dinars) : plusieurs « FRAIS POSTE » de 5,000, une seule d'un côté suffit", () => {
    const lignes = Array.from({ length: 4 }, (_, i) => mvt(`poste${i}`, `2026-07-0${i + 1}`, 5, 0, { libelle: "FRAIS POSTE" }));
    const t = textes(pistesEcart(periode("2026-07", 5), lignes));
    expect(t.some((x) => /4 lignes de ce mois ont exactement ce montant/.test(x) && /FRAIS POSTE/.test(x))).toBe(true);
    expect(t.some((x) => /TVA/.test(x))).toBe(false);
    expect(t.some((x) => /montant rond/.test(x))).toBe(false);
  });

  it("un écart rond de 5 000 : montant rond (virement, versement ou chèque entier)", () => {
    expect(textes(pistesEcart(periode("2026-07", 5000), [])).some((x) => /montant rond/.test(x))).toBe(true);
  });

  it("un écart négatif dit que la banque a moins", () => {
    expect(textes(pistesEcart(periode("2026-07", -12.5), []))[0]).toMatch(/La banque a 12,500 de moins/);
  });

  it("des lignes du mois suivant dont la date de valeur est dans le mois expliquent exactement l'écart", () => {
    const lignes = [mvt("commission", "2026-07-01", 2.975, 0, { dateValeur: "2026-06-30" })];
    const p = pistesEcart(periode("2026-06", -2.975), lignes);
    expect(p.find((x) => /date de valeur dans ce mois/.test(x.texte))?.lignes).toEqual(["commission"]);
  });

  it("des lignes du mois dont la date de valeur est le mois suivant expliquent exactement l'écart", () => {
    const lignes = [mvt("virement", "2026-06-30", 0, 40, { dateValeur: "2026-07-01" })];
    const p = pistesEcart(periode("2026-06", -40), lignes);
    expect(p.some((x) => /date de valeur le mois suivant/.test(x.texte))).toBe(true);
  });

  it("une ligne du mois de même montant, une ligne d'un mois voisin, un montant doublé (sens inversé)", () => {
    const lignes = [mvt("meme", "2026-06-10", 0, 130), mvt("voisine", "2026-07-02", 130, 0), mvt("moitie", "2026-06-12", 65, 0)];
    const t = textes(pistesEcart(periode("2026-06", 130), lignes));
    expect(t.some((x) => /Une ligne de ce mois a exactement ce montant \(« MEME » du 10\/06\)/.test(x))).toBe(true);
    expect(t.some((x) => /mois voisin/.test(x) && /VOISINE/.test(x))).toBe(true);
    expect(t.some((x) => /mauvais sens/.test(x) && /MOITIE/.test(x))).toBe(true);
  });

  it("une opération en cours du même montant, et les lignes « à revoir »", () => {
    const op = { id: "o", compteId: "c", mois: "2026-06", designation: "CHEQ 4000111", debit: 0, credit: 77, ordre: 0 } as OperationEnCoursBancaire;
    const t = textes(pistesEcart(periode("2026-06", 77, { enCours: [op], aRevoir: 2 }), [mvt("r", "2026-06-03", 1, 0, { aRevoir: true })]));
    expect(t.some((x) => /CHEQ 4000111/.test(x))).toBe(true);
    expect(t.some((x) => /2 lignes de ce mois sont marquées « à revoir »/.test(x))).toBe(true);
  });
});
