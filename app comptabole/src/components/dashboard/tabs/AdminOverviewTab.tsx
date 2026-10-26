import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, Bell, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ListChecks, MessageSquareText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceSection, WorkspaceLoading } from "../WorkspaceSection";
import { AttentionList } from "../attention/AttentionList";
import { CollecteStatusDot, StatusDot } from "@/components/ledger/StatusDot";
import { AdminMessageRows, AdminTeamCard } from "../AdminBureauCards";
import { TACHE_STATUT_LABELS } from "@/types";
import { cn, formatDate, initials } from "@/lib/utils";
import { dashboardDateKey, transmissionRows, type DashboardDeadline, type DashboardViewModel } from "@/lib/dashboard/dashboardData";

interface Props {
  data: DashboardViewModel;
  loading: boolean;
  error: boolean;
  canUseMessaging: boolean;
  now?: Date;
}

const DAY_EVENTS_SHOWN = 3;

/** Colonne d'un jour : la couleur de la collecte suit l'état réel (retard, corrections demandées, sinon transmission attendue ou à examiner). */
function eventTone(item: DashboardDeadline) {
  if (item.bucket === "overdue") return "is-overdue";
  if (item.statut === "a_corriger") return "is-correction";
  return "is-planned";
}

export function AdminOverviewTab({ data, loading, error, canUseMessaging, now = new Date() }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [registre, setRegistre] = useState("collectes");
  const today = dashboardDateKey(now);
  const days = Array.from({ length: 7 }, (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7 + index));
  const start = dashboardDateKey(days[0]);
  const end = dashboardDateKey(days[6]);
  const day = selected && selected >= start && selected <= end ? selected : start;
  const { selected: collections, upcoming } = transmissionRows(data.deadlines, day);
  const unavailable = loading || error;
  function moveWeek(amount: number) {
    const offset = weekOffset + amount;
    setWeekOffset(offset);
    setSelected(dashboardDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7)));
  }
  const byDay = new Map<string, DashboardDeadline[]>();
  if (!unavailable) for (const item of data.deadlines) byDay.set(item.echeance, [...(byDay.get(item.echeance) ?? []), item]);

  const tasks = [...data.taskRows.filter((task) => task.statut === "en_cours"), ...data.taskRows.filter((task) => task.statut === "a_faire")];
  const overdue = data.deadlines.filter((item) => item.daysFromToday < 0).length;
  const thisWeek = data.deadlines.filter((item) => item.bucket === "today" || item.bucket === "week").length;
  const unread = data.unreadMessages.reduce((sum, message) => sum + message.unread, 0);
  const attention = data.attentionItems.filter((item) => item.type !== "message");
  const summaries = [
    { label: "Collectes à examiner", value: unavailable ? "—" : data.collectionCounts.transmis, caption: unavailable ? undefined : overdue > 0 ? `dont ${overdue} en retard` : "Aucune en retard", alert: !unavailable && overdue > 0, route: "/?tab=attention", icon: ClipboardCheck, unavailable },
    { label: "Tâches ouvertes", value: data.taskCounts.a_faire + data.taskCounts.en_cours, caption: `${data.taskCounts.en_cours} en cours · ${data.taskCounts.a_faire} à faire`, route: "/?tab=tasks", icon: ListChecks },
    { label: "Échéances du jour", value: unavailable ? "—" : collections.length, caption: unavailable ? undefined : `${thisWeek} cette semaine`, route: "/?tab=deadlines", icon: CalendarDays, unavailable },
    ...(canUseMessaging ? [{ label: "Messages non lus", value: unread, caption: data.unreadMessages[0]?.label ?? "Boîte à jour", route: "/messagerie", icon: MessageSquareText }] : []),
  ];
  const range = `${days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  const count = (value: number) => <span className="bureau-registre-count" aria-hidden="true">{value}</span>;

  return (
    <div className="admin-overview admin-bureau">
      <aside className="bureau-side" aria-label="Surveillance du cabinet">
        <section className="bureau-card" aria-label="Aujourd'hui">
          <h2 className="bureau-card-title">Aujourd’hui</h2>
          <nav className="admin-summary" aria-label="L'essentiel du cabinet" data-tour="dashboard-resume">
            {summaries.map(({ label, value, caption, alert, route, icon: Icon, unavailable: off }) => <Link key={label} to={route} className="admin-summary-item">
              <span className="admin-summary-icon" aria-hidden="true"><Icon className="size-4" /></span>
              <span className="admin-summary-text">
                <span className="admin-summary-label">{label}</span>
                {off ? <span className="admin-summary-unavailable">{loading ? "Chargement…" : "Indisponible"}</span> : caption && <span className={cn("admin-summary-caption", alert && "is-alert")}>{caption}</span>}
              </span>
              <span className="admin-summary-value">{value}</span>
            </Link>)}
          </nav>
        </section>
        <div className="bureau-card bureau-card--warm">
          <WorkspaceSection title="À traiter" icon={Bell} route="/?tab=attention" linkLabel="Tout voir">
            {unavailable ? <p className="admin-brief-empty">Le suivi sera complété après chargement.</p> : attention.length ? <AttentionList items={attention} limit={3} compact /> : <p className="admin-brief-empty">Aucun élément à traiter dans ce périmètre.</p>}
          </WorkspaceSection>
        </div>
        {data.role === "admin" && <AdminTeamCard members={data.team} />}
      </aside>

      <div className="bureau-main">
        <section className="bureau-card bureau-week" aria-label="Choisir la journée" data-tour="dashboard-deadline-strip">
          <header>
            <h2 className="bureau-week-range">{range}</h2>
            <div className="bureau-week-tools">
            <div className="bureau-week-legend" aria-hidden="true">
              <span><i className="is-overdue" />En retard</span>
              <span><i className="is-correction" />À corriger</span>
              <span><i className="is-planned" />Prévue</span>
            </div>
            <div className="bureau-week-nav">
              <button type="button" aria-label="Sept jours précédents" onClick={() => moveWeek(-1)}><ChevronLeft aria-hidden="true" /></button>
              <button type="button" className="is-today" onClick={() => { setWeekOffset(0); setSelected(null); }}>Aujourd’hui</button>
              <button type="button" aria-label="Sept jours suivants" onClick={() => moveWeek(1)}><ChevronRight aria-hidden="true" /></button>
            </div>
            </div>
          </header>
          <div className="bureau-board" role="group" aria-label="Dates des collectes">
            {days.map((date) => {
              const key = dashboardDateKey(date);
              const items = byDay.get(key) ?? [];
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              return <div key={key} className={cn("bureau-day", key === today && "is-today", weekend && "is-weekend", key === day && "is-selected")}>
                <button type="button" className="bureau-day-head" aria-label={`${formatDate(key)}, ${unavailable ? loading ? "collectes en chargement" : "collectes indisponibles" : `${items.length} collecte${items.length > 1 ? "s" : ""}`}`}
                  aria-current={key === today ? "date" : undefined} aria-pressed={key === day} onClick={() => setSelected(key)}>
                  <span>{date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</span><strong>{date.getDate()}</strong><em>{date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</em>
                </button>
                <div className="bureau-day-body">
                  {items.slice(0, DAY_EVENTS_SHOWN).map((item) => <Link key={item.id} to={item.route} className={cn("bureau-event", eventTone(item))}>
                    <strong>{item.societeName}</strong><span>{item.periode}</span>
                  </Link>)}
                  {items.length > DAY_EVENTS_SHOWN && <span className="bureau-day-more">+ {items.length - DAY_EVENTS_SHOWN} autre{items.length - DAY_EVENTS_SHOWN > 1 ? "s" : ""}</span>}
                  {!unavailable && items.length === 0 && !weekend && <span className="bureau-day-empty" aria-hidden="true">Rien de prévu</span>}
                  {!unavailable && items.length === 0 && weekend && <span className="bureau-day-weekend" aria-hidden="true">Week-end</span>}
                </div>
              </div>;
            })}
          </div>
          <p className="admin-selected-day" aria-live="polite"><CalendarDays className="size-[17px]" aria-hidden="true" />Collectes du {formatDate(day)} · {loading ? "Chargement…" : error ? "Indisponibles" : `${collections.length} collecte${collections.length > 1 ? "s" : ""}`}</p>
        </section>

        <section className="bureau-card bureau-registres" aria-label="Registres du jour">
          <Tabs value={registre} onValueChange={setRegistre}>
            <TabsList className="bureau-registre-tabs" aria-label="Registres">
              <TabsTrigger value="collectes">Collectes du jour{!unavailable && count(collections.length)}</TabsTrigger>
              <TabsTrigger value="travail">Travail à avancer{count(tasks.length)}</TabsTrigger>
              <TabsTrigger value="echeances">Prochaines échéances{!unavailable && count(upcoming.length)}</TabsTrigger>
              {canUseMessaging && <TabsTrigger value="messages">Messages à lire{count(data.unreadMessages.length)}</TabsTrigger>}
            </TabsList>
            <div className="bureau-registre-links"><Link to={registre === "travail" ? "/?tab=tasks" : registre === "echeances" ? "/?tab=deadlines" : registre === "messages" ? "/messagerie" : "/collectes"}>{registre === "travail" ? "Tout voir" : registre === "echeances" ? "Calendrier" : registre === "messages" ? "Messagerie" : "Collectes"}<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></div>

            <TabsContent value="collectes" forceMount data-tour="dashboard-attention" className="bureau-registre data-[state=inactive]:hidden">
              {loading ? <WorkspaceLoading /> : error ? <p className="admin-brief-empty">Le suivi des collectes est indisponible.</p> : collections.length ? <ul>{collections.slice(0, 3).map((item) => <li key={item.id}><Link to={item.route} className="admin-brief-row">
                <span className="bureau-monogram" aria-hidden="true">{initials(item.societeName)}</span>
                <div className="min-w-0"><div className="admin-brief-row-heading"><strong>{item.societeName}</strong>{item.statut ? <CollecteStatusDot statut={item.statut} /> : <StatusDot className="text-xs" tone="primary" label={item.badge} />}</div><p>{item.periode}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune collecte prévue à cette date.</p>}
            </TabsContent>
            <TabsContent value="travail" forceMount data-tour="dashboard-tasks" className="bureau-registre data-[state=inactive]:hidden">
              {tasks.length ? <ul>{tasks.slice(0, 3).map((task) => <li key={task.id}><Link to="/taches" className="admin-brief-row">
                <span className="bureau-monogram" aria-hidden="true">{initials(task.assigneeName)}</span>
                <div className="min-w-0"><div className="admin-brief-row-heading"><strong>{task.titre}</strong><StatusDot className="text-xs" tone={task.statut === "en_cours" ? "primary" : "muted"} label={TACHE_STATUT_LABELS[task.statut]} /></div><p>{task.societeName} · {task.assigneeName}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune tâche ouverte dans ce périmètre.</p>}
            </TabsContent>
            <TabsContent value="echeances" forceMount data-tour="dashboard-transmissions" className="bureau-registre data-[state=inactive]:hidden">
              {loading ? <WorkspaceLoading /> : error ? <p className="admin-brief-empty">Les échéances sont indisponibles.</p> : <>
                {overdue > 0 && <Link to="/?tab=deadlines" className="admin-overdue-link">{overdue} échéance{overdue > 1 ? "s" : ""} en retard<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>}
                {upcoming.length ? <ul>{upcoming.map((item) => <li key={item.id}><Link to={item.route} className="admin-brief-row">
                  <time dateTime={item.echeance} className="admin-brief-date">{formatDate(item.echeance).slice(0, 5)}</time><div className="min-w-0"><strong>{item.societeName}</strong><p>{item.periode} · {item.statut === "transmis" ? "Déjà transmis · à examiner" : item.badge}</p></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune échéance après cette date.</p>}
              </>}
            </TabsContent>
            {canUseMessaging && <TabsContent value="messages" forceMount data-tour="dashboard-communication" className="bureau-registre data-[state=inactive]:hidden">
              <AdminMessageRows messages={data.unreadMessages} />
            </TabsContent>}
          </Tabs>
        </section>
      </div>
    </div>
  );
}
