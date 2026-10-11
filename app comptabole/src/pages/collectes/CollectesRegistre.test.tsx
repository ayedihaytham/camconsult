// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Collecte } from "@/types";
import { CollectesRegistre } from "./CollectesRegistre";

afterEach(cleanup);

const collecte = (id: string, societeId: string, statut: Collecte["statut"], extra: Partial<Collecte> = {}) =>
  ({ id, societeId, periode: "Octobre 2026", statut, echeance: null, creeLe: "2026-10-01T08:00:00Z", majLe: "2026-10-05T08:00:00Z", onglets: ["a", "b"], tableauxTransmis: 0, tableauxValides: 0, ...extra }) as unknown as Collecte;

const NOMS: Record<string, string> = { s1: "Atlas Import", s2: "Petra Euro", s3: "Ruspina Ciment" };
const socNom = (id: string) => NOMS[id] ?? "Société";

function rendre(list: Collecte[], onDelete?: (c: Collecte) => void) {
  render(<MemoryRouter><CollectesRegistre collectes={list} socNom={socNom} onDelete={onDelete} /></MemoryRouter>);
}
const noms = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.querySelector("p")?.textContent);

describe("registre des collectes du cabinet", () => {
  it("met d'abord ce qu'il y a à examiner, puis les plus récentes", () => {
    rendre([
      collecte("1", "s1", "brouillon", { majLe: "2026-10-09T08:00:00Z" }),
      collecte("2", "s2", "transmis", { tableauxTransmis: 1, majLe: "2026-10-01T08:00:00Z" }),
      collecte("3", "s3", "brouillon", { majLe: "2026-10-10T08:00:00Z" }),
    ]);
    expect(noms()).toEqual(["Petra Euro", "Ruspina Ciment", "Atlas Import"]);
    expect(screen.getAllByText(/Transmis · 1 à examiner/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Examiner la collecte Petra Euro/ }).length).toBeGreaterThan(0);
  });

  it("trie en cliquant sur un en-tête, et inverse au second clic", () => {
    rendre([collecte("1", "s2", "brouillon"), collecte("2", "s1", "brouillon"), collecte("3", "s3", "brouillon")]);
    fireEvent.click(screen.getByRole("button", { name: /Société · collecte/ }));
    expect(noms()).toEqual(["Atlas Import", "Petra Euro", "Ruspina Ciment"]);
    fireEvent.click(screen.getByRole("button", { name: /Société · collecte/ }));
    expect(noms()).toEqual(["Ruspina Ciment", "Petra Euro", "Atlas Import"]);
  });

  it("signale une échéance dépassée et ne propose la suppression qu'à l'admin", () => {
    const onDelete = vi.fn();
    rendre([collecte("1", "s1", "brouillon", { echeance: "2020-01-01" })], onDelete);
    expect(screen.getAllByText(/en retard/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Actions pour Atlas Import/ }).length).toBeGreaterThan(0);
    cleanup();
    rendre([collecte("1", "s1", "brouillon")]);
    expect(screen.queryByRole("button", { name: /Actions pour/ })).toBeNull();
  });
});
