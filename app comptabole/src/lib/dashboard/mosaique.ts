import type { DashboardPortefeuilleItem } from "./dashboardData";

/** État d'un client dans la mosaïque : en retard (terracotta), à traiter (marine), à jour (blanc). */
export type EtatClient = "retard" | "traiter" | "jour";

export function etatClient(item: DashboardPortefeuilleItem): EtatClient {
  if (item.enRetard > 0) return "retard";
  if (item.transmis + item.aCorriger > 0) return "traiter";
  return "jour";
}

/** Poids d'une tuile : les collectes ouvertes (au moins 1, pour que chaque client reste visible). */
export function poidsClient(item: DashboardPortefeuilleItem): number {
  return Math.max(item.enCours, 1);
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Tuile<T> extends Rect { item: T }

/** Mosaïque proportionnelle (algorithme « squarified ») : l'aire de chaque tuile est proportionnelle à son poids. Les entrées doivent être triées par poids décroissant. */
export function mosaique<T>(items: T[], poids: (item: T) => number, largeur: number, hauteur: number): Tuile<T>[] {
  const total = items.reduce((s, i) => s + poids(i), 0);
  if (!items.length || total <= 0 || largeur <= 0 || hauteur <= 0) return [];
  const echelle = (largeur * hauteur) / total;
  const sortie: Tuile<T>[] = [];
  let zone: Rect = { x: 0, y: 0, w: largeur, h: hauteur };
  let reste = items.map((item) => ({ item, aire: poids(item) * echelle }));

  const pire = (rangee: { aire: number }[], cote: number) => {
    const somme = rangee.reduce((s, r) => s + r.aire, 0);
    const max = Math.max(...rangee.map((r) => r.aire));
    const min = Math.min(...rangee.map((r) => r.aire));
    return Math.max((cote * cote * max) / (somme * somme), (somme * somme) / (cote * cote * min));
  };

  while (reste.length) {
    const cote = Math.min(zone.w, zone.h);
    const rangee = [reste[0]];
    let i = 1;
    while (i < reste.length && pire([...rangee, reste[i]], cote) <= pire(rangee, cote)) {
      rangee.push(reste[i]);
      i += 1;
    }
    const somme = rangee.reduce((s, r) => s + r.aire, 0);
    const horizontal = zone.w >= zone.h;
    const epaisseur = somme / cote;
    let pos = horizontal ? zone.y : zone.x;
    for (const r of rangee) {
      const longueur = r.aire / epaisseur;
      sortie.push(horizontal
        ? { item: r.item, x: zone.x, y: pos, w: epaisseur, h: longueur }
        : { item: r.item, x: pos, y: zone.y, w: longueur, h: epaisseur });
      pos += longueur;
    }
    zone = horizontal
      ? { x: zone.x + epaisseur, y: zone.y, w: zone.w - epaisseur, h: zone.h }
      : { x: zone.x, y: zone.y + epaisseur, w: zone.w, h: zone.h - epaisseur };
    reste = reste.slice(rangee.length);
  }
  return sortie;
}
