import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bell, ClipboardCheck, Landmark, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { cn, formatRelative } from "@/lib/utils";
import type { AttentionGroup, DashboardAttentionItem } from "@/lib/dashboard/dashboardData";

const GROUP_LABELS: Record<AttentionGroup, string> = { urgent: "Urgent", review: "À vérifier", communication: "Messages / Communication", other: "Autres" };
const ICONS = { collecte: ClipboardCheck, message: MessageCircle, notification: Bell, societe: AlertTriangle, bordereau: Landmark } as const;

function badgeVariant(item: DashboardAttentionItem) {
  if (item.severity === "critical") return "destructive" as const;
  if (item.severity === "warning") return "warning" as const;
  if (item.severity === "review") return "secondary" as const;
  return "outline" as const;
}

function presentation(item: DashboardAttentionItem) {
  if (item.severity === "critical") return { icon: "bg-destructive/10 text-destructive", edge: "border-l-destructive/70", badge: "" };
  if (item.severity === "warning") return { icon: "bg-warning/10 text-warning", edge: "border-l-warning/70", badge: "" };
  return { icon: "bg-primary/10 text-primary", edge: "border-l-primary/60", badge: "border-primary/15 bg-primary/8 text-primary" };
}

interface AttentionListProps { items: DashboardAttentionItem[]; limit?: number; grouped?: boolean; }

export function AttentionList({ items, limit, grouped = false }: AttentionListProps) {
  const navigate = useNavigate();
  const shown = typeof limit === "number" ? items.slice(0, limit) : items;
  if (shown.length === 0) return <DashboardEmptyState title="Tout est à jour" description="Aucun élément ne nécessite votre attention." />;
  const groups = (Object.keys(GROUP_LABELS) as AttentionGroup[]).map((group) => ({ group, items: shown.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0);

  return (
    <div>
      {groups.map((entry) => (
        <section key={entry.group} aria-labelledby={`attention-${entry.group}`}>
          {grouped && <h3 id={`attention-${entry.group}`} className="flex items-center justify-between border-b border-primary/25 pb-2 pt-5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary first:pt-0"><span>{GROUP_LABELS[entry.group]}</span><span className="tabular-nums text-muted-foreground">{entry.items.length}</span></h3>}
          <ul>
            {entry.items.map((item) => {
              const Icon = ICONS[item.type];
              const visual = presentation(item);
              return (
                <li key={item.id} className={cn("grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-l border-border py-3 pl-2", visual.edge)}>
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", visual.icon)}><Icon className="size-3.5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="min-w-0 truncate text-sm font-medium text-foreground">{item.title}</p><Badge variant={badgeVariant(item)} className={cn("shrink-0", visual.badge)}>{item.badge}</Badge></div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                    <time dateTime={item.date} className="mt-1 block text-[0.68rem] text-muted-foreground md:hidden">{formatRelative(item.date)}</time>
                  </div>
                  <div className="flex items-center gap-1.5"><time dateTime={item.date} className="hidden whitespace-nowrap text-[0.68rem] text-muted-foreground md:block">{formatRelative(item.date)}</time><Button variant="ghost" size="icon-sm" onClick={() => navigate(item.route)} aria-label={`Ouvrir ${item.title}`}><ArrowRight className="size-3.5" aria-hidden="true" /></Button></div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
