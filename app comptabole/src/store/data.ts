import { useMemo } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  AppNotification,
  Conversation,
  Employe,
  EmployePermissions,
  EmployeType,
  GroupConversation,
  Message,
  Noeud,
  Societe,
  Tache,
  TacheStatut,
} from "@/types";

/** Droits par défaut proposés selon le rôle du collaborateur. */
export function defaultPermissions(type: EmployeType): EmployePermissions {
  switch (type) {
    case "Comptable":
      return {
        consulterDossiers: true,
        deposerFichiers: true,
        modifierSocietes: true,
        supprimer: true,
        messagerie: true,
      };
    case "Gestionnaire de paie":
    case "Assistant":
      return {
        consulterDossiers: true,
        deposerFichiers: true,
        modifierSocietes: false,
        supprimer: false,
        messagerie: true,
      };
    case "Stagiaire":
      return {
        consulterDossiers: true,
        deposerFichiers: false,
        modifierSocietes: false,
        supprimer: false,
        messagerie: true,
      };
  }
}

export const PERMISSION_LABELS: Record<keyof EmployePermissions, string> = {
  consulterDossiers: "Consulter les dossiers",
  deposerFichiers: "Déposer des fichiers",
  modifierSocietes: "Modifier les fiches sociétés",
  supprimer: "Supprimer des éléments",
  messagerie: "Accès à la messagerie",
};

function fail(err: unknown): never {
  const msg = err instanceof ApiError ? err.message : "Opération impossible";
  toast.error(msg);
  throw err;
}

/**
 * Annonce une notification fraîche : toast in-app (toujours) + notification
 * système du navigateur si l'onglet n'est pas au premier plan — pour qu'elle
 * soit vue même quand l'utilisateur regarde ailleurs.
 */
const announcedIds = new Set<string>();
function announceNotification(n: AppNotification) {
  if (announcedIds.has(n.id)) return;
  announcedIds.add(n.id);

  toast(n.titre, { description: n.corps || undefined, duration: 6000 });

  try {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      const native = new Notification(n.titre, {
        body: n.corps || undefined,
        tag: n.id,
      });
      native.onclick = () => {
        window.focus();
        try {
          window.location.assign(n.lien || "/");
        } catch {
          /* ignore */
        }
      };
    }
  } catch {
    /* Notification API indisponible / bloquée */
  }
}

interface DataState {
  hydrated: boolean;
  societes: Societe[];
  employes: Employe[];
  noeuds: Noeud[];
  messages: Message[];
  groupConversations: GroupConversation[];
  taches: Tache[];
  notifications: AppNotification[];

  hydrate: () => Promise<void>;
  clearLocal: () => void;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: (ids?: string[]) => Promise<void>;

  addGroupConversation: (data: {
    titre: string;
    membreIds: string[];
  }) => Promise<GroupConversation>;
  updateGroupConversation: (
    id: string,
    patch: { titre?: string; membreIds?: string[] },
  ) => Promise<void>;
  deleteGroupConversation: (id: string) => Promise<void>;

  addSociete: (data: Omit<Societe, "id" | "creeLe">) => Promise<Societe>;
  updateSociete: (id: string, patch: Partial<Societe>) => Promise<void>;
  duplicateSociete: (id: string, nextCode: string) => Promise<void>;
  deleteSocietes: (ids: string[]) => Promise<void>;

  addEmploye: (data: Omit<Employe, "id" | "creeLe">) => Promise<Employe>;
  updateEmploye: (id: string, patch: Partial<Employe>) => Promise<void>;
  duplicateEmploye: (id: string) => Promise<void>;
  deleteEmployes: (ids: string[]) => Promise<void>;
  setEmployeAcces: (
    id: string,
    societesAssignees: string[],
    permissions: EmployePermissions,
  ) => Promise<void>;

  addNoeud: (data: Omit<Noeud, "id" | "majLe" | "creeLe">) => Promise<Noeud>;
  updateNoeud: (id: string, patch: Partial<Noeud>) => Promise<void>;
  duplicateArborescence: (id: string) => Promise<void>;
  deleteNoeudsCascade: (ids: string[]) => Promise<void>;

  addMessage: (msg: Omit<Message, "id">) => Promise<void>;
  refreshMessages: () => Promise<void>;
  markConversationRead: (
    conversationId: string,
    viewerAuthorId?: string,
  ) => Promise<void>;

  addTache: (data: {
    titre: string;
    description?: string;
    societeId: string;
    assigneId?: string | null;
  }) => Promise<Tache>;
  updateTache: (
    id: string,
    patch: Partial<
      Pick<Tache, "titre" | "description" | "societeId" | "assigneId" | "statut">
    >,
  ) => Promise<void>;
  setTacheStatut: (id: string, statut: TacheStatut) => Promise<void>;
  deleteTache: (id: string) => Promise<void>;

  resetAll: () => Promise<void>;
  importAll: (payload: {
    societes?: Societe[];
    employes?: Employe[];
    noeuds?: Noeud[];
    messages?: Message[];
    conversations?: GroupConversation[];
    taches?: Tache[];
  }) => Promise<void>;
}

export const useData = create<DataState>((set, get) => ({
  hydrated: false,
  societes: [],
  employes: [],
  noeuds: [],
  messages: [],
  groupConversations: [],
  taches: [],
  notifications: [],

  hydrate: async () => {
    const data = await api.get<{
      societes: Societe[];
      employes: Employe[];
      noeuds: Noeud[];
      messages: Message[];
      groupConversations: GroupConversation[];
      taches: Tache[];
      notifications: AppNotification[];
    }>("/data/bootstrap");
    // Ne pas ré-annoncer l'historique présent au chargement.
    (data.notifications ?? []).forEach((n) => announcedIds.add(n.id));
    set({
      societes: data.societes,
      employes: data.employes,
      noeuds: data.noeuds,
      messages: data.messages,
      groupConversations: data.groupConversations ?? [],
      taches: data.taches ?? [],
      notifications: data.notifications ?? [],
      hydrated: true,
    });
  },

  clearLocal: () =>
    set({
      hydrated: false,
      societes: [],
      employes: [],
      noeuds: [],
      messages: [],
      groupConversations: [],
      taches: [],
      notifications: [],
    }),

  refreshNotifications: async () => {
    try {
      const list = await api.get<AppNotification[]>("/notifications");
      const known = new Set(get().notifications.map((n) => n.id));
      set({ notifications: list });
      // Annonce les nouvelles (non lues) apparues depuis le dernier passage.
      list
        .filter((n) => !known.has(n.id) && !n.lu)
        .reverse()
        .forEach(announceNotification);
    } catch {
      /* silencieux : rafraîchissement d'arrière-plan */
    }
  },
  markNotificationsRead: async (ids) => {
    set((st) => ({
      notifications: st.notifications.map((n) =>
        !ids || ids.includes(n.id) ? { ...n, lu: true } : n,
      ),
    }));
    try {
      await api.post("/notifications/mark-read", { ids: ids ?? [] });
    } catch {
      /* silencieux */
    }
  },

  addGroupConversation: async (data) => {
    try {
      const g = await api.post<GroupConversation>("/conversations", data);
      set((st) => ({ groupConversations: [g, ...st.groupConversations] }));
      return g;
    } catch (e) {
      return fail(e);
    }
  },
  updateGroupConversation: async (id, patch) => {
    try {
      const g = await api.patch<GroupConversation>(`/conversations/${id}`, patch);
      set((st) => ({
        groupConversations: st.groupConversations.map((x) =>
          x.id === id ? g : x,
        ),
      }));
    } catch (e) {
      fail(e);
    }
  },
  deleteGroupConversation: async (id) => {
    try {
      await api.del(`/conversations/${id}`);
      set((st) => ({
        groupConversations: st.groupConversations.filter((x) => x.id !== id),
        messages: st.messages.filter((m) => m.conversationId !== id),
      }));
    } catch (e) {
      fail(e);
    }
  },

  // ── Sociétés ────────────────────────────────
  addSociete: async (data) => {
    try {
      const s = await api.post<Societe>("/societes", data);
      set((st) => ({ societes: [s, ...st.societes] }));
      return s;
    } catch (e) {
      return fail(e);
    }
  },
  updateSociete: async (id, patch) => {
    try {
      const s = await api.patch<Societe>(`/societes/${id}`, patch);
      set((st) => ({
        societes: st.societes.map((x) => (x.id === id ? s : x)),
      }));
    } catch (e) {
      fail(e);
    }
  },
  duplicateSociete: async (id, nextCode) => {
    try {
      const s = await api.post<Societe>(`/societes/${id}/duplicate`, {
        nextCode,
      });
      set((st) => ({ societes: [s, ...st.societes] }));
    } catch (e) {
      fail(e);
    }
  },
  deleteSocietes: async (ids) => {
    try {
      await api.post("/societes/bulk-delete", { ids });
      set((st) => ({
        societes: st.societes.filter((x) => !ids.includes(x.id)),
        // les noeuds rattachés sont supprimés côté serveur (cascade)
        noeuds: st.noeuds.filter(
          (n) => !n.societeId || !ids.includes(n.societeId),
        ),
      }));
    } catch (e) {
      fail(e);
    }
  },

  // ── Employés ────────────────────────────────
  addEmploye: async (data) => {
    try {
      const e = await api.post<Employe>("/employes", data);
      set((st) => ({ employes: [e, ...st.employes] }));
      return e;
    } catch (err) {
      return fail(err);
    }
  },
  updateEmploye: async (id, patch) => {
    try {
      const e = await api.patch<Employe>(`/employes/${id}`, patch);
      set((st) => ({
        employes: st.employes.map((x) => (x.id === id ? e : x)),
      }));
    } catch (err) {
      fail(err);
    }
  },
  duplicateEmploye: async (id) => {
    try {
      const e = await api.post<Employe>(`/employes/${id}/duplicate`);
      set((st) => ({ employes: [e, ...st.employes] }));
    } catch (err) {
      fail(err);
    }
  },
  deleteEmployes: async (ids) => {
    try {
      await api.post("/employes/bulk-delete", { ids });
      set((st) => ({
        employes: st.employes.filter((x) => !ids.includes(x.id)),
      }));
    } catch (err) {
      fail(err);
    }
  },
  setEmployeAcces: async (id, societesAssignees, permissions) => {
    try {
      const e = await api.patch<Employe>(`/employes/${id}/acces`, {
        societesAssignees,
        permissions,
      });
      set((st) => ({
        employes: st.employes.map((x) => (x.id === id ? e : x)),
      }));
    } catch (err) {
      fail(err);
    }
  },

  // ── Structuration ───────────────────────────
  addNoeud: async (data) => {
    try {
      const n = await api.post<Noeud>("/noeuds", data);
      set((st) => ({ noeuds: [...st.noeuds, n] }));
      return n;
    } catch (e) {
      return fail(e);
    }
  },
  updateNoeud: async (id, patch) => {
    try {
      const n = await api.patch<Noeud>(`/noeuds/${id}`, patch);
      set((st) => ({ noeuds: st.noeuds.map((x) => (x.id === id ? n : x)) }));
    } catch (e) {
      fail(e);
    }
  },
  duplicateArborescence: async (id) => {
    try {
      const clones = await api.post<Noeud[]>(`/noeuds/${id}/duplicate`);
      set((st) => ({ noeuds: [...clones, ...st.noeuds] }));
    } catch (e) {
      fail(e);
    }
  },
  deleteNoeudsCascade: async (ids) => {
    try {
      await api.post("/noeuds/bulk-delete", { ids });
      // Recalcule les descendants localement pour retirer l'arbre entier
      set((st) => {
        const toRemove = new Set<string>();
        const walk = (nid: string) => {
          toRemove.add(nid);
          st.noeuds
            .filter((n) => n.parentId === nid)
            .forEach((c) => walk(c.id));
        };
        ids.forEach(walk);
        return { noeuds: st.noeuds.filter((n) => !toRemove.has(n.id)) };
      });
    } catch (e) {
      fail(e);
    }
  },

  // ── Messagerie ──────────────────────────────
  addMessage: async (msg) => {
    try {
      const m = await api.post<Message>("/messages", msg);
      set((st) => ({ messages: [...st.messages, m] }));
    } catch (e) {
      fail(e);
    }
  },
  // Appelée au fil de l'eau par le signal temps réel (voir
  // src/lib/liveEvents.ts) — pas de payload dans le push, juste un signal
  // qui déclenche ce refetch REST classique.
  refreshMessages: async () => {
    try {
      const list = await api.get<Message[]>("/messages");
      set({ messages: list });
    } catch {
      /* silencieux : rafraîchissement d'arrière-plan */
    }
  },
  markConversationRead: async (conversationId, viewerAuthorId = "me") => {
    // Optimiste : on marque localement puis on notifie le serveur
    set((st) => ({
      messages: st.messages.map((m) =>
        m.conversationId === conversationId && m.auteurId !== viewerAuthorId
          ? { ...m, statut: "lu" }
          : m,
      ),
    }));
    try {
      await api.post("/messages/mark-read", { conversationId, viewerAuthorId });
    } catch {
      /* silencieux : simple accusé de lecture */
    }
  },

  // ── Tâches ──────────────────────────────────
  addTache: async (data) => {
    try {
      const t = await api.post<Tache>("/taches", data);
      set((st) => ({ taches: [t, ...st.taches] }));
      return t;
    } catch (e) {
      return fail(e);
    }
  },
  updateTache: async (id, patch) => {
    try {
      const t = await api.patch<Tache>(`/taches/${id}`, patch);
      set((st) => ({ taches: st.taches.map((x) => (x.id === id ? t : x)) }));
    } catch (e) {
      fail(e);
    }
  },
  setTacheStatut: async (id, statut) => {
    try {
      const t = await api.patch<Tache>(`/taches/${id}`, { statut });
      set((st) => ({ taches: st.taches.map((x) => (x.id === id ? t : x)) }));
    } catch (e) {
      fail(e);
    }
  },
  deleteTache: async (id) => {
    try {
      await api.del(`/taches/${id}`);
      set((st) => ({ taches: st.taches.filter((x) => x.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },

  resetAll: async () => {
    try {
      await api.post("/data/reset");
      await get().hydrate();
    } catch (e) {
      fail(e);
    }
  },
  importAll: async (payload) => {
    try {
      await api.post("/data/restore", payload);
      await get().hydrate();
    } catch (e) {
      fail(e);
    }
  },
}));

// ── Sélecteurs / helpers ──────────────────────────────────────────
export const useSocietes = () => useData((s) => s.societes);
export const useEmployes = () => useData((s) => s.employes);
export const useNoeuds = () => useData((s) => s.noeuds);
export const useTaches = () => useData((s) => s.taches);
export const useNotifications = () => useData((s) => s.notifications);

/** Équipe interne du cabinet (role = collaborateur, ou ancien compte sans rôle). */
export const useCollaborateurs = () => {
  const employes = useData((s) => s.employes);
  return useMemo(
    () => employes.filter((e) => e.role !== "societe_employe"),
    [employes],
  );
};

/** Employés d'une société cliente donnée. */
export const useSocieteEmployes = (societeId: string | null | undefined) => {
  const employes = useData((s) => s.employes);
  return useMemo(
    () =>
      employes.filter(
        (e) => e.role === "societe_employe" && e.societeId === societeId,
      ),
    [employes, societeId],
  );
};

export const useSocieteById = (id: string | null | undefined) =>
  useData((s) => s.societes.find((x) => x.id === id) ?? null);
export const useEmployeById = (id: string | null | undefined) =>
  useData((s) => s.employes.find((x) => x.id === id) ?? null);
export const useTacheById = (id: string | null | undefined) =>
  useData((s) => s.taches.find((x) => x.id === id) ?? null);

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Conversations : une directe par employé + les groupes. */
export function useConversations(viewerAuthorId = "me"): Conversation[] {
  const employes = useData((s) => s.employes);
  const messages = useData((s) => s.messages);
  const groups = useData((s) => s.groupConversations);

  const threadOf = (convId: string) =>
    messages
      .filter((m) => m.conversationId === convId)
      .sort((a, b) => a.envoyeLe.localeCompare(b.envoyeLe));

  const unreadIn = (thread: Message[]) =>
    thread.filter(
      (m) => m.auteurId !== viewerAuthorId && m.statut !== "lu",
    ).length;

  const direct: Conversation[] = employes.map((e) => {
    const convId = `conv-${e.id}`;
    const thread = threadOf(convId);
    const last = thread[thread.length - 1];
    const online =
      !!e.derniereConnexion &&
      Date.now() - new Date(e.derniereConnexion).getTime() < ONLINE_WINDOW_MS;
    return {
      id: convId,
      type: "direct",
      employeId: e.id,
      // Un responsable de société (role societe_employe) porte sa société
      // dans son propre champ societeId — societesAssignees n'existe que
      // pour les collaborateurs (affectés à plusieurs sociétés), donc ne
      // devait servir qu'en repli, jamais en premier : sinon la conversation
      // d'un vrai responsable de société n'avait jamais de société associée.
      societeId: e.societeId ?? e.societesAssignees[0] ?? null,
      dernierMessage: last?.contenu || "Aucun message",
      dernierMessageLe: last?.envoyeLe || e.creeLe,
      nonLus: unreadIn(thread),
      enLigne: online,
      derniereConnexion: e.derniereConnexion ?? null,
    };
  });

  const grouped: Conversation[] = groups.map((g) => {
    const thread = threadOf(g.id);
    const last = thread[thread.length - 1];
    return {
      id: g.id,
      type: "groupe",
      titre: g.titre,
      membreIds: g.membreIds,
      employeId: null,
      societeId: null,
      dernierMessage: last?.contenu || "Aucun message",
      dernierMessageLe: last?.envoyeLe || g.creeLe,
      nonLus: unreadIn(thread),
      enLigne: false,
    };
  });

  return [...direct, ...grouped];
}

export const societeNom = (societes: Societe[], id: string | null | undefined) =>
  societes.find((s) => s.id === id)?.raisonSociale ?? null;

export function nextSocieteCode(societes: Societe[]): string {
  const max = societes.reduce((m, s) => {
    const n = Number(s.code.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `CLI-${String(max + 1).padStart(4, "0")}`;
}
