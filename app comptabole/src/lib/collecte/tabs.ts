// Registre des onglets de la « Collecte de pièces ».
// Chaque onglet = un tableau que le client remplit. Les colonnes réelles de
// chaque onglet sont ajoutées au fur et à mesure (une entrée ci-dessous).
// Tant qu'un onglet n'a pas ses colonnes définitives : `provisional: true`
// + un jeu de colonnes générique (Date / Libellé / Référence / Montant /
// Commentaire) pour qu'il soit déjà utilisable.

import type { CollecteStatut } from "@/types";

export type ColType = "text" | "number" | "date" | "select";

export type TabRow = Record<string, unknown>;

export interface TabColumn {
  key: string;
  label: string;
  type: ColType;
  options?: string[];
  /** largeur indicative en px pour la grille */
  width?: number;
  /** colonne en lecture seule dont la valeur est produite par `TabDef.derive` */
  computed?: boolean;
  /** Export Excel : formule de la cellule à la ligne `r` (col(k) = lettre de
   * la colonne k), pour qu'une colonne calculée le reste dans Excel. */
  excelFormula?: (r: number, col: (key: string) => string) => string;
  /** Export Excel : format numérique (défaut « #,##0.00 » pour un montant). */
  excelNumFmt?: string;
}

/** Solde final dû = solde initial + facturé − réglé. */
const soldeFinalFormula: TabColumn["excelFormula"] = (r, col) => {
  const [si, f, rg] = [col("solde_initial"), col("facture"), col("regle")].map((l) => `${l}${r}`);
  return `IF(AND(${si}="",${f}="",${rg}=""),"",ROUND(N(${si})+N(${f})-N(${rg}),2))`;
};

/** Ancienneté = jours écoulés depuis le dernier règlement. */
const ancienneteFormula: TabColumn["excelFormula"] = (r, col) =>
  `IF(${col("date_dernier_reglement")}${r}="","",TODAY()-${col("date_dernier_reglement")}${r})`;

/** TTC = HT × (1 + TVA %), vide tant que le HT n'est pas saisi. */
const ttcFormula: TabColumn["excelFormula"] = (r, col) =>
  `IF(${col("montant_ht")}${r}="","",ROUND(${col("montant_ht")}${r}*(1+${col("tva_pct")}${r}/100),2))`;

/** Lit une cellule comme nombre (« 1 200,50 » → 1200.5). */
export function cellNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const n = parseFloat(
    String(v ?? "")
      .replace(/\s/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** HT + TVA % → TTC, sur chaque ligne. */
const deriveTtc = (rows: TabRow[]): TabRow[] =>
  rows.map((r) => ({
    ...r,
    montant_ttc: round2(
      cellNumber(r.montant_ht) * (1 + cellNumber(r.tva_pct) / 100),
    ),
  }));

/** solde_final = solde_initial + facture − regle, sur chaque ligne. */
const deriveSoldeFinal = (rows: TabRow[]): TabRow[] =>
  rows.map((r) => ({
    ...r,
    solde_final: round2(
      cellNumber(r.solde_initial) + cellNumber(r.facture) - cellNumber(r.regle),
    ),
  }));

const sumKey = (key: string) => (rows: TabRow[]) =>
  rows.reduce((s, r) => s + cellNumber(r[key]), 0);

export interface TabDef {
  key: string;
  /** nom de l'onglet (comme dans le fichier Excel) */
  label: string;
  /** libellé « Pièce à transmettre » affiché dans la Checklist */
  pieceLabel: string;
  columns: TabColumn[];
  /** colonne numérique agrégée dans la colonne « Total (€) » de la Checklist */
  totalKey?: string;
  /** colonnes totalisées sur la ligne TOTAL de l'export Excel (défaut : [totalKey]) */
  excelTotalKeys?: string[];
  /** Export Excel : libellé de la ligne de total (défaut : totalLabel, en majuscules) */
  excelTotalLabel?: string;
  /** Export Excel : titre de la feuille, si différent de pieceLabel */
  excelTitle?: string;
  /** calcule les colonnes dérivées (ex. TTC, solde courant) — appliqué à l'affichage et avant enregistrement */
  derive?: (rows: TabRow[]) => TabRow[];
  /** valeur affichée dans « Total (€) » de la Checklist si différente de la somme de `totalKey` */
  checklistTotal?: (derivedRows: TabRow[]) => number | null;
  /** libellé du pied de grille (défaut « Total ») */
  totalLabel?: string;
  /** true tant que les colonnes ne sont pas les colonnes définitives du client */
  provisional?: boolean;
}

export const COLLECTE_TABS: TabDef[] = [
  {
    key: "souche_cheques",
    label: "Souche de chèques",
    pieceLabel: "Détail de la souche de chèques (chèques émis)",
    totalKey: "montant",
    columns: [
      { key: "date", label: "Date", type: "date", width: 130 },
      { key: "num_cheque", label: "N° Chèque", type: "text", width: 130 },
      { key: "beneficiaire", label: "Bénéficiaire", type: "text", width: 220 },
      { key: "motif", label: "Motif / Objet", type: "text", width: 240 },
      { key: "montant", label: "Montant", type: "number", width: 130 },
      {
        key: "compte_bancaire",
        label: "Compte bancaire",
        type: "text",
        width: 170,
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "bordereaux_remise_cheques",
    label: "Bordereaux remise chèques",
    pieceLabel: "Détail des bordereaux de remise de chèques (nominatifs)",
    totalKey: "montant",
    columns: [
      { key: "date_remise", label: "Date de remise", type: "date", width: 130 },
      { key: "num_bordereau", label: "N° Bordereau", type: "text", width: 140 },
      { key: "banque", label: "Banque", type: "text", width: 170 },
      { key: "num_cheque", label: "N° Chèque", type: "text", width: 130 },
      {
        key: "client_emetteur",
        label: "Nom du client émetteur (nominatif)",
        type: "text",
        width: 240,
      },
      { key: "montant", label: "Montant", type: "number", width: 130 },
      {
        key: "date_valeur",
        label: "Date de valeur",
        type: "date",
        width: 130,
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "virements_recus",
    label: "Virements reçus",
    pieceLabel: "Détail des virements reçus",
    totalKey: "montant",
    columns: [
      { key: "date", label: "Date", type: "date", width: 130 },
      {
        key: "emetteur",
        label: "Émetteur du virement",
        type: "text",
        width: 220,
      },
      { key: "reference", label: "Référence / Motif", type: "text", width: 220 },
      { key: "montant", label: "Montant", type: "number", width: 130 },
      {
        key: "compte_bancaire",
        label: "Compte bancaire",
        type: "text",
        width: 170,
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "virements_emis",
    label: "Virements émis",
    pieceLabel: "Détail des virements émis",
    totalKey: "montant",
    columns: [
      { key: "date", label: "Date", type: "date", width: 130 },
      {
        key: "beneficiaire",
        label: "Bénéficiaire du virement",
        type: "text",
        width: 220,
      },
      { key: "reference", label: "Référence / Motif", type: "text", width: 220 },
      { key: "montant", label: "Montant", type: "number", width: 130 },
      {
        key: "compte_bancaire",
        label: "Compte bancaire",
        type: "text",
        width: 170,
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "virements_salaire",
    label: "Virements de salaire",
    pieceLabel: "Détail des virements de salaire",
    totalKey: "montant_net",
    columns: [
      {
        key: "date_virement",
        label: "Date de virement",
        type: "date",
        width: 140,
      },
      { key: "salarie", label: "Nom du salarié", type: "text", width: 200 },
      { key: "mois", label: "Mois concerné", type: "text", width: 150 },
      {
        key: "montant_net",
        label: "Montant net versé",
        type: "number",
        width: 150,
      },
      {
        key: "compte_bancaire",
        label: "Compte bancaire",
        type: "text",
        width: 170,
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "chiffre_affaires",
    label: "Chiffre d'affaires",
    pieceLabel: "Détail du chiffre d'affaires",
    totalKey: "montant_ht",
    excelTotalKeys: ["montant_ht", "montant_ttc"],
    derive: deriveTtc,
    columns: [
      { key: "date", label: "Date", type: "date", width: 130 },
      {
        key: "num_facture",
        label: "N° Facture / Ticket",
        type: "text",
        width: 160,
      },
      { key: "client", label: "Client", type: "text", width: 200 },
      {
        key: "nature",
        label: "Nature de la vente",
        type: "text",
        width: 200,
      },
      { key: "montant_ht", label: "Montant HT", type: "number", width: 130 },
      { key: "tva_pct", label: "TVA %", type: "number", width: 90 },
      {
        key: "montant_ttc",
        label: "Montant TTC",
        type: "number",
        width: 130,
        computed: true,
        excelFormula: ttcFormula,
      },
      {
        key: "mode_reglement",
        label: "Mode de règlement",
        type: "select",
        width: 160,
        options: [
          "Virement",
          "Chèque",
          "Espèces",
          "Carte bancaire",
          "Prélèvement",
          "Autre",
        ],
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "detail_achats",
    label: "Détail des achats",
    pieceLabel: "Détail des achats",
    totalKey: "montant_ht",
    excelTotalKeys: ["montant_ht", "montant_ttc"],
    derive: deriveTtc,
    columns: [
      { key: "date", label: "Date", type: "date", width: 130 },
      { key: "num_facture", label: "N° Facture", type: "text", width: 150 },
      { key: "fournisseur", label: "Fournisseur", type: "text", width: 200 },
      {
        key: "nature",
        label: "Nature de l'achat",
        type: "text",
        width: 200,
      },
      { key: "montant_ht", label: "Montant HT", type: "number", width: 130 },
      { key: "tva_pct", label: "TVA %", type: "number", width: 90 },
      {
        key: "montant_ttc",
        label: "Montant TTC",
        type: "number",
        width: 130,
        computed: true,
        excelFormula: ttcFormula,
      },
      {
        key: "mode_paiement",
        label: "Mode de paiement",
        type: "select",
        width: 160,
        options: [
          "Virement",
          "Chèque",
          "Espèces",
          "Carte bancaire",
          "Prélèvement",
          "Autre",
        ],
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "etat_caisse",
    label: "État de caisse",
    pieceLabel: "État de caisse",
    // 1re ligne = solde initial (saisir le Solde, laisser Entrée/Sortie vides).
    // Lignes suivantes : Solde = solde précédent + Entrée − Sortie.
    derive: (rows) => {
      let solde = 0;
      return rows.map((r, i) => {
        const entree = cellNumber(r.entree);
        const sortie = cellNumber(r.sortie);
        if (i === 0 && entree === 0 && sortie === 0) {
          solde = cellNumber(r.solde);
        } else {
          solde = round2(solde + entree - sortie);
        }
        return { ...r, solde };
      });
    },
    checklistTotal: (rows) =>
      rows.length ? cellNumber(rows[rows.length - 1].solde) : null,
    totalLabel: "Solde final",
    columns: [
      { key: "date", label: "Date", type: "date", width: 130 },
      {
        key: "libelle",
        label: "Libellé de l'opération",
        type: "text",
        width: 240,
      },
      { key: "entree", label: "Entrée", type: "number", width: 120 },
      { key: "sortie", label: "Sortie", type: "number", width: 120 },
      { key: "solde", label: "Solde", type: "number", width: 130 },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "etat_clients",
    label: "État clients",
    pieceLabel: "État clients (balance âgée)",
    excelTitle: "ÉTAT DES CLIENTS (BALANCE ÂGÉE)",
    derive: deriveSoldeFinal,
    checklistTotal: sumKey("solde_final"),
    totalLabel: "Total dû",
    excelTotalLabel: "TOTAUX",
    excelTotalKeys: ["solde_initial", "facture", "regle", "solde_final"],
    columns: [
      { key: "client", label: "Client", type: "text", width: 200 },
      {
        key: "solde_initial",
        label: "Solde initial",
        type: "number",
        width: 130,
      },
      {
        key: "facture",
        label: "Facturé sur la période",
        type: "number",
        width: 150,
      },
      {
        key: "regle",
        label: "Réglé sur la période",
        type: "number",
        width: 150,
      },
      {
        key: "solde_final",
        label: "Solde final dû",
        type: "number",
        width: 130,
        computed: true,
        excelFormula: soldeFinalFormula,
      },
      {
        key: "date_dernier_reglement",
        label: "Date du dernier règlement",
        type: "date",
        width: 150,
      },
      {
        key: "anciennete",
        label: "Ancienneté (jours)",
        type: "number",
        width: 120,
        excelFormula: ancienneteFormula,
        excelNumFmt: "0",
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "etat_fournisseurs",
    label: "État fournisseurs",
    pieceLabel: "État fournisseurs (balance âgée)",
    excelTitle: "ÉTAT DES FOURNISSEURS (BALANCE ÂGÉE)",
    derive: deriveSoldeFinal,
    checklistTotal: sumKey("solde_final"),
    totalLabel: "Total dû",
    excelTotalLabel: "TOTAUX",
    excelTotalKeys: ["solde_initial", "facture", "regle", "solde_final"],
    columns: [
      { key: "fournisseur", label: "Fournisseur", type: "text", width: 200 },
      {
        key: "solde_initial",
        label: "Solde initial",
        type: "number",
        width: 130,
      },
      {
        key: "facture",
        label: "Facturé sur la période",
        type: "number",
        width: 150,
      },
      {
        key: "regle",
        label: "Réglé sur la période",
        type: "number",
        width: 150,
      },
      {
        key: "solde_final",
        label: "Solde final dû",
        type: "number",
        width: 130,
        computed: true,
        excelFormula: soldeFinalFormula,
      },
      {
        key: "date_dernier_reglement",
        label: "Date du dernier règlement",
        type: "date",
        width: 150,
      },
      {
        key: "anciennete",
        label: "Ancienneté (jours)",
        type: "number",
        width: 120,
        excelFormula: ancienneteFormula,
        excelNumFmt: "0",
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
];

export const TAB_BY_KEY: Record<string, TabDef> = Object.fromEntries(
  COLLECTE_TABS.map((t) => [t.key, t]),
);

export const COLLECTE_TAB_KEYS = COLLECTE_TABS.map((t) => t.key);

export const COLLECTE_STATUT_LABELS: Record<CollecteStatut, string> = {
  brouillon: "Brouillon",
  transmis: "Transmis au cabinet",
  valide: "Validé",
  a_corriger: "À corriger",
  archive: "Archivée",
};
