import { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, FileText, MessageCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { formatRelative, formatTime } from "@/lib/utils";

type ActivityLabel = "Fichier" | "Message" | "Journal";
type ActivityFilter = "Tout" | ActivityLabel;
interface ActivityItem {
  id: string; label: ActivityLabel; title: string; description: string;
  updatedAt: string; icon: LucideIcon; route?: string; unread?: number;
}

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

export function ActivityTab({ data, canUseMessaging, loading = false, error = false }: {
  data: DashboardViewModel; canUseMessaging: boolean; loading?: boolean; error?: boolean;
}) {
  const navigate = useNavigate();
  const id = useId();
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

  return <section className="dashboard-major min-w-0 border-t-2 border-primary">
    <div className="max-w-4xl">
      <header className="py-3">
        <h2 className="text-base font-semibold text-primary">Activité récente</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Derniers éléments accessibles, pas un historique complet. Les messages sont ceux de votre compte.</p>
        <div role="group" aria-label="Filtrer l’activité" className="mt-3 flex flex-wrap gap-1">
          {filters.map((option) => <Button key={option} type="button" variant="ghost" aria-pressed={filter === option} onClick={() => setFilter(option)} className="dashboard-choice min-h-11 px-3 text-xs">{option}</Button>)}
        </div>
      </header>
      {(loading || error) && <p role="status" className="pb-3 text-xs text-muted-foreground">{loading ? "Le journal est en chargement." : "Le journal est indisponible ; les fichiers et messages restent consultables."}</p>}
      {filtered.length === 0 ? <DashboardEmptyState icon={Activity} title={loading || error ? "Aucun élément parmi les sources chargées" : "Aucune activité récente"} description={loading || error ? "Ce résultat est partiel." : "Les nouveaux éléments accessibles apparaîtront ici."} /> : groups.map((group, groupIndex) => (
        <section key={group.label} aria-labelledby={`${id}-${groupIndex}`} className="dashboard-group">
          <h3 id={`${id}-${groupIndex}`} className="dashboard-subsection flex items-center justify-between gap-3 border-b border-primary/25 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary"><span>{group.label}</span><span className="min-w-6 text-right tabular-nums text-muted-foreground">{group.items.length}</span></h3>
          <ul>{group.items.map((item) => {
            const Icon = item.icon;
            return <li key={item.id} className="dashboard-row grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_2.75rem] items-start gap-3 border-b border-border py-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_2.75rem]">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary"><Icon className="size-3.5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2"><p className="break-words text-sm font-medium text-foreground">{item.title}</p><Badge variant="outline" className="dashboard-badge dashboard-badge--neutral">{item.label}</Badge>{item.unread && item.unread > 0 ? <Badge className="dashboard-badge dashboard-badge--info">{item.unread} non lu{item.unread > 1 ? "s" : ""}</Badge> : null}</div>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                <time dateTime={item.updatedAt} className="mt-2 block text-xs text-muted-foreground sm:hidden">{formatRelative(item.updatedAt)} · {formatTime(item.updatedAt)}</time>
              </div>
              <time dateTime={item.updatedAt} className="hidden pt-0.5 text-right text-xs leading-relaxed text-muted-foreground sm:block"><span className="block">{formatRelative(item.updatedAt)}</span><span className="block tabular-nums">{formatTime(item.updatedAt)}</span></time>
              <div>{item.route && <Button variant="ghost" size="icon" className="dashboard-navigation size-11" onClick={() => item.route && navigate(item.route)} aria-label={`Ouvrir ${item.label.toLowerCase()} : ${item.title}`}><ArrowRight className="size-4" aria-hidden="true" /></Button>}</div>
            </li>;
          })}</ul>
        </section>
      ))}
    </div>
  </section>;
}
