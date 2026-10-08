import { describe, expect, it } from "vitest";
import type { CollecteSection, SectionStatut } from "@/types";
import { resumeSections, sectionOuverte, sectionStatut } from "./sections";

const section = (onglet: string, statut?: SectionStatut) => ({ onglet, statut }) as CollecteSection;

describe("circuit par tableau", () => {
  it("lit le statut propre à chaque tableau", () => {
    const c = { statut: "transmis" as const, sections: [section("a", "valide"), section("b", "a_corriger")] };
    expect(sectionStatut(c, "a")).toBe("valide");
    expect(sectionStatut(c, "b")).toBe("a_corriger");
  });

  it("reprend le statut de la collecte pour un tableau sans statut (collecte antérieure au circuit)", () => {
    expect(sectionStatut({ statut: "transmis", sections: [] }, "a")).toBe("transmis");
    expect(sectionStatut({ statut: "valide", sections: [section("a")] }, "a")).toBe("valide");
    expect(sectionStatut({ statut: "brouillon", sections: [] }, "a")).toBe("brouillon");
  });

  it("le client ne modifie un tableau que tant qu'il est à remplir ou à corriger", () => {
    const statuts: SectionStatut[] = ["brouillon", "a_corriger", "transmis", "valide", "archive"];
    expect(statuts.map(sectionOuverte)).toEqual([true, true, false, false, false]);
  });

  it("compte les tableaux de la collecte par statut", () => {
    const c = {
      statut: "brouillon" as const,
      onglets: ["a", "b", "c", "d"],
      sections: [section("a", "transmis"), section("b", "transmis"), section("c", "valide")],
    };
    expect(resumeSections(c)).toEqual({ brouillon: 1, transmis: 2, a_corriger: 0, valide: 1, archive: 0 });
  });
});
