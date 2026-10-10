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
  /** Export Excel : format numérique (défaut « #,##0.000 » pour un montant). */
  excelNumFmt?: string;
  /** La case accepte une pièce jointe (scan, PDF) en plus du texte : l'id du fichier est gardé dans `<clé>_fichier`. */
  piece?: boolean;
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

const round2 = (n: number) => Math.round(n * 1000) / 1000;

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

/** Jours écoulés depuis une date « AAAA-MM-JJ » (ou « JJ/MM/AAAA ») ; "" si pas de date. */
export function joursDepuis(v: unknown, today = new Date()): number | "" {
  const s = String(v ?? "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const d = iso
    ? Date.UTC(+iso[1], +iso[2] - 1, +iso[3])
    : fr
      ? Date.UTC(+fr[3], +fr[2] - 1, +fr[1])
      : null;
  if (d === null) return "";
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((t - d) / 86400000));
}

/** Balance âgée : solde final dû + ancienneté (depuis le dernier règlement), calculés. */
const deriveBalanceAgee = (rows: TabRow[]): TabRow[] =>
  deriveSoldeFinal(rows).map((r) => ({
    ...r,
    anciennete: joursDepuis(r.date_dernier_reglement),
  }));

/** Net crédité d'une traite escomptée = montant de la traite − agios. */
const deriveNetEscompte = (rows: TabRow[]): TabRow[] =>
  rows.map((r) => ({ ...r, net_credite: round2(cellNumber(r.montant) - cellNumber(r.agios)) }));

const netEscompteFormula: TabColumn["excelFormula"] = (r, col) =>
  `IF(AND(${col("montant")}${r}="",${col("agios")}${r}=""),"",ROUND(N(${col("montant")}${r})-N(${col("agios")}${r}),3))`;

const sumKey = (key: string) => (rows: TabRow[]) =>
  rows.reduce((s, r) => s + cellNumber(r[key]), 0);

/** Regroupement de lignes dont la somme doit atteindre un montant annoncé (ex. les chèques d'un bordereau de remise). */
export interface TabGroupe {
  /** colonne qui identifie le groupe (ex. n° de bordereau) */
  cle: string;
  /** colonne du montant annoncé du groupe, saisi sur sa première ligne */
  totalCol: string;
  /** colonne dont la somme doit atteindre le montant annoncé */
  montantCol: string;
  /** colonnes recopiées sur la ligne suivante d'un groupe incomplet */
  prefill: string[];
  /** « Bordereau » : nom d'un groupe dans les messages */
  libelle: string;
  /** Texte du bouton qui ajoute une ligne à un groupe : « Ajouter un chèque ». */
  ajout: string;
}

export interface RepartitionGroupe {
  id: string;
  /** valeur de la clé, telle que saisie (ex. « REM-42 ») */
  nom: string;
  total: number;
  reparti: number;
  /** montant restant à répartir (négatif en cas de dépassement) */
  reste: number;
  complet: boolean;
  nbLignes: number;
}

const TOLERANCE_GROUPE = 0.0005;

/** Avancement de chaque groupe qui a un montant annoncé : somme des lignes contre ce montant. */
export function repartitionGroupes(def: Pick<TabDef, "groupe">, rows: TabRow[]): RepartitionGroupe[] {
  const g = def.groupe;
  if (!g) return [];
  const groupes = new Map<string, RepartitionGroupe>();
  for (const r of rows) {
    const nom = String(r[g.cle] ?? "").trim();
    if (!nom) continue;
    // Anciennes lignes (un montant par ligne, sans colonne des chèques) : jamais contrôlées.
    if (!(g.montantCol in r)) continue;
    const id = nom.toLowerCase();
    const courant = groupes.get(id) ?? { id, nom, total: 0, reparti: 0, reste: 0, complet: false, nbLignes: 0 };
    if (courant.total === 0) courant.total = Math.max(0, cellNumber(r[g.totalCol]));
    courant.reparti = round2(courant.reparti + cellNumber(r[g.montantCol]));
    courant.nbLignes += 1;
    groupes.set(id, courant);
  }
  return [...groupes.values()]
    .filter((x) => x.total > 0)
    .map((x) => {
      const reste = Math.round((x.total - x.reparti) * 1000) / 1000;
      return { ...x, reste, complet: Math.abs(reste) < TOLERANCE_GROUPE };
    });
}

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
  /** lignes à répartir jusqu'à atteindre un montant annoncé (bordereaux de remise de chèques) */
  groupe?: TabGroupe;
  /** Tableau tenu par le cabinet : le client le consulte sans pouvoir le modifier ni le transmettre, et il n'est ni dans sa checklist ni dans le récap. */
  cabinetSeul?: boolean;
  /** Consigne courte pour le client : ce qu'il doit saisir dans ce tableau, en une ou deux phrases. */
  aide?: string;
  /** Tableau qui s'ouvre en demandant la plage de numéros à remplir (de tel n° à tel n°) : une ligne est créée par numéro de la plage. */
  plageNumeros?: { col: string; libelle: string };
}

const COLONNES_CHEQUES_EMIS: TabColumn[] = [
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
    ];

const TABLEAUX_DEFINIS: TabDef[] = [
  {
    key: "souche_cheques",
    label: "Souche de chèques",
    pieceLabel: "Détail de la souche de chèques (chèques émis)",
    // Le client indique d'abord les numéros de sa souche (du premier au dernier chèque) : une ligne est créée par chèque à remplir.
    plageNumeros: { col: "num_cheque", libelle: "chèque" },
    totalKey: "montant",
    columns: COLONNES_CHEQUES_EMIS,
  },
  {
    key: "etat_cheques_emis",
    label: "État des chèques émis",
    pieceLabel: "État des chèques émis",
    // Tableau tenu par le comptable : il reprend la souche remplie par le client, la vérifie et ajoute le nécessaire.
    cabinetSeul: true,
    totalKey: "montant",
    columns: COLONNES_CHEQUES_EMIS,
  },
  {
    key: "bordereaux_remise_cheques",
    label: "Bordereaux remise de chèques",
    pieceLabel: "Détail des bordereaux de remise de chèques (nominatifs)",
    totalKey: "montant",
    // Le montant du bordereau (60 000) se saisit une seule fois, sur sa première ligne ; les chèques qui le composent
    // se saisissent ligne sous ligne, chacun avec son montant, jusqu'à ce que leur somme l'atteigne.
    groupe: {
      cle: "num_bordereau",
      totalCol: "montant",
      montantCol: "montant_cheque",
      prefill: ["date_remise", "num_bordereau", "banque"],
      libelle: "Bordereau",
      ajout: "Ajouter un chèque",
    },
    columns: [
      { key: "date_remise", label: "Date de remise", type: "date", width: 130 },
      { key: "num_bordereau", label: "N° Bordereau", type: "text", width: 140 },
      { key: "montant", label: "Montant du bordereau", type: "number", width: 140 },
      { key: "banque", label: "Banque", type: "text", width: 170 },
      { key: "num_cheque", label: "N° Chèque", type: "text", width: 130 },
      {
        key: "client_emetteur",
        label: "Nom du client émetteur (nominatif)",
        type: "text",
        width: 240,
      },
      { key: "montant_cheque", label: "Montant du chèque", type: "number", width: 130 },
      { key: "date_echeance", label: "Date d'échéance", type: "date", width: 130 },
      { key: "observations", label: "Observations / pièce jointe", type: "text", width: 220, piece: true },
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
    label: "Virement multiple (salaires)",
    pieceLabel: "Détail des virements multiples (salaires)",
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
    key: "bordereaux_traites_recues",
    label: "Bordereaux traites reçues",
    pieceLabel: "Détail des bordereaux de remise de traites (nominatifs)",
    totalKey: "montant",
    // Comme les bordereaux de remise de chèques : le montant du bordereau se saisit sur sa première ligne, puis chaque
    // traite sur sa ligne jusqu'à atteindre ce montant.
    groupe: {
      cle: "num_bordereau",
      totalCol: "montant",
      montantCol: "montant_traite",
      prefill: ["date_remise", "num_bordereau", "banque"],
      libelle: "Bordereau",
      ajout: "Ajouter une traite",
    },
    columns: [
      { key: "date_remise", label: "Date de remise", type: "date", width: 130 },
      { key: "num_bordereau", label: "N° Bordereau", type: "text", width: 140 },
      { key: "montant", label: "Montant du bordereau", type: "number", width: 140 },
      { key: "banque", label: "Banque", type: "text", width: 170 },
      { key: "num_traite", label: "N° Traite", type: "text", width: 130 },
      { key: "client_emetteur", label: "Nom du client tiré (nominatif)", type: "text", width: 240 },
      { key: "montant_traite", label: "Montant de la traite", type: "number", width: 130 },
      { key: "date_echeance", label: "Date d'échéance", type: "date", width: 130 },
      { key: "observations", label: "Observations / pièce jointe", type: "text", width: 220, piece: true },
    ],
  },
  {
    key: "traites_emises",
    label: "État des traites émises",
    pieceLabel: "État des traites émises",
    totalKey: "montant",
    columns: [
      { key: "date", label: "Date", type: "date", width: 130 },
      { key: "num_traite", label: "N° Traite", type: "text", width: 130 },
      { key: "beneficiaire", label: "Bénéficiaire", type: "text", width: 220 },
      { key: "motif", label: "Motif / Objet", type: "text", width: 240 },
      { key: "montant", label: "Montant", type: "number", width: 130 },
      { key: "date_echeance", label: "Date d'échéance", type: "date", width: 130 },
      { key: "compte_bancaire", label: "Compte bancaire", type: "text", width: 170 },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
  {
    key: "traites_escomptees",
    label: "Traites escomptées",
    pieceLabel: "Détail des traites escomptées",
    totalKey: "montant",
    excelTotalKeys: ["montant", "agios", "net_credite"],
    derive: deriveNetEscompte,
    columns: [
      { key: "date_escompte", label: "Date d'escompte", type: "date", width: 130 },
      { key: "banque", label: "Banque", type: "text", width: 170 },
      { key: "num_traite", label: "N° Traite", type: "text", width: 130 },
      { key: "client_emetteur", label: "Nom du client tiré", type: "text", width: 220 },
      { key: "date_echeance", label: "Date d'échéance", type: "date", width: 130 },
      { key: "montant", label: "Montant de la traite", type: "number", width: 130 },
      { key: "agios", label: "Agios / frais d'escompte", type: "number", width: 140 },
      {
        key: "net_credite",
        label: "Net crédité",
        type: "number",
        width: 130,
        computed: true,
        excelFormula: netEscompteFormula,
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
    derive: deriveBalanceAgee,
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
        computed: true,
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
    derive: deriveBalanceAgee,
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
        computed: true,
        excelFormula: ancienneteFormula,
        excelNumFmt: "0",
      },
      { key: "observations", label: "Observations", type: "text", width: 220 },
    ],
  },
];

/** Titre des documents exportés (Excel, PDF) : « DÉTAIL DE LA SOUCHE (chèques émis) ». */
export function titreDocument(def: TabDef): string {
  if (def.excelTitle) return def.excelTitle;
  const i = def.pieceLabel.indexOf("(");
  return i === -1
    ? def.pieceLabel.toUpperCase()
    : def.pieceLabel.slice(0, i).toUpperCase() + def.pieceLabel.slice(i);
}

/** Un « état » regroupe plusieurs tableaux de la collecte : chaque tableau garde sa propre saisie, son circuit et son export. */
export interface EtatCollecte {
  key: "cheques" | "virements" | "traites";
  /** Sigle affiché sur les onglets et les listes. */
  code: "CHQ" | "VRT" | "TR";
  label: string;
  tableaux: string[];
}

export const COLLECTE_ETATS: EtatCollecte[] = [
  { key: "cheques", code: "CHQ", label: "État des chèques", tableaux: ["bordereaux_remise_cheques", "etat_cheques_emis"] },
  { key: "virements", code: "VRT", label: "État des virements", tableaux: ["virements_recus", "virements_emis", "virements_salaire"] },
  { key: "traites", code: "TR", label: "État des traites", tableaux: ["bordereaux_traites_recues", "traites_emises", "traites_escomptees"] },
];

/** L'état auquel appartient un tableau (undefined pour les tableaux qui n'en font pas partie). */
export const etatDeTableau = (key: string): EtatCollecte | undefined => COLLECTE_ETATS.find((e) => e.tableaux.includes(key));

/** Consigne affichée au client sous le titre de chaque tableau : quoi saisir, dans quel ordre. */
const AIDES: Record<string, string> = {
  souche_cheques:
    "Indiquez d'abord les numéros de votre souche : une ligne est créée par chèque. Complétez ensuite, pour chaque chèque émis, la date, le bénéficiaire, le motif et le montant.",
  etat_cheques_emis: "Ce tableau est tenu par le cabinet : vous pouvez le consulter, pas le modifier.",
  bordereaux_remise_cheques:
    "Un bordereau regroupe des chèques remis ensemble à la banque. Saisissez son numéro et son montant total sur la première ligne, puis chaque chèque (n°, client, montant) jusqu'à atteindre le total.",
  virements_recus: "Listez les virements reçus sur vos comptes : date, qui vous a payé, motif, montant et compte crédité.",
  virements_emis: "Listez les virements que vous avez émis : date, bénéficiaire, motif, montant et compte débité.",
  virements_salaire: "Un virement multiple regroupe les salaires payés en une fois : date, salarié, mois concerné, montant net versé et compte.",
  bordereaux_traites_recues:
    "Un bordereau regroupe des traites remises ensemble à la banque. Saisissez son numéro et son montant total sur la première ligne, puis chaque traite (n°, client, montant, échéance) jusqu'à atteindre le total.",
  traites_emises: "Listez les traites que vous avez émises : date, n° de traite, bénéficiaire, motif, montant, échéance et compte.",
  traites_escomptees:
    "Traites remises à la banque avant leur échéance : date d'escompte, banque, n° de traite, client, échéance, montant et agios. Le net crédité se calcule seul.",
  chiffre_affaires: "Une ligne par vente ou par facture : date, n° de facture ou de ticket, client, nature, montant HT et TVA. Le TTC se calcule seul.",
  detail_achats: "Une ligne par achat : date, n° de facture, fournisseur, nature, montant HT et TVA. Le TTC se calcule seul.",
  etat_caisse: "Première ligne : le solde de départ de la caisse. Ensuite, chaque entrée et chaque sortie ; le solde se calcule seul.",
  etat_clients: "Une ligne par client : solde de départ, ce qui a été facturé et ce qui a été réglé sur la période. Le solde final se calcule seul.",
  etat_fournisseurs: "Une ligne par fournisseur : solde de départ, ce qui a été facturé et ce qui a été réglé sur la période. Le solde final se calcule seul.",
};

/** Tableaux dans l'ordre d'affichage : les états d'abord (chèques, virements, traites), puis les autres tableaux. */
export const COLLECTE_TABS: TabDef[] = [
  ...COLLECTE_ETATS.flatMap((e) => e.tableaux.map((k) => TABLEAUX_DEFINIS.find((t) => t.key === k)!)),
  ...TABLEAUX_DEFINIS.filter((t) => !etatDeTableau(t.key)),
].map((t) => ({ ...t, aide: AIDES[t.key] }));

/** Trie des clés de tableaux dans l'ordre d'affichage (états regroupés). */
export const ordonnerTableaux = (keys: string[]): string[] => {
  const rang = (k: string) => {
    const i = COLLECTE_TABS.findIndex((t) => t.key === k);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...keys].sort((a, b) => rang(a) - rang(b));
};

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

/** Clés des tableaux tenus par le cabinet seul. */
export const TABLEAUX_CABINET_SEUL = COLLECTE_TABS.filter((t) => t.cabinetSeul).map((t) => t.key);
