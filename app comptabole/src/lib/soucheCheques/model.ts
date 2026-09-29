import { round3 } from "@/lib/amount";
import type { PdfCell } from "@/lib/pdfTables";
import type { SoucheCheque, SoucheChequeDevise } from "@/types";

export const DEVISES: SoucheChequeDevise[] = ["TND", "EUR", "USD"];

export const fmtMontant = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** « 2026-09-24 » → « 24/09/2026 » (— si vide). */
export const fmtDate = (iso: string | null) => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

export interface TotauxDevise {
  devise: SoucheChequeDevise;
  nb: number;
  nbDebites: number;
  emis: number;
  debite: number;
  /** émis − débité : ce qui reste à débiter sur le compte */
  restant: number;
  /** montant moyen d'un chèque émis (emis / nb) */
  moyenEmis: number;
}

function totaux(lignes: SoucheCheque[]): Omit<TotauxDevise, "devise"> {
  const emis = round3(lignes.reduce((s, l) => s + l.montant, 0));
  const debite = round3(lignes.filter((l) => l.debite).reduce((s, l) => s + l.montant, 0));
  return {
    nb: lignes.length,
    nbDebites: lignes.filter((l) => l.debite).length,
    emis,
    debite,
    restant: round3(emis - debite),
    moyenEmis: lignes.length > 0 ? round3(emis / lignes.length) : 0,
  };
}

/** Totaux par devise (jamais de somme entre devises différentes), dans
 * l'ordre TND, EUR, USD, seulement pour les devises présentes. */
export function totauxParDevise(list: SoucheCheque[]): TotauxDevise[] {
  return DEVISES.flatMap((devise) => {
    const lignes = list.filter((l) => l.devise === devise);
    if (lignes.length === 0) return [];
    return [{ devise, ...totaux(lignes) }];
  });
}

export interface TotauxBanque extends TotauxDevise {
  banque: string;
}

/** Reste à débiter par banque puis par devise — utile dès qu'il y a plusieurs
 * comptes bancaires : chaque compte a son propre encours à surveiller. */
export function totauxParBanque(list: SoucheCheque[]): TotauxBanque[] {
  const banques = [...new Set(list.map((l) => l.banque || "Sans banque"))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  return banques.flatMap((banque) =>
    totauxParDevise(list.filter((l) => (l.banque || "Sans banque") === banque)).map((t) => ({
      banque,
      ...t,
    })),
  );
}

/** Nombre de jours calendaires depuis la date d'émission (0 = aujourd'hui). */
export function joursDepuis(dateIso: string | null): number | null {
  const m = dateIso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso) : null;
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86_400_000);
}

/** Un chèque émis mais non débité depuis plus de ce délai mérite d'être
 * relancé auprès de la banque ou du bénéficiaire. */
export const SEUIL_ATTENTE_JOURS = 30;

export function chequesEnAttente(
  list: SoucheCheque[],
  seuilJours: number = SEUIL_ATTENTE_JOURS,
): SoucheCheque[] {
  return list.filter((l) => !l.debite && (joursDepuis(l.dateEmission) ?? 0) > seuilJours);
}

/** Colonnes du modèle du cabinet (A→H, identiques au fichier fourni) + Devise. */
export const ENTETES = [
  "Banque",
  "N° de Chèque",
  "Date d'Émission",
  "Bénéficiaire",
  "Motif / Description",
  "Montant (TND-EUR-USD)",
  "Statut Débité (Oui/Non)",
  "Date de Débit",
  "Devise",
] as const;

/** Lignes du PDF : en-tête, un chèque par ligne, puis les totaux par devise. */
export function soucheRows(list: SoucheCheque[]): PdfCell[][] {
  const header: PdfCell[] = [
    "Banque", "N° de chèque", "Date d'émission", "Bénéficiaire", "Motif / Description",
    "Montant", "Devise", "Statut débité", "Date de débit",
  ];
  const body: PdfCell[][] = list.map((l) => [
    l.banque,
    l.numCheque,
    fmtDate(l.dateEmission),
    l.beneficiaire,
    l.motif,
    l.montant,
    l.devise,
    l.debite ? "Oui" : "Non",
    fmtDate(l.dateDebit),
  ]);
  const totaux: PdfCell[][] = totauxParDevise(list).flatMap((t) => [
    ["TOTAL ÉMIS", "", "", "", "", t.emis, t.devise, "", ""],
    ["TOTAL DÉBITÉ", "", "", "", "", t.debite, t.devise, "", ""],
    ["RESTE À DÉBITER", "", "", "", "", t.restant, t.devise, "", ""],
  ]);
  return [header, ...body, ...totaux];
}
