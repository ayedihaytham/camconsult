import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { lireTextePdf, reconstruireTableau } from "@/lib/pdfToTables";
import { decouperLibelle, lignesPourTableau, lireGrandLivre, natureEcriture } from "./grandLivre";

const PDF = "samples/461.pdf";

async function livre() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pages = await lireTextePdf(pdfjs as never, new Uint8Array(readFileSync(PDF)).buffer as ArrayBuffer);
  return lireGrandLivre(pages.map((p) => reconstruireTableau(p, { nombres: false }) as string[][]));
}

describe.skipIf(!existsSync(PDF))("grand-livre Sage du compte 461 (PDF réel)", () => {
  it("lit les 46 écritures et retrouve les totaux imprimés (débit 69 456,666 ; crédit 589 283,639)", async () => {
    const l = await livre();
    expect(l).not.toBeNull();
    expect(l!.societe).toBe("I CARGO LINE");
    expect(l!.compte).toMatch(/^461000 COMPTES D'ATTENTE/);
    expect(l!.ecritures).toHaveLength(46);
    expect(l!.totaux).toEqual({ debit: 69456.666, credit: 589283.639 });
    expect(l!.controle).toBe(true);
  });

  it("classe les écritures : chèques émis, chèques et effets encaissés, virements, report", async () => {
    const l = (await livre())!;
    const n = (nature: string) => l.ecritures.filter((e) => e.nature === nature).length;
    expect(n("report")).toBe(1);
    expect(n("cheque_emis")).toBe(27);
    expect(n("cheque_recu")).toBe(10);
    expect(n("effet_recu")).toBe(2);
    expect(n("virement_recu")).toBe(5);
    expect(n("virement_emis")).toBe(1);
    expect(n("autre")).toBe(0);
  });

  it("recolle les libellés coupés sur plusieurs lignes et lit les noms", async () => {
    const l = (await livre())!;
    expect(l.ecritures.find((e) => e.piece === "135")?.libelle).toBe("BLOCAGE CHQ N°114826");
    expect(l.ecritures.find((e) => e.piece === "22")?.libelle).toBe("PAIEMENT CHQ N°144167 ADEL EDHAWTHI");
    expect(l.ecritures.find((e) => e.piece === "246")?.libelle).toBe("TRANSPFET ETRNAGER SO FOR TRADE");
  });

  it("remplit la souche de chèques avec les chèques émis : date, n°, bénéficiaire, montant et banque (journal)", async () => {
    const l = (await livre())!;
    const souche = lignesPourTableau("souche_cheques", l.ecritures);
    expect(souche).toHaveLength(27);
    expect(souche.find((r) => r.num_cheque === "144167")).toEqual({
      date: "2026-04-02", num_cheque: "144167", beneficiaire: "ADEL EDHAWTHI", motif: "Paiement par chèque", montant: 1560, compte_bancaire: "BTK", observations: "",
    });
    expect(souche.find((r) => r.num_cheque === "4001511")).toMatchObject({ beneficiaire: "BATTERIE QODS AUT", motif: "Règlement par chèque", compte_bancaire: "ZITO", montant: 820 });
    expect(souche.find((r) => r.num_cheque === "173746")).toMatchObject({ beneficiaire: "SPLENDID", montant: 804.5 });
  });

  it("remplit les bordereaux de remise de chèques avec les chèques encaissés, et ceux des traites avec les effets, sans inventer le bordereau", async () => {
    const l = (await livre())!;
    const rem = lignesPourTableau("bordereaux_remise_cheques", l.ecritures);
    expect(rem).toHaveLength(10);
    expect(rem[0]).toEqual({ date_remise: "2026-01-30", num_bordereau: "", montant: "", banque: "BTK", num_cheque: "8431", client_emetteur: "", montant_cheque: 2680.089, date_echeance: "", observations: "" });
    const traites = lignesPourTableau("bordereaux_traites_recues", l.ecritures);
    expect(traites).toHaveLength(2);
    expect(traites[0]).toMatchObject({ num_bordereau: "", montant: "", date_echeance: "" });
    expect(traites[0]).toHaveProperty("num_traite");
    expect(traites[0]).toHaveProperty("montant_traite");
    // Chèques et effets ensemble : les 12 écritures encaissées, soit le même total qu'avant la séparation.
    const total = (lignes: Record<string, unknown>[], col: string) => lignes.reduce((s, r) => s + (r[col] as number), 0);
    expect(total(rem, "montant_cheque") + total(traites, "montant_traite")).toBeCloseTo(69566.458, 2);
  });

  it("remplit les virements reçus (émetteur lu après le motif) et émis", async () => {
    const l = (await livre())!;
    const recus = lignesPourTableau("virements_recus", l.ecritures);
    expect(recus).toHaveLength(5);
    expect(recus.find((r) => r.montant === 16231.38)).toMatchObject({ emetteur: "SO FOR TRADE", reference: "TRANSPFET ETRNAGER", compte_bancaire: "BTK", date: "2026-04-28" });
    expect(recus.find((r) => r.montant === 1547.537)).toMatchObject({ reference: "VIR ETRANGER", compte_bancaire: "ZITO" });
    const emis = lignesPourTableau("virements_emis", l.ecritures);
    expect(emis).toEqual([expect.objectContaining({ date: "2026-03-06", beneficiaire: "VAS", montant: 1282.05, compte_bancaire: "BTK" })]);
  });

  it("n'alimente aucun autre tableau", async () => {
    const l = (await livre())!;
    expect(lignesPourTableau("etat_caisse", l.ecritures)).toEqual([]);
    expect(lignesPourTableau("virements_salaire", l.ecritures)).toEqual([]);
  });
});

describe("grand-livre : lecture et classement", () => {
  it.each([
    ["ENC CHQ N°8431", 0, 2680, "BTK", "cheque_recu"],
    ["BLOCAGE CHQ N°108042", 1000, 0, "BTK", "cheque_emis"],
    ["BLOCAGE N°197243", 2000, 0, "BTK", "cheque_emis"],
    ["REG CHQ N°12", 1269, 0, "UBCI", "cheque_emis"],
    ["RESERVATION CHQ N°4001504", 5200, 0, "ZITO", "cheque_emis"],
    ["REMISE EFFET N°23402", 0, 11610, "BTK", "effet_recu"],
    ["ENC EFFET N°1433489", 0, 4000, "BTK", "effet_recu"],
    ["VIR EMIS VAS", 1282, 0, "BTK", "virement_emis"],
    ["VIR ETRANGER", 0, 1547, "ZITO", "virement_recu"],
    ["SOLDE ANTERIEURE", 0, 483589, "RAN", "report"],
    ["AUTRE CHOSE", 10, 0, "BTK", "autre"],
  ] as const)("« %s » -> %s", (libelle, debit, credit, journal, nature) => {
    expect(natureEcriture(libelle, debit, credit, journal)).toBe(nature);
  });

  it("découpe un libellé en motif, numéro et nom", () => {
    expect(decouperLibelle("PAIEMENT CHQ N°144167 ADEL EDHAWTHI")).toEqual({ base: "PAIEMENT CHQ", numero: "144167", reste: "ADEL EDHAWTHI" });
    expect(decouperLibelle("VIR ETRANGER")).toEqual({ base: "VIR ETRANGER", numero: "", reste: "" });
    expect(decouperLibelle("TRANSPFET ETRNAGER SO FOR TRADE")).toEqual({ base: "TRANSPFET ETRNAGER", numero: "", reste: "SO FOR TRADE" });
  });

  it("refuse un tableau qui n'est pas un grand-livre", () => {
    expect(lireGrandLivre([[["a", "b"], ["1", "2"]]])).toBeNull();
  });
});
