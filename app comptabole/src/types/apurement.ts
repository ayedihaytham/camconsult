export type ApurementKind =
  | "autorisations"
  | "fournisseurs"
  | "bcs"
  | "factures";
export type Quarter = "T1" | "T2" | "T3" | "T4";
export interface ApurementRecord {
  source?: "manuel" | "stock" | "import";
  id: string;
  societeId: string;
  version: number;
  numero?: string;
  raisonSociale?: string;
  numeroFacture?: string;
  fournisseurId?: string;
  autorisationId?: string;
  bcId?: string | null;
  montantHtMillimes?: string;
  tvaSuspendueMillimes?: string;
  tvaCalculeeMillimes?: string;
  tauxTvaBps?: number;
  tvaMode?: "auto" | "manuel";
  motifCorrection?: string;
  dateFacture?: string | null;
  datePrecision?: "day" | "month" | "unknown";
  dateBrute?: string;
  dateBc?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  plafondHtMillimes?: string | null;
  plafondTvaMillimes?: string | null;
  objet?: string;
  description?: string;
  statutInterne?: string;
  matriculeFiscalRaw?: string;
  matriculeFiscalNormalise?: string | null;
  aliases?: string[];
  annee?: number;
  trimestre?: Quarter;
  motifPeriode?: string;
  stockMouvementId?: string | null;
  conflit?: unknown;
}
export interface ApurementList {
  items: ApurementRecord[];
  page: number;
  size: number;
  total: number;
  hasMore: boolean;
}
export interface ApurementSummary {
  id: string;
  raisonSociale: string;
  factures: number;
  bcs: number;
  ht: string;
  tva: string;
}
export interface ApurementControl {
  code: string;
  severity: "blocage" | "avertissement";
  message: string;
  factureId: string;
  fingerprint: string;
  ack: { motif: string; acteur: string } | null;
}
export interface ApurementControls {
  total: number;
  page: number;
  hasMore: boolean;
  controls: ApurementControl[];
  totals: { ht: string; tvaLignes: string; tvaGlobale: string; ecart: string };
  provisoire: boolean;
}
