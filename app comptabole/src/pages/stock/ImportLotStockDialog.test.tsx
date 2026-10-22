// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportLotStockDialog } from "./ImportLotStockDialog";
import { useStock } from "@/store/stock";
import type { StockChamps, StockDocType, StockExtractPage, StockLigne } from "@/types";

const ligne = (designation: string, quantite: number, prixUnitaire: number): StockLigne => ({
  designation, quantite, prixUnitaire, montantDevise: quantite * prixUnitaire, montantTnd: 0, unite: "T",
});

function page(index: number, type: StockDocType, champs: StockChamps): StockExtractPage {
  return { index, imageDataUrl: null, guessedType: type, confidence: "haute", champsByType: { achat: {}, vente: {}, douane: {}, [type]: champs } };
}

const PAGE_ACHAT = page(0, "achat", { date: "2026-01-05", numFacture: "F1", fournisseur: "SOTACIB", devise: "EUR", lignes: [ligne("CIMENT CEM I", 1000, 44)] });
const PAGE_VENTE = page(0, "vente", { date: "2026-01-20", numFacture: "V1", client: "CLIENT A", devise: "EUR", lignes: [ligne("CIMENT CEM I", 1000, 60)] });
const PAGE_DOUTEUSE = page(0, "achat", { date: "", numFacture: "F2", fournisseur: "AUTRE FOURNISSEUR", devise: "EUR", lignes: [ligne("HUILE", 10, 5)] });

function fichier(nom: string) {
  return new File(["%PDF-1.4"], nom, { type: "application/pdf" });
}

describe("import d'un lot de factures", () => {
  afterEach(() => {
    cleanup();
    useStock.setState({ list: [] });
  });

  it("analyse les fichiers, rapproche achat et vente, ne coche d'office que les mouvements prêts, et ne crée que les cochés", async () => {
    const extractPages = vi.fn(async (_s: string, dataUrl: string) => {
      void dataUrl;
      const n = extractPages.mock.calls.length;
      return [n === 1 ? PAGE_ACHAT : n === 2 ? PAGE_VENTE : PAGE_DOUTEUSE];
    });
    const create = vi.fn(async (data: unknown) => ({ id: `m${create.mock.calls.length}`, ...(data as object) }));
    useStock.setState({ extractPages, create } as never);

    const { container } = render(<ImportLotStockDialog open onOpenChange={vi.fn()} societeId="soc-1" />);
    const entree = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entree, { target: { files: [fichier("achat.pdf"), fichier("vente.pdf"), fichier("autre.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: /Analyser 3 fichiers/ }));

    await screen.findByText(/mouvements proposés/);
    expect(extractPages).toHaveBeenCalledTimes(3);
    // Un mouvement prêt (achat + vente rapprochés) et un à vérifier (date absente).
    expect(screen.getByText(/1 prêt/)).toBeTruthy();
    expect(screen.getByText(/1 à vérifier/)).toBeTruthy();

    const creer = screen.getByRole("button", { name: /Créer 1 mouvement/ });
    fireEvent.click(creer);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const envoye = create.mock.calls[0][0] as Record<string, unknown>;
    expect(envoye).toMatchObject({ societeId: "soc-1", fournisseur: "SOTACIB", achatNumFacture: "F1", client: "CLIENT A", venteNumFacture: "V1" });
    await screen.findByText("Créé");
  });

  it("refuse une facture déjà présente dans le stock", async () => {
    useStock.setState({
      list: [{ id: "x", achatNumFacture: "F1", venteNumFacture: "", fournisseur: "SOTACIB" }] as never,
      extractPages: vi.fn(async () => [PAGE_ACHAT]) as never,
    });
    const { container } = render(<ImportLotStockDialog open onOpenChange={vi.fn()} societeId="soc-1" />);
    fireEvent.change(container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fichier("achat.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: /Analyser 1 fichier/ }));
    await screen.findByText(/Refusé : doublon/);
    expect(screen.getByRole("button", { name: /Créer 0 mouvement/ }).hasAttribute("disabled")).toBe(true);
  });

  it("un fichier illisible n'empêche pas la lecture des suivants", async () => {
    const extractPages = vi.fn(async () => {
      if (extractPages.mock.calls.length === 1) throw new Error("illisible");
      return [PAGE_ACHAT];
    });
    useStock.setState({ extractPages } as never);
    const { container } = render(<ImportLotStockDialog open onOpenChange={vi.fn()} societeId="soc-1" />);
    fireEvent.change(container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [fichier("casse.pdf"), fichier("bon.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: /Analyser 2 fichiers/ }));
    await screen.findByText(/mouvement proposé/);
    expect(extractPages).toHaveBeenCalledTimes(2);
  });
});
