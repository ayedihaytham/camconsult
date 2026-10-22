import { describe, expect, it } from "vitest";
import { doublonsSupprimables, doublonsSwift, virementDejaPresent } from "./swiftDoublons";
import type { SwiftVirement } from "@/types";

const v = (id: string, extra: Partial<SwiftVirement> = {}): SwiftVirement => ({
  id, societeId: "s", date: "2026-08-10", montant: 7672.6, libelle: "ACHAT NEGOCIE SUR LE MARCHE", banque: "BANQ", envoye: false,
  justifie: 0, reste: 7672.6, devise: "", equivalentDevise: null, justifieDevise: 0, resteDevise: null, statut: "a_justifier", factures: [], ...extra,
});
const facture = { id: "f", numFacture: "F1", montantDevise: 1, devise: "EUR", taux: 3, montantTnd: 3 };

describe("virements SWIFT en double", () => {
  it("regroupe ceux qui ont même date, même montant et même libellé (casse, accents et espaces ignorés)", () => {
    const memes = doublonsSwift([v("a"), v("b", { libelle: "  achat négocié sur le  marché " }), v("c", { montant: 1 })]);
    expect(memes).toHaveLength(1);
    expect(memes[0].doublons).toHaveLength(1);
  });

  it("garde le plus avancé : celui qui a des factures, puis celui qui est envoyé", () => {
    const [g] = doublonsSwift([v("vide"), v("envoye", { envoye: true }), v("justifie", { envoye: true, factures: [facture] })]);
    expect(g.garde.id).toBe("justifie");
    expect(g.doublons.map((x) => x.id).sort()).toEqual(["envoye", "vide"]);
  });

  it("ne propose de supprimer que les doublons non envoyés et sans facture", () => {
    const liste = [v("a", { envoye: true, factures: [facture] }), v("b"), v("c", { envoye: true }), v("d", { factures: [facture] })];
    expect(doublonsSupprimables(liste).map((x) => x.id)).toEqual(["b"]);
  });

  it("un virement unique n'est jamais un doublon", () => {
    expect(doublonsSwift([v("a"), v("b", { date: "2026-08-11" })])).toEqual([]);
    expect(doublonsSupprimables([v("a")])).toEqual([]);
  });
});

describe("ligne d'import déjà présente dans le module", () => {
  it("même date et même montant", () => {
    const module = [{ date: "2026-08-10", montant: 7672.6 }];
    expect(virementDejaPresent({ date: "2026-08-10", montant: 7672.6 }, module)).toBe(true);
    expect(virementDejaPresent({ date: "2026-08-10", montant: 7672 }, module)).toBe(false);
    expect(virementDejaPresent({ date: "2026-08-11", montant: 7672.6 }, module)).toBe(false);
  });
});
