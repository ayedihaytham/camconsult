import type { CollecteFull, SectionStatut } from "@/types";
import { TAB_BY_KEY } from "./tabs";

export const SECTION_STATUT_LABELS: Record<SectionStatut, string> = {
  brouillon: "À remplir",
  transmis: "Transmis au cabinet",
  a_corriger: "À corriger",
  valide: "Validé",
  archive: "Archivé",
};

/** Statut d'UN tableau : chaque tableau suit son propre circuit (remplir, transmettre, valider ou renvoyer, archiver). */
export function sectionStatut(collecte: Pick<CollecteFull, "sections" | "statut">, onglet: string): SectionStatut {
  const section = collecte.sections.find((x) => x.onglet === onglet);
  const s = section?.statut;
  // Un récap en attente est une demande faite au client : le tableau est rouvert, même s'il avait été transmis ou validé.
  if (s) return section?.recapStatut === "envoye" && (s === "valide" || s === "transmis") ? "a_corriger" : s;
  return collecte.statut === "transmis" || collecte.statut === "valide" || collecte.statut === "archive" ? collecte.statut : "brouillon";
}

/** Le client peut remplir ou corriger un tableau tant qu'il n'est pas transmis, validé ou archivé. */
export const sectionOuverte = (statut: SectionStatut) => statut === "brouillon" || statut === "a_corriger";

/** Comptes par statut sur les tableaux d'une collecte (pour les résumés). */
export function resumeSections(collecte: Pick<CollecteFull, "sections" | "statut" | "onglets">): Record<SectionStatut, number> {
  const r: Record<SectionStatut, number> = { brouillon: 0, transmis: 0, a_corriger: 0, valide: 0, archive: 0 };
  // Un tableau tenu par le cabinet seul n'est pas du travail du client : il ne compte pas dans l'avancement.
  for (const o of collecte.onglets) if (!TAB_BY_KEY[o]?.cabinetSeul) r[sectionStatut(collecte, o)] += 1;
  return r;
}
