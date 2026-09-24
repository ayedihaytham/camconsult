import { api } from "@/lib/api";
import {
  computeRows,
  computeSig,
  resultatNet,
  resultatComptableAvantImpot,
  ROWS_BILAN_ACTIF,
  ROWS_BILAN_PASSIF,
  ROWS_ETAT_RESULTAT,
  ROWS_SIG_PRODUITS,
  ROWS_SIG_CHARGES,
  signForPoste,
  type Row,
} from "./postes";
import { computeImmoVariation, MASSE_AMORT_LABELS, MASSE_LABELS } from "./immobilisations";
import { computeBiensPourExercice, mergeImmoMouvements } from "./immobilisationsRegistre";
import { computeFlux } from "./flux";
import { computeTdrf } from "./tdrf";
import { computeControle, computeControleMarge } from "./controle";
import { substituteTokens } from "@/pages/etatsFinanciers/PrincipesComptablesSection";
import type { PostesExercice } from "@/store/balances";
import type {
  DetailCompteLigne,
  FicheSociete,
  FinancementMouvement,
  GrilleAffectatCode,
  ImmoBien,
  ImmoCategorie,
  ImmoMouvement,
  NotesExercice,
  NotesModele,
  TdrfLigne,
  TdrfParametres,
} from "@/types";

export type Aoa = (string | number)[][];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Télécharge une seule feuille comme classeur Excel autonome — utilisé pour
 * l'export « indépendant » d'une section (voir BalancesListPage), par
 * opposition à `exportClasseurExcel` qui assemble toutes les feuilles dans
 * un seul classeur.
 */
export async function downloadSingleSheetXlsx(aoa: Aoa, sheetName: string, societeName: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoWidth(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const safeName = societeName.replace(/[\\/:*?"<>|]/g, "").trim() || "Societe";
  XLSX.writeFile(wb, `${sheetName} - ${safeName}.xlsx`);
}

export function financialSheet(
  rows: Row[],
  exercices: PostesExercice[],
  titre: string,
  extraByExercice?: (exercice: string) => Record<string, number>,
): Aoa {
  const aoa: Aoa = [[titre, ...exercices.map((e) => e.exercice)]];
  const computed = exercices.map((e) => computeRows(rows, e.postes, extraByExercice?.(e.exercice) ?? {}));
  for (const r of rows) {
    if (r.section) {
      aoa.push([r.label.toUpperCase()]);
      continue;
    }
    const label = (r.indent ? "  " : "") + r.label;
    aoa.push([label, ...computed.map((c) => round2(c[r.id] ?? 0))]);
  }
  return aoa;
}

export function sigSheet(exercices: PostesExercice[]): Aoa {
  const aoa: Aoa = [];
  for (const e of exercices) {
    const produits = computeRows(ROWS_SIG_PRODUITS, e.postes);
    const charges = computeRows(ROWS_SIG_CHARGES, e.postes);
    const sig = computeSig(e.postes);
    aoa.push([`EXERCICE ${e.exercice}`]);
    aoa.push(["Produits", "Montant", "", "Charges", "Montant"]);
    const n = Math.max(ROWS_SIG_PRODUITS.length, ROWS_SIG_CHARGES.length);
    for (let i = 0; i < n; i++) {
      const p = ROWS_SIG_PRODUITS[i];
      const c = ROWS_SIG_CHARGES[i];
      aoa.push([
        p ? p.label : "",
        p ? round2(produits[p.id] ?? 0) : "",
        "",
        c ? c.label : "",
        c ? round2(charges[c.id] ?? 0) : "",
      ]);
    }
    aoa.push([]);
    aoa.push(["Marge commerciale", round2(sig.margeCommerciale)]);
    aoa.push(["Valeur ajoutée", round2(sig.valeurAjoutee)]);
    aoa.push(["Excédent brut d'exploitation (EBE)", round2(sig.ebe)]);
    aoa.push(["Résultat des activités ordinaires", round2(sig.resultatOrdinaire)]);
    aoa.push(["RÉSULTAT NET DE L'EXERCICE", round2(sig.resultatNet)]);
    aoa.push([]);
  }
  return aoa;
}

export function immoSheet(exercices: PostesExercice[], immoMouvements: ImmoMouvement[]): Aoa {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const aoa: Aoa = [];
  for (const e of chrono) {
    const prevExercice =
      chrono.filter((x) => x.exercice < e.exercice).sort((a, b) => b.exercice.localeCompare(a.exercice))[0] ?? null;
    const lignes = computeImmoVariation(e.exercice, e.postes, prevExercice ? prevExercice.postes : null, immoMouvements);
    aoa.push([`EXERCICE ${e.exercice}`]);
    for (const l of lignes) {
      aoa.push([MASSE_LABELS[l.masse]]);
      aoa.push(["", "Ouverture", "Augmentation", "Diminution", "Clôture"]);
      aoa.push(["Valeurs brutes", round2(l.brutOuverture), round2(l.acquisitions), round2(l.cessions), round2(l.brutCloture)]);
      aoa.push([
        MASSE_AMORT_LABELS[l.masse],
        round2(l.amortOuverture),
        round2(l.dotations),
        round2(l.reprises),
        round2(l.amortCloture),
      ]);
      aoa.push(["Valeur nette comptable", round2(l.netOuverture), "", "", round2(l.netCloture)]);
      aoa.push([]);
    }
  }
  return aoa;
}

export function fluxSheet(
  exercices: PostesExercice[],
  immoMouvements: ImmoMouvement[],
  financementMouvements: FinancementMouvement[],
): Aoa {
  const flux = computeFlux(exercices, immoMouvements, financementMouvements);
  const na = "n/d";
  const v = (x: number | null) => (x === null ? na : round2(x));
  const aoa: Aoa = [];
  for (const f of flux) {
    aoa.push([`EXERCICE ${f.exercice}`]);
    aoa.push(["Flux de trésorerie liés à l'exploitation"]);
    aoa.push(["Résultat net de l'exercice", round2(f.resultatNet)]);
    aoa.push(["Ajustements pour :"]);
    aoa.push(["  Dotations aux amortissements et aux provisions", round2(f.dotationsNettes)]);
    aoa.push(["  Intérêts sur placements courus et non échus", round2(f.interetsCourusNonEchus)]);
    aoa.push(["Variation des :"]);
    aoa.push(["  Clients et comptes rattachés", v(f.variationClients)]);
    aoa.push(["  Autres actifs", v(f.variationAutresActifs)]);
    aoa.push(["  Fournisseurs et autres dettes", v(f.variationFournisseursAutresDettes)]);
    aoa.push(["  Modifications comptables", v(f.variationModificationsComptables)]);
    aoa.push(["Flux de trésorerie provenant des opérations d'exploitation", v(f.fluxExploitation)]);
    aoa.push([]);
    aoa.push(["Flux de trésorerie liés à l'investissement"]);
    aoa.push(["Acquisition / Cession d'immobilisations corporelles et incorporelles", round2(f.acquisitionCessionImmoCorpIncorp)]);
    aoa.push(["Acquisition / Cession d'immobilisations financières", round2(f.acquisitionCessionImmoFin)]);
    aoa.push(["Flux de trésorerie affectés à des activités d'investissement", round2(f.fluxInvestissement)]);
    aoa.push([]);
    aoa.push(["Flux de trésorerie liés aux activités de financement"]);
    aoa.push(["Variation des placements", v(f.variationPlacements)]);
    aoa.push(["Encaissement suite à une augmentation de capital", round2(f.capitalNumeraire)]);
    aoa.push(["Distribution de dividendes", round2(f.dividendesDistribues)]);
    aoa.push(["Emprunts contractés", round2(f.empruntsContractes)]);
    aoa.push(["Remboursements d'emprunts", round2(f.empruntsRembourses)]);
    aoa.push(["Flux de trésorerie affecté à des activités de financement", v(f.fluxFinancement)]);
    aoa.push([]);
    aoa.push(["VARIATION DE TRÉSORERIE", v(f.variationTresorerie)]);
    aoa.push(["Trésorerie au début de l'exercice", f.tresorerieOuverture === null ? na : round2(f.tresorerieOuverture)]);
    aoa.push(["Trésorerie à la clôture de l'exercice", round2(f.tresorerieCloture)]);
    aoa.push([]);
    aoa.push([]);
  }
  return aoa;
}

// [clé sur TdrfParametres, libellé] — mêmes lignes standard que l'écran
// (TdrfTable.tsx), pour que l'export Excel corresponde exactement à ce qui
// s'affiche dans l'app plutôt que de ne lister que les lignes libres.
const REINTEGRATIONS_STANDARD: { key: keyof TdrfParametres; label: string }[] = [
  { key: "pertesChangeNonRealisees", label: "1.10 Pertes de change non réalisées" },
  { key: "gainsChangeNonRealisesAnterieurs", label: "1.11 Gains de change non réalisés antérieurement non imposés" },
  { key: "remunerationsExcedentairesTitres", label: "1.12 Rémunérations excédentaires des titres participatifs et des comptes courants associés" },
  { key: "chargesEspeces5000", label: "1.13 Charges d'une valeur ≥ 5.000 dinars payée en espèces" },
  { key: "moinsValueCessionTitresOpcvm", label: "1.14 Moins-value de cession des titres d'OPCVM dans la limite des dividendes distribués" },
  { key: "impotsDirectsLieuAutrui", label: "1.15 Impôts directs supportés au lieu et place d'autrui" },
  { key: "taxeVoyage", label: "1.16 Taxe de voyage" },
  { key: "transactionsAmendesPenalites", label: "1.17 Transactions, amendes, confiscations et pénalités non déductibles" },
  { key: "depensesEssaimage", label: "1.18 Dépenses excédentaires engagées pour la réalisation des opérations d'essaimage" },
  { key: "facturesNonParvenues", label: "1.19 Factures non parvenues" },
  { key: "amortissementsBiensReevalues", label: "2.1 Amortissements non déductibles relatifs aux biens réévalués" },
  { key: "provisionsNonDeductibles", label: "3.1 Provisions non déductibles" },
  { key: "provisionsCreancesDouteusesReintegrees", label: "3.2 Provisions pour créances douteuses (hors établissements de crédit)" },
];

export function tdrfSheet(
  exercices: PostesExercice[],
  lignes: TdrfLigne[],
  parametres: TdrfParametres[],
): Aoa {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const aoa: Aoa = [];
  for (const e of chrono) {
    const lignesExercice = lignes.filter((l) => l.exercice === e.exercice);
    const p = parametres.find((x) => x.exercice === e.exercice);
    const result = computeTdrf(resultatComptableAvantImpot(e.postes), lignesExercice, p);
    aoa.push([`EXERCICE ${e.exercice}`]);
    aoa.push(["Résultat comptable avant impôt", round2(result.resultatComptable)]);
    aoa.push(["Réintégrations"]);
    for (const { key, label } of REINTEGRATIONS_STANDARD) {
      const v = Number(p?.[key] ?? 0);
      if (v) aoa.push(["  " + label, round2(v)]);
    }
    for (const l of lignesExercice.filter((l) => l.kind === "reintegration")) {
      aoa.push(["  " + l.libelle, round2(l.montant)]);
    }
    aoa.push(["TOTAL RÉINTÉGRATIONS", round2(result.totalReintegrations)]);
    aoa.push([]);
    aoa.push(["Produits réalisés par les établissements situés à l'étranger", round2(p?.produitsEtranger ?? 0)]);
    aoa.push(["Résultat fiscal avant déduction des provisions (B/P)", round2(result.resultatFiscalAvantDeductionProvisions)]);
    aoa.push(["Provisions déductibles (plafonnées à 50%)", round2(result.provisionsDeductibles)]);
    aoa.push(["Résultat fiscal après déduction des provisions (B/P)", round2(result.resultatFiscalApresProvisions)]);
    aoa.push(["Moins-value de levée d'option déductible (plafonnée à 5%)", round2(result.moinsValueLeveeOptionDeductible)]);
    aoa.push(["Résultat fiscal avant déduction des déficits et amortissements", round2(result.resultatFiscalAvantDeficitsAmortissements)]);
    aoa.push(["Réintégration des amortissements de l'exercice", round2(p?.reintegrationAmortissementsExercice ?? 0)]);
    aoa.push(["Déduction des déficits reportés", round2(p?.deductionDeficitsReportes ?? 0)]);
    aoa.push(["Déduction des amortissements de l'exercice", round2(p?.deductionAmortissementsExercice ?? 0)]);
    aoa.push(["Déduction des amortissements différés en périodes déficitaires", round2(p?.deductionAmortissementsDifferes ?? 0)]);
    aoa.push(["Résultat fiscal après déduction des déficits et amortissements (B/P)", round2(result.resultatFiscalApresDeficitsAmortissements)]);
    aoa.push(["Intérêts des dépôts et titres en devises ou en dinars convertibles", round2(p?.interetsDepotsTitresDevises ?? 0)]);
    for (const l of lignesExercice.filter((l) => l.kind === "deduction")) {
      aoa.push(["  " + l.libelle, round2(l.montant)]);
    }
    aoa.push(["RÉSULTAT IMPOSABLE", round2(result.resultatImposable)]);
    aoa.push([]);
    aoa.push(["Chiffre d'affaires local", round2(result.chiffreAffairesLocal)]);
    aoa.push(["Chiffre d'affaires export", round2(result.chiffreAffairesExport)]);
    aoa.push(["Taux d'imposition", result.tauxImposition]);
    aoa.push(["Taux d'imposition — part export", result.tauxExport]);
    aoa.push(["Taux minimum d'impôt", result.tauxMinimum]);
    aoa.push(["Impôt sur les sociétés (résultat imposable × taux)", round2(result.isCalcule)]);
    aoa.push(["Minimum d'impôt", round2(result.minimumImpot)]);
    aoa.push(["IMPÔTS SUR LES SOCIÉTÉS", round2(result.impotSocietes)]);
    aoa.push(["Contribution sociale de solidarité", round2(result.contributionSociale)]);
    aoa.push(["Excédents et acomptes provisionnels imputables", round2(result.excedentsAcomptes)]);
    aoa.push(["Excédents antérieurs", round2(p?.excedentsAnterieurs ?? 0)]);
    aoa.push(["Acomptes provisionnels payés", round2(p?.acomptesProvisionnelsPayes ?? 0)]);
    aoa.push(["Retenue à la source", round2(p?.retenueALaSource ?? 0)]);
    aoa.push(["Avance IRPP sur import", round2(p?.avanceIrppImport ?? 0)]);
    aoa.push(["IMPÔTS À PAYER / (REPORT)", round2(result.impotsAPayer)]);
    if (result.tauxEffectif !== null) {
      aoa.push(["Taux effectif d'imposition", round2(result.tauxEffectif)]);
    }
    aoa.push([]);
  }
  return aoa;
}

const DETAIL_TITRES: { poste: string; titre: string }[] = [
  { poste: "actif.clients", titre: "5.4 Clients et comptes rattachés" },
  { poste: "actif.autres_courants", titre: "5.5 Autres actifs courants" },
  { poste: "actif.liquidites", titre: "5.6 Liquidités et équivalents de liquidités" },
  { poste: "passif.fournisseurs", titre: "6.2 Fournisseurs et comptes rattachés" },
  { poste: "passif.autres_passifs_courants", titre: "6.3 Autres passifs courants" },
  { poste: "passif.concours_bancaires", titre: "6.4 Concours bancaires et autres passifs financiers" },
  { poste: "cpc.charges_externes", titre: "7.1 Autres charges d'exploitation" },
];

export function notesSheet(
  societeName: string,
  fiche: FicheSociete,
  modele: NotesModele,
  notesParExercice: NotesExercice[],
  detailComptes: DetailCompteLigne[],
  exercices: PostesExercice[],
): Aoa {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const aoa: Aoa = [];

  aoa.push(["PRÉSENTATION DE LA SOCIÉTÉ"]);
  aoa.push(["Forme juridique", fiche.formeJuridique]);
  aoa.push(["Statut fiscal", fiche.statutFiscal]);
  aoa.push(["Date de création", fiche.dateCreation ?? ""]);
  aoa.push(["Capital initial (DT)", round2(fiche.capitalInitial)]);
  aoa.push(["Nombre de parts initiales", fiche.partsInitiales]);
  aoa.push(["Valeur nominale d'une part (DT)", round2(fiche.valeurNominale)]);
  aoa.push([]);
  if (fiche.objetSocial.length) {
    aoa.push(["Objet social"]);
    for (const bloc of fiche.objetSocial) aoa.push([bloc.titre, bloc.texte]);
    aoa.push([]);
  }
  if (fiche.associes.length) {
    aoa.push(["Structure du capital social"]);
    aoa.push(["Associé", "Valeur des parts (DT)", "Parts"]);
    for (const a of fiche.associes) aoa.push([a.nom, round2(a.valeurParts), a.parts]);
    aoa.push([]);
  }

  for (const e of chrono) {
    const n = notesParExercice.find((x) => x.exercice === e.exercice);
    const texte = n?.texteOverride || substituteTokens(modele.texte, societeName, e.exercice);
    aoa.push([`PRÉSENTATION DES ÉTATS FINANCIERS, NORMES ET PRINCIPES COMPTABLES — ${e.exercice}`]);
    for (const ligne of texte.split("\n")) aoa.push([ligne]);
    aoa.push([]);
  }

  aoa.push(["ACTIFS ET PASSIFS — DÉTAIL PAR COMPTE"]);
  for (const { poste, titre } of DETAIL_TITRES) {
    const filtered = detailComptes.filter((l) => l.poste === poste);
    const comptes = [...new Set(filtered.map((l) => l.compte))].sort();
    if (comptes.length === 0) continue;
    const sign = signForPoste(poste);
    aoa.push([titre]);
    aoa.push(["Compte", "Libellé", ...chrono.map((e) => e.exercice)]);
    for (const compte of comptes) {
      const libelle = filtered.find((l) => l.compte === compte && l.libelle)?.libelle || "";
      aoa.push([
        compte,
        libelle,
        ...chrono.map((e) =>
          round2(sign * (filtered.find((l) => l.compte === compte && l.exercice === e.exercice)?.solde ?? 0)),
        ),
      ]);
    }
    aoa.push([]);
  }

  for (const e of chrono) {
    const n = notesParExercice.find((x) => x.exercice === e.exercice);
    if (!n || n.blocsLibres.length === 0) continue;
    aoa.push([`NOTES COMPLÉMENTAIRES — ${e.exercice}`]);
    for (const bloc of n.blocsLibres) aoa.push([bloc.titre, bloc.texte]);
    aoa.push([]);
  }

  return aoa;
}

export function syntheseSheet(exercices: PostesExercice[], grilleCodes: GrilleAffectatCode[]): Aoa {
  const libelleByCode = new Map(grilleCodes.map((c) => [c.code, c.libelle]));
  const codes = new Set<string>();
  for (const e of exercices) for (const c of Object.keys(e.codes)) codes.add(c);
  const sorted = [...codes].sort((a, b) => (a || "(sans code)").localeCompare(b || "(sans code)"));

  const aoa: Aoa = [["Code", "Libellé", ...exercices.map((e) => e.exercice)]];
  for (const code of sorted) {
    aoa.push([
      code || "(sans code)",
      code ? libelleByCode.get(code) || "—" : "Lignes non reclassées",
      ...exercices.map((e) => round2(e.codes[code] ?? 0)),
    ]);
  }
  const totalByExercice = exercices.map((e) =>
    round2(Object.values(e.codes).reduce((s, v) => s + v, 0)),
  );
  aoa.push(["Total général", "", ...totalByExercice]);
  return aoa;
}

export function controleSheet(
  exercices: PostesExercice[],
  immoMouvements: ImmoMouvement[],
  financementMouvements: FinancementMouvement[],
  tdrfLignes: TdrfLigne[],
  tdrfParametres: TdrfParametres[],
): Aoa {
  const controle = computeControle(exercices, immoMouvements, financementMouvements, tdrfLignes, tdrfParametres);
  const marges = computeControleMarge(exercices);
  const aoa: Aoa = [];
  for (const c of controle) {
    aoa.push([`EXERCICE ${c.exercice}`]);
    aoa.push(["Libellé", "Source 1", "Valeur 1", "Source 2", "Valeur 2", "Écart"]);
    for (const l of c.lignes) {
      aoa.push([l.libelle, l.sourceLabel1, round2(l.valeur1), l.sourceLabel2, round2(l.valeur2), round2(l.valeur1 - l.valeur2)]);
    }
    aoa.push([]);
  }
  if (marges.length > 0) {
    aoa.push(["CONTRÔLE DE MARGE"]);
    aoa.push([
      "Libellé",
      ...marges.flatMap((m) => [m.exercice, m.exercicePrecedent]),
    ]);
    aoa.push([
      "Production de l'exercice / Ventes",
      ...marges.flatMap((m) => [round2(m.productionVentes1), round2(m.productionVentes2)]),
    ]);
    aoa.push([
      "Achats consommés",
      ...marges.flatMap((m) => [round2(m.achatsConsommes1), round2(m.achatsConsommes2)]),
    ]);
    aoa.push([
      "Marge en valeur",
      ...marges.flatMap((m) => [round2(m.margeValeur1), round2(m.margeValeur2)]),
    ]);
    aoa.push([
      "Marge en %",
      ...marges.flatMap((m) => [
        m.margePct1 === null ? "" : round2(m.margePct1 * 100),
        m.margePct2 === null ? "" : round2(m.margePct2 * 100),
      ]),
    ]);
  }
  return aoa;
}

export function registreSheet(exercices: PostesExercice[], biens: ImmoBien[], categories: ImmoCategorie[]): Aoa {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const aoa: Aoa = [];
  for (const e of chrono) {
    const calculs = computeBiensPourExercice(biens, categories, e.exercice);
    if (calculs.length === 0) continue;
    aoa.push([`EXERCICE ${e.exercice}`]);
    aoa.push([
      "Catégorie",
      "Bien",
      "Brut ouverture",
      "Acquisitions",
      "Cessions",
      "Brut clôture",
      "Amort. ouverture",
      "Dotations",
      "Amort. clôture",
      "VNC",
    ]);
    for (const c of calculs) {
      aoa.push([
        c.categorie.nom,
        c.bien.libelle,
        round2(c.brutOuverture),
        round2(c.acquisitions),
        round2(c.cessionsBrut),
        round2(c.brutCloture),
        round2(c.amortOuverture),
        round2(c.dotations),
        round2(c.amortCloture),
        round2(c.vcn),
      ]);
    }
    aoa.push([]);
  }
  return aoa;
}

function autoWidth(aoa: Aoa) {
  const widths: number[] = [];
  for (const row of aoa) {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.min(80, Math.max(widths[i] ?? 10, len + 2));
    });
  }
  return widths.map((wch) => ({ wch }));
}

export interface ClasseurSheet {
  name: string;
  aoa: Aoa;
  /** 1re ligne = en-têtes (« Actif | 2025 | 2024 ») */
  headerRow?: boolean;
}

/**
 * Feuilles du classeur complet (Bilan Actif/Passif, Etat de résultat, SIG,
 * TAB VAR Immob, Flux, TDRF, Notes) — une par tableau, comme le classeur
 * d'origine du cabinet. Récupère ses propres données depuis l'API
 * (indépendant de l'onglet actif dans l'app). Sert à l'Excel et au PDF.
 */
export async function loadClasseurSheets(societeId: string, societeName: string): Promise<ClasseurSheet[]> {
  const [
    postesParExercice,
    immoMouvementsManuels,
    financementMouvements,
    tdrfLignes,
    tdrfParametres,
    modele,
    fiche,
    detailComptes,
    immoBiens,
    immoCategories,
  ] = await Promise.all([
    api.get<PostesExercice[]>(`/balances/postes?societeId=${societeId}`),
    api.get<ImmoMouvement[]>(`/balances/immo-mouvements?societeId=${societeId}`),
    api.get<FinancementMouvement[]>(`/balances/financement-mouvements?societeId=${societeId}`),
    api.get<TdrfLigne[]>(`/balances/tdrf-lignes?societeId=${societeId}`),
    api.get<TdrfParametres[]>(`/balances/tdrf-parametres?societeId=${societeId}`),
    api.get<NotesModele>("/notes/modele"),
    api.get<FicheSociete>(`/notes/fiche-societe/${societeId}`),
    api.get<DetailCompteLigne[]>(`/notes/detail-comptes?societeId=${societeId}`),
    api.get<ImmoBien[]>(`/immobilisations/biens?societeId=${societeId}`),
    api.get<ImmoCategorie[]>("/immobilisations/categories"),
  ]);

  if (postesParExercice.length === 0) {
    throw new Error("Aucun exercice avec une balance pour cette société.");
  }

  const immoMouvements = mergeImmoMouvements(
    societeId,
    postesParExercice,
    immoMouvementsManuels,
    immoBiens,
    immoCategories,
  );

  const notesParExercice = await Promise.all(
    postesParExercice.map((e) =>
      api.get<NotesExercice>(`/notes/exercice?societeId=${societeId}&exercice=${encodeURIComponent(e.exercice)}`),
    ),
  );

  return [
    { name: "Bilan Actif", headerRow: true, aoa: financialSheet(ROWS_BILAN_ACTIF, postesParExercice, "Actif") },
    {
      name: "Bilan Passif",
      headerRow: true,
      aoa: financialSheet(ROWS_BILAN_PASSIF, postesParExercice, "Capitaux propres et passifs", (ex) => {
        const p = postesParExercice.find((e) => e.exercice === ex);
        return { resultat_exercice: p ? resultatNet(p.postes) : 0 };
      }),
    },
    {
      name: "Etat de résultat",
      headerRow: true,
      aoa: financialSheet(ROWS_ETAT_RESULTAT, postesParExercice, "Etat de résultat"),
    },
    { name: "SIG", aoa: sigSheet(postesParExercice) },
    { name: "TAB VAR Immob", aoa: immoSheet(postesParExercice, immoMouvements) },
    { name: "FLUX", aoa: fluxSheet(postesParExercice, immoMouvements, financementMouvements) },
    { name: "TDRF", aoa: tdrfSheet(postesParExercice, tdrfLignes, tdrfParametres) },
    {
      name: "Notes",
      aoa: notesSheet(societeName, fiche, modele, notesParExercice, detailComptes, postesParExercice),
    },
  ];
}

const safeSociete = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim() || "Societe";

/** Classeur complet en un fichier Excel multi-onglets. */
export async function exportClasseurExcel(societeId: string, societeName: string) {
  const [XLSX, sheets] = await Promise.all([import("xlsx"), loadClasseurSheets(societeId, societeName)]);
  const wb = XLSX.utils.book_new();
  for (const { name, aoa } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = autoWidth(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, `Etats financiers - ${safeSociete(societeName)}.xlsx`);
}

/** Classeur complet en un vrai fichier PDF (une partie par tableau). */
export async function exportClasseurPdf(societeId: string, societeName: string) {
  const [{ downloadTablesPdf }, sheets] = await Promise.all([
    import("@/lib/pdfTables"),
    loadClasseurSheets(societeId, societeName),
  ]);
  await downloadTablesPdf({
    title: `ÉTATS FINANCIERS — ${societeName}`,
    subtitle: "Chiffres exprimés en dinars tunisiens",
    sheets: sheets.map((s) => ({ name: s.name, rows: s.aoa, headerRow: s.headerRow })),
    fileName: `Etats financiers - ${safeSociete(societeName)}`,
  });
}

/** PDF d'une seule section (tableau déjà construit, comme pour l'Excel). */
export async function downloadSectionPdf(aoa: Aoa, sheetName: string, societeName: string, headerRow: boolean) {
  const { downloadTablesPdf } = await import("@/lib/pdfTables");
  await downloadTablesPdf({
    title: sheetName.toUpperCase(),
    subtitle: `${societeName} · Chiffres exprimés en dinars tunisiens`,
    sheets: [{ name: sheetName, rows: aoa, headerRow }],
    fileName: `${sheetName} - ${safeSociete(societeName)}`,
  });
}

/**
 * Feuille « Notes » seule — la seule section dont les données (fiche société,
 * modèle, détail comptes) ne sont pas déjà chargées dans BalancesListPage,
 * donc la seule à refaire son propre fetch.
 */
export async function loadNotesSheet(
  societeId: string,
  societeName: string,
  postesParExercice: PostesExercice[],
): Promise<Aoa> {
  if (postesParExercice.length === 0) {
    throw new Error("Aucun exercice avec une balance pour cette société.");
  }
  const [modele, fiche, detailComptes] = await Promise.all([
    api.get<NotesModele>("/notes/modele"),
    api.get<FicheSociete>(`/notes/fiche-societe/${societeId}`),
    api.get<DetailCompteLigne[]>(`/notes/detail-comptes?societeId=${societeId}`),
  ]);
  const notesParExercice = await Promise.all(
    postesParExercice.map((e) =>
      api.get<NotesExercice>(`/notes/exercice?societeId=${societeId}&exercice=${encodeURIComponent(e.exercice)}`),
    ),
  );
  return notesSheet(societeName, fiche, modele, notesParExercice, detailComptes, postesParExercice);
}
