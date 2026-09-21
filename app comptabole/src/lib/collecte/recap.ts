import type { CollecteFull, RecapStatut } from "@/types";

/** Statut de récap d'UN tableau précis — le récap s'envoie tableau par
 * tableau, indépendamment des autres (voir CollecteEditorPage/RecapTab). */
export function sectionRecapStatut(collecte: CollecteFull, onglet: string): RecapStatut {
  return collecte.sections.find((s) => s.onglet === onglet)?.recapStatut ?? "none";
}

/**
 * Agrégat pour affichage global (pastille sur l'onglet Récap, bannière
 * client, bouton "Transmettre au cabinet") : "envoye" si au moins un
 * tableau est en attente de complétion, "repondu" si au moins un tableau a
 * été complété par le client et qu'aucun n'est plus en attente, sinon
 * "none". Jamais stocké — calculé à partir des sections, seule source de
 * vérité.
 */
export function aggregateRecapStatut(collecte: CollecteFull): RecapStatut {
  const relevant = collecte.sections.filter((s) => s.recapStatut !== "none");
  if (relevant.length === 0) return "none";
  if (relevant.some((s) => s.recapStatut === "envoye")) return "envoye";
  return "repondu";
}
