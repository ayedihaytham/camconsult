import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, FileText, MessageCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { formatRelative } from "@/lib/utils";

interface ActivityItem {
  id: string;
  label: "Fichier" | "Message" | "Journal";
  title: string;
  description: string;
  updatedAt: string;
  icon: LucideIcon;
  route?: string;
  unread?: number;
}

export function ActivityTab({ data, canUseMessaging }: { data: DashboardViewModel; canUseMessaging: boolean }) {
  const navigate = useNavigate();
  const items = useMemo<ActivityItem[]>(() => {
    const files = data.recentFiles.map((file) => ({
      id: `file-${file.id}`,
      label: "Fichier" as const,
      title: file.name,
      description: `${file.societeName}${file.format ? ` · ${file.format.toUpperCase()}` : ""}`,
      updatedAt: file.updatedAt,
      icon: FileText,
      route: "/structuration",
    }));
    const messages = canUseMessaging ? data.recentMessages.map((message) => ({
      id: `message-${message.id}`,
      label: "Message" as const,
      title: message.label,
      description: message.preview || "Aperçu indisponible",
      updatedAt: message.updatedAt,
      icon: MessageCircle,
      route: "/messagerie",
      unread: message.unread,
    })) : [];
    const journal = data.role === "admin" ? data.journalEntries.map((entry) => ({
      id: `journal-${entry.id}`,
      label: "Journal" as const,
      title: entry.actor,
      description: entry.label,
      updatedAt: entry.at,
      icon: Activity,
    })) : [];

    return [...files, ...messages, ...journal]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 16);
  }, [canUseMessaging, data.journalEntries, data.recentFiles, data.recentMessages, data.role]);

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="p-4">
        <CardTitle>Activité récente</CardTitle>
        <CardDescription>Les derniers fichiers, échanges et opérations accessibles dans votre périmètre</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {items.length === 0 ? (
          <DashboardEmptyState
            icon={Activity}
            title="Aucune activité récente"
            description="Les nouveaux fichiers, échanges et opérations du journal apparaîtront ici."
          />
        ) : (
          <ul>
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  {index > 0 && <Separator />}
                  <div className="flex min-w-0 items-center gap-3 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                        <Badge variant="outline" className="shrink-0">
                          {item.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.unread && item.unread > 0 ? <Badge>{item.unread}</Badge> : null}
                      <time dateTime={item.updatedAt} className="hidden text-[0.68rem] text-muted-foreground sm:block">
                        {formatRelative(item.updatedAt)}
                      </time>
                      {item.route ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { if (item.route) navigate(item.route); }}
                          aria-label={`Ouvrir ${item.label.toLowerCase()} : ${item.title}`}
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <time dateTime={item.updatedAt} className="mb-1 block pl-11 text-[0.68rem] text-muted-foreground sm:hidden">
                    {formatRelative(item.updatedAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
