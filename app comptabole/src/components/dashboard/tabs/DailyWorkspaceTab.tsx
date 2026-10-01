import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { WorkspaceSection } from "../WorkspaceSection";
import { CollectionTransmissions } from "../CollectionTransmissions";
import { TaskRows } from "../TaskRows";
import { AttentionList } from "../attention/AttentionList";

export function DailyWorkspaceTab({ data, now, loading, error, adminDataLoading, adminDataError, canUseMessaging }: { data: DashboardViewModel; now: Date; loading: boolean; error: boolean; adminDataLoading: boolean; adminDataError: boolean; canUseMessaging: boolean }) {
  const admin = data.role === "admin";
  const resume = data.resumeTask;
  const ongoing = data.taskRows.filter((task) => task.statut === "en_cours" && task.id !== resume?.id);
  const todo = data.taskRows.filter((task) => task.statut === "a_faire");
  const attention = data.attentionItems.filter((item) => item.type !== "message");
  const unread = data.unreadMessages;
  const partial = loading || error || adminDataLoading || adminDataError;
  const attentionSummary = [
    { count: attention.filter((item) => item.severity === "critical").length, label: "en retard", tone: "dashboard-badge--danger" },
    { count: attention.filter((item) => item.severity === "warning").length, label: "correction", tone: "dashboard-badge--warning" },
    { count: attention.filter((item) => item.group === "review").length, label: "à examiner", tone: "dashboard-badge--neutral" },
    { count: attention.filter((item) => item.group === "other").length, label: "à consulter", tone: "dashboard-badge--info" },
  ].filter((item) => item.count > 0);
  return <div className="dashboard-overview-grid grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="dashboard-main min-w-0">
      <section data-tour="dashboard-resume" className="dashboard-resume">
        <h2 className="text-lg font-semibold tracking-tight text-primary">{admin ? "Reprendre le travail en cours" : "Reprendre mon travail"}</h2>
        {resume ? <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0"><Badge className="dashboard-badge dashboard-badge--progress">En cours</Badge><p className="mt-2 break-words text-lg font-semibold text-primary">{resume.titre}</p><p className="mt-1 text-xs text-muted-foreground">{resume.societeName}{admin ? ` · ${resume.assigneeName}` : ""}</p></div>
          <Link to="/taches" className="dashboard-resume-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">Reprendre<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div> : <p className="mt-3 text-sm text-muted-foreground">Rien à reprendre pour le moment. Retrouvez les tâches à commencer ci-dessous.</p>}
      </section>
      <CollectionTransmissions deadlines={data.deadlines} now={now} loading={loading} error={error} />
      <div data-tour="dashboard-tasks">
        <div className="dashboard-task-section dashboard-task-section--ongoing">
          <WorkspaceSection title={admin ? "Travail en cours" : "Mes tâches en cours"} description="Tâches déjà commencées, sans date limite." route="/?tab=tasks" linkLabel="Tâches">
            <TaskRows tasks={ongoing.slice(0, 3)} admin={admin} empty={resume ? "Votre tâche en cours figure dans Reprendre." : "Aucune tâche en cours."} />
          </WorkspaceSection>
        </div>
        <div className="dashboard-task-section dashboard-task-section--todo">
          <WorkspaceSection title="Tâches à commencer" route="/?tab=tasks" linkLabel={`${todo.length} à faire`}>
            <TaskRows tasks={todo.slice(0, 3)} admin={admin} empty="Aucune tâche à commencer dans ce périmètre." />
          </WorkspaceSection>
        </div>
      </div>
    </div>
    <aside className="dashboard-rail min-w-0 space-y-5 bg-muted/25 px-4 py-4" role="region" aria-label="Attention et communication">
      <div className="dashboard-mobile-attention">
        <WorkspaceSection title="À traiter" description={partial ? "Suivi partiel : certaines sources sont en chargement ou indisponibles." : "Échéances, corrections et éléments à examiner."} target="dashboard-attention" route="/?tab=attention" linkLabel="Tout voir">
          {!partial && attentionSummary.length > 0 && <div role="group" aria-label="Résumé des éléments à traiter" className="dashboard-attention-summary">{attentionSummary.map((item) => <Badge key={item.label} className={`dashboard-badge ${item.tone}`}>{item.count} {item.label}{item.label === "correction" && item.count > 1 ? "s" : ""}</Badge>)}</div>}
          {attention.length > 0 ? <AttentionList items={attention} limit={3} grouped compact /> : <p className="py-4 text-sm text-muted-foreground">{partial ? "Le suivi sera complété après chargement." : "Aucun élément à traiter dans ce périmètre."}</p>}
        </WorkspaceSection>
      </div>
      {canUseMessaging && <div className="dashboard-mobile-messages"><WorkspaceSection title="Mes messages non lus" target="dashboard-communication" route="/messagerie" linkLabel="Messagerie">
        {unread.length ? <ul>{unread.slice(0, 3).map((message) => <li key={message.id} className="border-b border-border py-3"><Link to="/messagerie" className="dashboard-message-unread dashboard-navigation block min-h-11 rounded px-2 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-primary"><span>{message.label}</span><Badge className="dashboard-badge dashboard-badge--info">{message.unread} non lu{message.unread > 1 ? "s" : ""}</Badge></p><p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{message.preview || "Nouveau message"}</p></Link></li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">Aucun message non lu.</p>}
      </WorkspaceSection></div>}
      {admin && <div className="dashboard-mobile-team"><WorkspaceSection title="Répartition du travail"><Link className="dashboard-navigation flex min-h-11 items-center gap-2 text-xs font-medium text-primary" to="/?tab=team">Voir le travail de l’équipe<ArrowRight className="size-4" aria-hidden="true" /></Link></WorkspaceSection></div>}
    </aside>
  </div>;
}
