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
});

const ventes = [vente("a", "202300003", 55000), vente("b", "202300004", 3200)];

describe("ventes du stock à reprendre", () => {
  afterEach(cleanup);

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
