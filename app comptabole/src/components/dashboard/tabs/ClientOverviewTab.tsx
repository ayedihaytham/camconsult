import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, ClipboardCheck, FileText, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { cn, formatDate, formatRelative } from "@/lib/utils";

export function ClientOverviewTab({ data, loading }: { data: DashboardViewModel; loading: boolean }) {
  const navigate = useNavigate();
  const file = data.recentFiles[0];
  const message = data.recentMessages[0];
  const collection = data.currentCollection;
  const deadline = data.nextDeadline;
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="py-3"><h2 className="text-base font-semibold text-primary">Votre espace</h2><p className="mt-0.5 text-xs text-muted-foreground">Les prochains éléments utiles dans vos échanges avec le cabinet</p></header>
      <div className="grid min-w-0 gap-x-6 sm:grid-cols-2">
        {loading ? [0, 1, 2, 3].map((item) => <div key={item} className="border-t border-border py-4"><Skeleton className="h-16 w-full" /></div>) : (
          <>
            <ClientInsight icon={ClipboardCheck} label="Collecte en cours" title={collection?.periode ?? "Aucune collecte ouverte"} meta={collection ? COLLECTE_STATUT_LABELS[collection.statut] : undefined} action={collection ? () => navigate(`/collectes/${collection.id}`) : undefined} />
            <ClientInsight icon={CalendarClock} label="Prochaine échéance" title={deadline ? formatDate(deadline.echeance) : "Aucune échéance à venir"} meta={deadline?.badge} action={deadline ? () => navigate(deadline.route) : undefined} warning={deadline ? deadline.daysFromToday <= 0 : false} />
            <ClientInsight icon={FileText} label="Document récent" title={file?.name ?? "Aucun fichier récent"} meta={file ? `${file.societeName} · ${formatRelative(file.updatedAt)}` : undefined} action={file ? () => navigate("/structuration") : undefined} />
            <ClientInsight icon={MessageCircle} label="Dernier échange" title={message?.label ?? "Aucun échange récent"} meta={message?.preview} action={message ? () => navigate("/messagerie") : undefined} />
          </>
        )}
      </div>
    </section>
  );
}

function ClientInsight({ icon: Icon, label, title, meta, action, warning = false }: { icon: typeof FileText; label: string; title: string; meta?: string; action?: () => void; warning?: boolean; }) {
  return (
    <section className={cn("min-w-0 border-t border-border py-4", !action && "text-muted-foreground")}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="size-4" aria-hidden="true" />{label}</div>
      <div className="mt-2 flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{title}</p>{meta && (warning ? <Badge variant="warning" className="mt-1.5">{meta}</Badge> : <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p>)}</div>{action && <Button variant="ghost" size="icon-sm" onClick={action} aria-label={`Ouvrir ${label}`}><ArrowRight className="size-4" /></Button>}</div>
    </section>
  );
}
