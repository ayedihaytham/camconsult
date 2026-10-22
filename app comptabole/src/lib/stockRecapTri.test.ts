import { describe, expect, it } from "vitest";
import { trierParNumero } from "./stockRecap";

const m = (id: string, venteNumFacture: string, achatDate: string | null = null) => ({ id, venteNumFacture, achatDate });

describe("tri des mouvements de stock par n° de mouvement", () => {
  it("classe les n° du plus petit au plus grand, en comparant les chiffres comme des nombres", () => {
    const ordre = trierParNumero([m("a", "2600091"), m("b", "2600084"), m("c", "2600089"), m("d", "2600087")]).map((x) => x.id);
    expect(ordre).toEqual(["b", "d", "c", "a"]);
    expect(trierParNumero([m("a", "F10"), m("b", "F9"), m("c", "F100")]).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("place à la fin les mouvements sans n° de vente, par date d'achat, et garde l'ordre de saisie à égalité", () => {
    const ordre = trierParNumero([m("sans2", "", "2026-09-01"), m("v2", "20"), m("sans1", "", "2026-08-01"), m("v1", "10"), m("egal", "20")]).map((x) => x.id);
    expect(ordre).toEqual(["v1", "v2", "egal", "sans1", "sans2"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const entree = [m("a", "2"), m("b", "1")];
    trierParNumero(entree);
    expect(entree.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
