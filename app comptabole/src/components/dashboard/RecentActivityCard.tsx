import { useState } from "react";
import { FileText, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface RecentFile {
  id: string;
  label: string;
  format?: string;
  modifiedLabel: string;
}

interface RecentConversation {
  id: string;
  label: string;
  message: string;
  initials: string;
  avatarClassName: string;
}

interface RecentActivityCardProps {
  files: RecentFile[];
  conversations: RecentConversation[];
  onOpenFiles: () => void;
  onOpenConversations: () => void;
}

export function RecentActivityCard({
  files,
  conversations,
  onOpenFiles,
  onOpenConversations,
}: RecentActivityCardProps) {
  const [activeTab, setActiveTab] = useState("files");
  const isFilesTab = activeTab === "files";
  const openActiveTab = isFilesTab ? onOpenFiles : onOpenConversations;
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <Card className="min-w-0 shadow-none">
        <CardHeader className="min-w-0 gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <CardTitle>Activité récente</CardTitle>
            <CardDescription className="mt-1">Documents et échanges du cabinet</CardDescription>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            <TabsList aria-label="Type d'activité récente" className="max-w-full">
              <TabsTrigger value="files">Fichiers</TabsTrigger>
              <TabsTrigger value="conversations">Échanges</TabsTrigger>
            </TabsList>
            <Button variant="link" size="sm" onClick={openActiveTab} className="h-8 px-1">
              {isFilesTab ? "Voir tous" : "Ouvrir"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 p-4 pt-0 sm:p-5 sm:pt-0">
          <TabsContent value="files" className="mt-0">
            {files.length === 0 ? (
              <EmptyActivity icon={FileText} label="Aucun fichier récent" />
            ) : (
              <ul className="divide-y divide-border">
                {files.map((file) => (
                  <li key={file.id}>
                    <button
                      onClick={onOpenFiles}
                      className="flex w-full min-w-0 items-center gap-3 rounded-md py-2.5 text-left first:pt-0 last:pb-0 hover:bg-muted/60 hover:text-primary"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileText className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{file.label}</span>
                        <span className="block text-xs text-muted-foreground">{file.modifiedLabel}</span>
                      </span>
                      {file.format && (
                        <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">{file.format}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="conversations" className="mt-0">
            {conversations.length === 0 ? (
              <EmptyActivity icon={MessageSquare} label="Aucun échange récent" />
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      onClick={onOpenConversations}
                      className="flex w-full min-w-0 items-center gap-3 rounded-md py-2.5 text-left first:pt-0 last:pb-0 hover:bg-muted/60 hover:text-primary"
                    >
                      <Avatar className="size-9">
                        <AvatarFallback className={cn("text-xs font-semibold", conversation.avatarClassName)}>
                          {conversation.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{conversation.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{conversation.message}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}

function EmptyActivity({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span>{label}</span>
    </div>
  );
}
