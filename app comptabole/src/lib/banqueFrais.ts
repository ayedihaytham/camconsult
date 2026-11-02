import { arrondi3 as r3 } from "../../shared/arrondi.js";
import { normaliser } from "@/lib/banque";
import type { MouvementBancaire } from "@/types";

/** Frais bancaires d'un compte : commissions, TVA, agios, frais de tenue de compte… (mouvements de type « frais »), par mois et par nature. */
type Ligne = Pick<MouvementBancaire, "type" | "debit" | "credit" | "dateOp" | "libelle">;

export interface FraisParMois {
  mois: string;
  total: number;
  nb: number;
}
export interface FraisParNature {
  libelle: string;
  total: number;
  nb: number;
}
export interface SyntheseFrais {
  /** Débits − crédits des lignes de frais (un remboursement de frais vient en déduction). */
  total: number;
  nb: number;
  /** Part des frais dans le total des débits de ces mouvements (null sans débit). */
  part: number | null;
  parMois: FraisParMois[];
  parNature: FraisParNature[];
}

/**
 * Libellé d'une nature de frais : les mots qui contiennent des chiffres (numéros de dossier, références « CEX2026375 », « N°IMLC-8356-005-25 ») sont retirés,
 * pour regrouper « COMMISSION DOMICILIATION 461 » et « … 464 ». Un libellé qui n'est fait que de chiffres reste tel quel.
 */
export function natureDeFrais(libelle: string): string {
  const mots = libelle.split(/\s+/).filter((m) => (m.match(/\d/g) ?? []).length < 2 && !/^[-–:/]+$/.test(m));
  return mots.join(" ").trim() || libelle.trim();
}

export const estFrais = (m: Pick<MouvementBancaire, "type">) => m.type === "frais";

export function syntheseFrais(mouvements: Ligne[]): SyntheseFrais {
  const frais = mouvements.filter(estFrais);
  const parMois = new Map<string, FraisParMois>();
  const parNature = new Map<string, FraisParNature>();
  for (const m of frais) {
    const net = m.debit - m.credit;
    const mois = m.dateOp.slice(0, 7);
    const pm = parMois.get(mois) ?? { mois, total: 0, nb: 0 };
    pm.total += net;
    pm.nb++;
    parMois.set(mois, pm);
    const nature = natureDeFrais(m.libelle);
    const cle = normaliser(nature);
    const pn = parNature.get(cle) ?? { libelle: nature, total: 0, nb: 0 };
    pn.total += net;
    pn.nb++;
    parNature.set(cle, pn);
  }
  const total = r3(frais.reduce((s, m) => s + m.debit - m.credit, 0));
  const debits = r3(mouvements.reduce((s, m) => s + m.debit, 0));
  return {
    total,
    nb: frais.length,
    part: debits > 0 ? total / debits : null,
    parMois: [...parMois.values()].map((x) => ({ ...x, total: r3(x.total) })).sort((a, b) => a.mois.localeCompare(b.mois)),
    parNature: [...parNature.values()].map((x) => ({ ...x, total: r3(x.total) })).sort((a, b) => b.total - a.total),
  };
}
