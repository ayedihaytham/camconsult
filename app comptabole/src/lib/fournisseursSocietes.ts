import type { Societe, SyntheseFournisseurs } from "@/types";

/**
 * Page de choix de la société du Suivi fournisseur : quelles sociétés ont des factures à régler, des paiements en banque à rapprocher ou des anomalies,
 * triées en premier, et ce qu'il reste à faire pour la société choisie. Tout vient de la synthèse du serveur ; rien n'est recalculé ici.
 */
export type EtatFournisseursSociete = "traiter" | "jour" | "sans";
export type FiltreFournisseurs = "toutes" | "traiter" | "jour" | "sans";

export const aDesFactures = (s: SyntheseFournisseurs | undefined): s is SyntheseFournisseurs => Boolean(s && s.factures > 0);

export function etatSociete(s: SyntheseFournisseurs | undefined): EtatFournisseursSociete {
  if (!s || (s.factures === 0 && s.paiementsARapprocher === 0)) return "sans";
  return s.impayees > 0 || s.paiementsARapprocher > 0 || s.doublons > 0 || s.reglementsAvantFacture > 0 ? "traiter" : "jour";
}

const RANG: Record<EtatFournisseursSociete, number> = { traiter: 0, jour: 1, sans: 2 };
const norme = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sociétés affichées : filtre des chiffres du haut, recherche (nom, thème, RNE, code), puis les sociétés à traiter d'abord, les sans-facture en dernier. */
export function listerSocietes(societes: Societe[], synthese: Record<string, SyntheseFournisseurs | undefined>, options: { recherche: string; filtre: FiltreFournisseurs }): Societe[] {
  const q = norme(options.recherche.trim());
  return societes
    .filter((s) => options.filtre === "toutes" || etatSociete(synthese[s.id]) === options.filtre)
    .filter((s) => !q || [s.raisonSociale, s.theme, s.rne, s.code].some((v) => norme(v || "").includes(q)))
    .sort((a, b) => RANG[etatSociete(synthese[a.id])] - RANG[etatSociete(synthese[b.id])] || a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true }));
}

/** Effectif de chaque filtre (les chiffres du haut). */
export function effectifs(societes: Societe[], synthese: Record<string, SyntheseFournisseurs | undefined>): Record<FiltreFournisseurs, number> {
  const n = { toutes: societes.length, traiter: 0, jour: 0, sans: 0 };
  for (const s of societes) n[etatSociete(synthese[s.id])]++;
  return n;
}

/** Ce qu'il y a à faire dans tout le cabinet : factures à régler, paiements à rapprocher et solde dû par devise des sociétés affichées. */
export function totauxCabinet(societes: Societe[], synthese: Record<string, SyntheseFournisseurs | undefined>): { impayees: number; paiements: number; soldes: { devise: string; montant: number }[] } {
  const par = new Map<string, number>();
  let impayees = 0;
  let paiements = 0;
  for (const s of societes) {
    const l = synthese[s.id];
    if (!l) continue;
    impayees += l.impayees;
    paiements += l.paiementsARapprocher;
    for (const d of l.soldes) par.set(d.devise, Math.round(((par.get(d.devise) ?? 0) + d.montant) * 1000) / 1000);
  }
  return { impayees, paiements, soldes: [...par.entries()].map(([devise, montant]) => ({ devise, montant })).sort((a, b) => b.montant - a.montant) };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Ce qu'il reste à faire pour une société, en clair (vide : rien à traiter). */
export function aFaire(s: SyntheseFournisseurs | undefined): string[] {
  if (!s) return [];
  const taches: string[] = [];
  if (s.impayees > 0) taches.push(`${pluriel(s.impayees, "facture")} à régler`);
  if (s.paiementsARapprocher > 0) taches.push(`${pluriel(s.paiementsARapprocher, "paiement")} en banque à rapprocher avec un règlement`);
  if (s.doublons > 0) taches.push(`${pluriel(s.doublons, "facture")} avec un n° en double : le règlement risque d'être compté deux fois`);
  if (s.reglementsAvantFacture > 0) taches.push(`${pluriel(s.reglementsAvantFacture, "règlement")} daté${s.reglementsAvantFacture > 1 ? "s" : ""} avant ${s.reglementsAvantFacture > 1 ? "leurs" : "sa"} facture`);
  return taches;
}
