import type { DashboardPortefeuilleItem } from "./dashboardData";

/** État d'un dossier dans le portefeuille : en retard de transmission, en révision (pièces à examiner ou à corriger), à jour. */
export type EtatClient = "retard" | "traiter" | "jour";

export function etatClient(item: DashboardPortefeuilleItem): EtatClient {
  if (item.enRetard > 0) return "retard";
  if (item.transmis + item.aCorriger > 0) return "traiter";
  return "jour";
}

/** Étapes d'une collecte ouverte, dans l'ordre du circuit (les collectes validées ne sont plus ouvertes). */
export const ETAPES_OUVERTES = ["brouillon", "transmis", "aCorriger"] as const;
export type EtapeOuverte = (typeof ETAPES_OUVERTES)[number];

/** Une part par étape où se trouve au moins une collecte ouverte du dossier. */
export function circuitOuvert(item: DashboardPortefeuilleItem): Array<{ etape: EtapeOuverte; n: number }> {
  return ETAPES_OUVERTES.map((etape) => ({ etape, n: item[etape] })).filter((p) => p.n > 0);
}

/** Les dossiers d'un état, les plus chargés (collectes ouvertes puis retards) d'abord, puis par nom. */
export function dossiersDeLEtat(items: DashboardPortefeuilleItem[], etat: EtatClient): DashboardPortefeuilleItem[] {
  return items
    .filter((i) => etatClient(i) === etat)
    .sort((a, b) => b.enRetard - a.enRetard || b.enCours - a.enCours || a.societeName.localeCompare(b.societeName, "fr"));
}
