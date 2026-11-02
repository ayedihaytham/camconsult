import type { Societe, SyntheseBanque } from "@/types";

/**
 * Page de choix de la société du Suivi bancaire : quelles sociétés ont du travail bancaire (paiements à rapprocher, mois en écart, soldes réels à saisir,
 * lignes à revoir), triées en premier, et ce qu'il reste à faire pour la société choisie. Tout vient de la synthèse du serveur ; rien n'est recalculé ici.
 */
export type EtatBanqueSociete = "traiter" | "jour" | "sans";
export type FiltreBanque = "toutes" | "traiter" | "jour" | "sans";

export const aUnCompte = (s: SyntheseBanque | undefined): s is SyntheseBanque => Boolean(s && s.comptes.length > 0);

export function etatSociete(s: SyntheseBanque | undefined): EtatBanqueSociete {
  if (!aUnCompte(s)) return "sans";
  return s.paiementsARapprocher > 0 || s.aRevoir > 0 || s.moisEnEcart > 0 || s.moisASaisir > 0 ? "traiter" : "jour";
}

const RANG: Record<EtatBanqueSociete, number> = { traiter: 0, jour: 1, sans: 2 };
const norme = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sociétés affichées : filtre des chiffres du haut, recherche (nom, thème, RNE, code), puis les sociétés à traiter d'abord, les sans-compte en dernier. */
export function listerSocietes(societes: Societe[], synthese: Record<string, SyntheseBanque | undefined>, options: { recherche: string; filtre: FiltreBanque }): Societe[] {
  const q = norme(options.recherche.trim());
  return societes
    .filter((s) => options.filtre === "toutes" || etatSociete(synthese[s.id]) === options.filtre)
    .filter((s) => !q || [s.raisonSociale, s.theme, s.rne, s.code].some((v) => norme(v || "").includes(q)))
    .sort((a, b) => RANG[etatSociete(synthese[a.id])] - RANG[etatSociete(synthese[b.id])] || a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true }));
}

/** Effectif de chaque filtre (les chiffres du haut). */
export function effectifs(societes: Societe[], synthese: Record<string, SyntheseBanque | undefined>): Record<FiltreBanque, number> {
  const n = { toutes: societes.length, traiter: 0, jour: 0, sans: 0 };
  for (const s of societes) n[etatSociete(synthese[s.id])]++;
  return n;
}

/** Ce qu'il y a à faire dans tout le cabinet : paiements à rapprocher et mois en écart des sociétés affichées. */
export function totauxCabinet(societes: Societe[], synthese: Record<string, SyntheseBanque | undefined>): { paiements: number; moisEnEcart: number } {
  return societes.reduce((t, s) => ({ paiements: t.paiements + (synthese[s.id]?.paiementsARapprocher ?? 0), moisEnEcart: t.moisEnEcart + (synthese[s.id]?.moisEnEcart ?? 0) }), { paiements: 0, moisEnEcart: 0 });
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 2026-06 » → « juin 2026 ». */
export const moisEnLettres = (mois: string) => `${MOIS[Number(mois.slice(5, 7)) - 1] ?? mois} ${mois.slice(0, 4)}`;
const montant = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[  ]/g, " ");
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Ce qu'il reste à faire pour une société, en clair (vide : rien à traiter). */
export function aFaire(s: SyntheseBanque | undefined): string[] {
  if (!aUnCompte(s)) return [];
  const taches: string[] = [];
  if (s.paiementsARapprocher > 0) taches.push(`${pluriel(s.paiementsARapprocher, "paiement")} à rapprocher avec le suivi fournisseur`);
  for (const e of s.ecarts.slice(-3)) taches.push(`Écart de ${montant(e.ecart)} ${e.devise} en ${moisEnLettres(e.mois)}`);
  if (s.moisEnEcart > Math.min(3, s.ecarts.length)) taches.push(`… et ${s.moisEnEcart - Math.min(3, s.ecarts.length)} autre${s.moisEnEcart - Math.min(3, s.ecarts.length) > 1 ? "s" : ""} mois en écart`);
  if (s.moisASaisir === 1) taches.push(`Solde réel de ${moisEnLettres(s.aSaisir[0].mois)} à saisir (${s.aSaisir[0].devise})`);
  else if (s.moisASaisir > 1) taches.push(`${s.moisASaisir} soldes réels à saisir (dernier : ${moisEnLettres(s.aSaisir[s.aSaisir.length - 1].mois)})`);
  if (s.aRevoir > 0) taches.push(`${pluriel(s.aRevoir, "ligne")} marquée${s.aRevoir > 1 ? "s" : ""} « à revoir »`);
  return taches;
}
