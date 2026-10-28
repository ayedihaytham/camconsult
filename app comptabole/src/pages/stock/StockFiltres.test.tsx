// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CRITERES_VIDES, type CriteresStock } from "@/lib/stockFiltres";
import { PREFS_PAR_DEFAUT } from "@/lib/stockPrefs";
import { StockFiltres } from "./StockFiltres";

afterEach(cleanup);

const COMPTES = { tous: 11, solde: 8, ecart: 0, "sans-achat": 2, "sans-vente": 1 };

function afficher(criteres: CriteresStock = CRITERES_VIDES) {
  const actions = { onCriteres: vi.fn(), onPrefs: vi.fn() };
  render(
    <StockFiltres
      criteres={criteres}
      clients={[{ cle: "evertis", nom: "EVERTIS ITALIA S.P.A", nombre: 2 }, { cle: "polymerx", nom: "POLYMERX LTD", nombre: 2 }]}
      fournisseurs={[{ cle: "green", nom: "GREEN RECYCLING SARL", nombre: 9 }]}
      comptes={COMPTES}
      prefs={PREFS_PAR_DEFAUT}
      affiches={11}
      total={11}
      droite={<span>monnaie</span>}
      {...actions}
    />,
  );
  return actions;
}

describe("barre de filtres du stock", () => {
  it("filtre par situation, avec le nombre de mouvements de chaque situation", () => {
    const { onCriteres } = afficher();
    const groupe = within(screen.getByRole("group", { name: "Situation des mouvements" }));
    expect(groupe.getByRole("button", { name: /Tous/ }).getAttribute("aria-pressed")).toBe("true");
    expect(groupe.getByRole("button", { name: /Sans achat/ }).textContent).toContain("2");
    fireEvent.click(groupe.getByRole("button", { name: /Sans achat/ }));
    expect(onCriteres).toHaveBeenCalledWith({ ...CRITERES_VIDES, situation: "sans-achat" });
  });

  it("recherche un n° de facture, un client ou un fournisseur", () => {
    const { onCriteres } = afficher();
    fireEvent.change(screen.getByRole("textbox", { name: /Rechercher/ }), { target: { value: "2600086" } });
    expect(onCriteres).toHaveBeenCalledWith({ ...CRITERES_VIDES, recherche: "2600086" });
  });

  it("filtre par client et par fournisseur depuis le bouton « Filtres », plusieurs choix possibles, avec le nombre de mouvements de chacun", () => {
    const { onCriteres } = afficher();
    fireEvent.click(screen.getByRole("button", { name: "Filtres" }));
    const clients = within(screen.getByRole("list", { name: "Client" }));
    expect(clients.getByRole("button", { name: /EVERTIS ITALIA S\.P\.A/ }).textContent).toContain("2");
    fireEvent.click(clients.getByRole("button", { name: /EVERTIS ITALIA S\.P\.A/ }));
    expect(onCriteres).toHaveBeenCalledWith({ ...CRITERES_VIDES, clients: new Set(["evertis"]) });
    fireEvent.click(within(screen.getByRole("list", { name: "Fournisseur" })).getByRole("button", { name: /GREEN RECYCLING SARL/ }));
    expect(onCriteres).toHaveBeenLastCalledWith({ ...CRITERES_VIDES, fournisseurs: new Set(["green"]) });
  });

  it("montre combien de filtres client et fournisseur sont actifs et permet d'effacer tous les filtres", () => {
    const { onCriteres } = afficher({ ...CRITERES_VIDES, clients: new Set(["evertis"]), situation: "ecart" });
    expect(within(screen.getByRole("button", { name: "Filtres (1 actif)" })).getByText("1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }));
    expect(onCriteres).toHaveBeenCalledWith({ situation: "tous", clients: new Set(), fournisseurs: new Set(), recherche: "" });
  });

  it("masque ou remet une colonne, et change la densité", () => {
    const { onPrefs } = afficher();
    fireEvent.click(screen.getByRole("button", { name: /Affichage/ }));
    const colonnes = within(screen.getByRole("list", { name: "Colonnes affichées" }));
    expect((colonnes.getByRole("checkbox", { name: "Douane" }) as HTMLElement).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(colonnes.getByRole("checkbox", { name: "Douane" }));
    expect(onPrefs).toHaveBeenCalledWith({ ...PREFS_PAR_DEFAUT, colonnes: { ...PREFS_PAR_DEFAUT.colonnes, douane: true } });
    fireEvent.click(within(screen.getByRole("group", { name: "Densité du tableau" })).getByRole("button", { name: "Aéré" }));
    expect(onPrefs).toHaveBeenLastCalledWith({ ...PREFS_PAR_DEFAUT, densite: "aere" });
  });

  it("indique « n sur total » quand des filtres masquent des mouvements, et garde les contrôles de la page à droite", () => {
    render(<StockFiltres criteres={CRITERES_VIDES} onCriteres={vi.fn()} clients={[]} fournisseurs={[]} comptes={COMPTES} prefs={PREFS_PAR_DEFAUT} onPrefs={vi.fn()} affiches={3} total={11} droite={<span>monnaie</span>} />);
    expect(screen.getByText("3 sur 11")).toBeTruthy();
    expect(screen.getByText("monnaie")).toBeTruthy();
  });
});
