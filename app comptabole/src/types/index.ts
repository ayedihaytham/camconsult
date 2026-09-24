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

export interface CollecteSection {
  id: string;
  onglet: string;
  commentaire: string;
  /** Statut de récap de CE tableau précis — indépendant des autres, voir
   * les routes /collectes/:id/sections/:onglet/recap/*. */
  recapStatut: RecapStatut;
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
  note: string;
  /** montantDeclaration + honoraire, calculé côté serveur */
  total: number;
  /** cumul (montantDeclaration + honoraire − reglement) depuis la 1ère ligne de la société, calculé côté serveur */
  solde: number;
  creeLe: string;
  majLe: string;
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
  douaneReference: string;

  /** document source (PDF/image en data URL) conservé pour vérification */
  achatDocDataUrl: string | null;
  venteDocDataUrl: string | null;
  douaneDocDataUrl: string | null;

  note: string;
  /** Somme(achatLignes.quantite) - somme(venteLignes.quantite), calculé côté serveur */
  ecart: number;
  /** Le même écart, détaillé par désignation — voir StockEcartLigne */
  ecartParDesignation: StockEcartLigne[];
  creeLe: string;
  majLe: string;
}

export type StockDocType = "achat" | "vente" | "douane";

/** Champs extraits d'une page (OCR/IA) pour un type de document donné —
 * `lignes` seulement pour achat/vente (jamais douane). */
export interface StockChamps {
  date?: string;
  numFacture?: string;
  fournisseur?: string;
  client?: string;
  devise?: string;
  lignes?: StockLigne[];
  numDeclaration?: string;
  regime?: string;
  reference?: string;
}

export interface StockExtractResult {
  source: "texte" | "ocr";
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
