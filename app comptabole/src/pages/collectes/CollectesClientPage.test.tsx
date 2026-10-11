// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Collecte } from "@/types";
import { CollectesClientPage } from "./CollectesClientPage";

afterEach(cleanup);

const collecte = (id: string, statut: Collecte["statut"], extra: Partial<Collecte> = {}) =>
  ({ id, societeId: "s1", periode: "", statut, echeance: null, creeLe: "2026-10-10T08:00:00Z", majLe: "2026-10-11T08:00:00Z", tableauxDemandes: 2, tableauxTransmis: 1, tableauxValides: 0, ...extra }) as unknown as Collecte;

function rendre(list: Collecte[]) {
  render(<MemoryRouter><CollectesClientPage list={list} loading={false} societeNom="ha" /></MemoryRouter>);
}

describe("page Collecte de pièces du responsable de société", () => {
  it("dit la société une fois, nomme les collectes sans période et met ce qu'il doit faire en premier", () => {
    rendre([collecte("a", "transmis"), collecte("b", "a_corriger")]);
    expect(screen.getAllByText(/ha ·/)).toHaveLength(1);
    const cartes = screen.getAllByRole("listitem");
    expect(cartes[0].textContent).toContain("À corriger");
    expect(cartes[0].textContent).toContain("Collecte du 10 octobre 2026");
    expect(cartes[1].textContent).toContain("En attente du cabinet");
    expect(screen.getAllByText(/tableaux transmis/)).toHaveLength(2);
  });

  it("garde les archives repliées derrière un bouton", () => {
    rendre([collecte("a", "brouillon"), collecte("z", "archive")]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Voir les collectes archivées \(1\)/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
