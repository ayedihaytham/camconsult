import { useCallback, useEffect, useMemo, useState } from "react";
import { buildDashboardData, type DashboardRole } from "@/lib/dashboard/dashboardData";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/store/auth";
import { useBordereaux } from "@/store/bordereaux";
import { useCollectes } from "@/store/collectes";
import {
  useCollaborateurs,
  useConversations,
  useNoeuds,
  useNotifications,
  useSocietes,
  useTaches,
} from "@/store/data";
import { useJournal } from "@/store/journal";

export function useDashboardData() {
  const { isAdmin, poste, employeId, can } = usePermissions();
  const session = useAuth((state) => state.session);
  const societes = useSocietes();
  const collaborateurs = useCollaborateurs();
  const noeuds = useNoeuds();
  const taches = useTaches();
  const notifications = useNotifications();
  const conversations = useConversations(isAdmin ? "me" : (employeId ?? "me"));

  const collectes = useCollectes((state) => state.list);
  const fetchCollectes = useCollectes((state) => state.fetchList);
  const bordereaux = useBordereaux((state) => state.list);
  const fetchBordereaux = useBordereaux((state) => state.fetchList);
  const journalEntries = useJournal((state) => state.entries);
  const fetchJournal = useJournal((state) => state.fetch);

  const [collectesReady, setCollectesReady] = useState(false);
  const [adminDataReady, setAdminDataReady] = useState(!isAdmin);
  const [collectesError, setCollectesError] = useState(false);
  const now = useMemo(() => new Date(), []);

  const loadCollectes = useCallback(async () => {
    setCollectesReady(false);
    setCollectesError(false);
    try {
      await fetchCollectes();
      setCollectesReady(true);
    } catch {
      setCollectesReady(true);
      setCollectesError(true);
    }
  }, [fetchCollectes]);

  useEffect(() => {
    let active = true;
    loadCollectes().catch(() => {
      if (active) setCollectesError(true);
    });
    return () => {
      active = false;
    };
  }, [loadCollectes, session?.employeId, session?.role]);

  useEffect(() => {
    let active = true;
    if (!isAdmin) {
      setAdminDataReady(true);
      return () => {
        active = false;
      };
    }
    setAdminDataReady(false);
    Promise.allSettled([fetchBordereaux(), fetchJournal()]).then(() => {
      if (active) setAdminDataReady(true);
    });
    return () => {
      active = false;
    };
  }, [fetchBordereaux, fetchJournal, isAdmin, session?.employeId, session?.role]);

  const role: DashboardRole = isAdmin
    ? "admin"
    : poste === "societe_employe"
      ? "societe_employe"
      : "collaborateur";
  const canUseMessaging = isAdmin || can("messagerie");

  const data = useMemo(
    () => buildDashboardData({
      role,
      viewerEmployeId: employeId,
      canUseMessaging,
      now,
      societes,
      collaborateurs,
      noeuds,
      taches,
      conversations: canUseMessaging ? conversations : [],
      notifications,
      collectes: collectesReady ? collectes : [],
      bordereaux: isAdmin && adminDataReady ? bordereaux : [],
      journalEntries: isAdmin && adminDataReady ? journalEntries : [],
      adminName: session?.cabinetNom ?? "Cabinet",
    }),
    [
      adminDataReady,
      bordereaux,
      canUseMessaging,
      collaborateurs,
      collectes,
      collectesReady,
      conversations,
      employeId,
      isAdmin,
      journalEntries,
      noeuds,
      notifications,
      now,
      role,
      session?.cabinetNom,
      societes,
      taches,
    ],
  );

  return {
    data,
    role,
    canUseMessaging,
    collectesLoading: !collectesReady,
    adminDataLoading: isAdmin && !adminDataReady,
    collectesError,
    retryCollectes: loadCollectes,
  };
}
