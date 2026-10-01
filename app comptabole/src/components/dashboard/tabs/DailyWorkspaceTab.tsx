import { Bell, ClipboardList, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { WorkspaceSection } from "../WorkspaceSection";
import { CollectionTransmissions } from "../CollectionTransmissions";
import { TaskRows } from "../TaskRows";
import { AttentionList } from "../attention/AttentionList";
import { ResumeWork } from "../ResumeWork";
import { UnreadMessagesPreview } from "../UnreadMessagesPreview";
import { TeamWorkPreview } from "../TeamWorkPreview";

interface DailyWorkspaceContextProps {
  data: DashboardViewModel;
  loading: boolean;
  error: boolean;
  adminDataLoading: boolean;
  adminDataError: boolean;
  canUseMessaging: boolean;
}

export function DailyWorkspaceTab({
  data,
  now,
  wide,
  loading,
  error,
  adminDataLoading,
  adminDataError,
  canUseMessaging,
}: DailyWorkspaceContextProps & { now: Date; wide: boolean }) {
  const admin = data.role === "admin";
  const resume = data.resumeTask;
  const ongoing = data.taskRows.filter(
    (task) => task.statut === "en_cours" && task.id !== resume?.id,
  );
  const todo = data.taskRows.filter((task) => task.statut === "a_faire");
  const resumeSurface = <ResumeWork task={resume} admin={admin} />;
  const transmissions = (
    <CollectionTransmissions
      deadlines={data.deadlines}
      now={now}
      loading={loading}
      error={error}
    />
  );
  const ongoingPreview = (
    <div
      data-tour="dashboard-tasks"
      className="dashboard-task-section dashboard-task-section--ongoing"
    >
      <WorkspaceSection
        title={admin ? "Travail en cours" : "Mes tâches en cours"}
        icon={ClipboardList}
        description="Tâches déjà commencées, sans date limite."
        route="/?tab=tasks"
        linkLabel="Tâches"
      >
        <TaskRows
          tasks={ongoing.slice(0, 3)}
          admin={admin}
          empty={
            resume
              ? "Votre tâche en cours figure dans Reprendre."
              : "Aucune tâche en cours."
          }
        />
      </WorkspaceSection>
    </div>
  );
  const todoPreview = (
    <div className="dashboard-task-section dashboard-task-section--todo">
      <WorkspaceSection
        title="Tâches à commencer"
        icon={ListTodo}
        description="À faire quand vous êtes disponible."
        route="/?tab=tasks"
        linkLabel={`${todo.length} à faire`}
      >
        <TaskRows
          tasks={todo.slice(0, 3)}
          admin={admin}
          empty="Aucune tâche à commencer dans ce périmètre."
        />
      </WorkspaceSection>
    </div>
  );
  return (
    <div className="dashboard-overview-grid">
      {wide ? (
        <>
          <div className="dashboard-main min-w-0">
            {resumeSurface}
            {transmissions}
            <div className="dashboard-task-pair">
              {ongoingPreview}
              {todoPreview}
            </div>
          </div>
        </>
      ) : (
        <>
          {resumeSurface}
          {transmissions}
          <DailyWorkspaceAttention
            data={data}
            partial={loading || error || adminDataLoading || adminDataError}
          />
          {ongoingPreview}
          {todoPreview}
          {canUseMessaging && (
            <div className="dashboard-mobile-messages">
              <UnreadMessagesPreview messages={data.unreadMessages} />
            </div>
          )}
          {admin && (
            <div className="dashboard-mobile-team">
              <TeamWorkPreview members={data.team} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function DailyWorkspaceRail({
  data,
  loading,
  error,
  adminDataLoading,
  adminDataError,
  canUseMessaging,
}: DailyWorkspaceContextProps) {
  return (
    <aside
      className="dashboard-rail min-w-0"
      role="region"
      aria-label="Attention et communication"
    >
      <DailyWorkspaceAttention
        data={data}
        partial={loading || error || adminDataLoading || adminDataError}
      />
      {canUseMessaging && (
        <div className="dashboard-mobile-messages">
          <UnreadMessagesPreview messages={data.unreadMessages} />
        </div>
      )}
      {data.role === "admin" && (
        <div className="dashboard-mobile-team">
          <TeamWorkPreview members={data.team} />
        </div>
      )}
    </aside>
  );
}

function DailyWorkspaceAttention({
  data,
  partial,
}: {
  data: DashboardViewModel;
  partial: boolean;
}) {
  const attention = data.attentionItems.filter(
    (item) => item.type !== "message",
  );
  const attentionSummary = [
    {
      count: attention.filter((item) => item.severity === "critical").length,
      label: "en retard",
      tone: "dashboard-badge--danger",
    },
    {
      count: attention.filter((item) => item.severity === "warning").length,
      label: "correction",
      tone: "dashboard-badge--warning",
    },
    {
      count: attention.filter((item) => item.group === "review").length,
      label: "à examiner",
      tone: "dashboard-badge--warning",
    },
    {
      count: attention.filter((item) => item.group === "other").length,
      label: "à consulter",
      tone: "dashboard-badge--info",
    },
  ].filter((item) => item.count > 0);
  return (
    <div className="dashboard-mobile-attention">
      <WorkspaceSection
        title="À traiter"
        icon={Bell}
        description={
          partial
            ? "Suivi partiel : certaines sources sont en chargement ou indisponibles."
            : "Échéances, corrections et éléments à examiner."
        }
        target="dashboard-attention"
        route="/?tab=attention"
        linkLabel="Tout voir"
      >
        {!partial && attentionSummary.length > 0 && (
          <div
            role="group"
            aria-label="Résumé des éléments à traiter"
            className="dashboard-attention-summary"
          >
            {attentionSummary.map((item) => (
              <Badge
                key={item.label}
                className={`dashboard-badge ${item.tone}`}
              >
                {item.count} {item.label}
                {item.label === "correction" && item.count > 1 ? "s" : ""}
              </Badge>
            ))}
          </div>
        )}
        {attention.length > 0 ? (
          <AttentionList items={attention} limit={3} grouped compact />
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            {partial
              ? "Le suivi sera complété après chargement."
              : "Aucun élément à traiter dans ce périmètre."}
          </p>
        )}
      </WorkspaceSection>
    </div>
  );
}
