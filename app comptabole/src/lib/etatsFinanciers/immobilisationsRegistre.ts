import type { ImmoBien, ImmoCategorie, ImmoMasse, ImmoMasseCategorie, ImmoMouvement } from "@/types";
import type { PostesExercice } from "@/store/balances";

/**
 * Registre d'immobilisations — chaque bien est saisi une fois (date, coût,
 * taux) ; l'amortissement de n'importe quel exercice se déduit par calcul
 * (linéaire, prorata temporis, plafonné au coût). Ce module ne fait QUE
 * produire les 4 mouvements (acquisitions/cessions/dotations/reprises) par
 * masse pour un exercice donné — au même format que la saisie manuelle
 * (`ImmoMouvement`), pour rester un remplacement transparent de
 * `computeImmoVariation` (src/lib/etatsFinanciers/immobilisations.ts), qui
 * continue de lire la valeur de clôture depuis la balance (vérité terrain),
 * pas depuis ce registre.
 */

const MASSE_MAP: Record<ImmoMasseCategorie, ImmoMasse> = {
  incorporelle: "incorporelles",
  corporelle: "corporelles",
};

export interface BienCalcul {
  bien: ImmoBien;
  categorie: ImmoCategorie;
  brutOuverture: number;
  acquisitions: number;
  cessionsBrut: number;
  brutCloture: number;
  amortOuverture: number;
  dotations: number;
  cessionsAmort: number;
  amortCloture: number;
  vcn: number;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Amortissement cumulé linéaire, prorata temporis, plafonné au coût —
 * depuis la date d'acquisition jusqu'à `asOf` (exclusive : `asOf` est le
 * lendemain du dernier jour à amortir). */
function amortCumuleAu(bien: ImmoBien, asOf: Date): number {
  const acquisition = new Date(bien.dateAcquisition);
  if (asOf <= acquisition) return 0;
  const dailyRate = (bien.coutAcquisition * (bien.taux / 100)) / 365;
  return Math.min(bien.coutAcquisition, dailyRate * daysBetween(acquisition, asOf));
}

/** Calcule un bien pour un exercice donné (année civile) — null si le bien
 * n'existe pas encore, ou a déjà été cédé avant cet exercice. */
export function computeBienPourExercice(
  bien: ImmoBien,
  categorie: ImmoCategorie,
  exercice: string,
): BienCalcul | null {
  const annee = Number(exercice);
  if (!Number.isFinite(annee)) return null;
  const exerciceStart = new Date(`${exercice}-01-01T00:00:00Z`);
  const exerciceFinExclusive = new Date(`${annee + 1}-01-01T00:00:00Z`);
  const acquisition = new Date(`${bien.dateAcquisition}T00:00:00Z`);
  const cession = bien.dateCession ? new Date(`${bien.dateCession}T00:00:00Z`) : null;

  if (acquisition >= exerciceFinExclusive) return null;
  if (cession && cession < exerciceStart) return null;

  const brutOuverture = acquisition < exerciceStart ? bien.coutAcquisition : 0;
  const acquisitions =
    acquisition >= exerciceStart && acquisition < exerciceFinExclusive ? bien.coutAcquisition : 0;
  const cedeCetExercice = cession !== null && cession >= exerciceStart && cession < exerciceFinExclusive;
  const cessionsBrut = cedeCetExercice ? bien.coutAcquisition : 0;
  const brutCloture = brutOuverture + acquisitions - cessionsBrut;

  const finPeriodeAmort = cedeCetExercice
    ? new Date((cession as Date).getTime() + 86400000)
    : exerciceFinExclusive;
  const amortOuverture = amortCumuleAu(bien, exerciceStart);
  const amortAvantCession = amortCumuleAu(bien, finPeriodeAmort);
  const dotations = amortAvantCession - amortOuverture;
  const cessionsAmort = cedeCetExercice ? amortAvantCession : 0;
  const amortCloture = amortOuverture + dotations - cessionsAmort;

  return {
    bien,
    categorie,
    brutOuverture,
    acquisitions,
    cessionsBrut,
    brutCloture,
    amortOuverture,
    dotations,
    cessionsAmort,
    amortCloture,
    vcn: brutCloture - amortCloture,
  };
}

/** Tous les biens d'une société calculés pour un exercice — un seul passage,
 * réutilisé pour le détail par bien et pour les totaux par masse. */
export function computeBiensPourExercice(
  biens: ImmoBien[],
  categories: ImmoCategorie[],
  exercice: string,
): BienCalcul[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const out: BienCalcul[] = [];
  for (const bien of biens) {
    const cat = catById.get(bien.categorieId);
    if (!cat) continue;
    const calc = computeBienPourExercice(bien, cat, exercice);
    if (calc) out.push(calc);
  }
  return out;
}

/** Masses effectivement couvertes par le registre pour cette société —
 * seules celles-ci basculent en lecture seule dans TAB VAR Immob (voir la
 * décision : bascule automatique par masse). */
export function massesCouvertesParRegistre(biens: ImmoBien[], categories: ImmoCategorie[]): ImmoMasse[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const masses = new Set<ImmoMasse>();
  for (const bien of biens) {
    const cat = catById.get(bien.categorieId);
    if (cat) masses.add(MASSE_MAP[cat.masse]);
  }
  return [...masses];
}

/** Produit les mouvements (acquisitions/cessions/dotations/reprises) par
 * masse pour un exercice, au même format que la saisie manuelle — pour
 * remplacer `immo_mouvements` dans `computeImmoVariation`/`computeFlux` sans
 * toucher à leur logique. */
export function computeMouvementsDepuisRegistre(
  societeId: string,
  biens: ImmoBien[],
  categories: ImmoCategorie[],
  exercice: string,
): ImmoMouvement[] {
  const calculs = computeBiensPourExercice(biens, categories, exercice);
  const totals = new Map<ImmoMasse, { acquisitions: number; cessions: number; dotations: number; reprises: number }>();
  for (const c of calculs) {
    const masse = MASSE_MAP[c.categorie.masse];
    const t = totals.get(masse) ?? { acquisitions: 0, cessions: 0, dotations: 0, reprises: 0 };
    t.acquisitions += c.acquisitions;
    t.cessions += c.cessionsBrut;
    t.dotations += c.dotations;
    t.reprises += c.cessionsAmort;
    totals.set(masse, t);
  }
  return [...totals.entries()].map(([masse, t]) => ({
    societeId,
    exercice,
    masse,
    ...t,
    majLe: "",
  }));
}

/** Fusionne, pour chaque exercice, les mouvements manuels (immo_mouvements)
 * avec ceux calculés depuis le registre — le registre l'emporte pour les
 * masses qu'il couvre (bascule automatique), la saisie manuelle reste pour
 * les autres (notamment "financieres", jamais couvert par ce registre). */
export function mergeImmoMouvements(
  societeId: string,
  exercices: PostesExercice[],
  manuels: ImmoMouvement[],
  biens: ImmoBien[],
  categories: ImmoCategorie[],
): ImmoMouvement[] {
  const massesRegistre = new Set(massesCouvertesParRegistre(biens, categories));
  if (massesRegistre.size === 0) return manuels;

  const result: ImmoMouvement[] = [];
  for (const e of exercices) {
    const calcules = computeMouvementsDepuisRegistre(societeId, biens, categories, e.exercice);
    for (const masse of massesRegistre) {
      result.push(
        calcules.find((m) => m.masse === masse) ?? {
          societeId,
          exercice: e.exercice,
          masse,
          acquisitions: 0,
          cessions: 0,
          dotations: 0,
          reprises: 0,
          majLe: "",
        },
      );
    }
  }
  const manuelsRestants = manuels.filter((m) => !massesRegistre.has(m.masse));
  return [...result, ...manuelsRestants];
}
