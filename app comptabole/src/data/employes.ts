import type { Employe } from "@/types";
import { toTitleCase } from "@/lib/utils";

/** Nom complet d'un collaborateur : « Prénom Nom », normalisé en casse
 * capitalisée quelle que soit la façon dont il a été saisi. */
export function employeNomComplet(e: Employe) {
  return toTitleCase(`${e.prenom} ${e.nom}`);
}
