import { describe, expect, it } from "vitest";
import type { CompteBancaire, MouvementBancaire } from "@/types";
import { encaissementsCandidats, facturesCiteesClient, libelleNommeLeClient, normaliserNumeroFacture, numerosCitesClient, repartitionAuto } from "./suiviDeviseBanque";

describe("numéros de facture cités dans le libellé d'un encaissement", () => {
  it("lit les libellés réels du compte EUR", () => {
    expect(numerosCitesClient("PAIEMENT LC N°777LC08253090002 FACTURE N°95/2025 ELOMRANE ESSATAA")).toContain("95/2025");
    expect(numerosCitesClient("ENC IMLC-9031-005-25 AL KHALIJ GROUPE FAC N°003/2026")).toEqual(["3/2026"]);
    expect(numerosCitesClient("ENCAISSEMENT RUSPINA IMPORT/EXPORT FACT N°130+131+132+133/2025")).toEqual(["130/2025", "131/2025", "132/2025", "133/2025"]);
    expect(numerosCitesClient("ENCAISSEMENT RUSPINA (fact 2025135+2025136+2025137)")).toEqual(["2025135", "2025136", "2025137"]);
    expect(numerosCitesClient("ENCAISS RUSPINA RGLT FACT 260030/260031")).toEqual(["260030", "260031"]);
    expect(numerosCitesClient("ENCAISSEMENT RUSPINA (fact N° 63/2025+72/2025)")).toEqual(["63/2025", "72/2025"]);
    expect(numerosCitesClient("COMMISSION SUR REGLEMENT")).toEqual([]);
  });

  it("normalise un numéro de facture : zéros de tête, séparateur « - » ou « / »", () => {
    expect(["094/2025", "94-2025", "94 / 2025"].map(normaliserNumeroFacture)).toEqual(["94/2025", "94/2025", "94/2025"]);
    expect(normaliserNumeroFacture("2026-0042A")).toBe("20260042A");
  });

  it("retrouve les factures de la fiche citées (zéros de tête et séparateurs tolérés)", () => {
    const factures = [{ id: "a", nFacture: "01-2026" }, { id: "b", nFacture: "130/2025" }, { id: "c", nFacture: "131/2025" }, { id: "d", nFacture: "9/2025" }, { id: "e", nFacture: "260030" }];
    expect(facturesCiteesClient("FAC N°003/2026 ET 01/2026", factures)).toEqual(["a"]);
    expect(facturesCiteesClient("FACT 130+131+132+133/2025", factures)).toEqual(["b", "c"]);
    expect(facturesCiteesClient("RGLT FACT 260030/260031", factures)).toEqual(["e"]);
    expect(facturesCiteesClient("sans numéro", factures)).toEqual([]);
  });
});

describe("répartition automatique d'un encaissement sur les factures", () => {
  const f = (id: string, reste: number, dateFacture: string | null, ordre: number) => ({ id, reste, dateFacture, ordre });
  const factures = [f("a", 400, "2026-01-05", 1), f("b", 500, "2026-01-02", 2), f("c", 300, "2026-01-20", 3), f("soldee", 0, "2025-12-01", 0)];

  it("les factures citées d'abord, puis les plus anciennes ; une facture soldée est ignorée", () => {
    expect(repartitionAuto(1000, factures, ["c"])).toEqual({ affectations: [{ factureId: "c", montant: 300 }, { factureId: "b", montant: 500 }, { factureId: "a", montant: 200 }], nonReparti: 0 });
  });

  it("sans citation : de la plus ancienne à la plus récente, chacune dans la limite de son reste", () => {
    expect(repartitionAuto(600, factures)).toEqual({ affectations: [{ factureId: "b", montant: 500 }, { factureId: "a", montant: 100 }], nonReparti: 0 });
  });

  it("ce qui dépasse le total des restes reste non réparti", () => {
    expect(repartitionAuto(1500, factures)).toEqual({ affectations: [{ factureId: "b", montant: 500 }, { factureId: "a", montant: 400 }, { factureId: "c", montant: 300 }], nonReparti: 300 });
    expect(repartitionAuto(100, [])).toEqual({ affectations: [], nonReparti: 100 });
  });
});

describe("encaissements à affecter", () => {
  const comptes = [{ id: "eur", devise: "EUR" }, { id: "tnd", devise: "TND" }] as CompteBancaire[];
  const m = (id: string, compteId: string, dateOp: string, libelle: string, credit: number, affecteClient = 0) => ({ id, compteId, dateOp, libelle, details: "", credit, debit: 0, affecteClient }) as unknown as MouvementBancaire;
  const mouvements = [
    m("1", "eur", "2026-02-10", "ENCAISSEMENT RUSPINA FACT 130+131/2025", 1000, 600),
    m("2", "eur", "2026-03-02", "ENC AL KHALIJ GROUPE", 500),
    m("3", "eur", "2026-01-05", "ENCAISSEMENT RUSPINA", 300, 300),
    m("4", "tnd", "2026-02-10", "VIREMENT RUSPINA", 700),
  ];

  it("garde les crédits de la devise de la fiche qu'il reste à affecter ; ceux qui nomment le client passent d'abord", () => {
    const r = encaissementsCandidats(mouvements, comptes, "EUR", "RUSPINA IMPORT EXPORT");
    expect(r.map((c) => [c.mouvement.id, c.reste, c.nommeLeClient])).toEqual([["1", 400, true], ["2", 500, false]]);
  });

  it("un règlement en cours de modification libère sa part sur son propre encaissement", () => {
    const r = encaissementsCandidats(mouvements, comptes, "EUR", "RUSPINA", { "3": 300 });
    expect(r.find((c) => c.mouvement.id === "3")?.reste).toBe(300);
  });

  it("le nom du client se retrouve par son premier mot significatif", () => {
    expect(libelleNommeLeClient("ENCAISSEMENT RUSPINA (fact 63/2025)", "RUSPINA IMPORT/EXPORT")).toBe(true);
    expect(libelleNommeLeClient("ENC AL KHALIJ GROUPE", "RUSPINA")).toBe(false);
  });
});
