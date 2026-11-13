import type { Collecte } from "@/types";

export const MOIS_COURTS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];
export const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Mois (0-11) et année d'une collecte : lus dans la période (« Octobre 2026 », « 2026-10 »), sinon dans sa date de création. */
export function moisDeCollecte(c: Pick<Collecte, "periode" | "creeLe">): { annee: number; mois: number } | null {
  const periode = sansAccent(c.periode ?? "");
  const annee = /(20\d{2})/.exec(periode)?.[1];
  const iso = /(20\d{2})-(0[1-9]|1[0-2])/.exec(periode);
  if (iso) return { annee: Number(iso[1]), mois: Number(iso[2]) - 1 };
  const i = MOIS_LONGS.findIndex((m) => new RegExp(`\\b${sansAccent(m)}\\b`).test(periode));
  if (i >= 0 && annee) return { annee: Number(annee), mois: i };
  if (c.creeLe) {
    const d = new Date(c.creeLe);
    if (!Number.isNaN(d.getTime())) return { annee: d.getFullYear(), mois: d.getMonth() };
  }
  return null;
}

export type EtatMois = "retard" | "en_cours" | "validees" | "vide";

export interface SyntheseMois {
  etat: EtatMois;
  validees: number;
  enCours: number;
  enRetard: number;
}

/** Une synthèse par mois de l'exercice : en retard > en cours > validées (archivées ignorées). */
export function syntheseParMois(collectes: Collecte[], annee: number, maintenant: Date): SyntheseMois[] {
  const mois: SyntheseMois[] = Array.from({ length: 12 }, () => ({ etat: "vide", validees: 0, enCours: 0, enRetard: 0 }));
  const aujourdhui = new Date(maintenant).setHours(0, 0, 0, 0);
  for (const c of collectes) {
    if (c.statut === "archive") continue;
    const m = moisDeCollecte(c);
    if (!m || m.annee !== annee) continue;
    const s = mois[m.mois];
    if (c.statut === "valide") s.validees += 1;
    else if (c.echeance && new Date(c.echeance).getTime() < aujourdhui) s.enRetard += 1;
    else s.enCours += 1;
  }
  for (const s of mois) s.etat = s.enRetard ? "retard" : s.enCours ? "en_cours" : s.validees ? "validees" : "vide";
  return mois;
}

export const cleMois = (annee: number, mois: number) => `${annee}-${String(mois + 1).padStart(2, "0")}`;

export function resumeMois(s: SyntheseMois): string {
  const parts = [
    s.enRetard ? `${s.enRetard} en retard` : "",
    s.enCours ? `${s.enCours} en cours` : "",
    s.validees ? `${s.validees} validée${s.validees > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "Aucune collecte";
}
