// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Collecte } from "@/types";
import { CollectesVolet, etapeCircuit } from "./CollectesVolet";

afterEach(cleanup);

const demain = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
const hier = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
const c = (patch: Partial<Collecte>): Collecte => ({ id: "c", societeId: "s1", periode: "Octobre 2026", statut: "brouillon", onglets: ["virements_recus", "virements_emis", "etat_caisse"], tableauxTransmis: 0, tableauxValides: 0, echeance: demain, creeLe: "2026-10-01T08:00:00Z", majLe: "2026-10-20T08:00:00Z", ...patch } as Collecte);
const noms: Record<string, string> = { s1: "05-I CARGO LINE", s2: "CAM" };
const socNom = (id: string) => noms[id] ?? "Société";

function Lieu() {
  return <p data-testid="lieu">{useLocation().pathname}</p>;
}
function afficher(collectes: Collecte[], onDelete?: (c: Collecte) => void) {
  render(
    <MemoryRouter>
      <CollectesVolet collectes={collectes} socNom={socNom} onDelete={onDelete} />
      <Routes><Route path="*" element={<Lieu />} /></Routes>
    </MemoryRouter>,
  );
}

describe("liste et volet des collectes", () => {
  it("le circuit d'une collecte suit son statut", () => {
    expect([etapeCircuit("brouillon"), etapeCircuit("a_corriger"), etapeCircuit("transmis"), etapeCircuit("valide"), etapeCircuit("archive")]).toEqual([0, 0, 1, 2, 2]);
  });

  it("liste les sociétés avec leurs collectes, les sociétés à examiner d'abord ; la fiche montre la première", () => {
    afficher([c({ id: "a", societeId: "s1" }), c({ id: "b", societeId: "s2", statut: "transmis", tableauxTransmis: 2 })]);
    const liste = within(screen.getByRole("list", { name: "Sociétés" }));
    const boutons = liste.getAllByRole("button");
    expect(boutons[0].textContent).toContain("CAM"); // CAM a du travail à examiner
    expect(boutons[0].textContent).toContain("2 à examiner");
    expect(boutons[1].textContent).toContain("Rien à examiner");
    expect(within(screen.getByRole("complementary", { name: "Fiche de la société" })).getByRole("heading", { name: "CAM" })).toBeTruthy();
  });

  it("un clic sur une société affiche ses collectes : circuit, avancement, échéance ; une collecte en retard est signalée", () => {
    afficher([c({ id: "a", societeId: "s1", periode: "Octobre 2026" }), c({ id: "b", societeId: "s1", periode: "T3 2026", echeance: hier }), c({ id: "x", societeId: "s2", statut: "transmis", tableauxTransmis: 1 })]);
    fireEvent.click(within(screen.getByRole("list", { name: "Sociétés" })).getByRole("button", { name: /CARGO LINE/ }));
    const fiche = within(screen.getByRole("complementary", { name: "Fiche de la société" }));
    expect(fiche.getByRole("heading", { name: "05-I CARGO LINE" })).toBeTruthy();
    const retard = fiche.getByRole("article", { name: "Collecte T3 2026" });
    expect(within(retard).getAllByText("En retard").length).toBeGreaterThan(0);
    expect(within(retard).getByRole("list", { name: "Circuit de la collecte" }).textContent).toContain("Transmise");
    expect(within(fiche.getByRole("article", { name: "Collecte Octobre 2026" })).getByText("0 / 3")).toBeTruthy();
  });

  it("« Ouvrir la collecte » mène à la collecte ; la suppression n'existe que si elle est permise", () => {
    afficher([c({ id: "abc", societeId: "s1" })]);
    expect(screen.queryByRole("button", { name: /Actions pour/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /la collecte 05-I CARGO LINE — Octobre 2026/ }));
    expect(screen.getByTestId("lieu").textContent).toBe("/collectes/abc");
    cleanup();
    afficher([c({ id: "abc", societeId: "s1" })], vi.fn());
    expect(screen.getByRole("button", { name: /Actions pour 05-I CARGO LINE/ })).toBeTruthy();
  });
});
