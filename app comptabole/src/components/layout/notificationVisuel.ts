import { Bell, Building2, ClipboardList, FolderTree, Globe, ListChecks, MessageSquare, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { NotificationType } from "@/types";

export interface NotificationVisuel {
  icone: LucideIcon;
  /** Classes de la tuile (fond + couleur de l'icône), sémantiques : ambre = à examiner, bleu marine pâle = le reste. */
  tuile: string;
}

const AMBRE = "bg-warning/15 text-warning";
const MARINE = "bg-primary/10 text-primary";

const PAR_TYPE: Record<NotificationType, NotificationVisuel> = {
  collecte: { icone: ClipboardList, tuile: AMBRE },
  apurement: { icone: ClipboardList, tuile: AMBRE },
  tache_assignee: { icone: ListChecks, tuile: MARINE },
  tache_statut: { icone: ListChecks, tuile: MARINE },
  tache_modifiee: { icone: ListChecks, tuile: MARINE },
  message: { icone: MessageSquare, tuile: MARINE },
  document: { icone: FolderTree, tuile: MARINE },
  societe: { icone: Building2, tuile: MARINE },
  compte: { icone: UserRound, tuile: MARINE },
  acces: { icone: ShieldCheck, tuile: MARINE },
  swift: { icone: Globe, tuile: MARINE },
};

/**
 * Icône et teinte d'une notification : d'abord d'après son type, puis, pour un type inconnu, d'après la page vers laquelle elle renvoie ;
 * la cloche pour tout le reste.
 */
export function visuelNotification(type: string | undefined | null, lien?: string | null): NotificationVisuel {
  const connu = type ? (PAR_TYPE as Record<string, NotificationVisuel>)[type] : undefined;
  if (connu) return connu;
  const chemin = lien ?? "";
  const dans = (base: string) => chemin === base || chemin.startsWith(`${base}/`) || chemin.startsWith(`${base}?`);
  if (dans("/collectes")) return PAR_TYPE.collecte;
  if (dans("/messagerie")) return PAR_TYPE.message;
  if (dans("/taches")) return PAR_TYPE.tache_assignee;
  if (dans("/structuration")) return PAR_TYPE.document;
  if (dans("/etat-swift")) return PAR_TYPE.swift;
  return { icone: Bell, tuile: "bg-muted text-muted-foreground" };
}
