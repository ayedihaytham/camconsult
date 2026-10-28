// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { appliquerFiltresRecap, FILTRES_RECAP_VIDES, type FiltresRecap } from "@/lib/filtresRecapSociete";
import { recapSociete } from "@/lib/stockRecapSociete";
import type { StockLigne, StockMouvement } from "@/types";
import { StockRecapSocieteTable } from "./StockRecapSocieteTable";

afterEach(cleanup);

const ligne = (quantite: number): StockLigne => ({ designation: "CIMENT", quantite, prixUnitaire: 1, montantDevise: quantite * 10, montantTnd: quantite * 30, unite: "T" });
const mvt = (id: string, client: string, quantite: number): StockMouvement => ({
  id, societeId: "s", ordre: 0, natureMarchandise: "CIMENT",
  achatDate: null, achatNumFacture: "", achatDocType: "", fournisseur: "", achatDevise: "EUR", achatCours: 0, achatLignes: [],
  venteDate: "2026-09-11", venteNumFacture: `F${id}`, venteDocType: "", client, venteDevise: "EUR", venteCours: 0, venteLignes: [ligne(quantite)],
  douaneNumDeclaration: "", douaneDate: null, douaneRegime: "", douaneTypeDeclaration: "", douaneReference: "", douaneTauxChange: 0, douaneValeurTnd: 0, douanePtfn: 0, douaneExportateur: "", douaneImportateur: "",
  achatDocDataUrl: null, venteDocDataUrl: null, douaneDocDataUrl: null, note: "", ecart: 0, ecartUnite: "T", ecartParDesignation: [], creeLe: "", majLe: "",
});
const base = recapSociete([mvt("1", "EVERTIS", 10), mvt("2", "POLYMERX", 20)]);

function Hote() {
  const [filtres, setFiltres] = useState<FiltresRecap>(FILTRES_RECAP_VIDES);
  return <StockRecapSocieteTable base={base} recap={appliquerFiltresRecap(base, filtres)} filtres={filtres} onFiltres={setFiltres} />;
}

describe("récapitulatif de société : filtres de colonnes", () => {
  it("chaque colonne de données a son filtre", () => {
    render(<Hote />);
    expect(screen.getAllByRole("button", { name: /^Filtrer la colonne/ })).toHaveLength(18);
  });

  it("décocher une valeur puis OK masque ses lignes, recalcule le total et montre le filtre actif ; Effacer tout rétablit", () => {
    render(<Hote />);
    expect(screen.getAllByRole("row")).toHaveLength(2 + 2 + 1);
    fireEvent.click(screen.getByRole("button", { name: "Filtrer la colonne Client (vente)" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "POLYMERX" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("status").textContent).toContain("1 filtre de colonne · 1 ligne sur 2");
    expect(screen.queryByText("POLYMERX")).toBeNull();
    const pied = within(screen.getAllByRole("row").at(-1)!);
    expect(pied.getByText("10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Effacer tous les filtres" }));
    expect(screen.getByText("POLYMERX")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("trier Z → A remet les lignes dans l'ordre inverse", () => {
    render(<Hote />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrer la colonne Quantité (vente)" }));
    fireEvent.click(screen.getByRole("button", { name: /Trier Z → A/ }));
    const lignes = screen.getAllByRole("row").slice(2, 4);
    expect(lignes[0].textContent).toContain("POLYMERX");
  });

  it("filtre par condition : « Supérieur(e) à » 15 sur la quantité ne garde que la ligne qui y répond", () => {
    render(<Hote />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrer la colonne Quantité (vente)" }));
    fireEvent.click(screen.getByRole("button", { name: "Filtrer par condition" }));
    fireEvent.change(screen.getByLabelText("Condition"), { target: { value: "sup" } });
    expect((screen.getByRole("button", { name: "OK" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Valeur"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("status").textContent).toContain("1 filtre de colonne · 1 ligne sur 2");
    expect(screen.queryByText("EVERTIS")).toBeNull();
    expect(screen.getByText("POLYMERX")).toBeTruthy();
  });

  it("la douane n'apparaît que si on l'affiche", () => {
    const { rerender } = render(<StockRecapSocieteTable base={base} recap={base} filtres={FILTRES_RECAP_VIDES} onFiltres={() => {}} />);
    expect(screen.queryByText("DOUANE")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Filtrer la colonne/ })).toHaveLength(18);
    rerender(<StockRecapSocieteTable base={base} recap={base} filtres={FILTRES_RECAP_VIDES} onFiltres={() => {}} douane />);
    expect(screen.getByText("DOUANE")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Filtrer la colonne/ })).toHaveLength(23);
  });
});
