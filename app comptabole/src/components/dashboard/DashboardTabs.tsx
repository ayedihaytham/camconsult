import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilesActivity } from "@/components/dashboard/activity/FilesActivity";
import { MessagesActivity } from "@/components/dashboard/activity/MessagesActivity";
import { ActivityTab } from "@/components/dashboard/tabs/ActivityTab";
import { AttentionTab } from "@/components/dashboard/tabs/AttentionTab";
import { ClientCollectionsTab } from "@/components/dashboard/tabs/ClientCollectionsTab";
import { ClientOverviewTab } from "@/components/dashboard/tabs/ClientOverviewTab";
import { DeadlinesTab } from "@/components/dashboard/tabs/DeadlinesTab";
import { DailyWorkspaceTab } from "@/components/dashboard/tabs/DailyWorkspaceTab";
import { TasksTab } from "@/components/dashboard/tabs/TasksTab";
import { CollectionFailure } from "./WorkspaceSection";
import { Button } from "@/components/ui/button";
import { TeamTab } from "@/components/dashboard/tabs/TeamTab";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

const DASHBOARD_TAB_TRIGGER_CLASS = "dashboard-tab relative min-h-11 shrink-0 rounded-none border-0 bg-transparent px-0 py-3 text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent after:opacity-0 data-[state=active]:after:opacity-100";

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

  return (
    <Tabs data-tour="dashboard-work" value={value} onValueChange={changeTab} className="min-w-0">
      <div ref={tabRailRef} data-tour="dashboard-tabs" className="dashboard-tab-rail max-w-full overflow-x-auto border-b border-border">
        <TabsList className="h-auto w-max min-w-full justify-start gap-5 rounded-none bg-transparent p-0 sm:min-w-0" aria-label="Sections du tableau de bord">
          <TabsTrigger value="overview" className={DASHBOARD_TAB_TRIGGER_CLASS}>{isClient ? "Vue d'ensemble" : "Mon bureau"}</TabsTrigger>
          {isClient ? (
            <>
              <TabsTrigger value="collections" className={DASHBOARD_TAB_TRIGGER_CLASS}>Collectes</TabsTrigger>
              <TabsTrigger value="documents" className={DASHBOARD_TAB_TRIGGER_CLASS}>Documents</TabsTrigger>
              {canUseMessaging && <TabsTrigger value="messages" className={DASHBOARD_TAB_TRIGGER_CLASS}>Messages</TabsTrigger>}
            </>
          ) : (
            <>
              <TabsTrigger value="tasks" className={DASHBOARD_TAB_TRIGGER_CLASS}>Tâches</TabsTrigger>
              <TabsTrigger data-tour="dashboard-attention-lens" value="attention" className={DASHBOARD_TAB_TRIGGER_CLASS}>À traiter</TabsTrigger>
              <TabsTrigger value="deadlines" className={DASHBOARD_TAB_TRIGGER_CLASS}>Échéances</TabsTrigger>
              {data.role === "admin" && <TabsTrigger value="team" className={DASHBOARD_TAB_TRIGGER_CLASS}>Équipe</TabsTrigger>}
              <TabsTrigger value="activity" className={DASHBOARD_TAB_TRIGGER_CLASS}>Activité</TabsTrigger>
            </>
          )}
        </TabsList>
      </div>
      {collectesError && <div className="mt-4"><CollectionFailure onRetry={onRetryCollectes} /></div>}
      {data.role === "admin" && (adminDataLoading || adminDataError) && <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 text-xs text-muted-foreground"><p>{adminDataLoading ? "Chargement du journal et des bordereaux…" : "Suivi partiel : une source cabinet est indisponible. Les tâches, fichiers et messages restent accessibles."}</p>{adminDataError && <Button variant="outline" className="min-h-11" onClick={onRetryAdminData}>Réessayer le suivi cabinet</Button>}</div>}

      <TabsContent value="overview" className="mt-4">
        {isClient ? <ClientOverviewTab data={data} loading={collectesLoading} error={collectesError} /> : <DailyWorkspaceTab data={data} now={now} loading={collectesLoading} error={collectesError} adminDataLoading={adminDataLoading} adminDataError={adminDataError} canUseMessaging={canUseMessaging} />}
      </TabsContent>
      {isClient ? (
        <>
          <TabsContent value="collections" className="mt-4">{!collectesError && <ClientCollectionsTab collections={data.collections} loading={collectesLoading} />}</TabsContent>
          <TabsContent value="documents" className="mt-4"><ActivitySection title="Documents récents" description="Derniers fichiers accessibles dans votre dossier"><FilesActivity files={data.recentFiles} onOpen={() => navigate("/structuration")} /></ActivitySection></TabsContent>
          {canUseMessaging && <TabsContent value="messages" className="mt-4"><ActivitySection title="Messages récents" description="Derniers échanges avec le cabinet"><MessagesActivity messages={data.recentMessages} onOpen={() => navigate("/messagerie")} /></ActivitySection></TabsContent>}
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
    </Tabs>
  );
}

function ActivitySection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="min-w-0 border-t-2 border-primary"><header className="py-3"><h2 className="text-base font-semibold text-primary">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></header>{children}</section>;
}
