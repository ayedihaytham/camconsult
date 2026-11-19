import { describe, expect, it } from "vitest";
import type { DashboardPortefeuilleItem } from "./dashboardData";
import { circuitOuvert, dossiersDeLEtat, etatClient } from "./portefeuille";

const dossier = (nom: string, patch: Partial<DashboardPortefeuilleItem> = {}): DashboardPortefeuilleItem => ({
  societeId: nom, societeName: nom, enCours: 0, brouillon: 0, transmis: 0, aCorriger: 0, valide: 0, enRetard: 0, prochaine: null, route: "/", ...patch,
});

describe("portefeuille clients", () => {
  it("classe un dossier : retard avant révision avant à jour", () => {
    expect(etatClient(dossier("a", { enRetard: 1, transmis: 1 }))).toBe("retard");
    expect(etatClient(dossier("b", { transmis: 1 }))).toBe("traiter");
    expect(etatClient(dossier("c", { aCorriger: 2 }))).toBe("traiter");
    expect(etatClient(dossier("d", { brouillon: 1 }))).toBe("jour");
  });
  it("le circuit ne garde que les étapes où se trouvent des collectes ouvertes", () => {
    expect(circuitOuvert(dossier("a", { brouillon: 2, transmis: 1, valide: 4 }))).toEqual([{ etape: "brouillon", n: 2 }, { etape: "transmis", n: 1 }]);
    expect(circuitOuvert(dossier("b"))).toEqual([]);
  });
  it("trie les dossiers d'un état : retards, puis collectes ouvertes, puis nom", () => {
    const liste = [dossier("Zed", { enRetard: 1, enCours: 1 }), dossier("Amir", { enRetard: 1, enCours: 1 }), dossier("Bako", { enRetard: 2, enCours: 2 }), dossier("Calme")];
    expect(dossiersDeLEtat(liste, "retard").map((d) => d.societeName)).toEqual(["Bako", "Amir", "Zed"]);
  });
});
