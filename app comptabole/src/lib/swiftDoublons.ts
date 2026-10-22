import type { SwiftVirement } from "@/types";

const cle = (v: Pick<SwiftVirement, "date" | "montant" | "libelle">) =>
  `${v.date ?? ""}|${Math.round(v.montant * 1000)}|${v.libelle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ")}`;

/** Virements du module qui font double emploi : même date, même montant et même libellé qu'un autre. Dans chaque groupe on garde le plus avancé
 * (le plus de factures, puis déjà envoyé à la société, puis le premier de la liste) ; les autres sont des doublons. */
export function doublonsSwift(virements: SwiftVirement[]): { garde: SwiftVirement; doublons: SwiftVirement[] }[] {
  const groupes = new Map<string, SwiftVirement[]>();
  for (const v of virements) groupes.set(cle(v), [...(groupes.get(cle(v)) ?? []), v]);
  const avancement = (v: SwiftVirement) => v.factures.length * 2 + (v.envoye ? 1 : 0);
  return [...groupes.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const tries = [...g].sort((a, b) => avancement(b) - avancement(a));
      return { garde: tries[0], doublons: tries.slice(1) };
    });
}

/** Doublons qu'on peut supprimer sans rien perdre : pas envoyés à la société et sans facture. */
export const doublonsSupprimables = (virements: SwiftVirement[]): SwiftVirement[] =>
  doublonsSwift(virements).flatMap((g) => g.doublons).filter((v) => !v.envoye && v.factures.length === 0);

/** Vrai si un virement du module a déjà cette date et ce montant (ligne d'import déjà présente). */
export const virementDejaPresent = (ligne: { date?: unknown; montant?: unknown }, virements: { date: string | null; montant: number }[]): boolean =>
  virements.some((v) => v.date === String(ligne.date ?? "") && Math.abs(v.montant - (Number(ligne.montant) || 0)) < 0.0005);
