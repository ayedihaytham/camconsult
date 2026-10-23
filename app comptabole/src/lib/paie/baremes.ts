/**
 * Barèmes de paie tunisiens utilisés par la simulation (CNSS, IRPP, CSS, déductions). Tous les montants sont en MILLIMES entiers
 * (1 DT = 1 000 millimes) et tous les taux en POINTS DE BASE (968 = 9,68 %), pour éviter tout calcul en virgule flottante.
 * Les déductions, le taux patronal, la TFP / le FOPROLOS et le fonds de 0,5 % restent à faire valider : voir docs/simulation-paie.md.
 */

export const DT = 1000;

export interface Tranche {
  /** Borne haute (exclue) du revenu imposable annuel, en millimes ; null pour la dernière tranche (sans limite). */
  jusqua: number | null;
  /** Taux de la tranche, en points de base. */
  tauxBp: number;
}

export interface Bareme {
  annee: number;
  /** Date d'effet (AAAA-MM-JJ) : le barème applicable à un mois est celui dont la date d'effet est la plus récente, au plus tard le dernier jour du mois. */
  dateEffet: string;
  cnssSalarieBp: number;
  cnssPatronaleBp: number;
  cssBp: number;
  /** Revenu imposable annuel (millimes) jusqu'auquel la CSS est exonérée (inclus) ; null : aucune exonération. */
  cssSeuilExoneration: number | null;
  fraisProBp: number;
  fraisProPlafond: number;
  deductionChefFamille: number;
  deductionParEnfant: number;
  enfantsMax: number;
  tranches: Tranche[];
}

const dt = (n: number) => n * DT;

const TRANCHES_2022: Tranche[] = [
  { jusqua: dt(5_000), tauxBp: 0 },
  { jusqua: dt(20_000), tauxBp: 2600 },
  { jusqua: dt(30_000), tauxBp: 2800 },
  { jusqua: dt(40_000), tauxBp: 3200 },
  { jusqua: null, tauxBp: 3500 },
];

const TRANCHES_2025: Tranche[] = [
  { jusqua: dt(5_000), tauxBp: 0 },
  { jusqua: dt(10_000), tauxBp: 1500 },
  { jusqua: dt(20_000), tauxBp: 2500 },
  { jusqua: dt(30_000), tauxBp: 3000 },
  { jusqua: dt(40_000), tauxBp: 3300 },
  { jusqua: dt(50_000), tauxBp: 3600 },
  { jusqua: dt(70_000), tauxBp: 3800 },
  { jusqua: null, tauxBp: 4000 },
];

const COMMUN = {
  fraisProBp: 1000,
  fraisProPlafond: dt(2_000),
  deductionChefFamille: dt(300),
  deductionParEnfant: dt(100),
  enfantsMax: 4,
};

export const BAREMES: Bareme[] = [
  { annee: 2022, dateEffet: "2022-01-01", cnssSalarieBp: 918, cnssPatronaleBp: 1657, cssBp: 100, cssSeuilExoneration: null, tranches: TRANCHES_2022, ...COMMUN },
  { annee: 2023, dateEffet: "2023-01-01", cnssSalarieBp: 918, cnssPatronaleBp: 1657, cssBp: 50, cssSeuilExoneration: dt(5_000), tranches: TRANCHES_2022, ...COMMUN },
  { annee: 2024, dateEffet: "2024-01-01", cnssSalarieBp: 918, cnssPatronaleBp: 1657, cssBp: 50, cssSeuilExoneration: dt(5_000), tranches: TRANCHES_2022, ...COMMUN },
  { annee: 2025, dateEffet: "2025-01-01", cnssSalarieBp: 918, cnssPatronaleBp: 1657, cssBp: 50, cssSeuilExoneration: dt(5_000), tranches: TRANCHES_2025, ...COMMUN },
  { annee: 2026, dateEffet: "2026-01-01", cnssSalarieBp: 968, cnssPatronaleBp: 1707, cssBp: 50, cssSeuilExoneration: dt(5_000), tranches: TRANCHES_2025, ...COMMUN },
];

/** Dernier jour d'un mois « AAAA-MM » (AAAA-MM-JJ). */
function dernierJour(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  const jour = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mois}-${String(jour).padStart(2, "0")}`;
}

/** Barème applicable à un mois « AAAA-MM » : date d'effet la plus récente au plus tard le dernier jour du mois ; undefined s'il n'y en a pas. */
export function baremeApplicable(mois: string, baremes: Bareme[] = BAREMES): Bareme | undefined {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) return undefined;
  const limite = dernierJour(mois);
  return baremes.filter((b) => b.dateEffet <= limite).sort((a, b) => b.dateEffet.localeCompare(a.dateEffet))[0];
}
