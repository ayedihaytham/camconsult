import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="max-w-full overflow-x-auto pb-1">
        <TabsList className="w-max min-w-full justify-start sm:min-w-0" aria-label="Sections du tableau de bord">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          {isClient ? (
            <>
              <TabsTrigger value="collections">Collectes</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              {canUseMessaging && <TabsTrigger value="messages">Messages</TabsTrigger>}
            </>
          ) : (
            <>
              <TabsTrigger value="attention">À traiter</TabsTrigger>
              <TabsTrigger value="deadlines">Échéances</TabsTrigger>
              {data.role === "admin" && <TabsTrigger value="team">Équipe</TabsTrigger>}
              <TabsTrigger value="activity">Activité</TabsTrigger>
            </>
          )}
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-3">
        {isClient ? <ClientOverviewTab data={data} loading={collectesLoading} /> : <OverviewTab data={data} loading={collectesLoading} />}
      </TabsContent>
      {isClient ? (
        <>
          <TabsContent value="collections" className="mt-3"><ClientCollectionsTab collections={data.collections} loading={collectesLoading} /></TabsContent>
          <TabsContent value="documents" className="mt-3"><ActivityCard title="Documents récents" description="Derniers fichiers accessibles dans votre dossier"><FilesActivity files={data.recentFiles} onOpen={() => navigate("/structuration")} /></ActivityCard></TabsContent>
          {canUseMessaging && <TabsContent value="messages" className="mt-3"><ActivityCard title="Messages récents" description="Derniers échanges avec le cabinet"><MessagesActivity messages={data.recentMessages} onOpen={() => navigate("/messagerie")} /></ActivityCard></TabsContent>}
        </>
      ) : (
        <>
          <TabsContent value="attention" className="mt-3"><AttentionTab items={data.attentionItems} loading={collectesLoading} error={collectesError} onRetry={onRetryCollectes} /></TabsContent>
          <TabsContent value="deadlines" className="mt-3"><DeadlinesTab deadlines={data.deadlines} counts={data.collectionCounts} loading={collectesLoading} error={collectesError} onRetry={onRetryCollectes} /></TabsContent>
          {data.role === "admin" && <TabsContent value="team" className="mt-3"><TeamTab members={data.team} counts={data.taskCounts} /></TabsContent>}
          <TabsContent value="activity" className="mt-3"><ActivityTab data={data} canUseMessaging={canUseMessaging} /></TabsContent>
        </>
      )}
    </Tabs>
  );
}

function ActivityCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card className="shadow-none"><CardHeader className="p-4"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="p-4 pt-0">{children}</CardContent></Card>;
}
