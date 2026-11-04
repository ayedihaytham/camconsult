import { arrondi3 as r3 } from "../../shared/arrondi.js";
import type { MouvementBancaire } from "@/types";

/**
 * Encaissement en devise converti en dinars : un encaissement (crédit d'un compte en devise) est vendu par un ou plusieurs changes (sorties du même compte).
 * On propose les changes possibles avec ce qui leur reste, une répartition dans l'ordre des dates, et le cours moyen obtenu. Le cours réel est une
 * information : rien n'est recalculé avec.
 */
export interface ChangePossible {
  mouvement: MouvementBancaire;
  /** Ce qui reste de la sortie de change pour cet encaissement (sa part déjà donnée à cet encaissement comprise, celle des autres exclue). */
  reste: number;
}

const TOLERANCE = 0.0005;

/** Les sorties de change du même compte, à la date de l'encaissement ou après, qui ont encore de quoi convertir, les plus proches d'abord. */
export function changesPossibles(encaissement: MouvementBancaire, mouvements: MouvementBancaire[]): ChangePossible[] {
  const dejaIci = new Map((encaissement.conversions ?? []).map((c) => [c.changeId, c.montant]));
  return mouvements
    .filter((m) => m.compteId === encaissement.compteId && m.type === "change" && m.debit > 0 && m.dateOp >= encaissement.dateOp)
    .map((m) => ({ mouvement: m, reste: r3(m.debit - (m.changeUtilise ?? 0) + (dejaIci.get(m.id) ?? 0)) }))
    .filter((c) => c.reste > TOLERANCE)
    .sort((a, b) => a.mouvement.dateOp.localeCompare(b.mouvement.dateOp));
}

/** Répartit l'encaissement sur les changes dans l'ordre des dates ; renvoie les parts et ce qui reste non converti. */
export function repartitionConversion(encaissement: MouvementBancaire, possibles: ChangePossible[]): { parts: { changeId: string; montant: number }[]; nonConverti: number } {
  let restant = encaissement.credit;
  const parts: { changeId: string; montant: number }[] = [];
  for (const c of possibles) {
    if (restant <= TOLERANCE) break;
    const montant = r3(Math.min(restant, c.reste));
    if (montant <= TOLERANCE) continue;
    parts.push({ changeId: c.mouvement.id, montant });
    restant = r3(restant - montant);
  }
  return { parts, nonConverti: Math.max(0, restant) };
}

/** Cours moyen pondéré des parts converties (dinars ÷ devise), et si certains changes n'ont pas de cours réel connu (autre jambe non reliée). */
export function coursMoyenConversions(conversions: NonNullable<MouvementBancaire["conversions"]>): { cours: number | null; converti: number; partiel: boolean } {
  const converti = r3(conversions.reduce((t, c) => t + c.montant, 0));
  const avecCours = conversions.filter((c) => c.coursReel != null);
  const base = avecCours.reduce((t, c) => t + c.montant, 0);
  if (base <= 0) return { cours: null, converti, partiel: conversions.length > 0 };
  const cours = avecCours.reduce((t, c) => t + c.montant * (c.coursReel as number), 0) / base;
  return { cours: Math.round(cours * 10000) / 10000, converti, partiel: avecCours.length < conversions.length };
}
