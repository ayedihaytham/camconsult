// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Facture } from "@/types";

vi.mock("@/store/data", () => ({ useSocietes: () => [{ id: "s1", raisonSociale: "CLIENT EXEMPLE SARL" }] }));

import { FactureFormSheet } from "./FactureFormSheet";

const source = {
  id: "f1",
  societeId: "s1",
  societeNom: "CLIENT EXEMPLE SARL",
  numero: "2026-0007",
  dateEmission: "2026-09-01",
  echeance: "2026-10-01",
  tvaTaux: 13,
  timbre: 2,
  note: "Note d'origine",
  lignes: [
    { ordre: 0, description: "Tenue comptable", quantite: 3, montantHt: 150 },
    { ordre: 1, description: "Déclaration", quantite: 1, montantHt: 80 },
  ],
} as unknown as Facture;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const monter = (mode: "nouvelle" | "modification" | "copie", onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<FactureFormSheet open onOpenChange={vi.fn()} onSubmit={onSubmit} source={mode === "nouvelle" ? null : source} mode={mode} />);
  return onSubmit;
};

describe("FactureFormSheet : modes", () => {
  it("modification : titre avec le numéro, données de la facture reprises (dates comprises), bouton d'enregistrement", async () => {
    const onSubmit = monter("modification");
    expect(screen.getByText("Modifier la facture 2026-0007")).toBeTruthy();
    expect((screen.getAllByDisplayValue("Tenue comptable")[0] as HTMLInputElement).value).toBe("Tenue comptable");
    expect(screen.getAllByDisplayValue("2026-09-01").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les modifications" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      societeId: "s1",
      dateEmission: "2026-09-01",
      echeance: "2026-10-01",
      tvaTaux: 13,
      timbre: 2,
      note: "Note d'origine",
      lignes: [
        { description: "Tenue comptable", quantite: 3, montantHt: 150 },
        { description: "Déclaration", quantite: 1, montantHt: 80 },
      ],
    });
  });

  it("copie : client, lignes et taux repris, mais dates du jour et bouton de génération", async () => {
    const onSubmit = monter("copie");
    expect(screen.getByText("Dupliquer la facture")).toBeTruthy();
    expect(screen.queryAllByDisplayValue("2026-09-01")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Générer la facture" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const envoye = onSubmit.mock.calls[0][0];
    expect(envoye.dateEmission).toBe(new Date().toISOString().slice(0, 10));
    expect(envoye.tvaTaux).toBe(13);
    expect(envoye.lignes).toHaveLength(2);
  });

  it("nouvelle facture : formulaire vide, comme avant", () => {
    monter("nouvelle");
    expect(screen.getByText("Nouvelle facture d'honoraires")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Générer la facture" }).hasAttribute("disabled")).toBe(true);
  });
});
