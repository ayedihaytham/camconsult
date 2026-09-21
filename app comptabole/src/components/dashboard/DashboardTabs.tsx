import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilesActivity } from "@/components/dashboard/activity/FilesActivity";
import { MessagesActivity } from "@/components/dashboard/activity/MessagesActivity";
import { ActivityTab } from "@/components/dashboard/tabs/ActivityTab";
import { AttentionTab } from "@/components/dashboard/tabs/AttentionTab";
import { ClientCollectionsTab } from "@/components/dashboard/tabs/ClientCollectionsTab";
import { ClientOverviewTab } from "@/components/dashboard/tabs/ClientOverviewTab";
import { DeadlinesTab } from "@/components/dashboard/tabs/DeadlinesTab";
import { OverviewTab } from "@/components/dashboard/tabs/OverviewTab";
import { TeamTab } from "@/components/dashboard/tabs/TeamTab";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

const DASHBOARD_TAB_TRIGGER_CLASS = "relative shrink-0 rounded-none border-0 bg-transparent px-0 py-3 text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent after:opacity-0 data-[state=active]:after:opacity-100";

interface DashboardTabsProps {
  data: DashboardViewModel;
  canUseMessaging: boolean;
  collectesLoading: boolean;
  collectesError: boolean;
  onRetryCollectes: () => void;
}

export function DashboardTabs({ data, canUseMessaging, collectesLoading, collectesError, onRetryCollectes }: DashboardTabsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isClient = data.role === "societe_employe";
  const tabs = isClient
    ? ["overview", "collections", "documents", ...(canUseMessaging ? ["messages"] : [])]
    : ["overview", "attention", "deadlines", ...(data.role === "admin" ? ["team"] : []), "activity"];
  const requested = searchParams.get("tab") ?? "overview";
  const value = tabs.includes(requested) ? requested : "overview";
  function changeTab(nextValue: string) {
    const next = new URLSearchParams(searchParams);
    if (nextValue === "overview") next.delete("tab");
    else next.set("tab", nextValue);
    setSearchParams(next, { replace: true });
  }

  return (
    <Tabs value={value} onValueChange={changeTab} className="min-w-0">
      <div className="max-w-full overflow-x-auto">
        <TabsList className="h-auto w-max min-w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0 sm:min-w-0" aria-label="Sections du tableau de bord">
          <TabsTrigger value="overview" className={DASHBOARD_TAB_TRIGGER_CLASS}>Vue d'ensemble</TabsTrigger>
          {isClient ? (
            <>
              <TabsTrigger value="collections" className={DASHBOARD_TAB_TRIGGER_CLASS}>Collectes</TabsTrigger>
              <TabsTrigger value="documents" className={DASHBOARD_TAB_TRIGGER_CLASS}>Documents</TabsTrigger>
              {canUseMessaging && <TabsTrigger value="messages" className={DASHBOARD_TAB_TRIGGER_CLASS}>Messages</TabsTrigger>}
            </>
          ) : (
            <>
              <TabsTrigger value="attention" className={DASHBOARD_TAB_TRIGGER_CLASS}>À traiter</TabsTrigger>
              <TabsTrigger value="deadlines" className={DASHBOARD_TAB_TRIGGER_CLASS}>Échéances</TabsTrigger>
              {data.role === "admin" && <TabsTrigger value="team" className={DASHBOARD_TAB_TRIGGER_CLASS}>Équipe</TabsTrigger>}
              <TabsTrigger value="activity" className={DASHBOARD_TAB_TRIGGER_CLASS}>Activité</TabsTrigger>
            </>
          )}
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-4">
        {isClient ? <ClientOverviewTab data={data} loading={collectesLoading} /> : <OverviewTab data={data} loading={collectesLoading} />}
      </TabsContent>
      {isClient ? (
        <>
          <TabsContent value="collections" className="mt-4"><ClientCollectionsTab collections={data.collections} loading={collectesLoading} /></TabsContent>
          <TabsContent value="documents" className="mt-4"><ActivitySection title="Documents récents" description="Derniers fichiers accessibles dans votre dossier"><FilesActivity files={data.recentFiles} onOpen={() => navigate("/structuration")} /></ActivitySection></TabsContent>
          {canUseMessaging && <TabsContent value="messages" className="mt-4"><ActivitySection title="Messages récents" description="Derniers échanges avec le cabinet"><MessagesActivity messages={data.recentMessages} onOpen={() => navigate("/messagerie")} /></ActivitySection></TabsContent>}
        </>
      ) : (
        <>
          <TabsContent value="attention" className="mt-4"><AttentionTab items={data.attentionItems} loading={collectesLoading} error={collectesError} onRetry={onRetryCollectes} /></TabsContent>
          <TabsContent value="deadlines" className="mt-4"><DeadlinesTab deadlines={data.deadlines} loading={collectesLoading} error={collectesError} onRetry={onRetryCollectes} /></TabsContent>
          {data.role === "admin" && <TabsContent value="team" className="mt-4"><TeamTab members={data.team} counts={data.taskCounts} /></TabsContent>}
          <TabsContent value="activity" className="mt-4"><ActivityTab data={data} canUseMessaging={canUseMessaging} /></TabsContent>
        </>
      )}
    </Tabs>
  );
}

function ActivitySection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="min-w-0 border-t-2 border-primary"><header className="py-3"><h2 className="text-base font-semibold text-primary">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></header>{children}</section>;
}
