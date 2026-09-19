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
  role: r.role === "societe_employe" ? "societe_employe" : "collaborateur",
  societeId: r.societe_id ?? null,
  email: r.email,
  statut: r.statut,
  societesAssignees: Array.isArray(r.societes_assignees)
    ? r.societes_assignees
    : [],
  permissions: r.permissions || {},
  derniereConnexion: isoOrNull(r.last_login),
  creeLe: dateStr(r.cree_le),
});

export const tacheDto = (r) => ({
  id: r.id,
  titre: r.titre,
  description: r.description ?? "",
  societeId: r.societe_id,
  assigneId: r.assigne_id ?? null,
  statut: r.statut,
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

export const collecteDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  periode: r.periode,
  statut: r.statut,
  recapStatut: r.recap_statut ?? "none",
  onglets: Array.isArray(r.onglets) ? r.onglets : [],
  devise: r.devise ?? "EUR",
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

export const stockMouvementDto = (r) => ({
  id: r.id,
  societeId: r.societe_id,
  ordre: r.ordre ?? 0,
  natureMarchandise: r.nature_marchandise ?? "",

  achatDate: r.achat_date ? dateStr(r.achat_date) : null,
  achatNumFacture: r.achat_num_facture ?? "",
  achatDocType: r.achat_doc_type ?? "",
  fournisseur: r.fournisseur ?? "",
  achatQuantite: num(r.achat_quantite),
  achatPu: num(r.achat_pu),
  achatMontantDevise: num(r.achat_montant_devise),
  achatDevise: r.achat_devise ?? "EUR",
  achatCours: num(r.achat_cours),
  achatMontantTnd: num(r.achat_montant_tnd),

  venteDate: r.vente_date ? dateStr(r.vente_date) : null,
  venteNumFacture: r.vente_num_facture ?? "",
  venteDocType: r.vente_doc_type ?? "",
  client: r.client ?? "",
  venteQuantite: num(r.vente_quantite),
  ventePu: num(r.vente_pu),
  venteMontantDevise: num(r.vente_montant_devise),
  venteDevise: r.vente_devise ?? "EUR",
  venteCours: num(r.vente_cours),
  venteMontantTnd: num(r.vente_montant_tnd),

  douaneNumDeclaration: r.douane_num_declaration ?? "",
  douaneDate: r.douane_date ? dateStr(r.douane_date) : null,
  douaneRegime: r.douane_regime ?? "",
  douaneReference: r.douane_reference ?? "",

  achatDocDataUrl: r.achat_doc_data_url ?? null,
  venteDocDataUrl: r.vente_doc_data_url ?? null,
  douaneDocDataUrl: r.douane_doc_data_url ?? null,

  note: r.note ?? "",
  ecart: Math.round((num(r.achat_quantite) - num(r.vente_quantite)) * 1000) / 1000,
  creeLe: isoOrNull(r.cree_le),
  majLe: isoOrNull(r.maj_le),
});

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
