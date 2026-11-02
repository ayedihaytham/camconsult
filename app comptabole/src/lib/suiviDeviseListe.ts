import type { SuiviDeviseResume } from "@/store/suiviDevise";

/**
 * Registre des fiches du suivi client devise : filtres des chiffres du haut, choix de la fiche affichée dans le volet, part soldée et solde dû par devise.
 * Rien de métier ici : tout vient de la liste déjà calculée par le serveur.
 */
export type FiltreFiches = "toutes" | "du" | "soldees" | "stock";

export const TOLERANCE_SOLDE = 0.01;
export const aSoldeDu = (f: Pick<SuiviDeviseResume, "solde">) => f.solde > TOLERANCE_SOLDE;

const filtres: Record<FiltreFiches, (f: SuiviDeviseResume) => boolean> = {
  toutes: () => true,
  du: (f) => aSoldeDu(f),
  soldees: (f) => !aSoldeDu(f),
  stock: (f) => (f.stockAReprendre ?? 0) > 0,
};

/** Effectif de chaque filtre (les chiffres du haut). */
export function effectifs(liste: SuiviDeviseResume[]): Record<FiltreFiches, number> {
  return { toutes: liste.length, du: liste.filter(filtres.du).length, soldees: liste.filter(filtres.soldees).length, stock: liste.filter(filtres.stock).length };
}

/** Fiches affichées : filtre des chiffres du haut, puis recherche (client, exercice, devise). */
export function fichesAffichees(liste: SuiviDeviseResume[], filtre: FiltreFiches, recherche: string): SuiviDeviseResume[] {
  const q = recherche.trim().toLowerCase();
  return liste.filter(filtres[filtre]).filter((f) => !q || [f.client, f.exercice, f.devise].some((v) => (v || "").toLowerCase().includes(q)));
}

/** Fiche choisie : celle de l'utilisateur tant qu'elle est affichée ; sinon la première avec un solde dû, ou la première de la liste. */
export function ficheChoisie(affichees: SuiviDeviseResume[], choix: string | null): string | null {
  if (choix && affichees.some((f) => f.id === choix)) return choix;
  return (affichees.find(aSoldeDu) ?? affichees[0])?.id ?? null;
}

/** Part d'une fiche déjà soldée (0 à 100) : tout ce qui a été déduit du total des ventes (règlements, avoirs, charges, report). Null sans vente. */
export function partSoldee(f: Pick<SuiviDeviseResume, "totalVentes" | "solde">): number | null {
  if (!(f.totalVentes > 0)) return null;
  return Math.max(0, Math.min(100, Math.round(((f.totalVentes - f.solde) / f.totalVentes) * 100)));
}

/** Solde dû total, une ligne par devise (les devises ne s'additionnent pas), de la plus importante à la moins importante. */
export function soldeDuParDevise(liste: SuiviDeviseResume[]): { devise: string; montant: number }[] {
  const par = new Map<string, number>();
  for (const f of liste.filter(aSoldeDu)) par.set(f.devise, Math.round(((par.get(f.devise) ?? 0) + f.solde) * 1000) / 1000);
  return [...par.entries()].map(([devise, montant]) => ({ devise, montant })).sort((a, b) => b.montant - a.montant);
}
