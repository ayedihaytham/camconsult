import { Bell, ClipboardList, ListChecks, MessageSquare, type LucideIcon } from "lucide-react";

export interface NotificationVisuel {
  icone: LucideIcon;
  /** Classes de la tuile (fond + couleur de l'icône), sémantiques : ambre = à examiner, neutre = le reste. */
  tuile: string;
}

/** Icône et teinte d'une notification, déduites de la page vers laquelle elle renvoie ; la cloche pour tout le reste. */
export function visuelNotification(lien: string | undefined | null): NotificationVisuel {
  const chemin = lien ?? "";
  const dans = (base: string) => chemin === base || chemin.startsWith(`${base}/`);
  if (dans("/collectes")) return { icone: ClipboardList, tuile: "bg-warning/15 text-warning" };
  if (dans("/messagerie")) return { icone: MessageSquare, tuile: "bg-primary/10 text-primary" };
  if (dans("/taches")) return { icone: ListChecks, tuile: "bg-primary/10 text-primary" };
  return { icone: Bell, tuile: "bg-muted text-muted-foreground" };
}
