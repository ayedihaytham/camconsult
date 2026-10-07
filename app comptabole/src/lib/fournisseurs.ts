import type { FactureFournisseur, ModeReglement, ReglementFournisseur } from "@/types";

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export const MODE_LABELS: Record<ModeReglement, string> = {
  virement: "Virement",
  cheque: "Chèque",
  effet: "Effet",
  especes: "Espèces",
  autre: "Autre",
};

/** Taux de retenue à la source proposés (en %) ; le taux reste libre. */
export const TAUX_RS = [0, 0.5, 1, 1.5, 5, 10, 15, 25];

/** Retenue à la source d'un montant : montant × taux %. */
export const calculerRs = (brut: number, taux: number) => r3((brut * taux) / 100);

export type StatutFacture = "reglee" | "partielle" | "impayee";

export interface SoldeFacture {
  regle: number;
  solde: number;
  statut: StatutFacture;
}

/** Montant réglé, solde et statut de chaque facture (par id de mouvement). */
export function soldesFactures(
  factures: FactureFournisseur[],
  reglements: ReglementFournisseur[],
): Map<string, SoldeFacture> {
  const regle = new Map<string, number>();
  for (const r of reglements) for (const a of r.affectations) regle.set(a.mouvementId, (regle.get(a.mouvementId) ?? 0) + a.montant);
  return new Map(
    factures.map((f) => {
      const paye = r3(regle.get(f.id) ?? 0);
      const solde = r3(f.montant - paye);
      const statut: StatutFacture = solde <= 0.0015 ? "reglee" : paye > 0 ? "partielle" : "impayee";
      return [f.id, { regle: paye, solde: Math.max(0, solde), statut }];
    }),
  );
}

export interface TotauxDevise {
  devise: string;
  facture: number;
  regle: number;
  rs: number;
  solde: number;
}

export interface RecapFournisseur {
  cle: string;
  nom: string;
  nbFactures: number;
  nbImpayees: number;
  totaux: TotauxDevise[];
}

/** Un fournisseur par clé de regroupement (le serveur ignore casse, accents et ponctuation) ;
 * l'orthographe affichée est la plus fréquente. Les montants sont totalisés par devise. */
export function recapFournisseurs(factures: FactureFournisseur[], reglements: ReglementFournisseur[]): RecapFournisseur[] {
  const soldes = soldesFactures(factures, reglements);
  const groupes = new Map<string, FactureFournisseur[]>();
  for (const f of factures) groupes.set(f.fournisseurCle, [...(groupes.get(f.fournisseurCle) ?? []), f]);
  const recap: RecapFournisseur[] = [];
  for (const [cle, fs] of groupes) {
    const noms = new Map<string, number>();
    for (const f of fs) noms.set(f.fournisseur, (noms.get(f.fournisseur) ?? 0) + 1);
    const nom = [...noms.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Fournisseur non renseigné";
    const parDevise = new Map<string, TotauxDevise>();
    const ligne = (devise: string) => {
      const t = parDevise.get(devise) ?? { devise, facture: 0, regle: 0, rs: 0, solde: 0 };
      parDevise.set(devise, t);
      return t;
    };
    for (const f of fs) {
      const t = ligne(f.devise);
      t.facture = r3(t.facture + f.montant);
      t.regle = r3(t.regle + (soldes.get(f.id)?.regle ?? 0));
      t.solde = r3(t.solde + (soldes.get(f.id)?.solde ?? 0));
    }
    for (const r of reglements.filter((x) => x.fournisseurCle === cle)) ligne(r.devise).rs = r3(ligne(r.devise).rs + r.rsMontant);
    recap.push({
      cle,
      nom,
      nbFactures: fs.length,
      nbImpayees: fs.filter((f) => soldes.get(f.id)?.statut !== "reglee").length,
      totaux: [...parDevise.values()].sort((a, b) => a.devise.localeCompare(b.devise)),
    });
  }
  // Plus gros solde dû d'abord (toutes devises confondues : seul l'ordre compte).
  const dette = (r: RecapFournisseur) => r.totaux.reduce((s, t) => s + t.solde, 0);
  return recap.sort((a, b) => dette(b) - dette(a) || a.nom.localeCompare(b.nom, "fr", { numeric: true }));
}

export interface LigneEtat {
  facture: FactureFournisseur;
  /** null = part de la facture pas encore réglée. */
  reglement: ReglementFournisseur | null;
  /** Montant de la facture couvert par ce règlement, ou son solde restant si reglement est null. */
  montant: number;
  /** Premier rang du règlement : ses cellules fusionnées s'étendent sur `rang` lignes. */
  debutGroupe: boolean;
  rang: number;
}

/** Lignes de l'état d'un fournisseur : chaque règlement suivi des factures qu'il couvre (cellules
 * de règlement fusionnées sur ces lignes), puis les parts de factures encore à régler. */
export function lignesEtat(
  cle: string,
  factures: FactureFournisseur[],
  reglements: ReglementFournisseur[],
): LigneEtat[] {
  const fs = new Map(factures.filter((f) => f.fournisseurCle === cle).map((f) => [f.id, f]));
  const lignes: LigneEtat[] = [];
  for (const r of reglements.filter((x) => x.fournisseurCle === cle)) {
    const affs = r.affectations.filter((a) => fs.has(a.mouvementId));
    affs.sort((a, b) => (fs.get(a.mouvementId)!.date ?? "").localeCompare(fs.get(b.mouvementId)!.date ?? ""));
    affs.forEach((a, i) =>
      lignes.push({ facture: fs.get(a.mouvementId)!, reglement: r, montant: a.montant, debutGroupe: i === 0, rang: affs.length }),
    );
  }
  const soldes = soldesFactures([...fs.values()], reglements);
  for (const f of fs.values()) {
    const solde = soldes.get(f.id)?.solde ?? 0;
    if (solde > 0.0015) lignes.push({ facture: f, reglement: null, montant: solde, debutGroupe: true, rang: 1 });
  }
  return lignes;
}

/** Anomalie à signaler sur un règlement : payé avant la date de facture, ou virement incohérent. */
export function anomalieReglement(r: ReglementFournisseur, factures: FactureFournisseur[]): string | null {
  const dates = r.affectations
    .map((a) => factures.find((f) => f.id === a.mouvementId)?.date)
    .filter((d): d is string => Boolean(d));
  if (r.date && dates.some((d) => d > r.date!)) return "Règlement daté avant une de ses factures";
  return null;
}
