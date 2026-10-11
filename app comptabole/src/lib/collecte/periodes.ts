import { COLLECTE_TABS, TAB_BY_KEY } from "@/lib/collecte/tabs";

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** « Octobre 2026 » : la période d'un mois, telle qu'on l'écrit dans une collecte. */
export function periodeMois(date: Date): string {
  return `${MOIS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Périodes proposées à la création d'une collecte : mois courant, mois précédent, trimestre courant, dernier exercice. */
export function periodesSuggerees(now: Date): string[] {
  const precedent = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const trimestre = Math.floor(now.getMonth() / 3) + 1;
  return [periodeMois(now), periodeMois(precedent), `T${trimestre} ${now.getFullYear()}`, `Exercice ${now.getFullYear() - 1}`];
}

/** Ce que demande une collecte, en une ligne : « Comptabilité complète » ou les tableaux nommés (4 au plus, puis « +n »). */
export function resumeTableaux(onglets: string[], max = 4): string[] {
  const demandes = onglets.filter((key) => !TAB_BY_KEY[key]?.cabinetSeul);
  if (demandes.length === 0) return [];
  if (demandes.length >= COLLECTE_TABS.filter((tab) => !tab.cabinetSeul).length) return ["Comptabilité complète"];
  const noms = demandes.map((key) => TAB_BY_KEY[key]?.label ?? key);
  return noms.length > max ? [...noms.slice(0, max), `+${noms.length - max}`] : noms;
}
