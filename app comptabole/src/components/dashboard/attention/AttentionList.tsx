import { Link } from "react-router-dom";
import { useId } from "react";
import { AlertTriangle, ArrowRight, Bell, ClipboardCheck, Landmark, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { cn, formatRelative } from "@/lib/utils";
import type { DashboardAttentionItem } from "@/lib/dashboard/dashboardData";

const GROUP_LABELS = { overdue: "Échéances dépassées", corrections: "Corrections", review: "À examiner", communication: "Communication", other: "Autres éléments" };
type DisplayGroup = keyof typeof GROUP_LABELS;
function displayGroup(item: DashboardAttentionItem): DisplayGroup { return item.group === "urgent" ? item.severity === "critical" ? "overdue" : "corrections" : item.group; }
const ICONS = { collecte: ClipboardCheck, message: MessageCircle, notification: Bell, societe: AlertTriangle, bordereau: Landmark } as const;

function badgeVariant(item: DashboardAttentionItem) {
  if (item.severity === "critical") return "destructive" as const;
  if (item.severity === "warning") return "warning" as const;
  if (item.severity === "review") return "secondary" as const;
  return "outline" as const;
}

function badgeTone(item: DashboardAttentionItem) {
  if (item.severity === "critical") return "dashboard-badge--danger";
  if (item.severity === "warning") return "dashboard-badge--warning";
  if (item.severity === "information") return "dashboard-badge--info";
  return "dashboard-badge--neutral";
}

function presentation(item: DashboardAttentionItem) {
  if (item.severity === "critical") return { icon: "bg-destructive/10 text-destructive", edge: "border-l-destructive/70" };
  if (item.severity === "warning") return { icon: "bg-warning/10 text-warning", edge: "border-l-warning/70" };
  return { icon: "bg-primary/10 text-primary", edge: "border-l-primary/60" };
}

interface AttentionListProps { items: DashboardAttentionItem[]; limit?: number; grouped?: boolean; compact?: boolean; }

export function AttentionList({ items, limit, grouped = false, compact = false }: AttentionListProps) {
  const id = useId();
  const shown = compact && typeof limit === "number" ? selectPriorityPreview(items, limit) : typeof limit === "number" ? items.slice(0, limit) : items;
  if (shown.length === 0) return <DashboardEmptyState title="Tout est à jour" description="Aucun élément ne nécessite votre attention." />;
  const groups = (Object.keys(GROUP_LABELS) as DisplayGroup[]).map((group) => ({ group, items: shown.filter((item) => displayGroup(item) === group) })).filter((entry) => entry.items.length > 0);

  return (
    <div>
      {groups.map((entry, groupIndex) => (
        <section key={entry.group} aria-labelledby={grouped ? `${id}-${entry.group}` : undefined} className={cn(grouped && "dashboard-group", grouped && groupIndex > 0 && "mt-4")}>
          {grouped && <h3 id={`${id}-${entry.group}`} className="dashboard-subsection mb-2 flex items-center justify-between border-b border-primary/25 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary"><span>{GROUP_LABELS[entry.group]}</span><span className={cn("min-w-6 shrink-0 text-right tabular-nums", entry.group === "overdue" ? "text-destructive" : entry.group === "corrections" ? "text-warning" : "text-muted-foreground")}>{entry.items.length}</span></h3>}
          <ul>
            {entry.items.map((item) => {
              const Icon = ICONS[item.type];
              const visual = presentation(item);
              return (
                <li key={item.id} data-urgency={item.severity} className={cn("dashboard-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-l border-border py-3 pl-2", compact && "dashboard-attention-preview", visual.edge)}>
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", visual.icon)}><Icon className="size-3.5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className={cn("min-w-0 break-words text-sm text-foreground", item.severity === "critical" ? "font-semibold text-destructive" : item.severity === "warning" ? "font-semibold" : "font-medium")}>{item.title}</p><Badge variant={badgeVariant(item)} className={cn("dashboard-badge shrink-0", badgeTone(item))}>{item.badge}</Badge></div>
                    <p className="mt-1 break-words line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                    <time dateTime={item.date} className={cn("mt-1 block text-[0.68rem] text-muted-foreground", !compact && "md:hidden")}>{formatRelative(item.date)}</time>
                  </div>
                  <Link to={item.route} className="dashboard-attention-open dashboard-navigation flex size-11 items-center justify-center rounded text-muted-foreground" aria-label={`Ouvrir ${item.title}`}><ArrowRight className="size-4" aria-hidden="true" /></Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function selectPriorityPreview(items: DashboardAttentionItem[], limit: number) {
  const priority: DisplayGroup[] = ["overdue", "corrections", "review", "other"];
  const selected: DashboardAttentionItem[] = [];
  const selectedIds = new Set<string>();
  for (const group of priority) {
    const item = items.find((candidate) => displayGroup(candidate) === group);
    if (item && selected.length < limit) {
      selected.push(item);
      selectedIds.add(item.id);
    }
  }
  for (const item of items) {
    if (selected.length >= limit) break;
    if (!selectedIds.has(item.id)) selected.push(item);
  }
  return selected;
}
