import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function useDashboardData(selectedEmployeeId: string | null = null) {
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
  const journalError = useJournal((state) => state.error);
  const fetchJournal = useJournal((state) => state.fetch);

  const [collectesReady, setCollectesReady] = useState(false);
  const [adminDataReady, setAdminDataReady] = useState(!isAdmin);
  const [collectesError, setCollectesError] = useState(false);
  const collectionRequest = useRef(0);
  const [adminDataError, setAdminDataError] = useState(false);
  const [bordereauxError, setBordereauxError] = useState(false);
  const [adminRefresh, setAdminRefresh] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setNow(new Date()), tomorrow.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [now]);

  const loadCollectes = useCallback(async () => {
    const request = ++collectionRequest.current;
    setCollectesReady(false);
    setCollectesError(false);
    try {
      await fetchCollectes();
      if (request === collectionRequest.current) setCollectesReady(true);
    } catch {
      if (request === collectionRequest.current) {
        setCollectesReady(true);
        setCollectesError(true);
      }
    }
  }, [fetchCollectes]);

  useEffect(() => {
    void loadCollectes();
    return () => {
      collectionRequest.current++;
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
    setAdminDataError(false);
    setBordereauxError(false);
    Promise.allSettled([fetchBordereaux(), fetchJournal()]).then((results) => {
      if (active) {
        setBordereauxError(results[0].status === "rejected");
        setAdminDataError(results.some((result) => result.status === "rejected") || useJournal.getState().error);
        setAdminDataReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchBordereaux, fetchJournal, isAdmin, session?.employeId, session?.role, adminRefresh]);

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
      collectes: collectesReady && !collectesError ? collectes : [],
      bordereaux: isAdmin && adminDataReady && !bordereauxError ? bordereaux : [],
      journalEntries: isAdmin && adminDataReady && !journalError ? journalEntries : [],
      adminName: session?.cabinetNom ?? "Cabinet",
      selectedEmployeeId: isAdmin ? selectedEmployeeId : null,
    }),
    [
      adminDataReady,
      bordereauxError,
      journalError,
      bordereaux,
      canUseMessaging,
      collaborateurs,
      collectes,
      collectesReady,
      collectesError,
      conversations,
      employeId,
      isAdmin,
      journalEntries,
      noeuds,
      notifications,
      now,
      role,
      session?.cabinetNom,
      selectedEmployeeId,
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
    retryAdminData: () => setAdminRefresh((value) => value + 1),
    adminDataError,
    journalError: isAdmin && journalError,
    now,
    employeeOptions: isAdmin ? collaborateurs.filter((employee) => employee.role !== "societe_employe") : [],
    collectesError,
    retryCollectes: loadCollectes,
  };
}
