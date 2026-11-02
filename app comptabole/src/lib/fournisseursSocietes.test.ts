import { describe, expect, it } from "vitest";
import { aFaire, effectifs, etatSociete, listerSocietes, totauxCabinet } from "./fournisseursSocietes";
import type { Societe, SyntheseFournisseurs } from "@/types";

const societe = (id: string, raisonSociale: string): Societe => ({ id, raisonSociale, theme: "PME", rne: "123A", code: id }) as unknown as Societe;
const synth = (societeId: string, patch: Partial<SyntheseFournisseurs> = {}): SyntheseFournisseurs => ({
  societeId, fournisseurs: 2, factures: 4, impayees: 0, soldes: [], reglements: 3, dernierReglement: "2026-08-01", paiementsARapprocher: 0, doublons: 0, reglementsAvantFacture: 0, principaux: [], ...patch,
});

const S = [societe("a", "Alpha"), societe("b", "Bravo"), societe("c", "Charlie"), societe("d", "Delta")];
const synthese = {
  a: synth("a", { impayees: 2, soldes: [{ devise: "TND", montant: 1500 }, { devise: "EUR", montant: 200 }] }),
  b: synth("b"),
  c: synth("c", { factures: 0, fournisseurs: 0, reglements: 0, dernierReglement: null }),
};

describe("sociétés du suivi fournisseur", () => {
  it("l'état : à traiter, à jour, sans facture (une société inconnue de la synthèse est sans facture)", () => {
    expect(etatSociete(synthese.a)).toBe("traiter");
    expect(etatSociete(synthese.b)).toBe("jour");
    expect(etatSociete(synthese.c)).toBe("sans");
    expect(etatSociete(undefined)).toBe("sans");
  });

  it("un paiement bancaire à rapprocher, un n° en double ou un règlement avant sa facture suffisent à demander du travail", () => {
    expect(etatSociete(synth("x", { paiementsARapprocher: 1 }))).toBe("traiter");
    expect(etatSociete(synth("x", { doublons: 2 }))).toBe("traiter");
    expect(etatSociete(synth("x", { reglementsAvantFacture: 1 }))).toBe("traiter");
    expect(etatSociete(synth("x", { factures: 0, paiementsARapprocher: 3 }))).toBe("traiter");
  });

  it("la liste met les sociétés à traiter d'abord, les sans-facture en dernier, et filtre par chiffre et par recherche", () => {
    expect(listerSocietes(S, synthese, { recherche: "", filtre: "toutes" }).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(listerSocietes([...S].reverse(), synthese, { recherche: "", filtre: "toutes" }).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(listerSocietes(S, synthese, { recherche: "", filtre: "traiter" }).map((s) => s.id)).toEqual(["a"]);
    expect(listerSocietes(S, synthese, { recherche: "", filtre: "sans" }).map((s) => s.id)).toEqual(["c", "d"]);
    expect(listerSocietes(S, synthese, { recherche: "BRAVO", filtre: "toutes" }).map((s) => s.id)).toEqual(["b"]);
  });

  it("les effectifs et les totaux du cabinet ; les devises ne s'additionnent pas", () => {
    expect(effectifs(S, synthese)).toEqual({ toutes: 4, traiter: 1, jour: 1, sans: 2 });
    const autre = { ...synthese, b: synth("b", { impayees: 1, paiementsARapprocher: 4, soldes: [{ devise: "TND", montant: 0.5 }] }) };
    expect(totauxCabinet(S, autre)).toEqual({ impayees: 3, paiements: 4, soldes: [{ devise: "TND", montant: 1500.5 }, { devise: "EUR", montant: 200 }] });
  });

  it("ce qu'il reste à faire, en clair", () => {
    expect(aFaire(synthese.b)).toEqual([]);
    expect(aFaire(undefined)).toEqual([]);
    expect(aFaire(synth("x", { impayees: 1, paiementsARapprocher: 2, doublons: 2, reglementsAvantFacture: 1 }))).toEqual([
      "1 facture à régler",
      "2 paiements en banque à rapprocher avec un règlement",
      "2 factures avec un n° en double : le règlement risque d'être compté deux fois",
      "1 règlement daté avant sa facture",
    ]);
  });
});
