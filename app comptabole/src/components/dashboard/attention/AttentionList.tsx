import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bell, ClipboardCheck, Landmark, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { AttentionGroup, DashboardAttentionItem } from "@/lib/dashboard/dashboardData";

const GROUP_LABELS: Record<AttentionGroup, string> = {
  urgent: "Urgent",
  review: "À vérifier",
  communication: "Messages / Communication",
  other: "Autres",
};

const ICONS = {
  collecte: ClipboardCheck,
  message: MessageCircle,
  notification: Bell,
  societe: AlertTriangle,
  bordereau: Landmark,
} as const;

function badgeVariant(item: DashboardAttentionItem) {
  if (item.severity === "critical") return "destructive" as const;
  if (item.severity === "warning") return "warning" as const;
  if (item.severity === "review") return "secondary" as const;
  return "outline" as const;
}

interface AttentionListProps {
  items: DashboardAttentionItem[];
  limit?: number;
  grouped?: boolean;
}

export function AttentionList({ items, limit, grouped = false }: AttentionListProps) {
  const navigate = useNavigate();
  const shown = typeof limit === "number" ? items.slice(0, limit) : items;

  if (shown.length === 0) {
    return <DashboardEmptyState title="Tout est à jour" description="Aucun élément ne nécessite votre attention." />;
  }

  const groups = (Object.keys(GROUP_LABELS) as AttentionGroup[])
    .map((group) => ({ group, items: shown.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div>
      {groups.map((entry, groupIndex) => (
        <section key={entry.group} aria-labelledby={`attention-${entry.group}`}>
          {grouped && (
            <h3 id={`attention-${entry.group}`} className="bg-muted/30 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {GROUP_LABELS[entry.group]}
            </h3>
          )}
          <ul className="px-4">
            {entry.items.map((item, index) => {
              const Icon = ICONS[item.type];
              return (
                <li key={item.id}>
                  {(index > 0 || (!grouped && groupIndex > 0)) && <Separator />}
                  <div className="flex min-w-0 items-start gap-3 py-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">{item.title}</p>
                        <Badge variant={badgeVariant(item)} className="shrink-0">{item.badge}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      onClick={() => navigate(item.route)}
                    >
                      <span className="hidden sm:inline">Ouvrir</span>
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                      <span className="sr-only sm:hidden">Ouvrir {item.title}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
