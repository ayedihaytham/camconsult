import type { CoursChange, DeviseChange } from "@/types";

export const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** « 2026-10-03 » ou « 03/10/2026 » → { annee, mois } ; null si la date n'est pas lisible. */
export function anneeMois(date: string | null | undefined): { annee: number; mois: number } | null {
  const s = String(date ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-\d{2}/.exec(s);
  const fr = /^\d{1,2}[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  const annee = iso ? Number(iso[1]) : fr ? Number(fr[2]) : NaN;
  const mois = iso ? Number(iso[2]) : fr ? Number(fr[1]) : NaN;
  return annee > 0 && mois >= 1 && mois <= 12 ? { annee, mois } : null;
}

/** Cours moyen d'une devise pour le mois d'une date (TND pour 1 unité de devise, c'est-à-dire déjà divisé par l'unité), ou undefined. */
export function coursDuMois(cours: CoursChange[], devise: string, date: string | null | undefined): CoursChange | undefined {
  const code = devise.trim().toUpperCase();
  const am = anneeMois(date);
  if (!code || !am) return undefined;
  return cours.find((c) => c.devise === code && c.annee === am.annee && c.mois === am.mois);
}

/** Cours par unité : pour une devise cotée par 1000 (JPY), le cours à appliquer à une unité est le cours divisé par 1000. */
export function coursParUnite(c: CoursChange, devises: DeviseChange[]): number {
  const unite = devises.find((d) => d.code === c.devise)?.unite ?? 1;
  return Math.round((c.cours / unite) * 1e8) / 1e8;
}

/** Moyenne annuelle d'une devise sur les mois renseignés, ou undefined. */
export function moyenneAnnee(cours: CoursChange[], devise: string, annee: number): number | undefined {
  const l = cours.filter((c) => c.devise === devise && c.annee === annee);
  return l.length ? Math.round((l.reduce((s, c) => s + c.cours, 0) / l.length) * 1e4) / 1e4 : undefined;
}

/** Années qui ont au moins un cours, de la plus récente à la plus ancienne. */
export const anneesAvecCours = (cours: CoursChange[]): number[] => [...new Set(cours.map((c) => c.annee))].sort((a, b) => b - a);

export interface CoursCollé {
  devise: string;
  annee: number;
  mois: number;
  cours: number;
}

/** Lit un tableau copié depuis le site de la banque centrale ou depuis Excel : une ligne d'en-têtes qui cite les devises
 * (« Dollar des USA (USD) Unité:1 », « EURO (EUR)… » ou simplement « USD ») puis une ligne par date « 31/01/2025  3,2000  3,9556  3,3167 »,
 * dans l'ordre des devises. Les dates de fin de mois donnent le mois. Renvoie aussi les lignes ignorées. */
export function lireCoursCollés(texte: string, devisesConnues: string[]): { cours: CoursCollé[]; devises: string[]; ignorees: number } {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let devises: string[] = [];
  const cours: CoursCollé[] = [];
  let ignorees = 0;
  const nombre = (t: string): number | null => {
    const n = Number(t.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  for (const ligne of lignes) {
    const date = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(ligne);
    if (!date) {
      // En-têtes : les codes de devise, dans l'ordre où ils apparaissent.
      const codes = [...ligne.matchAll(/\b([A-Z]{3})\b/g)].map((m) => m[1]).filter((c) => devisesConnues.includes(c) || /\(([A-Z]{3})\)/.test(ligne));
      const entre = [...ligne.matchAll(/\(([A-Z]{3})\)/g)].map((m) => m[1]);
      const trouves = entre.length ? entre : codes;
      if (trouves.length > 0) devises = [...new Set(trouves)];
      else if (/[\d]/.test(ligne)) ignorees += 1;
      continue;
    }
    const valeurs = ligne
      .slice(date[0].length)
      .split(/\t|\s{2,}|;/)
      .map((t) => t.trim())
      .filter(Boolean);
    const mois = Number(date[2]);
    const annee = Number(date[3]);
    if (mois < 1 || mois > 12 || devises.length === 0) {
      ignorees += 1;
      continue;
    }
    let lu = 0;
    valeurs.slice(0, devises.length).forEach((t, i) => {
      const n = nombre(t);
      if (n !== null) {
        cours.push({ devise: devises[i], annee, mois, cours: n });
        lu += 1;
      }
    });
    if (lu === 0) ignorees += 1;
  }
  return { cours, devises, ignorees };
}
