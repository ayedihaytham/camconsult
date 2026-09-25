// node-postgres renvoie une colonne `date` comme un Date JS à minuit HEURE
// LOCALE du serveur — passer par toISOString() (qui convertit en UTC
// d'abord) décale donc la date d'un jour dès que le fuseau local est en
// avance sur UTC (ex. Tunisie, UTC+1 : minuit local = 23h la veille en UTC).
// Constaté en usage réel sur `echeance` (Collecte de pièces) : 2020-01-01
// envoyé, 2019-12-31 relu. On relit donc les composants en HEURE LOCALE
// (mêmes getters que ceux utilisés pour construire le Date), jamais via UTC.
const dateStr = (d) => {
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
};

export const societeDto = (r) => ({
  id: r.id,
  raisonSociale: r.raison_sociale,
  rne: r.rne,
  tva: r.tva,
  theme: r.theme,
  code: r.code,
  identifiant: r.identifiant,
  motDePasse: r.mot_de_passe,
  statut: r.statut,
  telephone: r.telephone,
  email: r.email,
  adresse: r.adresse,
  creeLe: dateStr(r.cree_le),
});

const isoOrNull = (d) =>
  d == null ? null : d instanceof Date ? d.toISOString() : String(d);

export const employeDto = (r) => ({
  id: r.id,
  nom: r.nom,
  prenom: r.prenom,
  identifiant: r.identifiant,
  motDePasse: r.mot_de_passe,
  type: r.type,
  role:
    r.role === "societe_employe" || r.role === "responsable_collaborateurs"
      ? r.role
      : "collaborateur",
  societeId: r.societe_id ?? null,
  email: r.email,
  statut: r.statut,
  societesAssignees: Array.isArray(r.societes_assignees)
    ? r.societes_assignees
    : [],
  permissions: r.permissions || {},
  doitChangerMotDePasse: Boolean(r.doit_changer_mdp),
  delegue: r.role === "societe_employe" && Boolean(r.delegue),
  derniereConnexion: isoOrNull(r.last_login),
  creeLe: dateStr(r.cree_le),
});

/** employeDto pour une session donnée : seul l'admin reçoit les mots de
 * passe. Les autres (collaborateurs, responsable des collaborateurs,
 * employés de société) ne les voient jamais, même ceux qu'ils gèrent — ils
 * peuvent réinitialiser un mot de passe, pas le lire. */
export const employeDtoFor = (session) => (r) => {
  const d = employeDto(r);
  return session?.role === "admin" ? d : { ...d, motDePasse: "" };
};

export const tacheDto = (r) => ({
  id: r.id,
  titre: r.titre,
  description: r.description ?? "",
  societeId: r.societe_id,
  assigneId: r.assigne_id ?? null,
  statut: r.statut,
  origine: r.origine === "societe" ? "societe" : "cabinet",
  module: r.module ?? null,
  creePar: r.cree_par ?? "",
  creeLe: isoOrNull(r.cree_le),
  majLe: isoOrNull(r.maj_le),
  termineLe: isoOrNull(r.termine_le),
});

export const noeudDto = (r) => ({
  id: r.id,
  libelle: r.libelle,
  description: r.description,
  type: r.type,
  societeId: r.societe_id,
  parentId: r.parent_id,
  format: r.format ?? undefined,
  taille: r.taille ?? undefined,
  dataUrl: r.data_url ?? undefined,
  creeLe: dateStr(r.cree_le ?? r.maj_le),
  majLe: dateStr(r.maj_le),
});

/** Nœud sans son contenu (base64, jusqu'à plusieurs Mo par fichier) : c'est
 * ce qu'envoient le chargement initial et les listes. Le contenu se récupère
 * à la demande (GET /noeuds/:id/contenu) quand on ouvre ou télécharge le
 * fichier. noeudDto (complet) reste utilisé pour la sauvegarde. */
export const noeudDtoLeger = (r) => {
  const { dataUrl: _contenu, ...d } = noeudDto(r);
  return { ...d, aContenu: r.a_contenu ?? Boolean(r.data_url) };
};

/** Colonnes d'un nœud SANS son contenu, + a_contenu — pour les listes. */
export const NOEUD_COLONNES_LEGERES =
  "id, libelle, description, type, societe_id, parent_id, format, taille, maj_le, cree_le, (data_url is not null) as a_contenu";

export const conversationDto = (r) => ({
  id: r.id,
  type: r.type,
  titre: r.titre,
  membreIds: Array.isArray(r.membre_ids) ? r.membre_ids : [],
  creeLe:
    r.cree_le instanceof Date ? r.cree_le.toISOString() : String(r.cree_le),
});

export const messageDto = (r) => ({
  id: r.id,
  conversationId: r.conversation_id,
  auteurId: r.auteur_id,
  contenu: r.contenu,
  envoyeLe:
    r.envoye_le instanceof Date ? r.envoye_le.toISOString() : r.envoye_le,
  statut: r.statut,
  pieceJointe: r.piece_jointe || undefined,
});

/** Message sans le contenu de sa pièce jointe (base64) — même principe que
 * noeudDtoLeger ; contenu à la demande via GET /messages/:id/piece-jointe.
 * Important car les messages sont re-demandés régulièrement (temps réel). */
export const messageDtoLeger = (r) => {
  const d = messageDto(r);
  if (!d.pieceJointe) return d;
  const { dataUrl, ...pj } = d.pieceJointe;
  return { ...d, pieceJointe: { ...pj, aContenu: r.pj_a_contenu ?? Boolean(dataUrl) } };
};

/** Colonnes d'un message SANS le contenu de sa pièce jointe, + pj_a_contenu. */
export const MESSAGE_COLONNES_LEGERES =
  "id, conversation_id, auteur_id, contenu, envoye_le, statut, (piece_jointe - 'dataUrl') as piece_jointe, coalesce(piece_jointe ? 'dataUrl', false) as pj_a_contenu";

export const collecteDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  periode: r.periode,
  statut: r.statut,
  onglets: Array.isArray(r.onglets) ? r.onglets : [],
  devise: r.devise ?? "TND",
  echeance: r.echeance ? dateStr(r.echeance) : null,
  derniereRelanceLe: isoOrNull(r.derniere_relance_le),
  relanceCadenceJours: r.relance_cadence_jours ?? 3,
  creeLe: isoOrNull(r.cree_le),
  majLe: isoOrNull(r.maj_le),
  transmisLe: isoOrNull(r.transmis_le),
  valideLe: isoOrNull(r.valide_le),
});

export const collecteFichierDto = (r) => ({
  id: r.id,
  onglet: r.onglet ?? "",
  nom: r.nom,
  format: r.format ?? "",
  taille: r.taille ?? "",
  dataUrl: r.data_url,
  deposePar: r.depose_par ?? "",
  creeLe: isoOrNull(r.cree_le),
});

export const collecteNoteDto = (r) => ({
  id: r.id,
  onglet: r.onglet ?? "",
  kind: r.kind ?? "note",
  parentId: r.parent_id ?? null,
  auteur: r.auteur ?? "admin",
  ref: r.ref ?? "",
  cibleOrdre: r.cible_ordre == null ? null : Number(r.cible_ordre),
  cibleCol: r.cible_col ?? null,
  texte: r.texte ?? "",
  resolu: Boolean(r.resolu),
  creeLe: isoOrNull(r.cree_le),
});

export const collecteSectionDto = (r) => ({
  id: r.id,
  onglet: r.onglet,
  commentaire: r.commentaire ?? "",
  recapStatut: r.recap_statut ?? "none",
});

export const collecteLigneDto = (r) => ({
  id: r.id,
  onglet: r.onglet,
  ordre: r.ordre ?? 0,
  data: r.data ?? {},
});

export const bordereauLigneDto = (r) => ({
  id: r.id,
  ordre: r.ordre ?? 0,
  cheque: r.cheque ?? "",
  tiers: r.tiers ?? "",
  montant: r.montant == null ? 0 : Number(r.montant),
  facture: r.facture ?? "",
  remarque: r.remarque ?? "",
});

export const bordereauDto = (r) => ({
  id: r.id,
  type: r.type,
  volet: r.volet,
  numero: r.numero ?? "",
  dateOperation: r.date_operation ? dateStr(r.date_operation) : null,
  pointe: Boolean(r.pointe),
  note: r.note ?? "",
  creeLe: isoOrNull(r.cree_le),
  majLe: isoOrNull(r.maj_le),
});

const num = (v) => (v == null ? 0 : Number(v));

const ligneDto = (l) => ({
  id: l.id,
  designation: l.designation ?? "",
  quantite: num(l.quantite),
  prixUnitaire: num(l.prix_unitaire),
  montantDevise: num(l.montant_devise),
  montantTnd: num(l.montant_tnd),
});

const normDesignation = (s) => (s || "").trim().toLowerCase();

/** Écart par désignation : regroupe les lignes achat/vente d'un même
 * mouvement par produit (une facture peut en lister plusieurs, avec des
 * quantités différentes) — un simple total achat - total vente n'aurait pas
 * de sens si les produits ne sont pas les mêmes des deux côtés. */
function ecartParDesignation(achatLignes, venteLignes) {
  const byDesignation = new Map();
  for (const l of achatLignes) {
    const key = normDesignation(l.designation);
    const e = byDesignation.get(key) ?? {
      designation: l.designation || "(sans désignation)",
      achatQuantite: 0,
      venteQuantite: 0,
    };
    e.achatQuantite += l.quantite;
    byDesignation.set(key, e);
  }
  for (const l of venteLignes) {
    const key = normDesignation(l.designation);
    const e = byDesignation.get(key) ?? {
      designation: l.designation || "(sans désignation)",
      achatQuantite: 0,
      venteQuantite: 0,
    };
    e.venteQuantite += l.quantite;
    byDesignation.set(key, e);
  }
  return [...byDesignation.values()]
    .map((e) => ({ ...e, ecart: Math.round((e.achatQuantite - e.venteQuantite) * 1000) / 1000 }))
    .sort((a, b) => a.designation.localeCompare(b.designation));
}

/** `lignes` : toutes les lignes stock_lignes (achat + vente confondues) du
 * mouvement `r`, triées par ordre — voir server/routes/stock.js. */
export const stockMouvementDto = (r, lignes = []) => {
  const achatLignes = lignes
    .filter((l) => l.categorie === "achat")
    .map(ligneDto);
  const venteLignes = lignes
    .filter((l) => l.categorie === "vente")
    .map(ligneDto);
  const sumQ = (arr) => arr.reduce((s, l) => s + l.quantite, 0);

  return {
    id: r.id,
    societeId: r.societe_id,
    ordre: r.ordre ?? 0,
    natureMarchandise: r.nature_marchandise ?? "",

    achatDate: r.achat_date ? dateStr(r.achat_date) : null,
    achatNumFacture: r.achat_num_facture ?? "",
    achatDocType: r.achat_doc_type ?? "",
    fournisseur: r.fournisseur ?? "",
    achatDevise: r.achat_devise ?? "EUR",
    achatCours: num(r.achat_cours),
    achatLignes,

    venteDate: r.vente_date ? dateStr(r.vente_date) : null,
    venteNumFacture: r.vente_num_facture ?? "",
    venteDocType: r.vente_doc_type ?? "",
    client: r.client ?? "",
    venteDevise: r.vente_devise ?? "EUR",
    venteCours: num(r.vente_cours),
    venteLignes,

    douaneNumDeclaration: r.douane_num_declaration ?? "",
    douaneDate: r.douane_date ? dateStr(r.douane_date) : null,
    douaneRegime: r.douane_regime ?? "",
    douaneReference: r.douane_reference ?? "",

    achatDocDataUrl: r.achat_doc_data_url ?? null,
    venteDocDataUrl: r.vente_doc_data_url ?? null,
    douaneDocDataUrl: r.douane_doc_data_url ?? null,

    note: r.note ?? "",
    ecart: Math.round((sumQ(achatLignes) - sumQ(venteLignes)) * 1000) / 1000,
    ecartParDesignation: ecartParDesignation(achatLignes, venteLignes),
    creeLe: isoOrNull(r.cree_le),
    majLe: isoOrNull(r.maj_le),
  };
};

export const balanceLigneDto = (r) => ({
  id: r.id,
  ordre: r.ordre ?? 0,
  compte: r.compte ?? "",
  libelle: r.libelle ?? "",
  debit: num(r.debit),
  credit: num(r.credit),
  affectat: r.affectat ?? "",
  solde: Math.round((num(r.debit) - num(r.credit)) * 1000) / 1000,
});

export const balanceDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  exercice: r.exercice ?? "",
  note: r.note ?? "",
  creeLe: isoOrNull(r.cree_le),
  majLe: isoOrNull(r.maj_le),
});

export const grilleAffectatCodeDto = (r) => ({
  code: r.code,
  libelle: r.libelle ?? "",
  poste: r.poste ?? "",
  majLe: isoOrNull(r.maj_le),
});

export const grilleCompteDto = (r) => ({
  compte: r.compte,
  affectatCode: r.affectat_code ?? "",
  libelleCompte: r.libelle_compte ?? "",
  majLe: isoOrNull(r.maj_le),
});

/** Même forme que grilleCompteDto — la portée (quelle société) est portée
 * par le tableau dans lequel le DTO est renvoyé, pas par le DTO lui-même. */
export const grilleCompteSocieteDto = grilleCompteDto;

export const immoMouvementDto = (r) => ({
  societeId: r.societe_id,
  exercice: r.exercice ?? "",
  masse: r.masse,
  acquisitions: num(r.acquisitions),
  cessions: num(r.cessions),
  dotations: num(r.dotations),
  reprises: num(r.reprises),
  majLe: isoOrNull(r.maj_le),
});

export const financementMouvementDto = (r) => ({
  societeId: r.societe_id,
  exercice: r.exercice ?? "",
  empruntsContractes: num(r.emprunts_contractes),
  empruntsRembourses: num(r.emprunts_rembourses),
  dividendesDistribues: num(r.dividendes_distribues),
  capitalNumeraire: num(r.capital_numeraire),
  interetsCourusNonEchus: num(r.interets_courus_non_echus),
  majLe: isoOrNull(r.maj_le),
});

export const tdrfLigneDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  exercice: r.exercice ?? "",
  ordre: r.ordre ?? 0,
  kind: r.kind,
  libelle: r.libelle ?? "",
  montant: num(r.montant),
  majLe: isoOrNull(r.maj_le),
});

export const tdrfParametresDto = (r) => ({
  societeId: r.societe_id,
  exercice: r.exercice ?? "",
  chiffreAffairesLocal: num(r.chiffre_affaires_local),
  chiffreAffairesExport: num(r.chiffre_affaires_export),
  tauxImposition: num(r.taux_imposition),
  tauxExport: num(r.taux_export),
  tauxMinimum: num(r.taux_minimum),
  plancherMinimum: num(r.plancher_minimum),
  contributionSociale: num(r.contribution_sociale),
  excedentsAcomptes: num(r.excedents_acomptes),
  // Réintégrations (Annexe n°2, note commune n°26/2016)
  pertesChangeNonRealisees: num(r.pertes_change_non_realisees),
  gainsChangeNonRealisesAnterieurs: num(r.gains_change_non_realises_anterieurs),
  remunerationsExcedentairesTitres: num(r.remunerations_excedentaires_titres),
  chargesEspeces5000: num(r.charges_especes_5000),
  moinsValueCessionTitresOpcvm: num(r.moins_value_cession_titres_opcvm),
  impotsDirectsLieuAutrui: num(r.impots_directs_lieu_autrui),
  taxeVoyage: num(r.taxe_voyage),
  transactionsAmendesPenalites: num(r.transactions_amendes_penalites),
  depensesEssaimage: num(r.depenses_essaimage),
  facturesNonParvenues: num(r.factures_non_parvenues),
  amortissementsBiensReevalues: num(r.amortissements_biens_reevalues),
  provisionsNonDeductibles: num(r.provisions_non_deductibles),
  provisionsCreancesDouteusesReintegrees: num(r.provisions_creances_douteuses_reintegrees),
  // Déductions
  produitsEtranger: num(r.produits_etranger),
  provisionsCreancesDouteuses: num(r.provisions_creances_douteuses),
  provisionsDeprecStocksVente: num(r.provisions_deprec_stocks_vente),
  provisionsDeprecActionsCotees: num(r.provisions_deprec_actions_cotees),
  provisionsNonExigibiliteEngagements: num(r.provisions_non_exigibilite_engagements),
  moinsValueLeveeOption: num(r.moins_value_levee_option),
  reintegrationAmortissementsExercice: num(r.reintegration_amortissements_exercice),
  deductionDeficitsReportes: num(r.deduction_deficits_reportes),
  deductionAmortissementsExercice: num(r.deduction_amortissements_exercice),
  deductionAmortissementsDifferes: num(r.deduction_amortissements_differes),
  interetsDepotsTitresDevises: num(r.interets_depots_titres_devises),
  // Contribution sociale de solidarité / impôts à payer
  excedentsAnterieurs: num(r.excedents_anterieurs),
  acomptesProvisionnelsPayes: num(r.acomptes_provisionnels_payes),
  retenueALaSource: num(r.retenue_a_la_source),
  avanceIrppImport: num(r.avance_irpp_import),
  majLe: isoOrNull(r.maj_le),
});

export const notesModeleDto = (r) => ({
  texte: r.texte ?? "",
  majLe: isoOrNull(r.maj_le),
});

export const ficheSocieteDto = (r) => ({
  societeId: r.societe_id,
  formeJuridique: r.forme_juridique ?? "",
  statutFiscal: r.statut_fiscal ?? "",
  dateCreation: r.date_creation ? dateStr(r.date_creation) : null,
  capitalInitial: num(r.capital_initial),
  partsInitiales: r.parts_initiales ?? 0,
  valeurNominale: num(r.valeur_nominale),
  objetSocial: Array.isArray(r.objet_social) ? r.objet_social : [],
  associes: Array.isArray(r.associes) ? r.associes : [],
  majLe: isoOrNull(r.maj_le),
});

export const notesExerciceDto = (r) => ({
  societeId: r.societe_id,
  exercice: r.exercice ?? "",
  texteOverride: r.texte_override ?? "",
  blocsLibres: Array.isArray(r.blocs_libres) ? r.blocs_libres : [],
  majLe: isoOrNull(r.maj_le),
});

export const immoCategorieDto = (r) => ({
  id: r.id,
  nom: r.nom ?? "",
  taux: num(r.taux),
  masse: r.masse,
  majLe: isoOrNull(r.maj_le),
});

export const immoBienDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  categorieId: r.categorie_id,
  libelle: r.libelle ?? "",
  dateAcquisition: r.date_acquisition ? dateStr(r.date_acquisition) : null,
  coutAcquisition: num(r.cout_acquisition),
  taux: num(r.taux),
  dateCession: r.date_cession ? dateStr(r.date_cession) : null,
  valeurCession: num(r.valeur_cession),
  majLe: isoOrNull(r.maj_le),
});

export const notificationDto = (r) => ({
  id: r.id,
  type: r.type,
  titre: r.titre,
  corps: r.corps ?? "",
  lien: r.lien ?? "/taches",
  lu: Boolean(r.lu),
  creeLe: isoOrNull(r.cree_le),
});

export const journalDto = (r) => ({
  id: r.id,
  at: r.at instanceof Date ? r.at.toISOString() : r.at,
  actor: r.actor,
  action: r.action,
  entity: r.entity,
  label: r.label,
});

const honoraireLigneDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  ordre: r.ordre ?? 0,
  type: r.type ?? "mensuelle",
  nature: r.nature ?? "",
  periode: r.periode ?? "",
  libelle: r.libelle ?? "",
  cnss: r.cnss ?? "",
  numQuittance: r.num_quittance ?? "",
  montantDeclaration: num(r.montant_declaration),
  honoraire: num(r.honoraire),
  reglement: num(r.reglement),
  note: r.note ?? "",
  creeLe: isoOrNull(r.cree_le),
  majLe: isoOrNull(r.maj_le),
});

/** Ajoute le total de ligne et le solde cumulé (état client) — jamais
 * stocké, recalculé à chaque lecture dans l'ordre `ordre` : un solde figé
 * en base se désynchroniserait au moindre ajout/édition/suppression d'une
 * ligne antérieure (même logique que l'écart du module Stock). */
export function honoraireLignesDto(rows) {
  let solde = 0;
  return rows
    .map(honoraireLigneDto)
    .sort((a, b) => a.ordre - b.ordre)
    .map((l) => {
      const total = Math.round((l.montantDeclaration + l.honoraire) * 1000) / 1000;
      solde = Math.round((solde + l.montantDeclaration + l.honoraire - l.reglement) * 1000) / 1000;
      return { ...l, total, solde };
    });
}

// ── Suivi client devise ───────────────────────────
export const suiviDeviseDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  client: r.client,
  exercice: r.exercice ?? "",
  devise: r.devise || "EUR",
  note: r.note ?? "",
  soldeOuverture: num(r.solde_ouverture),
  creeLe: isoOrNull(r.cree_le),
  majLe: isoOrNull(r.maj_le),
});

const round2 = (n) => Math.round(n * 100) / 100;

const suiviDeviseLotDto = (r) => ({
  id: r.id,
  suiviId: r.suivi_id,
  ordre: r.ordre ?? 0,
  libelle: r.libelle ?? "",
  quantiteTonnes: num(r.quantite_tonnes),
  prixRendu: num(r.prix_rendu),
  rabais: num(r.rabais),
  incoterm: r.incoterm ?? "",
  type: r.type || "aucun",
  valeurReference: num(r.valeur_reference),
});

export const suiviDeviseFactureDto = (r) => ({
  id: r.id,
  suiviId: r.suivi_id,
  lotId: r.lot_id,
  ordre: r.ordre ?? 0,
  nFacture: r.n_facture ?? "",
  nSecondaire: r.n_secondaire ?? "",
  dateFacture: r.date_facture ? dateStr(r.date_facture) : null,
  modePaiement: r.mode_paiement ?? "",
  designationProduit: r.designation_produit ?? "",
  fournisseur: r.fournisseur ?? "",
  qteTonnes: num(r.qte_tonnes),
  pu: num(r.pu),
  montantTotal: num(r.montant_total),
  avoirMontant: r.avoir_montant == null ? null : num(r.avoir_montant),
  avoirDate: r.avoir_date ? dateStr(r.avoir_date) : null,
});

export const suiviDeviseMouvementDto = (r) => ({
  id: r.id,
  suiviId: r.suivi_id,
  lotId: r.lot_id,
  ordre: r.ordre ?? 0,
  type: r.type || "reglement",
  libelle: r.libelle ?? "",
  date: r.date ? dateStr(r.date) : null,
  montant: num(r.montant),
});

/**
 * Écart d'une facture rattachée à un lot à régime — reproduit exactement
 * les formules trouvées dans le fichier Excel réel du cabinet (onglet
 * BYOUT EZZ, vérifié au centime près contre son SOLDE affiché) :
 *   - "charges_trans_av" : qte_tonnes * (pu − valeur_reference) — l'écart
 *     entre le prix réellement facturé et un prix usine de référence par
 *     tonne (ex. `=-(E39*52)+G39`).
 *   - "avoir" : montant_total − valeur_reference — l'écart entre le
 *     montant facturé et un total forfaitaire de référence pour ce lot
 *     (ex. `=+G75-102000`).
 *   - "aucun" (incoterm EX WORK ou pas de régime) : aucun écart.
 */
function ecartFacture(facture, lot) {
  if (!lot) return 0;
  if (lot.type === "charges_trans_av")
    return facture.qteTonnes * (facture.pu - lot.valeurReference);
  if (lot.type === "avoir") return facture.montantTotal - lot.valeurReference;
  return 0;
}

/**
 * Assemble la fiche complète avec solde calculé — jamais stocké, recalculé
 * à chaque lecture (même principe que honoraireLignesDto).
 *
 * Grandeurs vérifiées au centime près contre le fichier Excel réel du
 * cabinet (onglet BYOUT EZZ, |solde| = 18 556,90 €) :
 *   solde = total ventes − (solde_ouverture + écarts des lots à régime
 *     (charges_trans_av et avoir, calculés facture par facture ci-dessus)
 *     + mouvements manuels (charges/avoirs/règlements)).
 * Convention : solde positif = le client doit encore ce montant ; négatif
 * = trop perçu/crédit en sa faveur. C'est l'inverse du signe du fichier
 * Excel d'origine (qui calcule `-TOTAL + règlements + ...`, donc négatif
 * quand le client doit) — même formule, signe choisi pour rester intuitif
 * dans l'appli plutôt que de reproduire le signe brut du fichier source.
 *
 * totalVentes ne compte QUE les factures sans lot (paiement "BANK
 * TRANSFER", suivi au solde). Une facture rattachée à un lot (référence
 * LC — le paiement est garanti par la lettre de crédit, pas par un
 * virement à surveiller) ne s'ajoute jamais à totalVentes : seul l'écart
 * de son lot (charges_trans_av/avoir) contribue au solde. Vérifié sur
 * BYOUT EZZ (TOTAL = SUM des 23 lignes "BANK TRANSFER", jamais des
 * lignes "LC:..." des lots) et BRAHIM (2) (même exclusion des 2 lignes
 * "LC205ILC2023/0400" de son TOTAL).
 */
export function suiviDeviseFullDto(suiviRow, lotRows, factureRows, mouvementRows) {
  const lots = lotRows.map(suiviDeviseLotDto).sort((a, b) => a.ordre - b.ordre);
  const factures = factureRows.map(suiviDeviseFactureDto).sort((a, b) => a.ordre - b.ordre);
  const mouvements = mouvementRows.map(suiviDeviseMouvementDto).sort((a, b) => a.ordre - b.ordre);

  const totalVentes = round2(
    factures.filter((f) => !f.lotId).reduce((s, f) => s + f.montantTotal, 0),
  );
  const totalVentesLots = round2(
    factures.filter((f) => f.lotId).reduce((s, f) => s + f.montantTotal, 0),
  );
  const totalCharges = round2(
    mouvements.filter((m) => m.type === "charge_transport").reduce((s, m) => s + m.montant, 0),
  );
  const totalAvoir = round2(
    mouvements.filter((m) => m.type === "avoir").reduce((s, m) => s + m.montant, 0),
  );
  const totalReglements = round2(
    mouvements.filter((m) => m.type === "reglement").reduce((s, m) => s + m.montant, 0),
  );

  const lotsAvecEcart = lots.map((l) => ({
    ...l,
    ecart: round2(
      factures
        .filter((f) => f.lotId === l.id)
        .reduce((s, f) => s + ecartFacture(f, l), 0),
    ),
  }));
  const totalEcartsLots = round2(lotsAvecEcart.reduce((s, l) => s + l.ecart, 0));

  const soldeOuverture = num(suiviRow.solde_ouverture);
  const solde = round2(
    totalVentes - (soldeOuverture + totalEcartsLots + totalCharges + totalAvoir + totalReglements),
  );

  return {
    ...suiviDeviseDto(suiviRow),
    lots: lotsAvecEcart,
    factures,
    mouvements,
    totalVentes,
    totalVentesLots,
    totalCharges,
    totalAvoir,
    totalReglements,
    totalEcartsLots,
    solde,
  };
}
