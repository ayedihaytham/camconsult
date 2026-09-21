import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilesActivity } from "@/components/dashboard/activity/FilesActivity";
import { JournalActivity } from "@/components/dashboard/activity/JournalActivity";
import { MessagesActivity } from "@/components/dashboard/activity/MessagesActivity";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

export function ActivityTab({ data, canUseMessaging }: { data: DashboardViewModel; canUseMessaging: boolean }) {
  const navigate = useNavigate();
  const defaultTab = data.recentFiles.length > 0 ? "files" : canUseMessaging ? "messages" : data.role === "admin" ? "journal" : "files";
  return (
    <Tabs defaultValue={defaultTab}>
      <Card className="min-w-0 shadow-none">
        <CardHeader className="gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>Activité récente</CardTitle><CardDescription className="mt-1">Derniers changements accessibles dans votre périmètre</CardDescription></div>
          <div className="max-w-full overflow-x-auto pb-1"><TabsList className="w-max" aria-label="Type d'activité"><TabsTrigger value="files">Fichiers</TabsTrigger>{canUseMessaging && <TabsTrigger value="messages">Messages</TabsTrigger>}{data.role === "admin" && <TabsTrigger value="journal">Journal</TabsTrigger>}</TabsList></div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <TabsContent value="files" className="mt-0"><FilesActivity files={data.recentFiles} onOpen={() => navigate("/structuration")} /></TabsContent>
          {canUseMessaging && <TabsContent value="messages" className="mt-0"><MessagesActivity messages={data.recentMessages} onOpen={() => navigate("/messagerie")} /></TabsContent>}
          {data.role === "admin" && <TabsContent value="journal" className="mt-0"><JournalActivity entries={data.journalEntries} /></TabsContent>}
        </CardContent>
      </Card>
    </Tabs>
  );
}
