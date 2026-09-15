import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatte un nombre en séparateurs français : 1 234 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

/** Date courte fr : 07/09/2026 */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Heure : 14:32 */
export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Étiquette relative simple (Aujourd'hui / Hier / date) */
export function formatDayLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return "Aujourd'hui";
  if (isSameDay(date, yesterday)) return "Hier";
  return formatDate(date);
}

/** Temps relatif court : « à l'instant », « il y a 3 min », « il y a 2 h », « hier à 14:30 », « le 05/09/2026 ». */
export function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "jamais";
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, yesterday)) return `hier à ${formatTime(date)}`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return `le ${formatDate(date)}`;
}

/** true si la date ISO tombe dans le mois calendaire courant. */
export function isCurrentMonth(d: string | Date | null | undefined): boolean {
  if (!d) return false;
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

/** Classes Tailwind écrites en toutes lettres (jamais construites par
 * interpolation) — le scanner JIT de Tailwind ne détecte que des chaînes
 * littérales présentes dans le code source. */
const AVATAR_PALETTE = [
  "bg-chart-1/12 text-chart-1",
  "bg-chart-2/12 text-chart-2",
  "bg-chart-3/12 text-chart-3",
  "bg-chart-4/12 text-chart-4",
  "bg-chart-5/12 text-chart-5",
] as const;

/** Couleur d'avatar stable par identifiant — chaque personne garde toujours
 * la même teinte (dérivée de la palette de graphiques du thème), pour se
 * repérer visuellement dans une liste de conversations comme Slack/Teams. */
export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
