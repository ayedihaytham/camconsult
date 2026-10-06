import type { StockLigne, StockMouvement } from "@/types";

export interface RecapCote {
  quantite: number;
  montantDevise: number;
  montantTnd: number;
  produits: number;
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Unité commune d'un ensemble de lignes : si tonnes (T) et kilos (KG) se mélangent, tout est
 * ramené en tonnes ; sinon l'unique unité utilisée, ou "" si aucune n'est précisée. */
export function uniteCommune(lignes: Pick<StockLigne, "unite">[]): string {
  const unites = new Set(lignes.map((l) => l.unite).filter(Boolean));
  if (unites.has("T") && unites.has("KG")) return "T";
  return unites.size === 1 ? [...unites][0]! : "";
}

/** Quantité d'une ligne exprimée dans l'unité commune. */
export const quantiteEn = (l: Pick<StockLigne, "quantite" | "unite">, unite: string) =>
  unite === "T" && l.unite === "KG" ? l.quantite / 1000 : l.quantite;

/** Unité d'un côté d'un mouvement, pour l'afficher à côté de sa quantité (vide si mélangée ou absente). */
export function uniteAffichee(lignes: Pick<StockLigne, "unite">[]): string {
  const unites = new Set(lignes.map((l) => l.unite).filter(Boolean));
  return unites.size === 1 ? [...unites][0]! : "";
}

/** Totaux d'un côté (achat ou vente) d'un mouvement : une facture peut lister plusieurs produits. */
export function totauxCote(lignes: StockLigne[], unite = uniteCommune(lignes)): RecapCote {
  return {
    quantite: r3(lignes.reduce((s, l) => s + quantiteEn({ quantite: l.quantite || 0, unite: l.unite }, unite), 0)),
    montantDevise: r3(lignes.reduce((s, l) => s + (l.montantDevise || 0), 0)),
    montantTnd: r3(lignes.reduce((s, l) => s + (l.montantTnd || 0), 0)),
    produits: lignes.length,
  };
}

export interface RecapStock {
  mouvements: number;
  anomalies: number;
  achat: RecapCote;
  vente: RecapCote;
  /** Somme des écarts (quantité achetée − quantité vendue) de chaque mouvement. */
  ecart: number;
  /** Unité des quantités totalisées (tonnes si des kilos et des tonnes se mélangent). */
  unite: string;
}

/** Récapitulatif de l'ensemble des mouvements affichés (pied du tableau et bandeau). */
export function recapStock(mouvements: StockMouvement[]): RecapStock {
  const unite = uniteCommune(mouvements.flatMap((m) => [...m.achatLignes, ...m.venteLignes]));
  const achat = mouvements.map((m) => totauxCote(m.achatLignes, unite));
  const vente = mouvements.map((m) => totauxCote(m.venteLignes, unite));
  const somme = (cotes: RecapCote[], cle: keyof RecapCote) => r3(cotes.reduce((s, c) => s + c[cle], 0));
  return {
    mouvements: mouvements.length,
    anomalies: mouvements.filter((m) => m.ecart !== 0).length,
    achat: {
      quantite: somme(achat, "quantite"),
      montantDevise: somme(achat, "montantDevise"),
      montantTnd: somme(achat, "montantTnd"),
      produits: somme(achat, "produits"),
    },
    vente: {
      quantite: somme(vente, "quantite"),
      montantDevise: somme(vente, "montantDevise"),
      montantTnd: somme(vente, "montantTnd"),
      produits: somme(vente, "produits"),
    },
    // L'écart de chaque mouvement est dans son unité : on le ramène à l'unité commune.
    ecart: r3(mouvements.reduce((s, m) => s + (unite === "T" && m.ecartUnite === "KG" ? m.ecart / 1000 : m.ecart), 0)),
    unite,
  };
}

export const fmtMontant = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const fmtQuantite = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** Quantité avec son unité : « 370 T ». */
export const fmtQuantiteUnite = (n: number, unite: string) => `${fmtQuantite(n)}${unite ? ` ${unite}` : ""}`;
