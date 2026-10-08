import type { SuiviDeviseFacture } from "@/types";

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Marge d'une facture reprise du stock : vente − achat, dans la devise de la fiche. Null quand la facture n'a pas
 * d'achat lié, ou quand l'achat est dans une autre devise (la différence n'aurait pas de sens). */
export function margeFacture(f: SuiviDeviseFacture, devise: string): number | null {
  if (!f.mouvementStockId || f.achatMontant == null || f.achatMontant === 0 || f.achatDevise !== devise) return null;
  return r3(f.montantTotal - f.achatMontant);
}

/** Achats liés et marge de toutes les factures qui ont un achat dans la devise de la fiche. */
export function totauxAchats(factures: SuiviDeviseFacture[], devise: string): { achats: number; marge: number; nb: number } {
  let achats = 0;
  let marge = 0;
  let nb = 0;
  for (const f of factures) {
    const m = margeFacture(f, devise);
    if (m === null) continue;
    nb += 1;
    achats += f.achatMontant ?? 0;
    marge += m;
  }
  return { achats: r3(achats), marge: r3(marge), nb };
}
