import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, ClipboardCheck, ListChecks, MessageSquareText } from "lucide-react";
import { WorkspaceSection, WorkspaceLoading } from "../WorkspaceSection";
import { CollecteStatusDot, StatusDot } from "@/components/ledger/StatusDot";
import { DashboardWeekSelector } from "../DashboardWeekSelector";
import { TACHE_STATUT_LABELS } from "@/types";
import { formatDate } from "@/lib/utils";
import { dashboardDateKey, transmissionRows, type DashboardViewModel } from "@/lib/dashboard/dashboardData";

interface Props {
  data: DashboardViewModel;
  loading: boolean;
  error: boolean;
  canUseMessaging: boolean;
  now?: Date;
}

export function AdminOverviewTab({ data, loading, error, canUseMessaging, now = new Date() }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const today = dashboardDateKey(now);
  const days = Array.from({ length: 7 }, (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7 + index));
  const start = dashboardDateKey(days[0]);
  const end = dashboardDateKey(days[6]);
  const day = selected && selected >= start && selected <= end ? selected : start;
  const { selected: collections, upcoming } = transmissionRows(data.deadlines, day);
  function moveWeek(amount: number) {
    const offset = weekOffset + amount;
    setWeekOffset(offset);
    setSelected(dashboardDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7)));
  }
  const tasks = [...data.taskRows.filter((task) => task.statut === "en_cours"), ...data.taskRows.filter((task) => task.statut === "a_faire")];
  const overdue = data.deadlines.filter((item) => item.daysFromToday < 0).length;
  const unread = data.unreadMessages.reduce((sum, message) => sum + message.unread, 0);
  const summaries = [
    { label: "Collectes à examiner", value: loading || error ? "—" : data.collectionCounts.transmis, route: "/?tab=attention", icon: ClipboardCheck, unavailable: loading || error },
    { label: "Tâches ouvertes", value: data.taskCounts.a_faire + data.taskCounts.en_cours, route: "/?tab=tasks", icon: ListChecks },
    { label: "Échéances du jour", value: loading || error ? "—" : collections.length, route: "/?tab=deadlines", icon: CalendarDays, unavailable: loading || error },
    ...(canUseMessaging ? [{ label: "Messages non lus", value: unread, route: "/messagerie", icon: MessageSquareText }] : []),
  ];

  return (
    <div className="admin-overview">
      <nav className="admin-summary" aria-label="L'essentiel du cabinet" data-tour="dashboard-resume">
        {summaries.map(({ label, value, route, icon: Icon, unavailable }) => <Link key={label} to={route} className="admin-summary-item">
          <span className="admin-summary-label"><Icon className="size-4" aria-hidden="true" />{label}</span>
          <span className="admin-summary-value">{value}<ArrowUpRight className="size-4" aria-hidden="true" /></span>
          {unavailable && <span className="admin-summary-unavailable">{loading ? "Chargement…" : "Indisponible"}</span>}
        </Link>)}
      </nav>
      <DashboardWeekSelector days={days} selected={day} today={today} deadlines={data.deadlines} loading={loading} error={error} onSelect={setSelected} onMove={moveWeek} onToday={() => { setWeekOffset(0); setSelected(null); }} />
      <p className="admin-selected-day" aria-live="polite">Collectes du {formatDate(day)} · {loading ? "Chargement…" : error ? "Indisponibles" : `${collections.length} collecte${collections.length > 1 ? "s" : ""}`}</p>
      <div className="admin-briefing-grid">
        <div className="admin-brief-panel">
          <WorkspaceSection title="Collectes du jour" icon={ClipboardCheck} target="dashboard-attention" route="/collectes" linkLabel="Collectes">
            {loading ? <WorkspaceLoading /> : error ? <p className="admin-brief-empty">Le suivi des collectes est indisponible.</p> : collections.length ? <ul>{collections.slice(0, 3).map((item) => <li key={item.id}><Link to={item.route} className="admin-brief-row">
              <div className="min-w-0"><div className="admin-brief-row-heading"><strong>{item.societeName}</strong>{item.statut ? <CollecteStatusDot statut={item.statut} /> : <StatusDot className="text-xs" tone="primary" label={item.badge} />}</div><p>{item.periode}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune collecte prévue à cette date.</p>}
          </WorkspaceSection>
        </div>
        <div className="admin-brief-panel">
          <WorkspaceSection title="Travail à avancer" icon={ListChecks} target="dashboard-tasks" route="/?tab=tasks" linkLabel="Tout voir">
            {tasks.length ? <ul>{tasks.slice(0, 3).map((task) => <li key={task.id}><Link to="/taches" className="admin-brief-row">
              <div className="min-w-0"><div className="admin-brief-row-heading"><strong>{task.titre}</strong><StatusDot className="text-xs" tone={task.statut === "en_cours" ? "primary" : "muted"} label={TACHE_STATUT_LABELS[task.statut]} /></div><p>{task.societeName} · {task.assigneeName}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune tâche ouverte dans ce périmètre.</p>}
          </WorkspaceSection>
        </div>
        <div className="admin-brief-panel">
          <WorkspaceSection title="Prochaines échéances" icon={CalendarDays} target="dashboard-transmissions" route="/?tab=deadlines" linkLabel="Calendrier">
            {loading ? <WorkspaceLoading /> : error ? <p className="admin-brief-empty">Les échéances sont indisponibles.</p> : <>
              {overdue > 0 && <Link to="/?tab=deadlines" className="admin-overdue-link">{overdue} échéance{overdue > 1 ? "s" : ""} en retard<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>}
              {upcoming.length ? <ul>{upcoming.map((item) => <li key={item.id}><Link to={item.route} className="admin-brief-row">
                <time dateTime={item.echeance} className="admin-brief-date">{formatDate(item.echeance).slice(0, 5)}</time><div className="min-w-0"><strong>{item.societeName}</strong><p>{item.periode} · {item.statut === "transmis" ? "Déjà transmis · à examiner" : item.badge}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune échéance après cette date.</p>}
            </>}
          </WorkspaceSection>
        </div>
        {canUseMessaging && <div className="admin-brief-panel">
          <WorkspaceSection title="Messages à lire" icon={MessageSquareText} target="dashboard-communication" route="/messagerie" linkLabel="Messagerie">
            {data.unreadMessages.length ? <ul>{data.unreadMessages.slice(0, 3).map((message) => <li key={message.id}><Link to="/messagerie" className="admin-brief-row">
              <div className="min-w-0"><div className="admin-brief-row-heading"><strong>{message.label}</strong><span className="admin-message-count">{message.unread} non lu{message.unread > 1 ? "s" : ""}</span></div><p>{message.preview || "Nouveau message"}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </Link></li>)}</ul> : <p className="admin-brief-empty">Aucun message non lu.</p>}
          </WorkspaceSection>
        </div>}
      </div>
    </div>
  );
}
