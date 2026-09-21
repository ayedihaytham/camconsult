import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, FileText, MessageCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { cn, formatRelative, formatTime } from "@/lib/utils";

type ActivityLabel = "Fichier" | "Message" | "Journal";
type ActivityFilter = "Tout" | ActivityLabel;
interface ActivityItem { id: string; label: ActivityLabel; title: string; description: string; updatedAt: string; icon: LucideIcon; route?: string; unread?: number; }

function dayGroup(value: string) {
  const date = new Date(value);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startToday.getTime() - startDate.getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return "Cette semaine";
  return "Plus ancien";
}

export function ActivityTab({ data, canUseMessaging }: { data: DashboardViewModel; canUseMessaging: boolean }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ActivityFilter>("Tout");
  const items = useMemo<ActivityItem[]>(() => {
    const files = data.recentFiles.map((file) => ({ id: `file-${file.id}`, label: "Fichier" as const, title: file.name, description: `${file.societeName}${file.format ? ` · ${file.format.toUpperCase()}` : ""}`, updatedAt: file.updatedAt, icon: FileText, route: "/structuration" }));
    const messages = canUseMessaging ? data.recentMessages.map((message) => ({ id: `message-${message.id}`, label: "Message" as const, title: message.label, description: message.preview || "Aperçu indisponible", updatedAt: message.updatedAt, icon: MessageCircle, route: "/messagerie", unread: message.unread })) : [];
    const journal = data.role === "admin" ? data.journalEntries.map((entry) => ({ id: `journal-${entry.id}`, label: "Journal" as const, title: entry.actor, description: entry.label, updatedAt: entry.at, icon: Activity })) : [];
    return [...files, ...messages, ...journal].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 16);
  }, [canUseMessaging, data.journalEntries, data.recentFiles, data.recentMessages, data.role]);
  const filters: ActivityFilter[] = ["Tout", "Fichier", ...(canUseMessaging ? ["Message" as const] : []), ...(data.role === "admin" ? ["Journal" as const] : [])];
  const filtered = filter === "Tout" ? items : items.filter((item) => item.label === filter);
  const groups = ["Aujourd'hui", "Hier", "Cette semaine", "Plus ancien"].map((label) => ({ label, items: filtered.filter((item) => dayGroup(item.updatedAt) === label) })).filter((group) => group.items.length > 0);

  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="flex flex-col gap-3 py-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-base font-semibold text-primary">Activité récente</h2><p className="mt-0.5 text-xs text-muted-foreground">Fichiers, échanges et opérations accessibles dans votre périmètre</p></div><div className="flex max-w-full gap-4 overflow-x-auto border-b border-border" aria-label="Filtrer l'activité">{filters.map((option) => <button key={option} type="button" onClick={() => setFilter(option)} className={cn("relative shrink-0 pb-2 text-xs font-medium text-muted-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent after:opacity-0", filter === option && "text-primary after:opacity-100")}>{option}</button>)}</div></header>
      {filtered.length === 0 ? <DashboardEmptyState icon={Activity} title="Aucune activité récente" description="Les nouveaux éléments accessibles apparaîtront ici." /> : groups.map((group, groupIndex) => (
        <section key={group.label} aria-labelledby={`activity-${group.label.replace(/\W/g, "-")}`} className={cn(groupIndex > 0 && "mt-4")}>
          <h3 id={`activity-${group.label.replace(/\W/g, "-")}`} className="mb-2 border-b border-primary/25 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary">{group.label}</h3>
          <ul>{group.items.map((item) => { const Icon = item.icon; return (
            <li key={item.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary"><Icon className="size-3.5" aria-hidden="true" /></span>
              <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="truncate text-sm font-medium text-foreground">{item.title}</p><Badge variant="outline">{item.label}</Badge>{item.unread && item.unread > 0 ? <Badge>{item.unread} non lu{item.unread > 1 ? "s" : ""}</Badge> : null}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p><time dateTime={item.updatedAt} className="mt-1 block text-[0.68rem] text-muted-foreground sm:hidden">{formatRelative(item.updatedAt)}</time></div>
              <div className="flex items-center gap-1.5"><time dateTime={item.updatedAt} className="hidden whitespace-nowrap text-[0.68rem] text-muted-foreground sm:block" title={formatRelative(item.updatedAt)}>{formatTime(item.updatedAt)}</time>{item.route ? <Button variant="ghost" size="icon-sm" onClick={() => item.route && navigate(item.route)} aria-label={`Ouvrir ${item.label.toLowerCase()} : ${item.title}`}><ArrowRight className="size-4" /></Button> : null}</div>
            </li>
          ); })}</ul>
        </section>
      ))}
    </section>
  );
}
