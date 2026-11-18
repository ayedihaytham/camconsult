import { usePermissions } from "@/hooks/usePermissions";
import { useConversations, useTaches } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import { unreadMessageCount } from "./navigation";

/** Pastilles du menu : tâches ouvertes, collectes transmises à examiner, messages non lus (menu latéral et barre d'onglets du mobile). */
export function useCompteursMenu() {
  const { isAdmin, employeId } = usePermissions();
  const conversations = useConversations(isAdmin ? "me" : (employeId ?? "me"));
  const taches = useTaches();
  const collectes = useCollectes((state) => state.list);
  return {
    unreadMessages: unreadMessageCount(conversations, isAdmin, employeId),
    compteurs: {
      taches: taches.filter((t) => t.statut !== "termine").length,
      collectes: collectes.filter((c) => c.statut === "transmis").length,
    },
  };
}
