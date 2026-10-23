import type { StockLigne, StockMouvement } from "@/types";

import { arrondi3 as r3 } from "../../shared/arrondi.js";
export interface RecapCote {
  quantite: number;
  montantDevise: number;
  montantTnd: number;
  produits: number;
}


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
  /** Lignes sans unité (pièces, sacs…) laissées hors des totaux en tonnes ou en kilos, pour ne pas les additionner à des tonnes. */
  horsUnite: number;
}

/** Lignes comptées dans une quantité totale : quand le total est en tonnes ou en kilos, seules les lignes en T ou en KG y entrent. */
function lignesComptees(lignes: StockLigne[], unite: string): StockLigne[] {
  return unite === "T" || unite === "KG" ? lignes.filter((l) => l.unite === "T" || l.unite === "KG") : lignes;
}

/** Récapitulatif de l'ensemble des mouvements affichés (pied du tableau et bandeau). */
export function recapStock(mouvements: StockMouvement[]): RecapStock {
  const unite = uniteCommune(mouvements.flatMap((m) => [...m.achatLignes, ...m.venteLignes]));
  const quantites = (lignes: StockLigne[]) => totauxCote(lignesComptees(lignes, unite), unite).quantite;
  const avecQuantiteComptee = (lignes: StockLigne[]): RecapCote => ({ ...totauxCote(lignes, unite), quantite: quantites(lignes) });
  const achat = mouvements.map((m) => avecQuantiteComptee(m.achatLignes));
  const vente = mouvements.map((m) => avecQuantiteComptee(m.venteLignes));
  const somme = (cotes: RecapCote[], cle: keyof RecapCote) => r3(cotes.reduce((s, c) => s + c[cle], 0));
  const horsUnite = mouvements.reduce((n, m) => n + m.achatLignes.length + m.venteLignes.length - lignesComptees(m.achatLignes, unite).length - lignesComptees(m.venteLignes, unite).length, 0);
  // Un mouvement sans unité (pièces) n'a pas d'écart en tonnes : il n'entre pas dans l'écart total.
  const ecartCompte = (m: StockMouvement) => !(unite === "T" || unite === "KG") || m.ecartUnite === "T" || m.ecartUnite === "KG";
  return {
    mouvements: mouvements.length,
    anomalies: mouvements.filter((m) => m.ecart !== 0).length,
    horsUnite,
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
    ecart: r3(mouvements.filter(ecartCompte).reduce((s, m) => s + (unite === "T" && m.ecartUnite === "KG" ? m.ecart / 1000 : m.ecart), 0)),
    unite,
  };
}

export const fmtMontant = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const fmtQuantite = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** Quantité avec son unité : « 370 T ». */
/** Quantité suivie de son unité ; un zéro reste « 0 », sans unité. */
export const fmtQuantiteUnite = (n: number, unite: string) => `${fmtQuantite(n)}${unite && n !== 0 ? ` ${unite}` : ""}`;

/** Différence vente − achat des montants en devise d'un mouvement, ou null quand les deux côtés ne sont
 * pas dans la même devise (la différence n'aurait pas de sens). */
export function ecartDevise(m: Pick<StockMouvement, "achatLignes" | "venteLignes" | "achatDevise" | "venteDevise">): { devise: string; valeur: number } | null {
  if (m.achatLignes.length === 0 && m.venteLignes.length === 0) return null;
  const devise = m.venteLignes.length ? m.venteDevise : m.achatDevise;
  if (m.achatLignes.length && m.venteLignes.length && m.achatDevise !== m.venteDevise) return null;
  const vente = totauxCote(m.venteLignes).montantDevise;
  const achat = totauxCote(m.achatLignes).montantDevise;
  return { devise, valeur: r3(vente - achat) };
}

/** Total vente − achat en devise de tous les mouvements, par devise. */
export function ecartsDeviseTotaux(mouvements: StockMouvement[]): { devise: string; valeur: number }[] {
  const parDevise = new Map<string, number>();
  for (const m of mouvements) {
    const e = ecartDevise(m);
    if (e) parDevise.set(e.devise, r3((parDevise.get(e.devise) ?? 0) + e.valeur));
  }
  return [...parDevise.entries()].map(([devise, valeur]) => ({ devise, valeur }));
}

/** Mouvements classés par n° de facture de vente croissant (« N° mouvement »), les chiffres comparés comme des nombres : 2600084 avant 2600091.
 * Ceux qui n'ont pas de n° de vente suivent, par date d'achat ; à égalité, l'ordre de saisie est gardé. */
export function trierParNumero<T extends Pick<StockMouvement, "venteNumFacture" | "achatDate">>(mouvements: T[]): T[] {
  return mouvements
    .map((m, rang) => ({ m, rang }))
    .sort((a, b) => {
      const na = a.m.venteNumFacture.trim();
      const nb = b.m.venteNumFacture.trim();
      if (na && nb) return na.localeCompare(nb, "fr", { numeric: true }) || a.rang - b.rang;
      if (na !== nb) return na ? -1 : 1;
      return (a.m.achatDate ?? "9999").localeCompare(b.m.achatDate ?? "9999") || a.rang - b.rang;
    })
    .map(({ m }) => m);
}
