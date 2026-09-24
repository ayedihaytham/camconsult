import { describe, expect, it } from "vitest";
import type { Collecte } from "@/types";
import {
  filterCollectes,
  formatCollecteDeadline,
  getCollecteStatusPresentation,
  getCollecteLensCounts,
  getCollecteNextAction,
  type CollecteListFilters,
} from "./collectionList";

const now = new Date(2026, 8, 24, 12);

function collecte(overrides: Partial<Collecte> = {}): Collecte {
  return {
    id: "collecte-1",
    societeId: "societe-1",
    periode: "Septembre 2026",
    statut: "brouillon",
    onglets: ["banque", "ventes"],
    devise: "TND",
    echeance: "2026-09-30",
    derniereRelanceLe: null,
    relanceCadenceJours: 3,
    creeLe: "2026-09-01T10:00:00.000Z",
    majLe: "2026-09-20T10:00:00.000Z",
    transmisLe: null,
    valideLe: null,
    ...overrides,
  };
}

const names = (id: string) => ({ "societe-1": "Atlas Conseil SARL", "societe-2": "Carthage Digital" })[id] ?? "Société";

const baseFilters: CollecteListFilters = {
  lens: "actives",
  query: "",
  societeId: "",
  periode: "",
  statut: "all",
  echeance: "all",
};

describe("Collecte Process Ledger list", () => {
  it("preserves Actives, Archivées and Toutes counts", () => {
    const items = [
      collecte(),
      collecte({ id: "collecte-2", statut: "valide" }),
      collecte({ id: "collecte-3", statut: "archive" }),
    ];

    expect(getCollecteLensCounts(items)).toEqual({ actives: 2, archivees: 1, toutes: 3 });
    expect(filterCollectes(items, { ...baseFilters, lens: "actives" }, names, now)).toHaveLength(2);
    expect(filterCollectes(items, { ...baseFilters, lens: "archivees" }, names, now)).toHaveLength(1);
    expect(filterCollectes(items, { ...baseFilters, lens: "toutes" }, names, now)).toHaveLength(3);
  });

  it("searches company and free-text period and applies real field filters", () => {
    const items = [
      collecte(),
      collecte({ id: "collecte-2", societeId: "societe-2", periode: "T3 2026", statut: "transmis" }),
    ];

    expect(filterCollectes(items, { ...baseFilters, query: "atlas" }, names, now).map((item) => item.id))
      .toEqual(["collecte-1"]);
    expect(filterCollectes(items, { ...baseFilters, query: "T3 2026" }, names, now).map((item) => item.id))
      .toEqual(["collecte-2"]);
    expect(filterCollectes(items, { ...baseFilters, societeId: "societe-2" }, names, now).map((item) => item.id))
      .toEqual(["collecte-2"]);
    expect(filterCollectes(items, { ...baseFilters, periode: "T3 2026", statut: "transmis" }, names, now))
      .toEqual([items[1]]);
  });

  it("filters by échéance using the existing register overdue helper", () => {
    const items = [
      collecte({ id: "late", echeance: "2026-09-15", statut: "a_corriger" }),
      collecte({ id: "today", echeance: "2026-09-24" }),
      collecte({ id: "future", echeance: "2026-10-01" }),
      collecte({ id: "none", echeance: null }),
      collecte({ id: "closed", echeance: "2026-09-15", statut: "valide" }),
    ];

    const ids = (echeance: CollecteListFilters["echeance"]) =>
      filterCollectes(items, { ...baseFilters, echeance }, names, now).map((item) => item.id);

    expect(ids("late")).toEqual(["late"]);
    expect(ids("today")).toEqual(["today"]);
    expect(ids("upcoming")).toEqual(["future"]);
    expect(ids("none")).toEqual(["none"]);
  });

  it("presents real status labels with distinct semantic tones", () => {
    expect(getCollecteStatusPresentation("brouillon")).toEqual({ label: "Brouillon", tone: "muted" });
    expect(getCollecteStatusPresentation("transmis")).toEqual({ label: "Transmis au cabinet", tone: "primary" });
    expect(getCollecteStatusPresentation("valide")).toEqual({ label: "Validé", tone: "success" });
    expect(getCollecteStatusPresentation("a_corriger")).toEqual({ label: "À corriger", tone: "warning" });
    expect(getCollecteStatusPresentation("archive")).toEqual({ label: "Archivée", tone: "muted" });
  });

  it("renders the real deadline without repeating the desktop column label", () => {
    expect(formatCollecteDeadline(collecte({ echeance: "2026-09-15", statut: "a_corriger" }), now))
      .toMatch(/Dépassée$/);
    expect(formatCollecteDeadline(collecte({ echeance: "2026-09-24" }), now))
      .toMatch(/Aujourd’hui$/);
    expect(formatCollecteDeadline(collecte({ echeance: null }), now)).toBe("Non définie");
    expect(formatCollecteDeadline(collecte({ echeance: "2026-09-15", statut: "valide" }), now))
      .not.toContain("Dépassée");
  });

  it("keeps next actions navigational and role-aware", () => {
    expect(getCollecteNextAction("transmis", { isAdmin: true, isSocieteEmploye: false })).toBe("Examiner");
    expect(getCollecteNextAction("transmis", { isAdmin: false, isSocieteEmploye: false })).toBe("Ouvrir");
    expect(getCollecteNextAction("brouillon", { isAdmin: false, isSocieteEmploye: true })).toBe("Remplir");
    expect(getCollecteNextAction("a_corriger", { isAdmin: false, isSocieteEmploye: true })).toBe("Reprendre");
    expect(getCollecteNextAction("a_corriger", { isAdmin: true, isSocieteEmploye: false })).toBe("Examiner");
    expect(getCollecteNextAction("valide", { isAdmin: true, isSocieteEmploye: false })).toBe("Consulter");
    expect(getCollecteNextAction("archive", { isAdmin: true, isSocieteEmploye: false })).toBe("Consulter");
  });
});
