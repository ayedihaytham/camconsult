import { describe, expect, it } from "vitest";
import {
  RACINE_SOCIETE_DESCRIPTION,
  classerDansStructuration,
  provisionnerArborescenceSociete,
} from "./classement";
import type { Noeud } from "@/types";

/** Arborescence en mémoire, comme le store (addNoeud / updateNoeud). */
function memoire(initial: Noeud[] = []) {
  const noeuds = [...initial];
  let seq = 0;
  return {
    noeuds,
    addNoeud: async (d: Omit<Noeud, "id" | "majLe" | "creeLe">) => {
      const n = { ...d, id: `n${++seq}`, majLe: "2026-09-24", creeLe: "2026-09-24" } as Noeud;
      noeuds.push(n);
      return n;
    },
    updateNoeud: async (id: string, patch: Partial<Noeud>) => {
      const i = noeuds.findIndex((n) => n.id === id);
      noeuds[i] = { ...noeuds[i], ...patch };
    },
  };
}
const chemin = (noeuds: Noeud[], n: Noeud) => {
  const p: string[] = [];
  for (let c: Noeud | undefined = n; c; c = noeuds.find((x) => x.id === c!.parentId)) p.unshift(c.libelle);
  return p.join(" › ");
};
const S = { societeId: "s1", societeLibelle: "01-RUSPINA" };

describe("provisionnerArborescenceSociete", () => {
  it("société › Comptabilité générale [année] › 8 dossiers, sans doublon", async () => {
    const m = memoire();
    expect(await provisionnerArborescenceSociete({ ...m, noeuds: [...m.noeuds], ...S, annee: 2026 })).toBe(10);
    const racine = m.noeuds.find((n) => n.parentId === null)!;
    expect(racine).toMatchObject({ libelle: "01-RUSPINA", societeId: "s1", description: RACINE_SOCIETE_DESCRIPTION });
    const achat = m.noeuds.find((n) => n.libelle === "achat")!;
    expect(chemin(m.noeuds, achat)).toBe("01-RUSPINA › Comptabilité générale 2026 › achat");
    expect(m.noeuds.filter((n) => n.parentId === m.noeuds.find((x) => x.libelle === "Comptabilité générale 2026")!.id)).toHaveLength(8);

    // rejoué : rien de plus ; autre année : même racine, un 2e dossier annuel
    expect(await provisionnerArborescenceSociete({ ...m, noeuds: [...m.noeuds], ...S, annee: 2026 })).toBe(0);
    expect(await provisionnerArborescenceSociete({ ...m, noeuds: [...m.noeuds], ...S, annee: 2025 })).toBe(9);
    expect(m.noeuds.filter((n) => n.parentId === null)).toHaveLength(1);
    expect(m.noeuds.filter((n) => n.parentId === racine.id).map((n) => n.libelle).sort()).toEqual([
      "Comptabilité générale 2025",
      "Comptabilité générale 2026",
    ]);
  });

  it("reprend un dossier créé à la main au nom de la société", async () => {
    const m = memoire([
      { id: "manuel", libelle: "01-ruspina", description: "", type: "dossier", societeId: "s1", parentId: null, majLe: "", creeLe: "" } as Noeud,
    ]);
    await provisionnerArborescenceSociete({ ...m, noeuds: [...m.noeuds], ...S, annee: 2026 });
    expect(m.noeuds.filter((n) => n.parentId === null)).toHaveLength(1);
    expect(m.noeuds.find((n) => n.id === "manuel")!.description).toBe(RACINE_SOCIETE_DESCRIPTION);
  });
});

describe("classerDansStructuration", () => {
  it("société › Comptabilité générale <année de la pièce> › catégorie, sans doublon", async () => {
    const m = memoire();
    const args = { ...m, ...S, categorie: "achat" as const, date: "2025-03-14", nomBase: "facture-12", dataUrl: "data:application/pdf;base64,QUFB" };
    const r1 = await classerDansStructuration({ ...args, noeuds: [...m.noeuds] });
    expect(r1.dejaClasse).toBe(false);
    expect(chemin(m.noeuds, r1.noeud)).toBe("01-RUSPINA › Comptabilité générale 2025 › achat › facture-12.pdf");
    const r2 = await classerDansStructuration({ ...args, noeuds: [...m.noeuds] });
    expect(r2.dejaClasse).toBe(true);
    expect(m.noeuds.filter((n) => n.type === "fichier")).toHaveLength(1);
  });
});
