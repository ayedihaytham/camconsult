import type { Noeud } from "@/types";

export const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"] as const;

export const MOIS_COMPLETS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"] as const;

export interface OptionsMois {
  /** Afficher les mois sous les dossiers de l'année. */
  afficher: boolean;
  /** Tous les mois sont dépliés au départ. */
  tous: boolean;
}

/** Année écrite dans un libellé (« Comptabilité générale 2026 » → 2026), sinon null. */
export function anneeDuLibelle(libelle: string): number | null {
  const m = /\b(20\d{2})\b/.exec(libelle);
  return m ? Number(m[1]) : null;
}

/** Fichiers d'un mois (janvier = 0) sous un dossier, tous niveaux confondus, du plus récent au plus ancien. */
export function fichiersDuMois(dossierId: string, nodes: Noeud[], annee: number | null, mois: number): Noeud[] {
  const enfants = new Map<string, Noeud[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    enfants.set(n.parentId, [...(enfants.get(n.parentId) ?? []), n]);
  }
  const trouves: Noeud[] = [];
  const pile = [...(enfants.get(dossierId) ?? [])];
  while (pile.length > 0) {
    const n = pile.pop()!;
    if (n.type === "dossier") {
      pile.push(...(enfants.get(n.id) ?? []));
      continue;
    }
    const date = new Date(n.creeLe);
    if (Number.isNaN(date.getTime()) || date.getMonth() !== mois) continue;
    if (annee !== null && date.getFullYear() !== annee) continue;
    trouves.push(n);
  }
  return trouves.sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

/** Nombre de fichiers de chaque mois (janvier = 0) sous un dossier, tous niveaux confondus, d'après leur date d'ajout.
 * Avec une année, seuls les fichiers de cette année comptent. */
export function comptesParMois(dossierId: string, nodes: Noeud[], annee: number | null): number[] {
  const comptes = new Array<number>(12).fill(0);
  const enfants = new Map<string, Noeud[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    enfants.set(n.parentId, [...(enfants.get(n.parentId) ?? []), n]);
  }
  const pile = [...(enfants.get(dossierId) ?? [])];
  while (pile.length > 0) {
    const n = pile.pop()!;
    if (n.type === "dossier") {
      pile.push(...(enfants.get(n.id) ?? []));
      continue;
    }
    const date = new Date(n.creeLe);
    if (Number.isNaN(date.getTime())) continue;
    if (annee !== null && date.getFullYear() !== annee) continue;
    comptes[date.getMonth()] += 1;
  }
  return comptes;
}
