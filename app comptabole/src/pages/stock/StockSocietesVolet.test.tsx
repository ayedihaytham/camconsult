// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Societe, StockMouvement } from "@/types";
import type { SyntheseStock } from "@/store/stock";
import { StockSocietesVolet, operationsRecentes, partCoursSaisis } from "./StockSocietesVolet";

afterEach(cleanup);

const societe = (id: string, raisonSociale: string): Societe => ({ id, raisonSociale, theme: "PME", rne: "1234567A" } as unknown as Societe);
const ligne = (patch: Partial<SyntheseStock>): SyntheseStock => ({ mouvements: 0, dernierLe: null, valeur: 0, alertes: 0, coursManquants: 0, enDevise: 0, ...patch });
const mvt = (patch: Partial<StockMouvement>): StockMouvement => ({ venteDate: null, venteNumFacture: "", client: "", achatDate: null, achatNumFacture: "", fournisseur: "", douaneDate: null, douaneNumDeclaration: "", ...patch } as StockMouvement);

describe("liste et volet des sociétés du stock", () => {
  it("part des cours saisis : sans mouvement en devise il n'y a rien à saisir", () => {
    expect(partCoursSaisis(ligne({ enDevise: 0 }))).toBeNull();
    expect(partCoursSaisis(ligne({ enDevise: 21, coursManquants: 13 }))).toBe(38);
    expect(partCoursSaisis(ligne({ enDevise: 2, coursManquants: 0 }))).toBe(100);
    expect(partCoursSaisis(undefined)).toBeNull();
  });

  it("dernières opérations : ventes, achats et douane confondus, de la plus récente à la plus ancienne, quatre au plus", () => {
    const ops = operationsRecentes([
      mvt({ venteDate: "2026-10-23", venteNumFacture: "V1", client: "EVERTIS", achatDate: "2026-08-21", achatNumFacture: "A1", fournisseur: "GREEN" }),
      mvt({ venteDate: "2026-09-02", douaneDate: "2026-08-03", douaneNumDeclaration: "D-1" }),
      mvt({ venteDate: "2026-07-01" }),
    ]);
    expect(ops.map((o) => [o.type, o.date])).toEqual([["Vente", "2026-10-23"], ["Vente", "2026-09-02"], ["Facture d'achat", "2026-08-21"], ["Déclaration douane", "2026-08-03"]]);
    expect(ops[0].detail).toBe("V1 · EVERTIS");
  });

  function afficher(onSelection = vi.fn(), onOuvrir = vi.fn(), recentes: Parameters<typeof StockSocietesVolet>[0]["recentes"] = []) {
    render(
      <MemoryRouter>
        <StockSocietesVolet
          societes={[societe("a", "05-I CARGO LINE"), societe("b", "11-GREENLINE INTERNATIONAL")]}
          synthese={{ b: ligne({ mouvements: 8, dernierLe: "2026-10-23", alertes: 3, enDevise: 21, coursManquants: 13 }) }}
          selectionId="b"
          onSelection={onSelection}
          onOuvrir={onOuvrir}
          recentes={recentes}
          ilYA={() => "il y a 5 jours"}
        />
      </MemoryRouter>,
    );
    return { onSelection, onOuvrir };
  }

  it("la liste dit combien de mouvements et quels cours restent à saisir ; la fiche de la société choisie reprend ses chiffres", () => {
    afficher(undefined, undefined, [{ type: "Vente", detail: "V1 · EVERTIS", date: "2026-10-23" }]);
    const liste = within(screen.getByRole("list", { name: "Sociétés" }));
    expect(liste.getByText("Aucun mouvement")).toBeTruthy();
    expect(liste.getByText("8 mouvements · il y a 5 jours")).toBeTruthy();
    expect(liste.getByText("13 à saisir")).toBeTruthy();
    expect(liste.getByRole("button", { name: /GREENLINE/ }).getAttribute("aria-current")).toBe("true");
    const fiche = within(screen.getByRole("complementary", { name: "Fiche de la société" }));
    expect(fiche.getByRole("heading", { name: "11-GREENLINE INTERNATIONAL" })).toBeTruthy();
    expect(fiche.getByText("38 % saisis")).toBeTruthy();
    expect(fiche.getByRole("link", { name: "Saisir les cours" }).getAttribute("href")).toBe("/cours-change");
    expect(fiche.getByText("V1 · EVERTIS")).toBeTruthy();
  });

  it("un clic choisit la société, un double clic ou le bouton « Ouvrir le stock » ouvre son stock", () => {
    const { onSelection, onOuvrir } = afficher();
    fireEvent.click(within(screen.getByRole("list", { name: "Sociétés" })).getByRole("button", { name: /CARGO LINE/ }));
    expect(onSelection).toHaveBeenCalledWith("a");
    fireEvent.doubleClick(within(screen.getByRole("list", { name: "Sociétés" })).getByRole("button", { name: /CARGO LINE/ }));
    expect(onOuvrir).toHaveBeenCalledWith("a");
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir le stock/ }));
    expect(onOuvrir).toHaveBeenLastCalledWith("b");
  });

  it("l'activité récente se charge, ou dit qu'il n'y a rien", () => {
    afficher(undefined, undefined, null);
    expect(screen.getByText("Chargement…")).toBeTruthy();
    cleanup();
    afficher(undefined, undefined, []);
    expect(screen.getByText("Aucune opération pour le moment.")).toBeTruthy();
  });
});
