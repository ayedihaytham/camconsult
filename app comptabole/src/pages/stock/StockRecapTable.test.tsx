// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { recapStock, totauxCote } from "@/lib/stockRecap";
import type { StockLigne, StockMouvement } from "@/types";
import { StockRecapTable } from "./StockRecapTable";

const ligne = (designation: string, quantite: number, montantDevise: number, montantTnd = 0): StockLigne => ({
  designation,
  quantite,
  prixUnitaire: quantite ? montantDevise / quantite : 0,
  montantDevise,
  montantTnd,
});

const base = (patch: Partial<StockMouvement>): StockMouvement => ({
  id: "m",
  societeId: "s1",
  ordre: 0,
  natureMarchandise: "",
  achatDate: null,
  achatNumFacture: "",
  achatDocType: "",
  fournisseur: "",
  achatDevise: "EUR",
  achatCours: 0,
  achatLignes: [],
  venteDate: null,
  venteNumFacture: "",
  venteDocType: "",
  client: "",
  venteDevise: "EUR",
  venteCours: 0,
  venteLignes: [],
  douaneNumDeclaration: "",
  douaneDate: null,
  douaneRegime: "",
  douaneTypeDeclaration: "",
  douaneReference: "",
  douaneTauxChange: 0,
  douaneValeurTnd: 0,
  douanePtfn: 0,
  douaneExportateur: "",
  douaneImportateur: "",
  achatDocDataUrl: null,
  venteDocDataUrl: null,
  douaneDocDataUrl: null,
  note: "",
  ecart: 0,
  ecartUnite: "",
  ecartParDesignation: [],
  creeLe: "",
  majLe: "",
  ...patch,
});

const ciment = base({
  id: "m1",
  natureMarchandise: "Portland Cement CEM I 42,5 N",
  achatDate: "2023-01-02",
  fournisseur: "RUSPINA IMPORT ET EXPORT",
  achatNumFacture: "6608000533",
  achatLignes: [ligne("Portland Cement", 1000, 52000)],
  venteDate: "2023-01-03",
  client: "GROUP BYOUT EZZ",
  venteNumFacture: "202300001",
  venteLignes: [ligne("Cement CEM I", 1000, 53000)],
  douaneNumDeclaration: "447898",
  douaneDate: "2023-01-03",
  douaneTypeDeclaration: "E",
  douaneTauxChange: 3.2842,
  douaneValeurTnd: 170778.4,
  douanePtfn: 52000,
  douaneExportateur: "STE DES CIMENTS D'ENFIDHA",
  douaneImportateur: "RUSPINA IMP EXP",
  douaneDocDataUrl: "data:application/pdf;base64,AAAA",
  ecart: 0,
});

const sac = base({
  id: "m2",
  natureMarchandise: "CEM I 52.5 N Sac 50kg PP",
  achatDate: "2023-01-04",
  fournisseur: "RUSPINA IMPORT EXPORT",
  achatNumFacture: "3100001306",
  achatLignes: [ligne("CEM I 52.5 N", 370, 33300, 100000)],
  venteLignes: [ligne("CEMENT", 370000, 0)],
  ecart: -369630,
  ecartParDesignation: [{ designation: "CEM I 52.5 N", achatQuantite: 370, venteQuantite: 370000, ecart: -369630 }],
});

function afficher(overrides: Partial<React.ComponentProps<typeof StockRecapTable>> = {}) {
  const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onPreview: vi.fn(), onClasser: vi.fn() };
  render(<StockRecapTable mouvements={[ciment, sac]} nouveauId={null} classing={null} {...handlers} {...overrides} />);
  return handlers;
}

describe("totaux du récapitulatif", () => {
  it("additionne quantités et montants d'un côté", () => {
    expect(totauxCote([ligne("A", 2, 10, 30), ligne("B", 3, 5, 15)])).toEqual({
      quantite: 5,
      montantDevise: 15,
      montantTnd: 45,
      produits: 2,
    });
  });

  it("totalise l'ensemble des mouvements et compte les anomalies", () => {
    const t = recapStock([ciment, sac]);
    expect(t.mouvements).toBe(2);
    expect(t.anomalies).toBe(1);
    expect(t.achat.quantite).toBe(1370);
    expect(t.vente.quantite).toBe(371000);
    expect(t.achat.montantTnd).toBe(100000);
    expect(t.ecart).toBe(-369630);
  });
});

describe("tableau récapitulatif du stock", () => {
  afterEach(cleanup);

  it("reprend les attributs du tableau Excel du cabinet, achat et vente côte à côte", () => {
    afficher();
    const entetes = Array.from(document.querySelectorAll("thead th")).map((th) => th.textContent);
    for (const colonne of ["N°", "Mouvement", "Écart", "Achat", "Vente", "Douane", "N° déclaration"]) {
      expect(entetes).toContain(colonne);
    }
    // Les huit colonnes d'un côté : date, facture, tiers, quantité, montant en devise, devise, cours, MT TND.
    for (const colonne of ["Date", "N° facture", "Qté", "En devise", "Devise", "Cours", "MT TND"]) {
      expect(entetes.filter((e) => e === colonne)).toHaveLength(2);
    }
    expect(entetes).toContain("Fournisseur");
    expect(entetes).toContain("Client");
    // Vente d'abord, puis achat, puis douane.
    expect(entetes.indexOf("Vente")).toBeLessThan(entetes.indexOf("Achat"));
    expect(entetes.indexOf("Achat")).toBeLessThan(entetes.indexOf("Douane"));
    expect(entetes.indexOf("Client")).toBeLessThan(entetes.indexOf("Fournisseur"));
  });

  it("montre le total vente − achat en devise en bas du tableau et dans le détail", () => {
    afficher();
    const pied = within(document.querySelector("tfoot") as HTMLElement);
    // Une seule ligne de total, sans montant en dinars.
    expect(document.querySelectorAll("tfoot tr")).toHaveLength(1);
    expect(pied.getByText(/Vente − achat :/)).toBeTruthy();
    expect(pied.getAllByText(/EUR/).length).toBeGreaterThan(0);
    fireEvent.click(document.getElementById("mouvement-m1") as HTMLElement);
    expect(screen.getByText(/Vente − achat \(en devise\)/)).toBeTruthy();
    expect(screen.getAllByText("1 000,000 EUR").length).toBeGreaterThan(0);
  });

  it("numérote les lignes et n'écrit la nature de la marchandise qu'une fois", () => {
    afficher();
    const ligneCiment = document.getElementById("mouvement-m1") as HTMLElement;
    expect(within(ligneCiment).getAllByText("Portland Cement CEM I 42,5 N")).toHaveLength(1);
    expect(ligneCiment.querySelector("td")?.textContent).toBe("1");
    expect((document.getElementById("mouvement-m2") as HTMLElement).querySelector("td")?.textContent).toBe("2");
  });

  it("montre le cours, la devise et le montant en dinars de chaque côté", () => {
    const avecCours = base({
      id: "m5",
      natureMarchandise: "PET FLAKES",
      achatDate: "2025-02-07",
      achatNumFacture: "250007",
      fournisseur: "GREEN RECYCLING",
      achatCours: 3.3165,
      achatLignes: [{ ...ligne("PET FLAKES", 46.826, 44484.7, 147545.1), unite: "T" }],
      venteDate: "2025-02-07",
      venteNumFacture: "2500012",
      client: "LUXPET AG",
      venteCours: 3.3165,
      venteLignes: [{ ...ligne("PET FLAKES", 46.826, 57127.72, 189464.083), unite: "T" }],
    });
    afficher({ mouvements: [avecCours] });
    const r = within(document.getElementById("mouvement-m5") as HTMLElement);
    expect(r.getAllByText("3,3165")).toHaveLength(2);
    expect(r.getAllByText("EUR")).toHaveLength(2);
    expect(r.getByText("147 545,100")).toBeTruthy();
    expect(r.getByText("189 464,083")).toBeTruthy();
    expect(r.getByText("GREEN RECYCLING")).toBeTruthy();
    expect(r.getByText("250007")).toBeTruthy();
  });

  it("affiche une ligne par mouvement avec achat, vente et douane côte à côte", () => {
    afficher();
    const ligneCiment = document.getElementById("mouvement-m1") as HTMLElement;
    const cellules = within(ligneCiment);
    expect(cellules.getByText("Portland Cement CEM I 42,5 N")).toBeTruthy();
    expect(cellules.getByText("RUSPINA IMPORT ET EXPORT")).toBeTruthy();
    expect(cellules.getByText("6608000533")).toBeTruthy();
    expect(cellules.getByText("GROUP BYOUT EZZ")).toBeTruthy();
    expect(cellules.getByText("202300001")).toBeTruthy();
    // Le tableau n'affiche que le n° de déclaration ; le type, le taux et la valeur sont dans le détail.
    expect(cellules.getByText("447898")).toBeTruthy();
    expect(cellules.queryByText("3,2842")).toBeNull();
    expect(cellules.queryByText("170 778,400")).toBeNull();
    expect(document.getElementById("mouvement-m2")).toBeTruthy();
  });

  it("met l'écart en évidence et totalise dans le pied du tableau", () => {
    afficher();
    expect(screen.getByText("Total (2)")).toBeTruthy();
    const pied = document.querySelector("tfoot") as HTMLElement;
    expect(within(pied).getByText("1 370")).toBeTruthy();
    expect(within(pied).getByText("371 000")).toBeTruthy();
    const ecart = within(document.getElementById("mouvement-m2") as HTMLElement).getByText("-369 630");
    expect(ecart.className).toContain("text-destructive");
  });

  it("déplie le détail en trois cartes : achat, vente et douane", () => {
    afficher();
    expect(screen.queryByText("Écart achat − vente", { exact: false })).toBeNull();
    fireEvent.click(document.getElementById("mouvement-m1") as HTMLElement);
    for (const titre of ["Achat", "Vente", "Douane"]) {
      expect(screen.getAllByText(titre, { selector: "h3" })).toHaveLength(1);
    }
    expect(screen.getAllByText("Fournisseur")).toHaveLength(2); // en-tête du tableau + carte du détail
    expect(screen.getByText("Exportateur")).toBeTruthy();
    expect(screen.getByText("STE DES CIMENTS D'ENFIDHA")).toBeTruthy();
    expect(screen.getByText("Écart achat − vente", { exact: false })).toBeTruthy();
  });

  it("n'affiche l'écart par produit que si une facture liste plusieurs produits", () => {
    afficher();
    fireEvent.click(document.getElementById("mouvement-m2") as HTMLElement);
    expect(screen.queryByText("CEM I 52.5 N", { exact: false, selector: "span" })).toBeNull();

    cleanup();
    const multi = base({
      id: "m4",
      natureMarchandise: "Deux produits",
      achatLignes: [ligne("SABLE", 10, 100), ligne("GRAVIER", 20, 400)],
      venteLignes: [ligne("SABLE", 10, 100), ligne("GRAVIER", 15, 300)],
      ecart: 5,
      ecartParDesignation: [
        { designation: "GRAVIER", achatQuantite: 20, venteQuantite: 15, ecart: 5 },
        { designation: "SABLE", achatQuantite: 10, venteQuantite: 10, ecart: 0 },
      ],
    });
    afficher({ mouvements: [multi] });
    fireEvent.click(document.getElementById("mouvement-m4") as HTMLElement);
    expect(screen.getByText("GRAVIER", { selector: "span" })).toBeTruthy();
    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
  });

  it("ouvre les actions sans déplier la ligne", () => {
    const { onEdit, onDelete, onPreview } = afficher();
    const ligneCiment = document.getElementById("mouvement-m1") as HTMLElement;
    fireEvent.click(within(ligneCiment).getByLabelText("Modifier ce mouvement"));
    fireEvent.click(within(ligneCiment).getByLabelText("Supprimer ce mouvement"));
    fireEvent.click(within(ligneCiment).getByLabelText("Voir : Document douanier"));
    expect(onEdit).toHaveBeenCalledWith(ciment);
    expect(onDelete).toHaveBeenCalledWith(ciment);
    expect(onPreview).toHaveBeenCalledWith("Document douanier", ciment.douaneDocDataUrl);
    expect(screen.queryByText("Écart achat − vente", { exact: false })).toBeNull();
  });

  it("met en évidence le mouvement qui vient d'être enregistré", () => {
    afficher({ nouveauId: "m2" });
    expect((document.getElementById("mouvement-m2") as HTMLElement).className).toContain("bg-accent/15");
    expect((document.getElementById("mouvement-m1") as HTMLElement).className).not.toContain("bg-accent/15");
  });
});

describe("quantités en unités différentes", () => {
  afterEach(cleanup);

  const kilos = base({
    id: "m3",
    natureMarchandise: "Ciment en vrac",
    achatLignes: [{ ...ligne("CIMENT", 370000, 40700), unite: "KG" }],
    venteLignes: [{ ...ligne("CIMENT", 370, 40700), unite: "T" }],
    ecart: 0,
    ecartUnite: "T",
  });

  it("ramène les kilos en tonnes dans les totaux", () => {
    const t = recapStock([kilos]);
    expect(t.unite).toBe("T");
    expect(t.achat.quantite).toBe(370);
    expect(t.vente.quantite).toBe(370);
    expect(t.ecart).toBe(0);
  });

  it("affiche l'unité de chaque quantité et de l'écart", () => {
    afficher({ mouvements: [kilos] });
    const rangee = within(document.getElementById("mouvement-m3") as HTMLElement);
    expect(rangee.getByText("370 T", { selector: "td" }).tagName).toBe("TD");
    // Un écart nul s'écrit « 0 », sans unité.
    expect(rangee.getByText("0")).toBeTruthy();
    expect(rangee.queryByText("0 T")).toBeNull();
  });
});
