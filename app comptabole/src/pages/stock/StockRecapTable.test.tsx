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

const tableau = () => within(document.querySelector("table") as HTMLElement);
const lignesDe = (id: string) => Array.from(document.querySelectorAll<HTMLElement>(`tr[data-mouvement="${id}"]`));

describe("tableau récapitulatif du stock", () => {
  afterEach(cleanup);

  it("met en évidence un n° de facture déjà utilisé par un autre mouvement", () => {
    afficher({ doublons: { vente: new Set(["m1"]), achat: new Set() } });
    const icones = tableau().getAllByLabelText("Numéro de facture en doublon");
    expect(icones).toHaveLength(1);
    expect(lignesDe("m1")[0].contains(icones[0])).toBe(true);
    cleanup();
    afficher();
    expect(screen.queryByLabelText("Numéro de facture en doublon")).toBeNull();
  });

  it("garde les attributs du cabinet : côté, date, facture, tiers, quantité, devise, cours, montant TND, pièce et douane", () => {
    afficher();
    const entetes = Array.from(document.querySelectorAll("thead th")).map((th) => th.textContent);
    for (const colonne of ["N°", "Mouvement", "Écart", "Côté", "Date", "N° facture", "Client / Fournisseur", "Qté", "En devise", "Devise", "Cours", "MT TND", "Pièce", "Douane"]) {
      expect(entetes).toContain(colonne);
    }
    // Une seule rangée d'en-têtes, aucune colonne n'est tronquée ni défilante.
    expect(document.querySelectorAll("thead tr")).toHaveLength(1);
    expect(document.querySelector("table")?.className).toContain("table-fixed");
    expect(document.querySelector("[data-tour='stock-register']")?.querySelector(".overflow-x-auto")).toBeNull();
  });

  it("donne deux lignes à chaque mouvement : la vente puis l'achat, avec la douane à droite", () => {
    afficher();
    const [vente, achat] = lignesDe("m1");
    const v = within(vente);
    const a = within(achat);
    expect(v.getByText("Vente")).toBeTruthy();
    expect(v.getByText("GROUP BYOUT EZZ")).toBeTruthy();
    expect(v.getByText("202300001")).toBeTruthy();
    expect(a.getByText("Achat")).toBeTruthy();
    expect(a.getByText("RUSPINA IMPORT ET EXPORT")).toBeTruthy();
    expect(a.getByText("6608000533")).toBeTruthy();
    // La douane est portée par la première ligne, sur les deux lignes du mouvement.
    expect(v.getByText("447898")).toBeTruthy();
    expect(v.getByText(/type E/)).toBeTruthy();
    expect(v.getByText(/Valeur 170 778,400/)).toBeTruthy();
    expect(a.queryByText("447898")).toBeNull();
    expect(v.getByText("Portland Cement CEM I 42,5 N")).toBeTruthy();
  });

  it("numérote les mouvements et n'écrit la nature de la marchandise qu'une fois", () => {
    afficher();
    expect(tableau().getAllByText("Portland Cement CEM I 42,5 N")).toHaveLength(1);
    expect(lignesDe("m1")[0].querySelector("td")?.textContent).toBe("1");
    expect(lignesDe("m2")[0].querySelector("td")?.textContent).toBe("2");
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
    const r = within(document.querySelector("tbody") as HTMLElement);
    expect(r.getAllByText("3,3165")).toHaveLength(2);
    expect(r.getAllByText("EUR")).toHaveLength(2);
    expect(r.getByText("147 545,100")).toBeTruthy();
    expect(r.getByText("189 464,083")).toBeTruthy();
    expect(r.getByText("GREEN RECYCLING")).toBeTruthy();
    expect(r.getByText("250007")).toBeTruthy();
  });

  it("met l'écart en évidence, totalise dans le pied du tableau et donne la marge en dinars", () => {
    afficher();
    expect(tableau().getByText("Total (2)")).toBeTruthy();
    const pied = within(document.querySelector("tfoot") as HTMLElement);
    expect(document.querySelectorAll("tfoot tr")).toHaveLength(1);
    expect(pied.getByText(/Vente : 371 000/)).toBeTruthy();
    expect(pied.getByText(/Achat : 1 370/)).toBeTruthy();
    expect(pied.getByText(/Vente − achat :/)).toBeTruthy();
    expect(pied.getByText(/Marge TND/)).toBeTruthy();
    const ecart = within(lignesDe("m2")[0]).getByText("-369 630");
    expect(ecart.className).toContain("text-destructive");
  });

  it("déplie le détail : vente et achat côte à côte, douane en dessous, avec leurs pièces et les actions", () => {
    const { onEdit, onDelete } = afficher();
    expect(tableau().queryByText("Écart achat − vente", { exact: false })).toBeNull();
    fireEvent.click(lignesDe("m1")[0]);
    for (const titre of ["Vente", "Achat", "Douane"]) {
      expect(tableau().getAllByText(titre, { selector: "h3" })).toHaveLength(1);
    }
    expect(tableau().getByText("Exportateur")).toBeTruthy();
    expect(tableau().getByText("STE DES CIMENTS D'ENFIDHA")).toBeTruthy();
    expect(tableau().getByText("Écart achat − vente", { exact: false })).toBeTruthy();
    expect(tableau().getAllByText("1 000,000 EUR").length).toBeGreaterThan(0);
    // Chaque facture porte sa pièce : seul le document douanier existe ici.
    expect(tableau().getAllByText("Aucune pièce jointe").length).toBe(2);
    expect(tableau().getByText("Document douanier")).toBeTruthy();
    fireEvent.click(tableau().getByRole("button", { name: "Modifier" }));
    fireEvent.click(tableau().getByRole("button", { name: "Supprimer" }));
    expect(onEdit).toHaveBeenCalledWith(ciment);
    expect(onDelete).toHaveBeenCalledWith(ciment);
  });

  it("n'affiche l'écart par produit que si une facture liste plusieurs produits", () => {
    afficher();
    fireEvent.click(lignesDe("m2")[0]);
    expect(tableau().queryByText("CEM I 52.5 N", { exact: false, selector: "span" })).toBeNull();

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
    fireEvent.click(lignesDe("m4")[0]);
    expect(tableau().getByText("GRAVIER", { selector: "span" })).toBeTruthy();
    expect(tableau().getAllByText("Total").length).toBeGreaterThan(0);
  });

  it("ouvre l'aperçu d'une pièce sans déplier la ligne", () => {
    const { onPreview } = afficher();
    fireEvent.click(within(lignesDe("m1")[0]).getByLabelText("Voir : Document douanier"));
    expect(onPreview).toHaveBeenCalledWith("Document douanier", ciment.douaneDocDataUrl);
    expect(tableau().queryByText("Écart achat − vente", { exact: false })).toBeNull();
  });

  it("met en évidence le mouvement qui vient d'être enregistré", () => {
    afficher({ nouveauId: "m2" });
    expect(lignesDe("m2")[0].getAttribute("data-nouveau")).toBe("true");
    expect(lignesDe("m1")[0].getAttribute("data-nouveau")).toBeNull();
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
    const [vente, achat] = lignesDe("m3");
    expect(within(vente).getByText("370 T", { selector: "td" }).tagName).toBe("TD");
    expect(within(achat).getByText("370 000 KG", { selector: "td" }).tagName).toBe("TD");
    // Un écart nul s'écrit « 0 », sans unité.
    expect(within(vente).getByText("0")).toBeTruthy();
    expect(within(vente).queryByText("0 T")).toBeNull();
  });
});
