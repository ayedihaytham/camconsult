// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Collecte } from "@/types";
import { CollectesRegistre } from "./CollectesRegistre";

afterEach(cleanup);

const collecte = (id: string, societeId: string, statut: Collecte["statut"], extra: Partial<Collecte> = {}) =>
  ({ id, societeId, periode: "Octobre 2026", statut, echeance: null, creeLe: "2026-10-01T08:00:00Z", majLe: "2026-10-05T08:00:00Z", onglets: ["virements_recus", "virements_emis"], tableauxTransmis: 0, tableauxValides: 0, ...extra }) as unknown as Collecte;

const NOMS: Record<string, string> = { s1: "Atlas Import", s2: "Petra Euro", s3: "Ruspina Ciment" };
const socNom = (id: string) => NOMS[id] ?? "Société";

function rendre(list: Collecte[], onDelete?: (c: Collecte) => void) {
  render(<MemoryRouter><CollectesRegistre collectes={list} socNom={socNom} onDelete={onDelete} /></MemoryRouter>);
}
const societes = () =>
  screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-controls")).map((b) => b.querySelector("span.block")?.textContent);

describe("registre des collectes du cabinet, par société", () => {
  it("regroupe les collectes par société et met d'abord celles qui ont du travail à examiner", () => {
    rendre([
      collecte("1", "s1", "brouillon"),
      collecte("2", "s2", "transmis", { tableauxTransmis: 1 }),
      collecte("3", "s2", "brouillon", { periode: "Septembre 2026" }),
    ]);
    expect(societes()).toEqual(["Petra Euro", "Atlas Import"]);
    expect(screen.getByText("2 sociétés · 3 collectes")).toBeTruthy();
    expect(screen.getByText("1 à examiner")).toBeTruthy();
    expect(screen.getByText("Rien à examiner")).toBeTruthy();
  });

  it("déplie une société pour montrer ses collectes avec leur période et leurs tableaux", () => {
    rendre([collecte("1", "s1", "brouillon"), collecte("2", "s2", "transmis", { tableauxTransmis: 1 })]);
    // Atlas n'a rien à examiner : repliée au départ, Petra est ouverte.
    expect(screen.queryByRole("button", { name: /Ouvrir la collecte Atlas Import/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Examiner la collecte Petra Euro — Octobre 2026/ })).toBeTruthy();
    expect(screen.getAllByText("Virements reçus").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent?.includes("Atlas Import") && b.hasAttribute("aria-controls"))!);
    expect(screen.getByRole("button", { name: /Ouvrir la collecte Atlas Import — Octobre 2026/ })).toBeTruthy();
  });

  it("n'écrit jamais une date de création : une collecte sans période s'appelle « Sans période »", () => {
    rendre([collecte("1", "s1", "brouillon", { periode: "" })]);
    expect(screen.getByRole("button", { name: /Ouvrir la collecte Atlas Import — Sans période/ })).toBeTruthy();
  });

  it("déplie ou replie tout, et ne propose la suppression qu'à l'admin", () => {
    const onDelete = vi.fn();
    rendre([collecte("1", "s1", "brouillon"), collecte("2", "s2", "brouillon")], onDelete);
    fireEvent.click(screen.getByRole("button", { name: "Tout déplier" }));
    expect(screen.getAllByRole("button", { name: /Actions pour/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Tout replier" }));
    expect(screen.queryByRole("button", { name: /Actions pour/ })).toBeNull();
    cleanup();
    rendre([collecte("1", "s1", "brouillon")]);
    expect(screen.queryByRole("button", { name: /Actions pour/ })).toBeNull();
  });
});
