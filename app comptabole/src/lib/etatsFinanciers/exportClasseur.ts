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
  type Row,
} from "./postes";
import { computeImmoVariation, MASSE_AMORT_LABELS, MASSE_LABELS } from "./immobilisations";
import { mergeImmoMouvements } from "./immobilisationsRegistre";
import { computeFlux } from "./flux";
import { computeTdrf } from "./tdrf";
import { substituteTokens } from "@/pages/etatsFinanciers/PrincipesComptablesSection";
import type { PostesExercice } from "@/store/balances";
import type {
  DetailCompteLigne,
  FicheSociete,
  FinancementMouvement,
  ImmoBien,
  ImmoCategorie,
  ImmoMouvement,
  NotesExercice,
  NotesModele,
  TdrfLigne,
  TdrfParametres,
} from "@/types";

type Aoa = (string | number)[][];

const round2 = (n: number) => Math.round(n * 100) / 100;

function financialSheet(
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

function sigSheet(exercices: PostesExercice[]): Aoa {
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

function immoSheet(exercices: PostesExercice[], immoMouvements: ImmoMouvement[]): Aoa {
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

function fluxSheet(
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

function tdrfSheet(
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
    for (const l of lignesExercice.filter((l) => l.kind === "reintegration")) {
      aoa.push(["  " + l.libelle, round2(l.montant)]);
    }
    aoa.push(["Total réintégrations", round2(result.totalReintegrations)]);
    aoa.push(["Déductions"]);
    for (const l of lignesExercice.filter((l) => l.kind === "deduction")) {
      aoa.push(["  " + l.libelle, round2(l.montant)]);
    }
    aoa.push(["Total déductions", round2(result.totalDeductions)]);
    aoa.push(["RÉSULTAT FISCAL (résultat imposable)", round2(result.resultatFiscal)]);
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

function notesSheet(
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
    aoa.push([titre]);
    aoa.push(["Compte", "Libellé", ...chrono.map((e) => e.exercice)]);
    for (const compte of comptes) {
      const libelle = filtered.find((l) => l.compte === compte && l.libelle)?.libelle || "";
      aoa.push([
        compte,
        libelle,
        ...chrono.map((e) => round2(filtered.find((l) => l.compte === compte && l.exercice === e.exercice)?.solde ?? 0)),
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

/**
 * Exporte le classeur complet (Bilan Actif/Passif, Etat de résultat, SIG,
 * TAB VAR Immob, Flux, TDRF, Notes) en un fichier Excel multi-onglets — une
 * feuille par tableau, comme le classeur d'origine du cabinet. Récupère ses
 * propres données depuis l'API (indépendant de l'onglet actif dans l'app).
 */
export async function exportClasseurExcel(societeId: string, societeName: string) {
  const [
    XLSX,
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
    import("xlsx"),
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

  const wb = XLSX.utils.book_new();
  const addSheet = (name: string, aoa: Aoa) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = autoWidth(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };

  addSheet("Bilan Actif", financialSheet(ROWS_BILAN_ACTIF, postesParExercice, "Actif"));
  addSheet(
    "Bilan Passif",
    financialSheet(ROWS_BILAN_PASSIF, postesParExercice, "Capitaux propres et passifs", (ex) => {
      const p = postesParExercice.find((e) => e.exercice === ex);
      return { resultat_exercice: p ? resultatNet(p.postes) : 0 };
    }),
  );
  addSheet("Etat de résultat", financialSheet(ROWS_ETAT_RESULTAT, postesParExercice, "Etat de résultat"));
  addSheet("SIG", sigSheet(postesParExercice));
  addSheet("TAB VAR Immob", immoSheet(postesParExercice, immoMouvements));
  addSheet("FLUX", fluxSheet(postesParExercice, immoMouvements, financementMouvements));
  addSheet("TDRF", tdrfSheet(postesParExercice, tdrfLignes, tdrfParametres));
  addSheet(
    "Notes",
    notesSheet(societeName, fiche, modele, notesParExercice, detailComptes, postesParExercice),
  );

  const safeName = societeName.replace(/[\\/:*?"<>|]/g, "").trim() || "Societe";
  XLSX.writeFile(wb, `Etats financiers - ${safeName}.xlsx`);
}
