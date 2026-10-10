import { useEffect, useRef, type ReactNode } from "react";
import { Activity, Bell, CalendarDays, LayoutGrid, ListChecks, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilesActivity } from "@/components/dashboard/activity/FilesActivity";
import { ActivityTab } from "@/components/dashboard/tabs/ActivityTab";
import { AttentionTab } from "@/components/dashboard/tabs/AttentionTab";
import { ClientMessagesTab } from "@/components/dashboard/tabs/ClientMessagesTab";
import { ClientCollectionsTab } from "@/components/dashboard/tabs/ClientCollectionsTab";
import { ClientOverviewTab } from "@/components/dashboard/tabs/ClientOverviewTab";
import { DeadlinesTab } from "@/components/dashboard/tabs/DeadlinesTab";
import { DailyWorkspaceRail, DailyWorkspaceTab } from "@/components/dashboard/tabs/DailyWorkspaceTab";
import { TasksTab } from "@/components/dashboard/tabs/TasksTab";
import { CollectionFailure } from "./WorkspaceSection";
import { Button } from "@/components/ui/button";
import { TeamTab } from "@/components/dashboard/tabs/TeamTab";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { useMediaQuery } from "@/hooks/use-media-query";

const DASHBOARD_TAB_TRIGGER_CLASS = "dashboard-tab relative inline-flex min-h-11 items-center gap-2 shrink-0 rounded-none border-0 bg-transparent px-0 py-3 text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent after:opacity-0 data-[state=active]:after:opacity-100";

interface DashboardTabsProps {
  data: DashboardViewModel;
  canUseMessaging: boolean;
  collectesLoading: boolean;
  collectesError: boolean;
  onRetryCollectes: () => void;
  now: Date;
  adminDataLoading: boolean;
  adminDataError: boolean;
  journalError?: boolean;
  onRetryAdminData: () => void;
}

export function DashboardTabs({ data, canUseMessaging, collectesLoading, collectesError, onRetryCollectes, now, adminDataLoading, adminDataError, journalError = false, onRetryAdminData }: DashboardTabsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRailRef = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery("(min-width: 1280px)");
  const isClient = data.role === "societe_employe";
  const tabs = isClient
    ? ["overview", "collections", "documents", ...(canUseMessaging ? ["messages"] : [])]
    : ["overview", "tasks", "attention", "deadlines", ...(data.role === "admin" ? ["team"] : []), "activity"];
  const requested = searchParams.get("tab") ?? "overview";
  const value = tabs.includes(requested) ? requested : "overview";
  useEffect(() => {
    if (!window.matchMedia?.("(max-width: 639px)").matches) return;
    const selected = tabRailRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value]);
  function changeTab(nextValue: string) {
    const next = new URLSearchParams(searchParams);
    if (nextValue === "overview") next.delete("tab");
    else next.set("tab", nextValue);
    setSearchParams(next, { replace: true });
  }

  const openTasks = data.taskCounts.a_faire + data.taskCounts.en_cours;
  const activityCount = Math.min(
    16,
    data.recentFiles.length +
      (canUseMessaging ? data.recentMessages.length : 0) +
      (data.role === "admin" ? data.journalEntries.length : 0),
  );
  const tabLabel = (icon: ReactNode, label: string, count?: number) => (
    <>
      {icon}
      {label}
      {count ? <span className="dashboard-tab-count" aria-hidden="true">{count}</span> : null}
    </>
  );
  const navigation = (
      <div ref={tabRailRef} data-tour="dashboard-tabs" className="dashboard-tab-rail max-w-full overflow-x-auto border-b border-border">
        <TabsList className="h-auto w-max min-w-full justify-start gap-5 rounded-none bg-transparent p-0 sm:min-w-0" aria-label="Sections du tableau de bord">
          <TabsTrigger value="overview" className={DASHBOARD_TAB_TRIGGER_CLASS}>{isClient ? "Vue d'ensemble" : tabLabel(<LayoutGrid aria-hidden="true" />, "Mon bureau")}</TabsTrigger>
          {isClient ? (
            <>
              <TabsTrigger value="collections" className={DASHBOARD_TAB_TRIGGER_CLASS}>Collectes</TabsTrigger>
              <TabsTrigger value="documents" className={DASHBOARD_TAB_TRIGGER_CLASS}>Documents</TabsTrigger>
              {canUseMessaging && <TabsTrigger value="messages" className={DASHBOARD_TAB_TRIGGER_CLASS}>Messages</TabsTrigger>}
            </>
          ) : (
            <>
              <TabsTrigger value="tasks" className={DASHBOARD_TAB_TRIGGER_CLASS}>{tabLabel(<ListChecks aria-hidden="true" />, "Tâches", openTasks)}</TabsTrigger>
              <TabsTrigger data-tour="dashboard-attention-lens" value="attention" className={DASHBOARD_TAB_TRIGGER_CLASS}>{tabLabel(<Bell aria-hidden="true" />, "À traiter", data.attentionItems.length)}</TabsTrigger>
              <TabsTrigger value="deadlines" className={DASHBOARD_TAB_TRIGGER_CLASS}>{tabLabel(<CalendarDays aria-hidden="true" />, "Échéances", data.deadlines.length)}</TabsTrigger>
              {data.role === "admin" && <TabsTrigger value="team" className={DASHBOARD_TAB_TRIGGER_CLASS}>{tabLabel(<Users aria-hidden="true" />, "Équipe", data.team.length)}</TabsTrigger>}
              <TabsTrigger value="activity" className={DASHBOARD_TAB_TRIGGER_CLASS}>{tabLabel(<Activity aria-hidden="true" />, "Activité", activityCount)}</TabsTrigger>
            </>
          )}
        </TabsList>
      </div>
  );
  const bureau = !isClient && value === "overview";
  const cabinetNotice = data.role === "admin" && (adminDataLoading || adminDataError);
  return (
    <Tabs data-tour="dashboard-work" value={value} onValueChange={changeTab} className={`min-w-0 ${bureau ? "dashboard-bureau" : ""}`}>
      <div className="dashboard-view-column min-w-0">
      {navigation}
      {collectesError && <div className="dashboard-source-notice mt-4"><CollectionFailure onRetry={onRetryCollectes} /></div>}
      {cabinetNotice && <div role="status" className="dashboard-source-notice mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 text-xs text-muted-foreground"><p>{adminDataLoading ? "Chargement du journal et des bordereaux…" : "Suivi partiel : une source cabinet est indisponible. Les tâches, fichiers et messages restent accessibles."}</p>{adminDataError && <Button variant="outline" className="min-h-11" onClick={onRetryAdminData}>Réessayer le suivi cabinet</Button>}</div>}

      <TabsContent value="overview" className="dashboard-overview-content mt-4">
        {isClient ? <ClientOverviewTab data={data} loading={collectesLoading} error={collectesError} /> : <DailyWorkspaceTab data={data} wide={wide} now={now} loading={collectesLoading} error={collectesError} adminDataLoading={adminDataLoading} adminDataError={adminDataError} canUseMessaging={canUseMessaging} />}
      </TabsContent>
      {isClient ? (
        <>
          <TabsContent value="collections" className="mt-4">{!collectesError && <ClientCollectionsTab collections={data.collections} loading={collectesLoading} />}</TabsContent>
          <TabsContent value="documents" className="mt-4"><ActivitySection title="Documents récents" description="Derniers fichiers accessibles dans votre dossier"><FilesActivity files={data.recentFiles} onOpen={() => navigate("/structuration")} /></ActivitySection></TabsContent>
          {canUseMessaging && <TabsContent value="messages" className="mt-4"><ClientMessagesTab messages={data.recentMessages} /></TabsContent>}
        </>
      ) : (
        <>
          <TabsContent value="tasks" className="mt-4"><TasksTab data={data} /></TabsContent>
          <TabsContent value="attention" className="mt-4"><AttentionTab items={data.attentionItems} loading={collectesLoading || adminDataLoading} error={collectesError || adminDataError} /></TabsContent>
          <TabsContent value="deadlines" className="mt-4"><DeadlinesTab deadlines={data.deadlines} loading={collectesLoading} error={collectesError} onRetry={onRetryCollectes} /></TabsContent>
          {data.role === "admin" && <TabsContent value="team" className="mt-4"><TeamTab members={data.team} counts={data.taskCounts} /></TabsContent>}
          <TabsContent value="activity" className="mt-4"><ActivityTab data={data} canUseMessaging={canUseMessaging} loading={adminDataLoading} error={journalError} /></TabsContent>
        </>
      )}
      </div>
      {bureau && wide && <DailyWorkspaceRail data={data} loading={collectesLoading} error={collectesError} adminDataLoading={adminDataLoading} adminDataError={adminDataError} canUseMessaging={canUseMessaging} />}
    </Tabs>
  );
}

function ActivitySection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="min-w-0 border-t-2 border-primary"><header className="py-3"><h2 className="text-base font-semibold text-primary">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></header>{children}</section>;
}
