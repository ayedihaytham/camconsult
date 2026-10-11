import { describe, expect, it } from "vitest";
import type { Noeud } from "@/types";
import { anneeDuLibelle, comptesParMois, fichiersDuMois } from "./structurationMois";

const noeud = (id: string, parentId: string | null, type: "dossier" | "fichier", creeLe = "2026-01-10T08:00:00Z"): Noeud =>
  ({ id, parentId, type, libelle: id, description: "", societeId: "s1", creeLe, majLe: creeLe }) as unknown as Noeud;

describe("mois de l'organigramme", () => {
  it("lit l'année d'un libellé", () => {
    expect(anneeDuLibelle("Comptabilité générale 2026")).toBe(2026);
    expect(anneeDuLibelle("achat")).toBeNull();
  });

  it("range les fichiers sous le mois de leur date d'ajout, à tous les niveaux", () => {
    const nodes = [
      noeud("achat", "annee", "dossier"),
      noeud("f1", "achat", "fichier", "2026-01-05T08:00:00Z"),
      noeud("f2", "achat", "fichier", "2026-01-20T08:00:00Z"),
      noeud("sous", "achat", "dossier"),
      noeud("f3", "sous", "fichier", "2026-03-02T08:00:00Z"),
      noeud("f4", "achat", "fichier", "2025-12-30T08:00:00Z"),
    ];
    const comptes = comptesParMois("achat", nodes, 2026);
    expect(comptes[0]).toBe(2);
    expect(comptes[2]).toBe(1);
    expect(comptes.reduce((a, c) => a + c, 0)).toBe(3); // le fichier de 2025 n'est pas compté
    expect(comptesParMois("achat", nodes, null).reduce((a, c) => a + c, 0)).toBe(4);
  });

  it("ne compte rien pour un dossier vide", () => {
    expect(comptesParMois("vide", [noeud("vide", "annee", "dossier")], 2026)).toEqual(new Array(12).fill(0));
  });

  it("liste les fichiers d'un mois, du plus récent au plus ancien", () => {
    const nodes = [
      noeud("achat", "annee", "dossier"),
      noeud("f1", "achat", "fichier", "2026-01-05T08:00:00Z"),
      noeud("f2", "achat", "fichier", "2026-01-20T08:00:00Z"),
      noeud("f3", "achat", "fichier", "2026-02-02T08:00:00Z"),
    ];
    expect(fichiersDuMois("achat", nodes, 2026, 0).map((n) => n.id)).toEqual(["f2", "f1"]);
    expect(fichiersDuMois("achat", nodes, 2026, 5)).toEqual([]);
  });
});
