/**
 * Taxonomie des postes du Bilan/Etat de résultat/SIG — étape 2 du module
 * États financiers. Le backend ne renvoie que des sommes par poste
 * (`GET /balances/postes`) ; toute la mise en page (sections, sous-totaux,
 * signe d'affichage) est ici, côté frontend, pour rester facile à ajuster
 * sans toucher au calcul serveur.
 *
 * Convention de signe : solde = débit − crédit (comme partout ailleurs dans
 * le module). Les postes d'actif/charge sont débiteurs par nature (solde
 * positif) → affichés tels quels. Les postes de passif/capitaux
 * propres/produit sont créditeurs par nature (solde négatif) → affichés
 * inversés (signe -1) pour apparaître en positif dans le Bilan/CPC, comme
 * dans un document comptable normal.
 */

export type Postes = Record<string, number>;

export interface Row {
  id: string;
  label: string;
  /** Ligne "feuille" : somme directe de ces clés de poste. */
  posteKeys?: string[];
  /** Ligne de sous-total/total : somme des valeurs déjà calculées de ces ids. */
  sumOf?: string[];
  /** 1 = affiché tel quel (actif/charge), -1 = inversé (passif/produit). */
  sign?: 1 | -1;
  bold?: boolean;
  section?: boolean;
  indent?: boolean;
}

function val(id: string, values: Record<string, number>) {
  return values[id] ?? 0;
}

/** Calcule la valeur de chaque ligne pour un jeu de postes (un exercice). */
export function computeRows(
  rows: Row[],
  postes: Postes,
  extra: Record<string, number> = {},
): Record<string, number> {
  const values: Record<string, number> = { ...extra };
  for (const r of rows) {
    if (r.section) continue;
    if (r.posteKeys) {
      const sum = r.posteKeys.reduce((s, k) => s + (postes[k] ?? 0), 0);
      values[r.id] = (r.sign ?? 1) * sum;
    } else if (r.sumOf) {
      values[r.id] = r.sumOf.reduce((s, id) => s + val(id, values), 0);
    }
  }
  return values;
}

/** Contribution d'un poste CPC au résultat, en signe "naturel" (produit
 * positif, charge négative) — voir le raisonnement du module : pour tout
 * poste cpc.*, contribution = -solde, quelle que soit sa nature. */
export function contrib(postes: Postes, ...keys: string[]) {
  return -keys.reduce((s, k) => s + (postes[k] ?? 0), 0);
}

/** Résultat net = -(somme de tous les postes cpc.*) — identité comptable
 * fondamentale (Actif = Capitaux propres + Passifs, et le résultat boucle
 * l'équation), la même que pour la synthèse AFFECTAT de l'étape 1. */
export function resultatNet(postes: Postes) {
  let s = 0;
  for (const [k, v] of Object.entries(postes)) {
    if (k.startsWith("cpc.")) s += v;
  }
  return -s;
}

/** Résultat comptable AVANT IMPÔT — même identité que resultatNet(), mais
 * en excluant la charge d'impôt sur les sociétés/CSS (poste
 * cpc.impot_societes) : c'est le point de départ du TDRF (Tableau de
 * détermination du résultat fiscal), qui réintègre les charges non
 * déductibles à partir du résultat AVANT impôt, pas du résultat net après
 * impôt. Vérifié contre le document réel du cabinet (Annexe n°2, note
 * commune n°26/2016). */
export function resultatComptableAvantImpot(postes: Postes) {
  return resultatNet(postes) + (postes["cpc.impot_societes"] ?? 0);
}

// ── Bilan Actif ─────────────────────────────────────
export const ROWS_BILAN_ACTIF: Row[] = [
  { id: "s1", label: "Actifs immobilisés", section: true },
  { id: "immo_incorp_brut", label: "Immobilisations incorporelles", posteKeys: ["actif.immo_incorp_brut"] },
  { id: "immo_incorp_amort", label: "Amortissements", posteKeys: ["actif.immo_incorp_amort"], indent: true },
  { id: "immo_incorp_net", label: "Immobilisations incorporelles (net)", sumOf: ["immo_incorp_brut", "immo_incorp_amort"], bold: true },
  { id: "immo_corp_brut", label: "Immobilisations corporelles", posteKeys: ["actif.immo_corp_brut"] },
  { id: "immo_corp_amort", label: "Amortissements", posteKeys: ["actif.immo_corp_amort"], indent: true },
  { id: "immo_corp_net", label: "Immobilisations corporelles (net)", sumOf: ["immo_corp_brut", "immo_corp_amort"], bold: true },
  { id: "immo_fin_brut", label: "Immobilisations financières", posteKeys: ["actif.immo_fin"] },
  { id: "immo_fin_prov", label: "Provisions", posteKeys: ["actif.immo_fin_provisions"], indent: true },
  { id: "immo_fin_net", label: "Immobilisations financières (net)", sumOf: ["immo_fin_brut", "immo_fin_prov"], bold: true },
  { id: "autres_non_courants", label: "Autres actifs non courants", posteKeys: ["actif.autres_non_courants"] },
  { id: "total_non_courants", label: "Total des actifs non courants", sumOf: ["immo_incorp_net", "immo_corp_net", "immo_fin_net", "autres_non_courants"], bold: true },

  { id: "s2", label: "Actifs courants", section: true },
  { id: "stocks_brut", label: "Stocks", posteKeys: ["actif.stocks"] },
  { id: "stocks_prov", label: "Provisions", posteKeys: ["actif.stocks_provisions"], indent: true },
  { id: "stocks_net", label: "Stocks (net)", sumOf: ["stocks_brut", "stocks_prov"], bold: true },
  { id: "clients_brut", label: "Clients et comptes rattachés", posteKeys: ["actif.clients"] },
  { id: "clients_prov", label: "Provisions", posteKeys: ["actif.clients_provisions"], indent: true },
  { id: "clients_net", label: "Clients (net)", sumOf: ["clients_brut", "clients_prov"], bold: true },
  { id: "autres_courants_brut", label: "Autres actifs courants", posteKeys: ["actif.autres_courants"] },
  { id: "autres_courants_prov", label: "Provisions", posteKeys: ["actif.autres_courants_provisions"], indent: true },
  { id: "autres_courants_net", label: "Autres actifs courants (net)", sumOf: ["autres_courants_brut", "autres_courants_prov"], bold: true },
  { id: "placements", label: "Placements et autres actifs financiers", posteKeys: ["actif.placements"] },
  { id: "liquidites", label: "Liquidités et équivalents de liquidités", posteKeys: ["actif.liquidites"] },
  { id: "total_courants", label: "Total des actifs courants", sumOf: ["stocks_net", "clients_net", "autres_courants_net", "placements", "liquidites"], bold: true },

  { id: "total_actifs", label: "TOTAL DES ACTIFS", sumOf: ["total_non_courants", "total_courants"], bold: true },
];

// ── Bilan Passif ────────────────────────────────────
export const ROWS_BILAN_PASSIF: Row[] = [
  { id: "s1", label: "Capitaux propres", section: true },
  { id: "capital_social", label: "Capital social", posteKeys: ["passif.capital_social"], sign: -1 },
  { id: "reserve_legale", label: "Réserve légale", posteKeys: ["passif.reserve_legale"], sign: -1 },
  { id: "reserve_facultative", label: "Réserve facultative", posteKeys: ["passif.reserve_facultative"], sign: -1 },
  { id: "resultat_reporte", label: "Résultat reporté", posteKeys: ["passif.resultat_reporte"], sign: -1 },
  { id: "modifs_comptables", label: "Modifications comptables", posteKeys: ["passif.modifications_comptables"], sign: -1 },
  { id: "total_cp_avant_resultat", label: "Total capitaux propres avant résultat de l'exercice", sumOf: ["capital_social", "reserve_legale", "reserve_facultative", "resultat_reporte", "modifs_comptables"], bold: true },
  { id: "resultat_exercice", label: "Résultat net de l'exercice" }, // injecté (voir extra)
  { id: "total_cp", label: "Total des capitaux propres", sumOf: ["total_cp_avant_resultat", "resultat_exercice"], bold: true },

  { id: "s2", label: "Passifs non courants", section: true },
  { id: "emprunts", label: "Emprunts", posteKeys: ["passif.emprunts"], sign: -1 },
  { id: "autres_passifs_fin", label: "Autres passifs financiers", posteKeys: ["passif.autres_passifs_financiers"], sign: -1 },
  { id: "provisions_nc", label: "Provisions", posteKeys: ["passif.provisions"], sign: -1 },
  { id: "total_passifs_nc", label: "Total des passifs non courants", sumOf: ["emprunts", "autres_passifs_fin", "provisions_nc"], bold: true },

  { id: "s3", label: "Passifs courants", section: true },
  { id: "fournisseurs", label: "Fournisseurs et comptes rattachés", posteKeys: ["passif.fournisseurs"], sign: -1 },
  { id: "autres_passifs_courants", label: "Autres passifs courants", posteKeys: ["passif.autres_passifs_courants"], sign: -1 },
  { id: "concours_bancaires", label: "Concours bancaires et autres passifs financiers", posteKeys: ["passif.concours_bancaires"], sign: -1 },
  { id: "total_passifs_c", label: "Total des passifs courants", sumOf: ["fournisseurs", "autres_passifs_courants", "concours_bancaires"], bold: true },

  { id: "total_passifs", label: "Total des passifs", sumOf: ["total_passifs_nc", "total_passifs_c"], bold: true },
  { id: "total_cp_et_passifs", label: "TOTAL DES CAPITAUX PROPRES ET DES PASSIFS", sumOf: ["total_cp", "total_passifs"], bold: true },
];

// ── Etat de résultat (liste classique) ──────────────
// Toutes les lignes CPC utilisent sign:-1 : pour un poste produit (solde
// négatif car créditeur), -solde donne un montant positif ; pour un poste
// charge (solde positif car débiteur), -solde donne un montant négatif —
// donc l'addition des sumOf fonctionne directement (pas de +/- à gérer ligne
// par ligne), même identité que `contrib()`/`resultatNet()` plus haut.
export const ROWS_ETAT_RESULTAT: Row[] = [
  { id: "s1", label: "Produits d'exploitation", section: true },
  { id: "ventes", label: "Ventes de marchandises", posteKeys: ["cpc.ventes_marchandises"], sign: -1 },
  { id: "autres_prod_expl", label: "Autres produits d'exploitation", posteKeys: ["cpc.autres_produits_exploitation"], sign: -1 },
  { id: "prod_stockee", label: "Production stockée", posteKeys: ["cpc.production_stockee"], sign: -1 },
  { id: "prod_immobilisee", label: "Production immobilisée", posteKeys: ["cpc.production_immobilisee"], sign: -1 },
  { id: "total_produits_expl", label: "Total des produits d'exploitation", sumOf: ["ventes", "autres_prod_expl", "prod_stockee", "prod_immobilisee"], bold: true },

  { id: "s2", label: "Charges d'exploitation", section: true },
  { id: "achats", label: "Achats consommés", posteKeys: ["cpc.achats_consommes"], sign: -1 },
  // Version détaillée (norme tunisienne NC 01, forme développée) de la ligne
  // "achats" ci-dessus : gardée en plus, jamais à la place — un code AFFECTAT
  // n'est jamais rattaché aux deux à la fois, donc pas de double-comptage ;
  // la ligne condensée reste disponible pour un cabinet qui ne détaille pas.
  { id: "achats_marchandises", label: "Achats de marchandises consommés", posteKeys: ["cpc.achats_marchandises"], sign: -1 },
  { id: "achats_approvisionnements", label: "Achats d'approvisionnements consommés", posteKeys: ["cpc.achats_approvisionnements"], sign: -1 },
  { id: "charges_ext", label: "Charges externes", posteKeys: ["cpc.charges_externes"], sign: -1 },
  { id: "impots_taxes_er", label: "Impôts et taxes", posteKeys: ["cpc.impots_taxes"], sign: -1 },
  { id: "charges_personnel_er", label: "Charges de personnel", posteKeys: ["cpc.charges_personnel"], sign: -1 },
  { id: "dotations_er", label: "Dotations aux amortissements et provisions", posteKeys: ["cpc.dotations_amort_provisions"], sign: -1 },
  // Version détaillée de "dotations_er" — même principe que les achats ci-dessus.
  { id: "dotations_amortissements_er", label: "Dotations aux amortissements et aux résorptions", posteKeys: ["cpc.dotations_amortissements"], sign: -1 },
  { id: "dotations_provisions_er", label: "Dotations aux provisions", posteKeys: ["cpc.dotations_provisions"], sign: -1 },
  { id: "autres_charges_expl_er", label: "Autres charges d'exploitation", posteKeys: ["cpc.autres_charges_exploitation"], sign: -1 },
  { id: "total_charges_expl", label: "Total des charges d'exploitation", sumOf: ["achats", "achats_marchandises", "achats_approvisionnements", "charges_ext", "impots_taxes_er", "charges_personnel_er", "dotations_er", "dotations_amortissements_er", "dotations_provisions_er", "autres_charges_expl_er"], bold: true },

  { id: "resultat_exploitation", label: "RÉSULTAT D'EXPLOITATION", sumOf: ["total_produits_expl", "total_charges_expl"], bold: true },

  { id: "s3", label: "Éléments financiers et autres éléments ordinaires", section: true },
  { id: "charges_fin_er", label: "Charges financières nettes", posteKeys: ["cpc.charges_financieres"], sign: -1 },
  { id: "produits_fin_er", label: "Produits financiers", posteKeys: ["cpc.produits_financiers"], sign: -1 },
  { id: "autres_prod_ord_er", label: "Autres produits ordinaires", posteKeys: ["cpc.autres_produits_ordinaires"], sign: -1 },
  { id: "autres_charges_ord_er", label: "Autres charges ordinaires", posteKeys: ["cpc.autres_charges_ordinaires"], sign: -1 },
  { id: "transferts_er", label: "Transferts de charges", posteKeys: ["cpc.transferts_charges"], sign: -1 },
  { id: "reprises_er", label: "Reprises sur provisions antérieures", posteKeys: ["cpc.reprises_provisions"], sign: -1 },
  { id: "resultat_avant_impot", label: "Résultat des activités ordinaires avant impôt", sumOf: ["resultat_exploitation", "charges_fin_er", "produits_fin_er", "autres_prod_ord_er", "autres_charges_ord_er", "transferts_er", "reprises_er"], bold: true },

  { id: "impot_societes_er", label: "Impôt sur les sociétés", posteKeys: ["cpc.impot_societes"], sign: -1 },
  { id: "resultat_ordinaire", label: "Résultat des activités ordinaires", sumOf: ["resultat_avant_impot", "impot_societes_er"], bold: true },

  { id: "gains_extra_er", label: "Gains extraordinaires", posteKeys: ["cpc.gains_extraordinaires"], sign: -1 },
  { id: "pertes_extra_er", label: "Pertes extraordinaires", posteKeys: ["cpc.pertes_extraordinaires"], sign: -1 },
  { id: "effet_modifs_er", label: "Effet des modifications comptables", posteKeys: ["cpc.effet_modifications_comptables"], sign: -1 },
  { id: "resultat_net_er", label: "RÉSULTAT NET DE L'EXERCICE", sumOf: ["resultat_ordinaire", "gains_extra_er", "pertes_extra_er", "effet_modifs_er"], bold: true },
];

export const CPC_LIGNES = {
  ventes: { keys: ["cpc.ventes_marchandises"], label: "Ventes de marchandises", nature: "produit" },
  autresProduitsExploitation: { keys: ["cpc.autres_produits_exploitation"], label: "Autres produits d'exploitation", nature: "produit" },
  productionStockee: { keys: ["cpc.production_stockee"], label: "Production stockée", nature: "produit" },
  productionImmobilisee: { keys: ["cpc.production_immobilisee"], label: "Production immobilisée", nature: "produit" },
  achatsConsommes: { keys: ["cpc.achats_consommes"], label: "Coût d'achat des marchandises vendues", nature: "charge" },
  achatsMarchandises: { keys: ["cpc.achats_marchandises"], label: "Achats de marchandises consommés", nature: "charge" },
  achatsApprovisionnements: { keys: ["cpc.achats_approvisionnements"], label: "Achats d'approvisionnements consommés", nature: "charge" },
  chargesExternes: { keys: ["cpc.charges_externes"], label: "Autres charges externes", nature: "charge" },
  autresChargesExploitation: { keys: ["cpc.autres_charges_exploitation"], label: "Autres charges d'exploitation", nature: "charge" },
  impotsTaxes: { keys: ["cpc.impots_taxes"], label: "Impôts et taxes", nature: "charge" },
  chargesPersonnel: { keys: ["cpc.charges_personnel"], label: "Charges de personnel", nature: "charge" },
  dotationsAmort: { keys: ["cpc.dotations_amort_provisions"], label: "Dotations aux amortissements et provisions", nature: "charge" },
  dotationsAmortissements: { keys: ["cpc.dotations_amortissements"], label: "Dotations aux amortissements et aux résorptions", nature: "charge" },
  dotationsProvisions: { keys: ["cpc.dotations_provisions"], label: "Dotations aux provisions", nature: "charge" },
  chargesFinancieres: { keys: ["cpc.charges_financieres"], label: "Charges financières nettes", nature: "charge" },
  produitsFinanciers: { keys: ["cpc.produits_financiers"], label: "Produits financiers", nature: "produit" },
  autresProduitsOrdinaires: { keys: ["cpc.autres_produits_ordinaires"], label: "Autres produits ordinaires", nature: "produit" },
  autresChargesOrdinaires: { keys: ["cpc.autres_charges_ordinaires"], label: "Autres charges ordinaires", nature: "charge" },
  transfertsCharges: { keys: ["cpc.transferts_charges"], label: "Transferts de charges", nature: "produit" },
  reprisesProvisions: { keys: ["cpc.reprises_provisions"], label: "Reprises sur provisions antérieures", nature: "produit" },
  impotSocietes: { keys: ["cpc.impot_societes"], label: "Impôt sur les sociétés", nature: "charge" },
  gainsExtraordinaires: { keys: ["cpc.gains_extraordinaires"], label: "Gains extraordinaires", nature: "produit" },
  pertesExtraordinaires: { keys: ["cpc.pertes_extraordinaires"], label: "Pertes extraordinaires", nature: "charge" },
  effetModifs: { keys: ["cpc.effet_modifications_comptables"], label: "Effet des modifications comptables", nature: "produit" },
} as const;

/** Deux tableaux (Produits / Charges) pour l'affichage SIG — même montant
 * que dans l'Etat de résultat, mais présenté en 2 colonnes comme sur votre
 * capture plutôt qu'en liste unique. Produits en sign:-1 (solde créditeur
 * négatif → montant positif) ; Charges en sign:1 (solde débiteur déjà
 * positif, affiché tel quel). */
export const ROWS_SIG_PRODUITS: Row[] = Object.values(CPC_LIGNES)
  .filter((l) => l.nature === "produit")
  .map((l) => ({ id: l.keys[0], label: l.label, posteKeys: [...l.keys], sign: -1 as const }));

export const ROWS_SIG_CHARGES: Row[] = Object.values(CPC_LIGNES)
  .filter((l) => l.nature === "charge")
  .map((l) => ({ id: l.keys[0], label: l.label, posteKeys: [...l.keys], sign: 1 as const }));

export const POSTE_LABELS: Record<string, string> = {
  "": "(non affecté)",
  ...Object.fromEntries(
    Object.values(CPC_LIGNES).map((l) => [l.keys[0], l.label]),
  ),
};

export interface SigResult {
  margeCommerciale: number;
  valeurAjoutee: number;
  ebe: number;
  resultatOrdinaire: number;
  resultatNet: number;
}

export interface SigLigne {
  label: string;
  /** Postes cpc.* sommés pour cette ligne — plusieurs quand la présentation
   * officielle du cabinet combine la version condensée et la version
   * détaillée d'une même ligne (ex. achats consommés / achats de
   * marchandises consommés → une seule ligne « Coût d'achat des
   * marchandises vendues »), jamais les deux renseignées à la fois pour un
   * même code donc pas de double-comptage. */
  keys: string[];
}

export interface SigBloc {
  soldeId: keyof SigResult;
  soldeLabel: string;
  produits: SigLigne[];
  charges: SigLigne[];
}

/** Regroupement des lignes CPC par solde intermédiaire, dans l'ordre où
 * chaque solde se ferme — reproduit le Tableau de Solde Intermédiaire de
 * Gestion officiel du cabinet (3 colonnes Produits/Charges/Soldes, le solde
 * apparaissant au niveau du groupe qui le calcule), voir SigTable.tsx. */
export const SIG_BLOCS: SigBloc[] = [
  {
    soldeId: "margeCommerciale",
    soldeLabel: "Marge commerciale",
    produits: [{ label: "Ventes de marchandises", keys: ["cpc.ventes_marchandises"] }],
    charges: [
      {
        label: "Coût d'achat des marchandises vendues",
        keys: ["cpc.achats_consommes", "cpc.achats_marchandises"],
      },
    ],
  },
  {
    soldeId: "valeurAjoutee",
    soldeLabel: "Valeur ajoutée",
    produits: [
      { label: "Autres produits d'exploitation", keys: ["cpc.autres_produits_exploitation"] },
      { label: "Production stockée", keys: ["cpc.production_stockee"] },
      { label: "Production immobilisée", keys: ["cpc.production_immobilisee"] },
    ],
    charges: [
      { label: "Achats d'approvisionnements consommés", keys: ["cpc.achats_approvisionnements"] },
      { label: "Autres charges externes", keys: ["cpc.charges_externes"] },
    ],
  },
  {
    soldeId: "ebe",
    soldeLabel: "Excédent (ou insuffisance) brut d'exploitation",
    produits: [],
    charges: [
      { label: "Impôts et taxes", keys: ["cpc.impots_taxes"] },
      { label: "Charges de personnel", keys: ["cpc.charges_personnel"] },
    ],
  },
  {
    soldeId: "resultatOrdinaire",
    soldeLabel: "Résultat des activités ordinaires",
    produits: [
      { label: "Autres produits ordinaires", keys: ["cpc.autres_produits_ordinaires"] },
      { label: "Produits financiers", keys: ["cpc.produits_financiers"] },
      { label: "Transferts de charges", keys: ["cpc.transferts_charges"] },
      { label: "Reprises sur provisions antérieures", keys: ["cpc.reprises_provisions"] },
    ],
    charges: [
      { label: "Autres charges ordinaires", keys: ["cpc.autres_charges_ordinaires"] },
      { label: "Charges financières nettes", keys: ["cpc.charges_financieres"] },
      {
        label: "Dotations aux amortissements et aux provisions",
        keys: [
          "cpc.dotations_amort_provisions",
          "cpc.dotations_amortissements",
          "cpc.dotations_provisions",
        ],
      },
      { label: "Autres charges d'exploitation", keys: ["cpc.autres_charges_exploitation"] },
      { label: "Impôt sur les sociétés", keys: ["cpc.impot_societes"] },
    ],
  },
  {
    soldeId: "resultatNet",
    soldeLabel: "RÉSULTAT NET DE L'EXERCICE",
    produits: [
      { label: "Gains extraordinaires", keys: ["cpc.gains_extraordinaires"] },
      { label: "Effet des modifications comptables", keys: ["cpc.effet_modifications_comptables"] },
    ],
    charges: [{ label: "Pertes extraordinaires", keys: ["cpc.pertes_extraordinaires"] }],
  },
];

/** Montant d'une ligne SIG (produit ou charge), affiché positif dans les
 * deux colonnes comme sur le document officiel — même convention de signe
 * que ROWS_SIG_PRODUITS (sign:-1) / ROWS_SIG_CHARGES (sign:1). */
export function sigLigneValeur(postes: Postes, ligne: SigLigne, nature: "produit" | "charge") {
  const sum = ligne.keys.reduce((s, k) => s + (postes[k] ?? 0), 0);
  return nature === "produit" ? -sum : sum;
}

/** Les 5 soldes intermédiaires de gestion — enchaînés, chacun repart du
 * précédent (comme sur votre capture SIG). */
export function computeSig(postes: Postes): SigResult {
  // Marge commerciale = ventes − coût d'achat des MARCHANDISES revendues
  // uniquement (jamais les approvisionnements, qui relèvent de la
  // production/prestation, pas de la revente) — cpc.achats_consommes
  // (ligne condensée) reste ici pour compatibilité, cpc.achats_marchandises
  // est son équivalent détaillé, jamais les deux à la fois pour un même code.
  const margeCommerciale = contrib(postes, "cpc.ventes_marchandises", "cpc.achats_consommes", "cpc.achats_marchandises");
  const valeurAjoutee =
    margeCommerciale +
    contrib(
      postes,
      "cpc.autres_produits_exploitation",
      "cpc.production_stockee",
      "cpc.production_immobilisee",
      "cpc.charges_externes",
      "cpc.achats_approvisionnements",
    );
  const ebe = valeurAjoutee + contrib(postes, "cpc.impots_taxes", "cpc.charges_personnel");
  const resultatOrdinaire =
    ebe +
    contrib(
      postes,
      "cpc.autres_produits_ordinaires",
      "cpc.produits_financiers",
      "cpc.transferts_charges",
      "cpc.reprises_provisions",
      "cpc.autres_charges_ordinaires",
      "cpc.charges_financieres",
      "cpc.dotations_amort_provisions",
      "cpc.dotations_amortissements",
      "cpc.dotations_provisions",
      "cpc.autres_charges_exploitation",
      "cpc.impot_societes",
    );
  const resultatNetVal =
    resultatOrdinaire +
    contrib(postes, "cpc.gains_extraordinaires", "cpc.pertes_extraordinaires", "cpc.effet_modifications_comptables");
  return {
    margeCommerciale,
    valeurAjoutee,
    ebe,
    resultatOrdinaire,
    resultatNet: resultatNetVal,
  };
}

export const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Liste des postes assignables à un code AFFECTAT, pour le menu déroulant
 * de la grille de reclassement (admin). */
export const POSTE_OPTIONS: { value: string; label: string; groupe: string }[] = [
  ...ROWS_BILAN_ACTIF.filter((r) => r.posteKeys?.length).map((r) => ({
    value: r.posteKeys![0],
    label: r.label,
    groupe: "Bilan Actif",
  })),
  ...ROWS_BILAN_PASSIF.filter((r) => r.posteKeys?.length).map((r) => ({
    value: r.posteKeys![0],
    label: r.label,
    groupe: "Bilan Passif",
  })),
  ...Object.values(CPC_LIGNES).map((l) => ({
    value: l.keys[0],
    label: l.label,
    groupe: "Etat de résultat / SIG",
  })),
];
