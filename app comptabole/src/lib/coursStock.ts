import { coursDuMois, coursParUnite } from "@/lib/coursChange";
import { arrondi3 } from "../../shared/arrondi.js";
import type { CoursChange, DeviseChange, StockLigne } from "@/types";

/**
 * Cours de change d'un mouvement de stock, côté achat et côté vente.
 *
 * Deux cours par facture : en dinars (TND pour 1 unité de la devise) et par rapport au dollar (USD pour 1 unité de la devise).
 * Ordre de choix, pour chacun :
 *   1. le cours de la facture, quand il est saisi ou lu sur la facture ;
 *   2. sinon le taux de la douane (dinars) ;
 *   3. sinon le cours moyen du mois de la date de la facture (page « Cours de change »).
 * Le cours du dollar de repli est le cours croisé : cours en dinars de la devise ÷ cours en dinars du dollar du même mois.
 */

export type Cote = "achat" | "vente";

/** Cours qui suivent encore un repli (et qu'un changement de date, de devise ou de taux douanier peut donc mettre à jour) :
 * dès que l'utilisateur en saisit un à la main, il n'est plus remplacé. */
export interface CoursAuto {
  achat: boolean;
  vente: boolean;
  achatUsd: boolean;
  venteUsd: boolean;
}

export const coursAutoInitial = (): CoursAuto => ({ achat: true, vente: true, achatUsd: true, venteUsd: true });

const codeDevise = (devise: string) => devise.trim().toUpperCase();
const arrondi6 = (n: number) => Math.round(n * 1e6) / 1e6;

interface Tables {
  cours: CoursChange[];
  devises: DeviseChange[];
}

/** Cours en dinars de repli : taux de la douane s'il est renseigné, sinon cours moyen du mois ; null pour le dinar ou sans cours. */
export function coursTndDeRepli(devise: string, date: string | null | undefined, douaneTaux: number, t: Tables): { valeur: number; source: "douane" | "moyen" } | null {
  const code = codeDevise(devise);
  if (!code || code === "TND") return null;
  if (douaneTaux > 0) return { valeur: douaneTaux, source: "douane" };
  const trouve = coursDuMois(t.cours, code, date);
  return trouve ? { valeur: coursParUnite(trouve, t.devises), source: "moyen" } : null;
}

/** Cours par rapport au dollar de repli (USD pour 1 unité de la devise) : 1 pour le dollar, sinon cours en dinars ÷ cours du dollar du mois. */
export function coursUsdDeRepli(devise: string, date: string | null | undefined, coursTnd: number, t: Tables): number | null {
  const code = codeDevise(devise);
  if (!code || code === "TND") return null;
  if (code === "USD") return 1;
  if (!(coursTnd > 0)) return null;
  const usd = coursDuMois(t.cours, "USD", date);
  if (!usd) return null;
  const tndParUsd = coursParUnite(usd, t.devises);
  return tndParUsd > 0 ? arrondi6(coursTnd / tndParUsd) : null;
}

interface AvecCours {
  achatDate: string | null;
  achatDevise: string;
  achatCours: number;
  achatCoursUsd?: number;
  achatLignes: StockLigne[];
  venteDate: string | null;
  venteDevise: string;
  venteCours: number;
  venteCoursUsd?: number;
  venteLignes: StockLigne[];
  douaneTauxChange: number;
}

const montantTnd = (montantDevise: number, cours: number) => Math.round((montantDevise || 0) * (cours || 0) * 1000) / 1000;

/** Complète le cours d'un côté (dinars puis dollar) selon l'ordre de choix ci-dessus. Un cours saisi à la main (non « automatique »)
 * n'est jamais remplacé ; un cours vide est toujours complété. Met `auto` à jour. */
export function completerCours<T extends AvecCours>(prev: T, cote: Cote, auto: CoursAuto, t: Tables): T {
  const date = cote === "achat" ? prev.achatDate : prev.venteDate;
  const devise = cote === "achat" ? prev.achatDevise : prev.venteDevise;
  const coursActuel = cote === "achat" ? prev.achatCours : prev.venteCours;
  let suite = prev;
  let coursTnd = coursActuel;
  if (!coursActuel || auto[cote]) {
    const repli = coursTndDeRepli(devise, date, prev.douaneTauxChange, t);
    if (repli && repli.valeur !== coursActuel) {
      coursTnd = repli.valeur;
      auto[cote] = true;
      const lignes = (cote === "achat" ? prev.achatLignes : prev.venteLignes).map((l) => ({ ...l, montantTnd: montantTnd(l.montantDevise, coursTnd) }));
      suite = cote === "achat" ? { ...suite, achatCours: coursTnd, achatLignes: lignes } : { ...suite, venteCours: coursTnd, venteLignes: lignes };
    }
  }
  const cleUsd = cote === "achat" ? "achatCoursUsd" : "venteCoursUsd";
  const autoUsd = cote === "achat" ? "achatUsd" : "venteUsd";
  const usdActuel = (suite[cleUsd] as number | undefined) ?? 0;
  if (!usdActuel || auto[autoUsd]) {
    const usd = coursUsdDeRepli(devise, date, coursTnd, t);
    if (usd !== null && usd !== usdActuel) {
      auto[autoUsd] = true;
      suite = { ...suite, [cleUsd]: usd };
    }
  }
  return suite;
}

/** Montant d'un côté dans la monnaie choisie : dinars (montants déjà calculés) ou dollars (montant en devise × cours du dollar). */
export function montantCote(lignes: StockLigne[], coursUsd: number | undefined, base: "TND" | "USD"): number {
  if (base === "TND") return arrondi3(lignes.reduce((s, l) => s + (l.montantTnd || 0), 0));
  return arrondi3(lignes.reduce((s, l) => s + (l.montantDevise || 0), 0) * (coursUsd || 0));
}
