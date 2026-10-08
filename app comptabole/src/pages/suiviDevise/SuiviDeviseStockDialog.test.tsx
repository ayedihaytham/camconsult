// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SuiviDeviseStockVente } from "@/types";
import { SuiviDeviseStockDialog } from "./SuiviDeviseStockDialog";

const vente = (id: string, nFacture: string, montantTotal: number): SuiviDeviseStockVente => ({
  mouvementId: id,
  client: "TAKWA CEMENT",
  nFacture,
  dateFacture: "2026-01-04",
  designationProduit: "CEM I 52,5 N",
  fournisseur: "SOTACIB",
  qteTonnes: 500,
  pu: 110,
  montantTotal,
  achatNumFacture: "6608001609",
  achatDate: "2026-01-02",
  achatDevise: "EUR",
  achatMontant: 50000,
});

const ventes = [vente("a", "202300003", 55000), vente("b", "202300004", 3200)];

describe("ventes du stock à reprendre", () => {
  afterEach(cleanup);

  it("montre la facture d'achat liée à chaque vente", () => {
    render(<SuiviDeviseStockDialog open onOpenChange={() => undefined} ventes={ventes} devise="EUR" onReprendre={vi.fn()} />);
    expect(screen.getAllByText("6608001609")).toHaveLength(2);
    expect(screen.getAllByText(/50\s000,000 EUR/).length).toBe(2);
  });

  it("signale une vente dont le n° de facture existe déjà dans la fiche, ou deux fois dans le stock", () => {
    const deux = [vente("a", "202300003", 55000), vente("b", "2023-00003", 100), vente("c", "202300009", 5)];
    render(<SuiviDeviseStockDialog open onOpenChange={() => undefined} ventes={deux} devise="EUR" numerosExistants={["202300009"]} onReprendre={vi.fn()} />);
    expect(screen.getAllByLabelText("Numéro de facture en doublon")).toHaveLength(3);
    expect(screen.getByRole("alert").textContent).toMatch(/3 factures sélectionnées portent un numéro déjà utilisé/);
  });

  it("n'alerte pas sans doublon", () => {
    render(<SuiviDeviseStockDialog open onOpenChange={() => undefined} ventes={ventes} devise="EUR" onReprendre={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("coche tout à l'ouverture et reprend toutes les factures", async () => {
    const onReprendre = vi.fn().mockResolvedValue(undefined);
    render(<SuiviDeviseStockDialog open onOpenChange={() => undefined} ventes={ventes} devise="EUR" onReprendre={onReprendre} />);
    expect(screen.getByText(/2 factures sélectionnées/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reprendre 2 factures" }));
    await waitFor(() => expect(onReprendre).toHaveBeenCalledWith(["a", "b"]));
  });

  it("ne reprend que les factures cochées", async () => {
    const onReprendre = vi.fn().mockResolvedValue(undefined);
    render(<SuiviDeviseStockDialog open onOpenChange={() => undefined} ventes={ventes} devise="EUR" onReprendre={onReprendre} />);
    fireEvent.click(screen.getByLabelText("Facture 202300004"));
    expect(screen.getByText(/1 facture sélectionnée/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reprendre 1 facture" }));
    await waitFor(() => expect(onReprendre).toHaveBeenCalledWith(["a"]));
  });

  it("reste ouverte quand la reprise échoue, et interdit une reprise vide", async () => {
    const onOpenChange = vi.fn();
    const onReprendre = vi.fn().mockRejectedValue(new Error("échec"));
    render(<SuiviDeviseStockDialog open onOpenChange={onOpenChange} ventes={ventes} devise="EUR" onReprendre={onReprendre} />);
    fireEvent.click(screen.getByRole("button", { name: "Reprendre 2 factures" }));
    await waitFor(() => expect(onReprendre).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByLabelText("Tout sélectionner"));
    expect((screen.getByRole("button", { name: "Reprendre 0 facture" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
