import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { lireTextePdf, reconstruireTableau } from "@/lib/pdfToTables";
import { classeCompte, dejaPresente, decouperLibelle, lignesPourTableau, ligneDepuisEcriture, lireGrandLivre, natureEcriture, TABLEAU_PAR_NATURE } from "./grandLivre";

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
      date: "2026-04-02", num_cheque: "144167", beneficiaire: "ADEL EDHAWTHI", motif: "Paiement par chèque", montant: 1560, banque: "BTK", observations: "Paiement par chèque · GL 461000 · BTK · p.22",
    });
    expect(souche.find((r) => r.num_cheque === "4001511")).toMatchObject({ beneficiaire: "BATTERIE QODS AUT", motif: "Règlement par chèque", banque: "ZITO", montant: 820 });
    expect(souche.find((r) => r.num_cheque === "173746")).toMatchObject({ beneficiaire: "SPLENDID", montant: 804.5 });
  });

  it("remplit les bordereaux de remise de chèques avec les chèques encaissés, et ceux des traites avec les effets, sans inventer le bordereau", async () => {
    const l = (await livre())!;
    const rem = lignesPourTableau("bordereaux_remise_cheques", l.ecritures);
    expect(rem).toHaveLength(10);
    expect(rem[0]).toEqual({ date_remise: "2026-01-30", num_bordereau: "", montant: "", banque: "BTK", num_cheque: "8431", client_emetteur: "", montant_cheque: 2680.089, date_echeance: "", observations: "Chèque encaissé · GL 461000 · BTK · p.169" });
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

describe.skipIf(!existsSync(PDF))("grand-livre 461 : sens précis, destinations et reprise", () => {
  it("donne à chaque écriture son sens précis (règlement, paiement, blocage, réservation, encaissement, virement étranger…)", async () => {
    const l = (await livre())!;
    const compte = (s: string) => l.ecritures.filter((e) => e.sousType === s).length;
    expect(compte("Règlement par chèque")).toBe(4);
    expect(compte("Paiement par chèque")).toBe(1);
    expect(compte("Chèque réservé")).toBe(2);
    expect(compte("Chèque bloqué")).toBe(20);
    expect(compte("Chèque encaissé")).toBe(10);
    expect(compte("Effet remis à l'encaissement")).toBe(1);
    expect(compte("Effet encaissé")).toBe(1);
    expect(compte("Virement de l'étranger")).toBe(3);
    expect(compte("Transfert de l'étranger")).toBe(1);
    expect(compte("Virement reçu")).toBe(1);
    expect(compte("Virement émis")).toBe(1);
    expect(compte("Solde antérieur")).toBe(1);
    expect(compte("À classer")).toBe(0);
    expect(l.comptes).toHaveLength(1);
    expect(l.comptes[0].classe).toBe("attente");
  });

  it("chaque nature a son tableau ; le solde antérieur n'en a aucun ; les chèques émis vont dans l'état tenu par le cabinet", async () => {
    const l = (await livre())!;
    const parTableau = new Map<string, number>();
    for (const e of l.ecritures) {
      const t = TABLEAU_PAR_NATURE[e.nature];
      if (t) parTableau.set(t, (parTableau.get(t) ?? 0) + 1);
    }
    expect(Object.fromEntries(parTableau)).toEqual({ etat_cheques_emis: 27, bordereaux_remise_cheques: 10, bordereaux_traites_recues: 2, virements_recus: 5, virements_emis: 1 });
    expect(TABLEAU_PAR_NATURE.report).toBeNull();
  });

  it("reconnaît une écriture déjà importée (repère dans Observations) ou saisie à la main (même n° et même montant)", async () => {
    const l = (await livre())!;
    const e = l.ecritures.find((x) => x.piece === "22")!;
    const importee = ligneDepuisEcriture("etat_cheques_emis", e);
    expect(dejaPresente("etat_cheques_emis", e, [importee])).toBe(true);
    expect(dejaPresente("etat_cheques_emis", e, [{ num_cheque: "144167", montant: "1 560,000", observations: "" }])).toBe(true);
    expect(dejaPresente("etat_cheques_emis", e, [{ num_cheque: "144167", montant: 999, observations: "" }])).toBe(false);
    expect(dejaPresente("etat_cheques_emis", e, [])).toBe(false);
    const vir = l.ecritures.find((x) => x.piece === "18")!;
    expect(dejaPresente("virements_recus", vir, [{ date: "2026-02-10", montant: 6208.274, compte_bancaire: "ZITO", observations: "" }])).toBe(true);
  });
});

/** Grand-livre au format reconstruit d'un PDF Sage : en-tête, puis comptes enchaînés. */
const document = (...corps: string[][]) => [[["CAB X", "Grand-livre des comptes"], ["Date C.j N° pièce", "Libellé écriture", "Mouvement débit", "Mouvement crédit", "Solde"], ...corps]];

describe("grand-livre : le sens dépend du type de compte", () => {
  it.each([
    // [classe, libellé, débit, crédit, nature]
    ["banque", "ENC CHQ N°11", 1000, 0, "cheque_recu"],
    ["banque", "REG CHQ N°12", 0, 800, "cheque_emis"],
    ["banque", "VIR RECU CLIENT", 500, 0, "virement_recu"],
    ["banque", "VIR EMIS FOURNISSEUR", 0, 300, "virement_emis"],
    ["client", "REG CHQ N°5", 0, 2000, "cheque_recu"],
    ["client", "FACTURE 12", 2000, 0, "autre"],
    ["client", "CHQ IMPAYE N°5", 2000, 0, "autre"],
    ["fournisseur", "REG CHQ N°9", 700, 0, "cheque_emis"],
    ["fournisseur", "VIR", 700, 0, "virement_emis"],
    ["fournisseur", "FACTURE 7", 0, 700, "autre"],
    ["attente", "ENC CHQ N°8", 0, 100, "cheque_recu"],
  ] as const)("%s : « %s » (D %s, C %s) -> %s", (classe, libelle, debit, credit, nature) => {
    expect(natureEcriture(libelle, debit, credit, "BTK", classe)).toBe(nature);
  });

  it("numéro de compte -> type : 46/47 attente, 51/52 banque, 41 clients, 40 fournisseurs", () => {
    expect([classeCompte("461000"), classeCompte("471000"), classeCompte("512000"), classeCompte("411001"), classeCompte("401001"), classeCompte("531000")]).toEqual(["attente", "attente", "banque", "client", "fournisseur", "inconnue"]);
  });

  it("un grand-livre complet de plusieurs comptes : chaque compte garde son sens, ses totaux et son tiers", () => {
    const l = lireGrandLivre(
      document(
        ["512000 BANQUE BTK"],
        ["020126 BTK 1", "ENC CHQ N°11 ALPHA", "1 000,000", "", ""],
        ["030126 BTK 2", "REG CHQ N°12 BETA", "", "800,000", ""],
        ["", "Total", "1 000,000", "800,000", ""],
        ["411001 ALPHA SARL"],
        ["040126 VTE 3", "REG CHQ N°5", "", "2 000,000", ""],
        ["", "Total", "0,000", "2 000,000", ""],
        ["401001 BETA SA"],
        ["050126 ACH 4", "REG CHQ N°9", "700,000", "", ""],
        ["", "Total", "700,000", "0,000", ""],
      ),
    )!;
    expect(l.comptes.map((c) => [c.compte.slice(0, 6), c.classe, c.ecritures])).toEqual([["512000", "banque", 2], ["411001", "client", 1], ["401001", "fournisseur", 1]]);
    expect(l.controle).toBe(true);
    expect(l.totaux).toBeNull();
    expect(l.ecritures.map((e) => e.nature)).toEqual(["cheque_recu", "cheque_emis", "cheque_recu", "cheque_emis"]);
    const [, , , achat] = l.ecritures;
    expect(ligneDepuisEcriture("etat_cheques_emis", achat)).toMatchObject({ beneficiaire: "BETA SA", montant: 700, num_cheque: "9" });
    expect(ligneDepuisEcriture("bordereaux_remise_cheques", l.ecritures[0])).toMatchObject({ client_emetteur: "ALPHA", montant_cheque: 1000 });
  });

  it("compte client : l'émetteur manquant du libellé est le client du compte", () => {
    const l = lireGrandLivre(document(["411000 CLIENT DELTA"], ["040126 VTE 3", "REG CHQ N°5", "", "2 000,000", ""]))!;
    expect(l.comptes[0].classe).toBe("client");
    expect(ligneDepuisEcriture("bordereaux_remise_cheques", l.ecritures[0])).toMatchObject({ client_emetteur: "CLIENT DELTA", num_cheque: "5", montant_cheque: 2000 });
  });

  it("un total qui ne correspond pas aux écritures lues est signalé", () => {
    const l = lireGrandLivre(document(["461000 ATTENTE"], ["040126 BTK 3", "ENC CHQ N°5", "", "2 000,000", ""], ["", "Total", "0,000", "9 999,000", ""]))!;
    expect(l.controle).toBe(false);
  });
});
