import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import type { JournalAction } from "@/store/journal";

export type ActivitySource = "Fichier" | "Message" | "Journal";

export interface ActivityItem {
  id: string;
  source: ActivitySource;
  /** Acteur du journal, nom du fichier ou de la conversation. */
  title: string;
  description: string;
  at: string;
  route?: string;
  unread?: number;
  online?: boolean;
  /** Messages : initiales de la conversation. */
  initials?: string;
  action?: JournalAction;
}

export interface ActivityGroup {
  key: string;
  items: ActivityItem[];
}

export const ACTIVITY_LIMIT = 16;

export const ACTION_LABELS: Record<JournalAction, { label: string; plural: string; tone: "crea" | "modi" | "supp" | "neutre" }> = {
  creation: { label: "Création", plural: "créations", tone: "crea" },
  duplication: { label: "Duplication", plural: "duplications", tone: "crea" },
  import: { label: "Import", plural: "imports", tone: "crea" },
  modification: { label: "Modification", plural: "modifications", tone: "modi" },
  reinitialisation: { label: "Réinitialisation", plural: "réinitialisations", tone: "modi" },
  suppression: { label: "Suppression", plural: "suppressions", tone: "supp" },
  connexion: { label: "Connexion", plural: "connexions", tone: "neutre" },
  deconnexion: { label: "Déconnexion", plural: "déconnexions", tone: "neutre" },
  acces: { label: "Accès", plural: "accès", tone: "neutre" },
};

/** Fichiers, messages (si autorisés) et journal (administrateur) : les plus récents d'abord, au plus `ACTIVITY_LIMIT`. Même périmètre que l'ancien onglet. */
export function buildActivityItems(data: DashboardViewModel, canUseMessaging: boolean): ActivityItem[] {
  const files: ActivityItem[] = data.recentFiles.map((file) => ({ id: `file-${file.id}`, source: "Fichier", title: file.name, description: `${file.societeName}${file.format ? ` · ${file.format.toUpperCase()}` : ""}`, at: file.updatedAt, route: "/structuration" }));
  const messages: ActivityItem[] = canUseMessaging ? data.recentMessages.map((message) => ({ id: `message-${message.id}`, source: "Message", title: message.label, description: message.preview || "Aperçu indisponible", at: message.updatedAt, route: "/messagerie", unread: message.unread, online: message.online, initials: message.initials })) : [];
  const journal: ActivityItem[] = data.role === "admin" ? data.journalEntries.map((entry) => ({ id: `journal-${entry.id}`, source: "Journal", title: entry.actor, description: entry.label, at: entry.at, action: entry.action })) : [];
  return [...files, ...messages, ...journal].sort((left, right) => right.at.localeCompare(left.at)).slice(0, ACTIVITY_LIMIT);
}

const minute = (iso: string) => Math.floor(new Date(iso).getTime() / 60_000);

/** Regroupe les écritures du journal qui se suivent avec le même acteur, la même action et la même minute (ex. trois modifications d'un coup). */
export function groupConsecutive(items: ActivityItem[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    const first = last?.items[0];
    if (last && first && item.source === "Journal" && first.source === "Journal" && first.title === item.title && first.action === item.action && minute(first.at) === minute(item.at)) last.items.push(item);
    else groups.push({ key: item.id, items: [item] });
  }
  return groups;
}

export type DayLabel = "Aujourd'hui" | "Hier" | "Cette semaine" | "Plus ancien";
export const DAY_LABELS: DayLabel[] = ["Aujourd'hui", "Hier", "Cette semaine", "Plus ancien"];

export function dayLabel(value: string, now: Date): DayLabel {
  const date = new Date(value);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startToday.getTime() - startDate.getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return "Cette semaine";
  return "Plus ancien";
}

/** Événements du jour par heure locale (de 7 h à 19 h, élargi si une activité sort de cette plage). */
export function hourlyRhythm(items: ActivityItem[], now: Date): { hour: number; count: number }[] {
  const today = items.filter((item) => dayLabel(item.at, now) === "Aujourd'hui" && new Date(item.at) <= new Date(now.getTime() + 60_000));
  const hours = today.map((item) => new Date(item.at).getHours());
  const from = Math.min(7, ...hours);
  const to = Math.max(19, ...hours);
  return Array.from({ length: to - from + 1 }, (_, index) => ({ hour: from + index, count: hours.filter((hour) => hour === from + index).length }));
}
