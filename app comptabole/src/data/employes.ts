import type { Employe } from "@/types";

/** Nom complet d'un collaborateur : « Prénom Nom ». */
export function employeNomComplet(e: Employe) {
  return `${e.prenom} ${e.nom}`;
}
