import type { StockLigne, StockMouvement } from "@/types";

export interface RecapCote {
  quantite: number;
  montantDevise: number;
  montantTnd: number;
  produits: number;
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Totaux d'un côté (achat ou vente) d'un mouvement : une facture peut lister plusieurs produits. */
export function totauxCote(lignes: StockLigne[]): RecapCote {
  return {
    quantite: r3(lignes.reduce((s, l) => s + (l.quantite || 0), 0)),
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
}

/** Récapitulatif de l'ensemble des mouvements affichés (pied du tableau et bandeau). */
export function recapStock(mouvements: StockMouvement[]): RecapStock {
  const achat = mouvements.map((m) => totauxCote(m.achatLignes));
  const vente = mouvements.map((m) => totauxCote(m.venteLignes));
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
    ecart: r3(mouvements.reduce((s, m) => s + m.ecart, 0)),
  };
}

export const fmtMontant = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const fmtQuantite = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
