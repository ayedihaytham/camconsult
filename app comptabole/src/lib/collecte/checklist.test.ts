import { describe, expect, it } from "vitest";
import { checklistRows } from "./checklist";
import type { CollecteFull } from "@/types";

const base = {
  id: "c", societeId: "s", periode: "2026-09", statut: "brouillon", onglets: ["virements_recus", "etat_caisse"], devise: "TND",
  echeance: null, derniereRelanceLe: null, relanceCadenceJours: 3, creeLe: "2026-09-01", majLe: "2026-09-10T10:00:00", transmisLe: null,
  valideLe: null, sections: [], lignes: [], notes: [], fichiers: [],
} as unknown as CollecteFull;

const section = (onglet: string, patch: object = {}) => ({ id: onglet, onglet, commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, ...patch });

describe("lignes de la checklist", () => {
  it("laisse une pièce sans ligne ni case cochée en attente", () => {
    const [vir] = checklistRows(base);
    expect(vir).toMatchObject({ recu: false, recuAuto: false, total: null, dateSuivi: null, statutLabel: "En attente" });
  });

  it("compte une pièce cochée à la main avec la date et le total saisis", () => {
    const c = { ...base, sections: [section("virements_recus", { recuManuel: true, dateSuivi: "2026-10-05", totalSaisi: 3000 })] } as unknown as CollecteFull;
    const [vir] = checklistRows(c);
    expect(vir).toMatchObject({ recu: true, recuAuto: false, total: 3000, dateSuivi: "2026-10-05", statutLabel: "Reçu" });
    expect(vir.dateReception).toBe("05/10/2026");
  });

  it("garde une pièce cochée sans date ni total à vide, sans les inventer", () => {
    const c = { ...base, sections: [section("etat_caisse", { recuManuel: true })] } as unknown as CollecteFull;
    const caisse = checklistRows(c)[1];
    expect(caisse).toMatchObject({ recu: true, total: null, dateSuivi: null, dateReception: null });
  });

  it("calcule le total d'un tableau saisi et le reçoit d'office, sans tenir compte du total saisi", () => {
    const c = {
      ...base,
      lignes: [{ id: "l1", onglet: "virements_recus", ordre: 0, data: { montant: 1000 } }, { id: "l2", onglet: "virements_recus", ordre: 1, data: { montant: 250 } }],
      sections: [section("virements_recus", { totalSaisi: 99 })],
    } as unknown as CollecteFull;
    const [vir] = checklistRows(c);
    expect(vir).toMatchObject({ recu: true, recuAuto: true, total: 1250 });
    expect(vir.dateSuivi).toBe("2026-09-10");
  });
});
