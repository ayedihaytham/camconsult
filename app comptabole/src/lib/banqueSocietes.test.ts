import { describe, expect, it } from "vitest";
import { aFaire, effectifs, etatSociete, listerSocietes, moisEnLettres, totauxCabinet } from "./banqueSocietes";
import type { Societe, SyntheseBanque } from "@/types";

const societe = (id: string, raisonSociale: string, extra: Partial<Societe> = {}): Societe => ({ id, raisonSociale, theme: "PME", rne: "", code: id.toUpperCase(), ...extra }) as unknown as Societe;
const synth = (societeId: string, patch: Partial<SyntheseBanque> = {}): SyntheseBanque => ({
  societeId, comptes: [{ id: `c-${societeId}`, banque: "BTL", devise: "TND", solde: 1000 }], mouvements: 10, dernierMouvement: "2026-08-31", paiementsARapprocher: 0, aRevoir: 0,
  annee: 2026, mois: ["ok", "ok", null, null, null, null, null, null, null, null, null, null], moisEnEcart: 0, moisASaisir: 0, ecarts: [], aSaisir: [], ...patch,
});

const S = [societe("a", "05-I CARGO LINE"), societe("b", "07-MS TRANSPORT"), societe("c", "12-PETRA"), societe("d", "CAM"), societe("e", "SOCIETE DEMO", { rne: "APM-DEMO" })];
const synthese: Record<string, SyntheseBanque | undefined> = {
  a: synth("a", { paiementsARapprocher: 7 }),
  b: synth("b"),
  c: synth("c", { paiementsARapprocher: 60, aRevoir: 16, moisEnEcart: 2, ecarts: [{ mois: "2026-06", devise: "TND", banque: "BTL", ecart: 3.57 }, { mois: "2026-07", devise: "TND", banque: "BTL", ecart: 5 }] }),
  d: synth("d", { moisASaisir: 1, aSaisir: [{ mois: "2026-02", devise: "EUR", banque: "BTL" }] }),
};

describe("choix de la société du suivi bancaire", () => {
  it("état d'une société : à traiter dès qu'il y a un paiement à rapprocher, une ligne à revoir, un écart ou un solde à saisir ; à jour sinon ; sans compte", () => {
    expect(etatSociete(synthese.a)).toBe("traiter");
    expect(etatSociete(synthese.d)).toBe("traiter");
    expect(etatSociete(synth("x", { aRevoir: 1 }))).toBe("traiter");
    expect(etatSociete(synthese.b)).toBe("jour");
    expect(etatSociete(synthese.e)).toBe("sans");
    expect(etatSociete(synth("x", { comptes: [] }))).toBe("sans");
  });

  it("les chiffres du haut : toutes, à traiter, à jour, sans compte", () => {
    expect(effectifs(S, synthese)).toEqual({ toutes: 5, traiter: 3, jour: 1, sans: 1 });
  });

  it("les sociétés à traiter d'abord (par ordre naturel), puis à jour, puis sans compte", () => {
    expect(listerSocietes(S, synthese, { recherche: "", filtre: "toutes" }).map((s) => s.id)).toEqual(["a", "c", "d", "b", "e"]);
    expect(listerSocietes(S, synthese, { recherche: "", filtre: "traiter" }).map((s) => s.id)).toEqual(["a", "c", "d"]);
    expect(listerSocietes(S, synthese, { recherche: "", filtre: "sans" }).map((s) => s.id)).toEqual(["e"]);
  });

  it("la recherche porte sur le nom, le thème, le RNE et le code, sans accents ni casse", () => {
    expect(listerSocietes(S, synthese, { recherche: "petra", filtre: "toutes" }).map((s) => s.id)).toEqual(["c"]);
    expect(listerSocietes(S, synthese, { recherche: "apm-demo", filtre: "toutes" }).map((s) => s.id)).toEqual(["e"]);
    expect(listerSocietes(S, synthese, { recherche: "pme", filtre: "jour" }).map((s) => s.id)).toEqual(["b"]);
    expect(listerSocietes(S, synthese, { recherche: "zzz", filtre: "toutes" })).toEqual([]);
  });

  it("le total du cabinet : paiements à rapprocher et mois en écart", () => {
    expect(totauxCabinet(S, synthese)).toEqual({ paiements: 67, moisEnEcart: 2 });
    expect(totauxCabinet([S[1]], synthese)).toEqual({ paiements: 0, moisEnEcart: 0 });
  });

  it("ce qu'il reste à faire, en clair : paiements, écarts du plus ancien au plus récent, solde réel à saisir, lignes à revoir", () => {
    expect(aFaire(synthese.c)).toEqual([
      "60 paiements à rapprocher avec le suivi fournisseur",
      "Écart de 3,570 TND en juin 2026",
      "Écart de 5,000 TND en juillet 2026",
      "16 lignes marquées « à revoir »",
    ]);
    expect(aFaire(synthese.d)).toEqual(["Solde réel de février 2026 à saisir (EUR)"]);
    expect(aFaire(synth("x", { paiementsARapprocher: 1, aRevoir: 1 }))).toEqual(["1 paiement à rapprocher avec le suivi fournisseur", "1 ligne marquée « à revoir »"]);
    expect(aFaire(synthese.b)).toEqual([]);
    expect(aFaire(synthese.e)).toEqual([]);
    expect(aFaire(synth("x", { moisASaisir: 3, aSaisir: [{ mois: "2026-05", devise: "TND", banque: "BTL" }, { mois: "2026-06", devise: "TND", banque: "BTL" }, { mois: "2026-07", devise: "TND", banque: "BTL" }] }))).toEqual(["3 soldes réels à saisir (dernier : juillet 2026)"]);
  });

  it("plus de trois écarts : les trois derniers sont dits, le reste est compté", () => {
    const ecarts = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"].map((mois) => ({ mois, devise: "EUR", banque: "BTL", ecart: 1 }));
    const t = aFaire(synth("x", { moisEnEcart: 5, ecarts }));
    expect(t).toEqual(["Écart de 1,000 EUR en mars 2026", "Écart de 1,000 EUR en avril 2026", "Écart de 1,000 EUR en mai 2026", "… et 2 autres mois en écart"]);
  });

  it("« 2026-06 » se dit « juin 2026 »", () => {
    expect(moisEnLettres("2026-06")).toBe("juin 2026");
    expect(moisEnLettres("2025-12")).toBe("décembre 2025");
  });
});
