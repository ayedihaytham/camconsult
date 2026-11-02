import { arrondi3 as r3 } from "../../shared/arrondi.js";
import type { CompteBancaire, MouvementBancaire } from "@/types";

/**
 * Les deux jambes d'un même change : une ligne qui sort d'un compte (ex. 300 000 EUR vendus) et une ligne qui entre sur l'autre (le même jour, en dinars).
 * On cherche les paires que rien ne relie encore ; le cours réel (dinars ÷ devise) en découle et reste une information.
 */
export interface PropositionChange {
  a: MouvementBancaire;
  b: MouvementBancaire;
  /** Dinars ÷ devise, d'après les deux montants. */
  coursReel: number;
  /** Écart en jours entre les deux dates d'opération. */
  ecartJours: number;
  /** Sûre : le cours lu dans un libellé est confirmé par les montants, ou la paire est la seule possible pour chacune des deux lignes. */
  sure: boolean;
}

const JOURS_MAX = 3;
const COURS_MIN = 0.05;
const COURS_MAX = 100;
const montant = (m: Pick<MouvementBancaire, "debit" | "credit">) => (m.debit > 0 ? m.debit : m.credit);
const jours = (a: string, b: string) => Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000));

export function propositionsChange(mouvements: MouvementBancaire[], comptes: CompteBancaire[]): PropositionChange[] {
  const devises = new Map(comptes.map((c) => [c.id, c.devise]));
  const libres = mouvements.filter((m) => m.type === "change" && !m.changeLie && devises.has(m.compteId) && montant(m) > 0);
  const candidates: PropositionChange[] = [];
  for (const a of libres) {
    for (const b of libres) {
      if (a.id >= b.id || a.compteId === b.compteId || devises.get(a.compteId) === devises.get(b.compteId)) continue;
      const sorties = a.debit > 0 && b.credit > 0;
      const entrees = a.credit > 0 && b.debit > 0;
      if (!sorties && !entrees) continue;
      const ecartJours = jours(a.dateOp, b.dateOp);
      if (ecartJours > JOURS_MAX) continue;
      const [tnd, dev] = devises.get(a.compteId) === "TND" ? [a, b] : devises.get(b.compteId) === "TND" ? [b, a] : [null, null];
      if (!tnd || !dev) continue;
      const coursReel = Math.round((montant(tnd) / montant(dev)) * 10000) / 10000;
      if (coursReel < COURS_MIN || coursReel > COURS_MAX) continue;
      candidates.push({ a, b, coursReel, ecartJours, sure: false });
    }
  }
  const nbPar = new Map<string, number>();
  for (const c of candidates) for (const id of [c.a.id, c.b.id]) nbPar.set(id, (nbPar.get(id) ?? 0) + 1);
  const confirme = (c: PropositionChange) => {
    const lus = [c.a.cours, c.b.cours].filter((x): x is number => Boolean(x));
    return lus.length > 0 && lus.every((x) => Math.abs(x - c.coursReel) / x < 0.005);
  };
  const resultat = candidates.map((c) => ({ ...c, sure: confirme(c) || (nbPar.get(c.a.id) === 1 && nbPar.get(c.b.id) === 1 && c.ecartJours <= 1) }));
  // Chaque ligne n'apparaît que dans une paire : la meilleure (cours confirmé, puis même jour).
  const classes = resultat.sort((x, y) => Number(y.sure) - Number(x.sure) || x.ecartJours - y.ecartJours || x.a.dateOp.localeCompare(y.a.dateOp));
  const prises = new Set<string>();
  return classes.filter((c) => {
    if (prises.has(c.a.id) || prises.has(c.b.id)) return false;
    prises.add(c.a.id);
    prises.add(c.b.id);
    return true;
  });
}

/** Ce que les deux jambes disent ensemble : « 300 000,000 EUR → 1 011 300,000 TND au cours de 3,3710 ». */
export function resumeChange(m: MouvementBancaire, devises: Map<string, string>): { sortie: string; entree: string; cours: number | null } | null {
  if (!m.changeLie) return null;
  const moi = { devise: devises.get(m.compteId) ?? "", montant: montant(m), sort: m.debit > 0 };
  const lui = { devise: m.changeLie.devise, montant: m.changeLie.montant };
  const fr = (n: number, d: string) => `${r3(n).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${d}`;
  return moi.sort ? { sortie: fr(moi.montant, moi.devise), entree: fr(lui.montant, lui.devise), cours: m.changeLie.coursReel } : { sortie: fr(lui.montant, lui.devise), entree: fr(moi.montant, moi.devise), cours: m.changeLie.coursReel };
}
