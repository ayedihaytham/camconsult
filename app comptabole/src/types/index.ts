export type SocieteTheme =
  | "PME"
  | "Grande entreprise"
  | "Association"
  | "Profession libérale"
  | "Auto-entrepreneur";

export type Statut = "actif" | "inactif" | "en_attente";

export interface Societe {
  id: string;
  raisonSociale: string;
  rne: string;
  tva: string;
  theme: SocieteTheme;
  code: string;
  /** @deprecated l'authentification société a été retirée */
  identifiant?: string;
  /** @deprecated l'authentification société a été retirée */
  motDePasse?: string;
  statut: Statut;
  telephone: string;
  email: string;
  adresse: string;
  creeLe: string; // ISO
}

export type EmployeType = "Comptable" | "Assistant" | "Stagiaire" | "Gestionnaire de paie";

/** collaborateur = équipe interne du cabinet ; societe_employe = employé
 * d'une société cliente ; responsable_collaborateurs = chef d'équipe —
 * gère les collaborateurs et voit toutes les sociétés comme l'admin, mais
 * sans Journal/Paramètres/État client/Bordereaux (voir usePermissions). */
export type EmployeRole =
  | "collaborateur"
  | "societe_employe"
  | "responsable_collaborateurs";

export type PermissionKey =
  | "consulterDossiers"
  | "deposerFichiers"
  | "modifierSocietes"
  | "supprimer"
  | "messagerie";

export type EmployePermissions = Record<PermissionKey, boolean>;

export interface Employe {
  id: string;
  nom: string;
  prenom: string;
  identifiant: string;
  motDePasse: string;
  type: EmployeType;
  role: EmployeRole;
  /** défini uniquement pour role = "societe_employe" */
  societeId?: string | null;
  email: string;
  statut: Statut;
  societesAssignees: string[]; // ids de sociétés (role = "collaborateur")
  permissions: EmployePermissions;
  /** true = doit changer son mot de passe à la prochaine connexion (1ère
   * connexion, ou après une réinitialisation par l'admin/le responsable). */
  doitChangerMotDePasse?: boolean;
  /** role = "societe_employe" uniquement : délégué de société (placé sous le
   * responsable, reçoit ses tâches) plutôt que responsable. */
  delegue?: boolean;
  derniereConnexion?: string | null; // ISO
  creeLe: string;
}

export type TacheStatut = "a_faire" | "en_cours" | "termine";

export interface Tache {
  id: string;
  titre: string;
  description: string;
  societeId: string;
  assigneId: string | null; // id d'un collaborateur (ou d'un délégué, origine "societe")
  statut: TacheStatut;
  /** "cabinet" : admin → collaborateur ; "societe" : responsable de société
   * → délégué (visible par le cabinet, en lecture seule). */
  origine: TacheOrigine;
  module: TacheModule | null;
  creePar: string;
  creeLe: string; // ISO
  majLe: string; // ISO
  termineLe: string | null; // ISO
}

export type TacheOrigine = "cabinet" | "societe";
export type TacheModule = "collectes" | "structuration" | "messagerie";

export const TACHE_MODULE_LABELS: Record<TacheModule, string> = {
  collectes: "Collecte de pièces",
  structuration: "Structuration",
  messagerie: "Messagerie",
};

export const TACHE_STATUT_LABELS: Record<TacheStatut, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
};

export type NotificationType =
  | "tache_assignee"
  | "tache_statut"
  | "tache_modifiee"
  | "document"
  | "societe"
  | "compte"
  | "acces"
  | "message"
  | "collecte";

// ── Collecte de pièces ────────────────────────────
export type CollecteStatut =
  | "brouillon"
  | "transmis"
  | "valide"
  | "a_corriger"
  | "archive";
export type RecapStatut = "none" | "envoye" | "repondu";
/** Circuit d'un tableau de la collecte : à remplir, transmis au cabinet, à corriger (renvoyé), validé, archivé. */
export type SectionStatut = "brouillon" | "transmis" | "a_corriger" | "valide" | "archive";

export interface CollecteSection {
  id: string;
  onglet: string;
  commentaire: string;
  /** Statut de récap de CE tableau précis — indépendant des autres, voir
   * les routes /collectes/:id/sections/:onglet/recap/*. */
  recapStatut: RecapStatut;
  /** Pièce cochée « reçue » à la main, sans lignes saisies dans le tableau. */
  recuManuel: boolean;
  /** Date de suivi saisie (AAAA-MM-JJ), sinon calculée à partir du tableau. */
  dateSuivi: string | null;
  /** Total saisi à la main, quand le tableau n'a pas de lignes pour le calculer. */
  totalSaisi: number | null;
  statut: SectionStatut;
  transmisLe: string | null;
  valideLe: string | null;
  /** Ce que le cabinet demande de corriger ou compléter quand il renvoie le tableau. */
  motifRenvoi: string;
}

export type CollecteNoteKind = "note" | "manque" | "reponse";

export interface CollecteNote {
  id: string;
  onglet: string;
  kind: CollecteNoteKind;
  parentId: string | null;
  auteur: "admin" | "client";
  ref: string;
  /** kind=manque : index de ligne visée (null = tableau entier) */
  cibleOrdre: number | null;
  /** kind=manque : clé de colonne visée (null = tableau entier) */
  cibleCol: string | null;
  texte: string;
  resolu: boolean;
  creeLe: string;
}

export interface CollecteLigne {
  id: string;
  onglet: string;
  ordre: number;
  data: Record<string, unknown>;
}

export interface CollecteFichier {
  id: string;
  onglet: string;
  nom: string;
  format: string;
  taille: string;
  dataUrl?: string;
  deposePar: string;
  creeLe: string;
}

export interface CollecteJournalEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  label: string;
}

export interface Collecte {
  id: string;
  societeId: string;
  /** Tableaux transmis par le client et en attente d'examen, tableaux validés ou archivés (liste des collectes seulement). */
  tableauxTransmis?: number;
  tableauxValides?: number;
  tableauxArchives?: number;
  periode: string;
  statut: CollecteStatut;
  onglets: string[];
  devise: string;
  /** Date limite de transmission par le client (AAAA-MM-JJ), facultative. */
  echeance: string | null;
  derniereRelanceLe: string | null;
  /** Nombre de jours entre deux relances automatiques (défaut 3). */
  relanceCadenceJours: number;
  creeLe: string;
  majLe: string;
  transmisLe: string | null;
  valideLe: string | null;
}

export interface CollecteFull extends Collecte {
  sections: CollecteSection[];
  lignes: CollecteLigne[];
  notes: CollecteNote[];
  fichiers: CollecteFichier[];
}

// ── Bordereaux bancaires (registre interne cabinet) ──
export type BordereauType = "virement" | "remise_traite" | "remise_cheque";
export type BordereauVolet = "client" | "fournisseur";

export interface BordereauLigne {
  id?: string;
  ordre: number;
  cheque: string;
  tiers: string;
  montant: number;
  facture: string;
  remarque: string;
}

export interface Bordereau {
  id: string;
  type: BordereauType;
  volet: BordereauVolet;
  numero: string;
  dateOperation: string | null;
  pointe: boolean;
  note: string;
  creeLe: string;
  majLe: string;
  lignes: BordereauLigne[];
}

export const BORDEREAU_TYPE_LABELS: Record<BordereauType, string> = {
  virement: "Virements",
  remise_traite: "Remises de traites",
  remise_cheque: "Remises de chèques",
};

export const BORDEREAU_VOLET_LABELS: Record<BordereauVolet, string> = {
  client: "Clients (411)",
  fournisseur: "Fournisseurs (401)",
};

// ── Facturation (factures d'honoraires du cabinet) ──
export type FactureStatut = "emise" | "payee" | "annulee";

export interface FactureLigne {
  id?: string;
  ordre: number;
  description: string;
  quantite: number;
  montantHt: number;
}

export interface Facture {
  id: string;
  societeId: string;
  societeNom: string;
  clientAdresse: string;
  clientTva: string;
  clientRne: string;
  numero: string;
  dateEmission: string;
  echeance: string | null;
  tvaTaux: number;
  timbre: number;
  statut: FactureStatut;
  payeLe: string | null;
  signeeLe: string | null;
  note: string;
  /** Totaux calculés par le serveur depuis les lignes. */
  totalHt: number;
  tva: number;
  netAPayer: number;
  creeLe: string;
  lignes: FactureLigne[];
}

/** Coordonnées du cabinet imprimées sur les factures. */
export interface FactureCabinet {
  nom: string;
  adresse: string;
  matriculeFiscal: string;
  telephone: string;
  email: string;
  rib: string;
  mentions: string;
}

export const FACTURE_STATUT_LABELS: Record<FactureStatut, string> = {
  emise: "Émise",
  payee: "Payée",
  annulee: "Annulée",
};

// ── État client (honoraires, par société) ─────────
export type HonoraireType =
  | "mensuelle"
  | "trimestrielle"
  | "annuelle"
  | "acompte1"
  | "acompte2"
  | "acompte3"
  | "autre";

export const HONORAIRE_TYPE_LABELS: Record<HonoraireType, string> = {
  mensuelle: "Mensuelle",
  trimestrielle: "Trimestrielle",
  annuelle: "Annuelle",
  acompte1: "Acompte 1",
  acompte2: "Acompte 2",
  acompte3: "Acompte 3",
  autre: "Autre",
};

export interface HonoraireLigne {
  id: string;
  societeId: string;
  ordre: number;
  type: HonoraireType;
  nature: string;
  periode: string;
  libelle: string;
  cnss: string;
  numQuittance: string;
  montantDeclaration: number;
  honoraire: number;
  reglement: number;
  /** Date de réception du règlement (AAAA-MM-JJ), si connue. */
  dateReglement: string | null;
  note: string;
  /** Pièce jointe (fichier de l'ordinateur) — le contenu ne vient jamais avec
   * la ligne : GET /honoraires/:id/piece à la demande. */
  pieceNom: string;
  pieceFormat: string;
  pieceTaille: string;
  aPiece: boolean;
  /** montantDeclaration + honoraire, calculé côté serveur */
  total: number;
  /** cumul (montantDeclaration + honoraire − reglement) depuis la 1ère ligne de la société, calculé côté serveur */
  solde: number;
  creeLe: string;
  majLe: string;
}

/** Une ligne du récapitulatif de tous les clients (état client) : totaux d'une société. */
export interface HonoraireRecapClient {
  societeId: string;
  raisonSociale: string;
  code: string;
  statut: Statut;
  nbLignes: number;
  /** Montants déclarés (à reverser), honoraires, leur somme, règlements reçus et solde dû. */
  declare: number;
  honoraires: number;
  total: number;
  reglements: number;
  solde: number;
  dernierReglement: string | null;
}

// ── Gestion de stock (par société) ────────────────
/** Une ligne de produit d'un mouvement (achat ou vente) — une facture peut
 * en lister plusieurs, avec des quantités différentes, pas une seule. */
export interface StockLigne {
  id?: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  montantDevise: number;
  montantTnd: number;
  /** Unité de la quantité : "T" (tonnes), "KG" (kilos) ou vide. */
  unite?: string;
}

/** Écart entre achat et vente pour une même désignation (produit) au sein
 * d'un mouvement — calculé côté serveur en regroupant les lignes. */
export interface StockEcartLigne {
  designation: string;
  achatQuantite: number;
  venteQuantite: number;
  ecart: number;
}

export interface StockMouvement {
  id: string;
  societeId: string;
  ordre: number;
  natureMarchandise: string;

  achatDate: string | null;
  achatNumFacture: string;
  achatDocType: string;
  fournisseur: string;
  achatDevise: string;
  achatCours: number;
  achatLignes: StockLigne[];

  venteDate: string | null;
  venteNumFacture: string;
  venteDocType: string;
  client: string;
  venteDevise: string;
  venteCours: number;
  venteLignes: StockLigne[];

  douaneNumDeclaration: string;
  douaneDate: string | null;
  douaneRegime: string;
  /** Type de déclaration (case « Type déclaration » de la déclaration douanière, ex. E). */
  douaneTypeDeclaration: string;
  douaneReference: string;
  /** Taux de change douanier (TND pour 1 unité de devise) et valeur en douane (TND). */
  douaneTauxChange: number;
  douaneValeurTnd: number;
  /** PTFN déclaré, exportateur et importateur de la déclaration douanière. */
  douanePtfn: number;
  douaneExportateur: string;
  douaneImportateur: string;

  /** document source (PDF/image en data URL) conservé pour vérification */
  achatDocDataUrl: string | null;
  venteDocDataUrl: string | null;
  douaneDocDataUrl: string | null;

  note: string;
  /** Somme(achatLignes.quantite) - somme(venteLignes.quantite), calculé côté serveur */
  ecart: number;
  /** Unité dans laquelle l'écart est exprimé (tonnes si achat et vente diffèrent d'unité). */
  ecartUnite: string;
  /** Le même écart, détaillé par désignation — voir StockEcartLigne */
  ecartParDesignation: StockEcartLigne[];
  creeLe: string;
  majLe: string;
}

export type StockDocType = "achat" | "vente" | "douane";

/** Champs extraits d'une page (moteur RUSPINA ou modèle de vision) pour un type de document donné —
 * `lignes` seulement pour achat/vente (jamais douane). */
export interface StockChamps {
  date?: string;
  numFacture?: string;
  fournisseur?: string;
  client?: string;
  devise?: string;
  lignes?: StockLigne[];
  numDeclaration?: string;
  typeDeclaration?: string;
  reference?: string;
  tauxChange?: number;
  valeurTnd?: number;
  ptfn?: number;
  exportateur?: string;
  importateur?: string;
}

export interface StockExtractResult {
  source: "ia" | "ruspina";
  texte: string;
  champs: StockChamps;
}

export type StockDocConfidence = "haute" | "moyenne" | "faible";

/** Une page d'un import "document complet" (PDF combinant plusieurs pièces
 * — ex. facture d'achat + facture de vente + déclaration douanière
 * scannées ensemble) : type deviné à confirmer/corriger avant application. */
export interface StockExtractPage {
  index: number;
  imageDataUrl: string | null;
  guessedType: StockDocType | null;
  confidence: StockDocConfidence | null;
  /** Champs déjà calculés pour les 3 types possibles (voir server/ocr.js) —
   * corriger le type deviné à l'écran n'a besoin d'aucun aller-retour
   * serveur, le bon jeu de champs est toujours prêt. */
  champsByType: Record<StockDocType, StockChamps>;
  /** Informations lues par le moteur RUSPINA qui n'ont pas de champ dans le
   * mouvement (page douane : exportateur, importateur, taux, valeur). */
  details?: Record<string, string | number>;
}

// ── États financiers : balance par société/exercice, reclassée par
// code AFFECTAT (grille de reclassement cabinet) ──
export interface BalanceLigne {
  id: string;
  ordre: number;
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
  affectat: string;
  /** debit - credit, calculé côté serveur (jamais stocké). */
  solde: number;
}

export interface Balance {
  id: string;
  societeId: string;
  exercice: string;
  note: string;
  creeLe: string;
  majLe: string;
}

export interface BalanceFull extends Balance {
  lignes: BalanceLigne[];
}

// ── Suivi client devise ───────────────────────────
export interface SuiviDevise {
  id: string;
  societeId: string;
  client: string;
  exercice: string;
  devise: string;
  note: string;
  /** Report manuel de l'exercice précédent (ex. "Avoir 31/12/2022"), inclus
   * tel quel dans le solde — jamais recalculé. */
  soldeOuverture: number;
  creeLe: string;
  majLe: string;
}

export type SuiviDeviseLotType = "aucun" | "charges_trans_av" | "avoir";

export interface SuiviDeviseLot {
  id: string;
  suiviId: string;
  ordre: number;
  libelle: string;
  quantiteTonnes: number;
  prixRendu: number;
  rabais: number;
  incoterm: string;
  /** Régime du lot : "aucun" (EX WORK, pas d'écart), "charges_trans_av"
   * (écart par tonne) ou "avoir" (écart par facture) — voir valeurReference. */
  type: SuiviDeviseLotType;
  /** Selon type : prix de référence par tonne (charges_trans_av) ou total
   * forfaitaire de référence du lot (avoir). */
  valeurReference: number;
  /** Calculé côté serveur à partir des factures du lot et de son régime. */
  ecart: number;
}

export interface SuiviDeviseFacture {
  id: string;
  suiviId: string;
  lotId: string | null;
  ordre: number;
  nFacture: string;
  nSecondaire: string;
  dateFacture: string | null;
  modePaiement: string;
  designationProduit: string;
  fournisseur: string;
  qteTonnes: number;
  pu: number;
  montantTotal: number;
  avoirMontant: number | null;
  avoirDate: string | null;
  /** Vente du stock dont cette facture est la reprise : ses champs se lisent sur le mouvement de stock. */
  mouvementStockId: string | null;
  /** Facture d'achat du même mouvement de stock (reprises du stock seulement). */
  achatNumFacture: string;
  achatDate: string | null;
  achatDevise: string;
  achatMontant: number | null;
}

/** Client de la gestion de stock sans fiche : ses ventes d'une année et d'une devise, à suivre. */
export interface SuiviDeviseStockClient {
  client: string;
  devise: string;
  exercice: string;
  nbFactures: number;
  montantTotal: number;
}

/** Vente de la gestion de stock que la fiche peut reprendre comme facture. */
export interface SuiviDeviseStockVente {
  mouvementId: string;
  client: string;
  nFacture: string;
  dateFacture: string | null;
  designationProduit: string;
  fournisseur: string;
  qteTonnes: number;
  pu: number;
  montantTotal: number;
  achatNumFacture: string;
  achatDate: string | null;
  achatDevise: string;
  achatMontant: number;
}

export type SuiviDeviseMouvementType = "charge_transport" | "avoir" | "reglement";

export interface SuiviDeviseMouvement {
  id: string;
  suiviId: string;
  lotId: string | null;
  ordre: number;
  type: SuiviDeviseMouvementType;
  libelle: string;
  date: string | null;
  montant: number;
}

export interface SuiviDeviseFull extends SuiviDevise {
  lots: SuiviDeviseLot[];
  factures: SuiviDeviseFacture[];
  mouvements: SuiviDeviseMouvement[];
  /** Factures sans lot (paiement "BANK TRANSFER") — seules celles-ci comptent dans le solde. */
  totalVentes: number;
  /** Informatif seulement : factures rattachées à un lot (LC), déjà couvertes par
   * l'écart de leur lot — jamais ajoutées à totalVentes ni au solde. */
  totalVentesLots: number;
  /** Mouvements manuels de type charge_transport (hors écarts de lot). */
  totalCharges: number;
  /** Mouvements manuels de type avoir (hors écarts de lot). */
  totalAvoir: number;
  totalReglements: number;
  /** Somme des écarts calculés de tous les lots à régime. */
  totalEcartsLots: number;
  solde: number;
}

/** Un point de la table 4 : total du solde pour un code AFFECTAT donné. */
export interface AffectatSynthese {
  code: string;
  libelle: string;
  solde: number;
}

export interface GrilleAffectatCode {
  code: string;
  libelle: string;
  /** Clé de poste Bilan/Etat de résultat (voir src/lib/etatsFinanciers/postes.ts), vide si non assigné. */
  poste: string;
  majLe: string;
}

export interface GrilleCompte {
  compte: string;
  affectatCode: string;
  libelleCompte: string;
  majLe: string;
}

// ── États financiers, étape 3 : mouvements non déductibles de la seule
// balance de fin d'exercice — saisie manuelle dédiée ──
export type ImmoMasse = "incorporelles" | "corporelles" | "financieres";

export interface ImmoMouvement {
  societeId: string;
  exercice: string;
  masse: ImmoMasse;
  acquisitions: number;
  cessions: number;
  dotations: number;
  reprises: number;
  majLe: string;
}

export interface FinancementMouvement {
  societeId: string;
  exercice: string;
  empruntsContractes: number;
  empruntsRembourses: number;
  dividendesDistribues: number;
  capitalNumeraire: number;
  /** Ajustement d'exploitation du Flux (méthode indirecte) — ne se déduit
   * pas de la balance, saisi ici comme les autres mouvements manuels. */
  interetsCourusNonEchus: number;
  majLe: string;
}

export type TdrfKind = "reintegration" | "deduction";

export interface TdrfLigne {
  id: string;
  societeId: string;
  exercice: string;
  ordre: number;
  kind: TdrfKind;
  libelle: string;
  montant: number;
  majLe: string;
}

export interface TdrfParametres {
  societeId: string;
  exercice: string;
  chiffreAffairesLocal: number;
  chiffreAffairesExport: number;
  tauxImposition: number;
  tauxExport: number;
  tauxMinimum: number;
  plancherMinimum: number;
  contributionSociale: number;
  excedentsAcomptes: number;
  // Réintégrations (Annexe n°2, note commune n°26/2016)
  pertesChangeNonRealisees: number;
  gainsChangeNonRealisesAnterieurs: number;
  remunerationsExcedentairesTitres: number;
  chargesEspeces5000: number;
  moinsValueCessionTitresOpcvm: number;
  impotsDirectsLieuAutrui: number;
  taxeVoyage: number;
  transactionsAmendesPenalites: number;
  depensesEssaimage: number;
  facturesNonParvenues: number;
  amortissementsBiensReevalues: number;
  provisionsNonDeductibles: number;
  provisionsCreancesDouteusesReintegrees: number;
  // Déductions (cascade — voir computeTdrf)
  produitsEtranger: number;
  provisionsCreancesDouteuses: number;
  provisionsDeprecStocksVente: number;
  provisionsDeprecActionsCotees: number;
  provisionsNonExigibiliteEngagements: number;
  moinsValueLeveeOption: number;
  reintegrationAmortissementsExercice: number;
  deductionDeficitsReportes: number;
  deductionAmortissementsExercice: number;
  deductionAmortissementsDifferes: number;
  interetsDepotsTitresDevises: number;
  // Contribution sociale de solidarité / impôts à payer
  excedentsAnterieurs: number;
  acomptesProvisionnelsPayes: number;
  retenueALaSource: number;
  avanceIrppImport: number;
  majLe: string | null;
}

// ── Notes aux états financiers (étape 4) ──
export interface NotesModele {
  texte: string;
  majLe: string | null;
}

export interface ObjetSocialBloc {
  titre: string;
  texte: string;
}

export interface Associe {
  nom: string;
  valeurParts: number;
  parts: number;
}

export interface FicheSociete {
  societeId: string;
  formeJuridique: string;
  statutFiscal: string;
  dateCreation: string | null;
  capitalInitial: number;
  partsInitiales: number;
  valeurNominale: number;
  objetSocial: ObjetSocialBloc[];
  associes: Associe[];
  majLe: string | null;
}

export interface BlocLibre {
  titre: string;
  texte: string;
}

export interface NotesExercice {
  societeId: string;
  exercice: string;
  texteOverride: string;
  blocsLibres: BlocLibre[];
  majLe: string | null;
}

/** Une ligne du détail par compte (Clients, Fournisseurs, Liquidités...) —
 * regroupée par compte pour un poste et un exercice donnés. */
export interface DetailCompteLigne {
  exercice: string;
  poste: string;
  compte: string;
  libelle: string;
  solde: number;
}

// ── Registre d'immobilisations (étape 5) ──
export type ImmoMasseCategorie = "incorporelle" | "corporelle";

export interface ImmoCategorie {
  id: string;
  nom: string;
  taux: number;
  masse: ImmoMasseCategorie;
  majLe: string;
}

export interface ImmoBien {
  id: string;
  societeId: string;
  categorieId: string;
  libelle: string;
  dateAcquisition: string;
  coutAcquisition: number;
  taux: number;
  dateCession: string | null;
  valeurCession: number;
  majLe: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  titre: string;
  corps: string;
  lien: string;
  lu: boolean;
  creeLe: string; // ISO
}

export type NoeudType = "dossier" | "fichier";

export interface Noeud {
  id: string;
  libelle: string;
  description: string;
  type: NoeudType;
  societeId: string | null;
  parentId: string | null;
  format?: string; // pdf, xlsx…
  taille?: string; // "1,2 Mo"
  /** Contenu encodé (data URL) — seulement quand on vient de l'envoyer ; sinon
   * absent des listes et chargé à la demande (voir lib/contenus.ts). */
  dataUrl?: string;
  /** true si le serveur conserve un contenu téléchargeable pour ce fichier. */
  aContenu?: boolean;
  creeLe: string;
  majLe: string;
}

export type MessageStatut = "envoye" | "lu";

export interface Message {
  id: string;
  conversationId: string;
  auteurId: string; // "me" pour le comptable connecté
  contenu: string;
  envoyeLe: string;
  statut: MessageStatut;
  pieceJointe?: {
    libelle: string;
    /** Nouveau format — fichier joint directement au message (PC ou téléphone).
     * Absent des listes : chargé à la demande (voir lib/contenus.ts). */
    dataUrl?: string;
    /** true si le serveur conserve le contenu de cette pièce jointe. */
    aContenu?: boolean;
    mime?: string;
    tailleOctets?: number;
    /** Ancien format — référence à un document déjà présent dans la Structuration. */
    noeudId?: string;
  };
}

export type ConversationType = "direct" | "groupe";

export interface Conversation {
  id: string;
  type: ConversationType;
  titre?: string; // groupes
  membreIds?: string[]; // groupes
  employeId: string | null; // null pour un groupe
  societeId: string | null; // conversation directe liée à un dossier/société
  dernierMessage: string;
  dernierMessageLe: string;
  nonLus: number;
  enLigne: boolean;
  derniereConnexion?: string | null; // conversation directe : dernière connexion de l'employé
}

/** Enregistrement serveur d'une conversation de groupe. */
export interface GroupConversation {
  id: string;
  type: "groupe";
  titre: string;
  membreIds: string[];
  creeLe: string;
}

// ── État de souche de chèques ─────────────────────
export type SoucheChequeDevise = "TND" | "EUR" | "USD";

export interface SoucheCheque {
  id: string;
  societeId: string;
  ordre: number;
  banque: string;
  /** Texte : garde les zéros de tête (« 0000001 »). */
  numCheque: string;
  dateEmission: string | null;
  beneficiaire: string;
  motif: string;
  montant: number;
  devise: SoucheChequeDevise;
  debite: boolean;
  /** Renseignée seulement si le chèque est débité. */
  dateDebit: string | null;
  creeLe: string;
  majLe: string;
}

// ── Suivi fournisseur ─────────────────────────────────────────────────────

/** Informations de suivi d'une facture d'achat (proforma, titre, chargement). */
export interface FactureSuivi {
  numProforma: string;
  dateProforma: string | null;
  montantProforma: number;
  /** Quantité de la proforma (tonnes), pour suivre ce qui reste à facturer. */
  qteProforma: number;
  etatProforma: string;
  numTitre: string;
  etatChargement: string;
  vuPasse: string;
}

/** Facture d'achat d'un fournisseur : le côté achat d'un mouvement de stock. */
export interface FactureFournisseur {
  /** Id du mouvement de stock. */
  id: string;
  fournisseur: string;
  fournisseurCle: string;
  numFacture: string;
  date: string | null;
  devise: string;
  cours: number;
  quantite: number;
  designation: string;
  prixUnitaire: number;
  montant: number;
  montantTnd: number;
  venteNumFacture: string;
  douaneNumDeclaration: string;
  suivi: FactureSuivi;
}

export type ModeReglement = "virement" | "cheque" | "effet" | "especes" | "autre";

export interface ReglementAffectation {
  mouvementId: string;
  montant: number;
}

export interface ReglementFournisseur {
  id: string;
  fournisseurCle: string;
  date: string | null;
  mode: ModeReglement;
  reference: string;
  banque: string;
  devise: string;
  cours: number;
  rsTaux: number;
  rsNumero: string;
  rsMontant: number;
  note: string;
  /** Mouvement bancaire qui a payé ce règlement (rapprochement). */
  mouvementBancaireId: string | null;
  /** Total des factures couvertes, retenue à la source comprise. */
  brut: number;
  /** Montant réellement viré : brut − retenue à la source. */
  vire: number;
  affectations: ReglementAffectation[];
}

export interface EtatFournisseurs {
  factures: FactureFournisseur[];
  reglements: ReglementFournisseur[];
}

// ── Suivi bancaire ────────────────────────────────────────────────────────

export type TypeMouvementBancaire = "encaissement_client" | "paiement_fournisseur" | "frais" | "credit" | "change" | "autre";

export interface CompteBancaire {
  id: string;
  banque: string;
  devise: string;
  numero: string;
  soldeDepart: number;
  dateDepart: string | null;
  /** Solde indiqué par le relevé de la banque, pour contrôler le solde calculé. */
  soldeReel: number | null;
  dateReel: string | null;
}

/** Mouvement d'un compte : débit et crédit sont ceux de la banque (le débit sort du compte). */
export interface MouvementBancaire {
  id: string;
  compteId: string;
  dateOp: string;
  dateValeur: string | null;
  libelle: string;
  details: string;
  reference: string;
  numPiece: string;
  debit: number;
  credit: number;
  type: TypeMouvementBancaire;
  /** Cours d'une opération de change (TND pour 1 unité de devise), lu dans le libellé ou la pièce. */
  cours: number | null;
  /** Règlement fournisseur rapproché de ce mouvement. */
  reglementId: string | null;
  fournisseurCle: string | null;
}

export interface EtatBanque {
  comptes: CompteBancaire[];
  mouvements: MouvementBancaire[];
}

// ── Cours de change (moyenne mensuelle du marché interbancaire) ──
export interface DeviseChange {
  code: string;
  libelle: string;
  /** Nombre d'unités de devise pour lesquelles le cours est donné (1 pour l'USD, 1000 pour le JPY). */
  unite: number;
  ordre: number;
}

export interface CoursChange {
  devise: string;
  annee: number;
  /** 1 à 12 */
  mois: number;
  /** TND pour `unite` unités de la devise. */
  cours: number;
}
