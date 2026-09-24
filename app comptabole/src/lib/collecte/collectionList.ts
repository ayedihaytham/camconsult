import { getDeadlineBucket, isOverdueCollection } from "@/lib/dashboard/dashboardData";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { Collecte, CollecteStatut } from "@/types";

export type CollecteStatusTone = "success" | "warning" | "muted" | "destructive" | "primary";

export function getCollecteStatusPresentation(statut: CollecteStatut): {
  label: string;
  tone: CollecteStatusTone;
} {
  const tones: Record<CollecteStatut, CollecteStatusTone> = {
    brouillon: "muted",
    transmis: "primary",
    valide: "success",
    a_corriger: "warning",
    archive: "muted",
  };
  return { label: COLLECTE_STATUT_LABELS[statut], tone: tones[statut] };
}

export function formatCollecteDeadline(collecte: Collecte, now: Date): string {
  if (!collecte.echeance) return "Non définie";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(collecte.echeance);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : null;
  const formatted = date
    ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date)
    : collecte.echeance;
  if (isOverdueCollection(collecte, now)) return `${formatted} · Dépassée`;
  if (
    getDeadlineBucket(collecte.echeance, now) === "today" &&
    collecte.statut !== "valide" && collecte.statut !== "archive"
  ) return `${formatted} · Aujourd’hui`;
  return formatted;
}

export type CollecteLens = "actives" | "archivees" | "toutes";
export type CollecteDeadlineFilter = "all" | "late" | "today" | "upcoming" | "none";

export interface CollecteListFilters {
  lens: CollecteLens;
  query: string;
  societeId: string;
  periode: string;
  statut: CollecteStatut | "all";
  echeance: CollecteDeadlineFilter;
}

export function getCollecteLensCounts(collectes: Collecte[]) {
  const archivees = collectes.filter((collecte) => collecte.statut === "archive").length;
  return {
    actives: collectes.length - archivees,
    archivees,
    toutes: collectes.length,
  };
}

export function filterCollectes(
  collectes: Collecte[],
  filters: CollecteListFilters,
  societeName: (societeId: string) => string,
  now: Date,
): Collecte[] {
  const query = filters.query.trim().toLocaleLowerCase("fr");

  return collectes.filter((collecte) => {
    if (filters.lens === "archivees" && collecte.statut !== "archive") return false;
    if (filters.lens === "actives" && collecte.statut === "archive") return false;
    if (filters.societeId && collecte.societeId !== filters.societeId) return false;
    if (filters.periode && collecte.periode.trim() !== filters.periode) return false;
    if (filters.statut !== "all" && collecte.statut !== filters.statut) return false;

    if (query) {
      const searchable = `${societeName(collecte.societeId)} ${collecte.periode}`
        .toLocaleLowerCase("fr");
      if (!searchable.includes(query)) return false;
    }

    if (filters.echeance === "late" && !isOverdueCollection(collecte, now)) return false;
    if (filters.echeance === "none" && collecte.echeance) return false;
    if (filters.echeance !== "all" && filters.echeance !== "late" && filters.echeance !== "none") {
      if (!collecte.echeance) return false;
      const bucket = getDeadlineBucket(collecte.echeance, now);
      if (filters.echeance === "today" && bucket !== "today") return false;
      if (filters.echeance === "upcoming" && bucket !== "week" && bucket !== "later") return false;
    }

    return true;
  });
}

export function getCollecteNextAction(
  statut: CollecteStatut,
  { isAdmin, isSocieteEmploye }: { isAdmin: boolean; isSocieteEmploye: boolean },
): string {
  if (statut === "valide" || statut === "archive") return "Consulter";
  if (statut === "transmis") return isAdmin ? "Examiner" : "Ouvrir";
  if (statut === "a_corriger") {
    if (isSocieteEmploye) return "Reprendre";
    return isAdmin ? "Examiner" : "Ouvrir";
  }
  return isSocieteEmploye ? "Remplir" : "Ouvrir";
}
