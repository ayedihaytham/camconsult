import { describe, expect, it } from "vitest";
import {
  classerMouvement,
  controleSolde,
  dateFlexible,
  facturesCitees,
  fournisseurCite,
  lignesVersMouvements,
  moisDesMouvements,
  numerosDansLibelle,
  soldesCourants,
} from "./banque";
import type { CompteBancaire, MouvementBancaire } from "@/types";

const compte: CompteBancaire = { id: "c", banque: "BTL", devise: "EUR", numero: "", soldeDepart: 213.5, dateDepart: "2026-07-31", soldeReel: null, dateReel: null };
const mvt = (id: string, debit: number, credit: number, dateOp = "2026-08-03"): MouvementBancaire => ({
  id, compteId: "c", dateOp, dateValeur: null, libelle: "", details: "", reference: "", numPiece: "", debit, credit,
  type: "autre", reglementId: null, fournisseurCle: null,
});

describe("classement des mouvements", () => {
  it.each([
    ["LC PAYMENT BUIOT ALEAZ IMLC-9284-005-26 FACTURE N°2026061", 0, 22420, "encaissement_client"],
    ["LC PAYMENT BUIOT ALEAZ IMLC-9284-005-26 DATE FACTURE 06/04/26", 20250, 0, "paiement_fournisseur"],
    ["REGLEMENT INNORPI FAC N° 263500", 893.5, 0, "paiement_fournisseur"],
    ["CERTIFICATION CHEQ SOTACIB KAIROUAN", 296114.32, 0, "paiement_fournisseur"],
    ["TVA/COMM", 0.38, 0, "frais"],
    ["COMMISSION BANCAIRE", 15, 0, "frais"],
    ["FRAIS IBMB", 6.7, 0, "frais"],
    ["DEBLOCAGE CREDIT MCNE EN DEVISES", 0, 35280, "credit"],
    ["PAIEMENT INTERET", 104.66, 0, "credit"],
    ["OPERATION DE CHANGE", 0, 384750, "change"],
    ["VIREMENT AVANCE SUR SALAIRE DE AOUT GHOFRAN", 200, 0, "autre"],
  ] as const)("« %s » -> %s", (libelle, debit, credit, type) => {
    expect(classerMouvement(libelle, debit, credit)).toBe(type);
  });
});

describe("dates de relevé", () => {
  it.each([
    ["02-01-2026", "2026-01-02"],
    ["3/8/2026", "2026-08-03"],
    ["31.07.26", "2026-07-31"],
    ["2026-08-05", "2026-08-05"],
  ])("« %s » -> %s", (entree, attendu) => expect(dateFlexible(entree)).toBe(attendu));

  it("lit une date Excel (nombre de série) et refuse le reste", () => {
    expect(dateFlexible(46237)).toBe("2026-08-03");
    expect(dateFlexible("TOTAL")).toBeNull();
    expect(dateFlexible("32/13/2026")).toBeNull();
  });
});

describe("soldes", () => {
  it("cumule crédit − débit à partir du solde de départ, et contrôle le solde du relevé", () => {
    const l = [mvt("1", 0, 22420), mvt("2", 20250, 0), mvt("3", 0.38, 0)];
    const s = soldesCourants(compte, l);
    expect(s.get("1")).toBe(22633.5);
    expect(s.get("2")).toBe(2383.5);
    expect(s.get("3")).toBe(2383.12);
    expect(controleSolde(compte, l)).toEqual({ calcule: 2383.12, ecart: null });
    expect(controleSolde({ ...compte, soldeReel: 2383.12 }, l).ecart).toBe(0);
    expect(controleSolde({ ...compte, soldeReel: 2400 }, l).ecart).toBe(16.88);
  });

  it("liste les mois du plus récent au plus ancien", () => {
    expect(moisDesMouvements([mvt("1", 1, 0, "2026-07-05"), mvt("2", 1, 0, "2026-08-05"), mvt("3", 1, 0, "2026-08-09")])).toEqual(["2026-08", "2026-07"]);
  });
});

describe("rapprochement avec les factures", () => {
  const factures = [
    { id: "a", numFacture: "263500" },
    { id: "b", numFacture: "6608001609" },
    { id: "c", numFacture: "12" },
  ];

  it("extrait les numéros cités", () => {
    expect(numerosDansLibelle("REGLEMENT INNORPI FAC N 263500 DU 12/08")).toEqual(["263500"]);
  });

  it("retrouve les factures dont le numéro est cité dans le libellé", () => {
    expect(facturesCitees("REGLEMENT INNORPI FAC N° 263500", factures)).toEqual(["a"]);
    expect(facturesCitees("LC PAYMENT FACTURE 6608001609 ET 263500", factures)).toEqual(["a", "b"]);
    expect(facturesCitees("TVA/COMM", factures)).toEqual([]);
  });

  it("reconnaît le fournisseur cité, sans le deviner quand c'est ambigu", () => {
    const f = [{ cle: "sotacib", nom: "SOTACIB" }, { cle: "carthage cement", nom: "CARTHAGE CEMENT SA" }];
    expect(fournisseurCite("CERTIFICATION CHEQ SOTACIB KAIROUAN", f)?.cle).toBe("sotacib");
    expect(fournisseurCite("CERTIFICATION CHEQ CARTHAGE CEMENT", f)?.cle).toBe("carthage cement");
    expect(fournisseurCite("REGLEMENT CHAMBRE FAC 6306", f)).toBeNull();
  });
});

describe("import d'un relevé", () => {
  it("lit le relevé converti du PDF (Date, Libellé, Date de valeur, Débit, Crédit)", () => {
    const r = lignesVersMouvements([
      ["Date", "Libellé de l'opération", "Date de valeur", "Débit", "Crédit"],
      ["31-12-2025", "Solde au: 31/12/2025", "29-01-2026", "0,000", "16 426,680"],
      ["02-01-2026", "TVA sur Com", "02-01-2026", "0,950", "0,000"],
      ["02-01-2026", "Commission acceptation LC", "02-01-2026", 150, 0],
    ]);
    expect(r?.mouvements.map((m) => [m.dateOp, m.dateValeur, m.libelle, m.debit, m.credit, m.type])).toEqual([
      ["2026-01-02", "2026-01-02", "TVA sur Com", 0.95, 0, "frais"],
      ["2026-01-02", "2026-01-02", "Commission acceptation LC", 150, 0, "frais"],
    ]);
  });

  it("ne prend pas la ligne « Solde au… » pour une opération : elle donne le solde de départ", () => {
    const r = lignesVersMouvements([
      ["Date", "Libellé de l'opération", "Date de valeur", "Débit", "Crédit"],
      ["31-12-2025", "Solde au: 31/12/2025", "29-01-2026", "0,000", "16 426,680"],
      ["02-01-2026", "TVA sur Com", "02-01-2026", "0,950", "0,000"],
    ]);
    expect(r?.mouvements).toHaveLength(1);
    expect(r?.soldeOuverture).toEqual({ date: "2025-12-31", montant: 16426.68 });
  });

  it("lit la feuille du cabinet à deux blocs (société puis banque) : les colonnes de la banque", () => {
    const r = lignesVersMouvements([
      ["ACCOUNTS BTL BANK (EUR)"],
      ["DATE OP", "VALUE DATE", "DESCRIPTION", "REF", "Mvt", "N° PIECE", "PETRA CMC", "", "BANK", "", "BANK BALANCE"],
      ["", "", "", "", "", "", "DEBIT", "CREDIT", "DEBIT", "CREDIT", ""],
      ["DATE OP", "VALUE DATE", "DESCRIPTION", "REF", "Mvt", "N° PIECE", "DEBIT", "CREDIT", "DEBIT", "CREDIT", "BANK BALANCE"],
      ["03/08/2026", "03/08/2026", "LC PAYMENT BUIOT ALEAZ FACTURE N°2026061", "VTE 05-2026", "ACCOUNTING", "TF260764909717\TN1", 34045, 0, 0, 34045, 56678.5],
      ["03/08/2026", "03/08/2026", "LC PAYMENT BUIOT ALEAZ DATE FACTURE 06/04/26", "", "ACCOUNTING", "LD2620521717", 0, 20250, 20250, 0, 56303.5],
      ["TOTAL", "", "", "", "", "", 34045, 20250, 20250, 34045, ""],
    ]);
    expect(r?.mouvements).toHaveLength(2);
    expect(r?.mouvements[0]).toMatchObject({ reference: "VTE 05-2026", numPiece: "TF260764909717\TN1", debit: 0, credit: 34045, type: "encaissement_client" });
    expect(r?.mouvements[1]).toMatchObject({ numPiece: "LD2620521717", debit: 20250, credit: 0, type: "paiement_fournisseur" });
    expect(r?.ignorees).toBe(1);
  });

  it("refuse un tableau sans en-tête de relevé", () => {
    expect(lignesVersMouvements([["a", "b"], ["1", "2"]])).toBeNull();
  });
});
