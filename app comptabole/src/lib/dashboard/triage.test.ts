import { describe, expect, it } from "vitest";
import type { Collecte } from "@/types";
import { buildPortefeuille, buildTriage } from "./dashboardData";

const NOW = new Date(2026, 10, 10, 9, 0, 0);
const noms = new Map([["s1", "Atlas Textile SARL"], ["s2", "Medina Pharma"]]);

function collecte(id: string, societeId: string, statut: Collecte["statut"], echeance: string | null, extra: Partial<Collecte> = {}): Collecte {
  return {
    id, societeId, periode: `P-${id}`, statut, onglets: [], devise: "TND", echeance, derniereRelanceLe: null, relanceCadenceJours: 3,
    creeLe: "2026-10-01T00:00:00Z", majLe: "2026-10-02T00:00:00Z", transmisLe: null, valideLe: null, ...extra,
  } as Collecte;
}

describe("file « À traiter maintenant »", () => {
  const liste = [
    collecte("a", "s1", "transmis", "2026-11-08"), // transmise et en retard
    collecte("b", "s2", "transmis", "2026-11-12", { tableauxTransmis: 2, tableauxDemandes: 5 }),
    collecte("c", "s1", "a_corriger", "2026-11-11"),
    collecte("d", "s2", "brouillon", "2026-11-20"), // chez le client, pas d'action du cabinet
    collecte("e", "s2", "valide", "2026-11-01"), // terminée
    collecte("f", "s1", "brouillon", "2026-11-01"), // en retard, chez le client
  ];

  it("garde les collectes en retard, à examiner et à corriger, et écarte le reste", () => {
    const t = buildTriage(liste, noms, NOW);
    expect(t.map((i) => i.id)).toEqual(["f", "a", "b", "c"]);
    expect(t.map((i) => i.groupe)).toEqual(["retard", "retard", "examiner", "corriger"]);
  });

  it("classe les retards du plus ancien au plus récent et donne les jours d'écart", () => {
    const t = buildTriage(liste, noms, NOW);
    expect(t.find((i) => i.id === "a")?.daysFromToday).toBe(-2);
    expect(t.find((i) => i.id === "b")?.daysFromToday).toBe(2);
  });

  it("reprend les tableaux et les autres collectes de la même société", () => {
    const t = buildTriage(liste, noms, NOW);
    const b = t.find((i) => i.id === "b")!;
    expect(b.tableauxTransmis).toBe(2);
    expect(b.tableauxDemandes).toBe(5);
    expect(b.societeName).toBe("Medina Pharma");
    expect(b.autres.map((x) => x.id).sort()).toEqual(["d", "e"]);
    expect(b.route).toBe("/collectes/b");
  });

  it("ignore les collectes archivées", () => {
    expect(buildTriage([collecte("z", "s1", "archive", "2026-10-01")], noms, NOW)).toEqual([]);
  });
});

describe("portefeuille", () => {
  it("résume le circuit des collectes de chaque société, retards d'abord", () => {
    const liste = [
      collecte("a", "s1", "transmis", "2026-11-08"),
      collecte("c", "s1", "a_corriger", "2026-11-11"),
      collecte("e", "s1", "valide", "2026-11-01"),
      collecte("b", "s2", "brouillon", "2026-11-20"),
      collecte("z", "s2", "archive", "2026-10-01"),
    ];
    const p = buildPortefeuille(liste, noms, NOW);
    expect(p.map((i) => i.societeId)).toEqual(["s1", "s2"]);
    expect(p[0]).toMatchObject({ enCours: 2, transmis: 1, aCorriger: 1, valide: 1, enRetard: 1 });
    expect(p[0].prochaine?.echeance).toBe("2026-11-08");
    expect(p[1]).toMatchObject({ enCours: 1, brouillon: 1, enRetard: 0 });
  });
});
