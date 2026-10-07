import { round3 } from "@/lib/amount";
import { HONORAIRE_TYPE_LABELS, type HonoraireLigne, type HonoraireRecapClient, type HonoraireType } from "@/types";

/** Totaux d'un groupe de lignes (un type de déclaration, une année). Le règlement compte sur
 * la ligne où il est saisi : le solde d'un groupe est son total moins ses règlements. */
export interface RecapGroupe {
  cle: string;
  libelle: string;
  nbLignes: number;
  declare: number;
  honoraires: number;
  total: number;
  reglements: number;
  solde: number;
}

export interface RecapSociete {
  nbLignes: number;
  declare: number;
  honoraires: number;
  total: number;
  reglements: number;
  solde: number;
  /** Date du règlement le plus récent (AAAA-MM-JJ), ou null si aucune n'est renseignée. */
  dernierReglement: string | null;
  parType: RecapGroupe[];
  parAnnee: RecapGroupe[];
}

const SANS_ANNEE = "Sans année";

/** Année d'une ligne : celle lue dans sa période, sinon dans son libellé (« DMI avril 2026 »),
 * sinon l'année de sa création. */
export function anneeDeLigne(l: Pick<HonoraireLigne, "periode" | "libelle" | "creeLe">): string {
  const dansTexte = (t: string) => /(?:^|\D)(20\d{2})(?!\d)/.exec(t || "")?.[1];
  return dansTexte(l.periode) ?? dansTexte(l.libelle) ?? (l.creeLe ? l.creeLe.slice(0, 4) : SANS_ANNEE);
}

function grouper(
  list: HonoraireLigne[],
  cle: (l: HonoraireLigne) => string,
  libelle: (cle: string) => string,
  ordre: (a: string, b: string) => number,
): RecapGroupe[] {
  const groupes = new Map<string, HonoraireLigne[]>();
  for (const l of list) groupes.set(cle(l), [...(groupes.get(cle(l)) ?? []), l]);
  return [...groupes.entries()]
    .sort(([a], [b]) => ordre(a, b))
    .map(([k, lignes]) => {
      const declare = round3(lignes.reduce((s, l) => s + l.montantDeclaration, 0));
      const honoraires = round3(lignes.reduce((s, l) => s + l.honoraire, 0));
      const reglements = round3(lignes.reduce((s, l) => s + l.reglement, 0));
      const total = round3(declare + honoraires);
      return { cle: k, libelle: libelle(k), nbLignes: lignes.length, declare, honoraires, total, reglements, solde: round3(total - reglements) };
    });
}

const ORDRE_TYPES = Object.keys(HONORAIRE_TYPE_LABELS) as HonoraireType[];

/** Récapitulatif d'une société : totaux, détail par type de déclaration et par année. */
export function recapSociete(list: HonoraireLigne[]): RecapSociete {
  const declare = round3(list.reduce((s, l) => s + l.montantDeclaration, 0));
  const honoraires = round3(list.reduce((s, l) => s + l.honoraire, 0));
  const reglements = round3(list.reduce((s, l) => s + l.reglement, 0));
  const total = round3(declare + honoraires);
  const dates = list.map((l) => l.dateReglement).filter((d): d is string => Boolean(d));
  return {
    nbLignes: list.length,
    declare,
    honoraires,
    total,
    reglements,
    solde: round3(total - reglements),
    dernierReglement: dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null,
    parType: grouper(
      list,
      (l) => l.type,
      (k) => HONORAIRE_TYPE_LABELS[k as HonoraireType] ?? k,
      (a, b) => ORDRE_TYPES.indexOf(a as HonoraireType) - ORDRE_TYPES.indexOf(b as HonoraireType),
    ),
    // Années les plus récentes d'abord ; « Sans année » en dernier.
    parAnnee: grouper(
      list,
      anneeDeLigne,
      (k) => k,
      (a, b) => (a === SANS_ANNEE ? 1 : b === SANS_ANNEE ? -1 : b.localeCompare(a)),
    ),
  };
}

export interface TotauxClients {
  clients: number;
  avecSolde: number;
  declare: number;
  honoraires: number;
  total: number;
  reglements: number;
  solde: number;
}

/** Totaux de l'ensemble des clients du récapitulatif. */
export function totauxClients(rows: HonoraireRecapClient[]): TotauxClients {
  const somme = (cle: "declare" | "honoraires" | "total" | "reglements" | "solde") => round3(rows.reduce((s, r) => s + r[cle], 0));
  return {
    clients: rows.length,
    avecSolde: rows.filter((r) => r.solde > 0).length,
    declare: somme("declare"),
    honoraires: somme("honoraires"),
    total: somme("total"),
    reglements: somme("reglements"),
    solde: somme("solde"),
  };
}

/** Tri du récapitulatif : plus gros solde dû d'abord, puis ordre alphabétique. */
export function trierParSolde(rows: HonoraireRecapClient[]): HonoraireRecapClient[] {
  return [...rows].sort((a, b) => b.solde - a.solde || a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true }));
}
