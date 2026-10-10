// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CollecteFull } from "@/types";
import { CollecteNextStep } from "./CollecteNextStep";

afterEach(cleanup);

function collecte(statut: "brouillon" | "transmis" | "valide" = "brouillon", recapStatut: "none" | "envoye" = "none"): CollecteFull {
  return {
    id: "c1",
    societeId: "s1",
    periode: "2026",
    statut,
    onglets: ["virements_recus"],
    devise: "TND",
    echeance: null,
    derniereRelanceLe: null,
    relanceCadenceJours: 3,
    creeLe: "2026-01-01",
    majLe: "2026-01-01",
    transmisLe: null,
    valideLe: null,
    sections: [{
      id: "s1",
      onglet: "virements_recus",
      commentaire: "",
      recapStatut,
      recuManuel: false,
      dateSuivi: null,
      totalSaisi: null,
      statut: recapStatut === "envoye" ? "valide" : statut,
      transmisLe: null,
      valideLe: null,
      motifRenvoi: "",
    }],
    lignes: [],
    notes: [],
    fichiers: [],
  };
}

describe("CollecteNextStep", () => {
  it("guide le client vers la saisie ouverte", () => {
    const onNavigate = vi.fn();
    render(<CollecteNextStep collecte={collecte()} isClient isCabinet={false} recapPending={false} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Continuer la saisie/ }));
    expect(onNavigate).toHaveBeenCalledWith("virements_recus");
  });

  it("priorise le récap demandé pour le client", () => {
    const onNavigate = vi.fn();
    render(<CollecteNextStep collecte={collecte("transmis", "envoye")} isClient isCabinet={false} recapPending onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Compléter le récap/ }));
    expect(onNavigate).toHaveBeenCalledWith("recap");
  });

  it("guide le cabinet vers un tableau transmis pour examen", () => {
    const onNavigate = vi.fn();
    render(<CollecteNextStep collecte={collecte("transmis")} isClient={false} isCabinet recapPending={false} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Examiner ce tableau/ }));
    expect(onNavigate).toHaveBeenCalledWith("virements_recus");
  });

  it("does not ask for a click when the recommended table is already open", () => {
    render(<CollecteNextStep collecte={collecte()} isClient isCabinet={false} recapPending={false} currentTab="virements_recus" onNavigate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Continuer la saisie/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Tableau ouvert");
  });
});
