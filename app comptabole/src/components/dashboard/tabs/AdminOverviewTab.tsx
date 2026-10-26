import { Link } from "react-router-dom";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceLoading } from "../WorkspaceSection";
import { AdminMessageRows, AdminTeamRows, CollecteCircuit, collecteStatutLabel } from "../AdminBureauCards";
import { TACHE_STATUT_LABELS } from "@/types";
import { cn, formatDate, toTitleCase } from "@/lib/utils";
import { dashboardDateKey, transmissionRows, type DashboardDeadline, type DashboardViewModel } from "@/lib/dashboard/dashboardData";

interface Props {
  data: DashboardViewModel;
  loading: boolean;
  error: boolean;
  canUseMessaging: boolean;
  now?: Date;
}

const DAY_EVENTS_SHOWN = 2;

export function AdminOverviewTab({ data, loading, error, canUseMessaging, now = new Date() }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [registre, setRegistre] = useState("travail");
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
  const attention = data.attentionItems.filter((item) => item.type !== "message");
  const range = `${days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  const showTeam = data.role === "admin";
  const count = (value: number) => <span className="bureau-registre-count" aria-hidden="true">{value}</span>;
  const tiles = 2 + (canUseMessaging ? 1 : 0) + (showTeam ? 1 : 0);

  return (
    <div className="admin-overview admin-bureau">
      {unavailable ? <p className="bureau-verdict is-muted" data-tour="dashboard-resume">{loading ? "Le suivi sera complété après chargement." : "Le suivi des collectes est indisponible."}</p>
        : attention.length ? <Link to="/?tab=attention" className="bureau-verdict is-alert" data-tour="dashboard-resume">
          <AlertTriangle aria-hidden="true" /><strong>{attention.length} point{attention.length > 1 ? "s" : ""} demande{attention.length > 1 ? "nt" : ""} votre attention</strong><span>· {attention[0].title}</span>
        </Link>
        : <p className="bureau-verdict is-ok" data-tour="dashboard-resume"><CheckCircle2 aria-hidden="true" /><strong>Tout est à jour</strong><span>· Aucun élément à traiter</span></p>}

      <section className="bureau-card bureau-week" aria-label="Choisir la journée" data-tour="dashboard-deadline-strip">
        <header>
          <h2 className="bureau-week-range">{range}</h2>
          <div className="bureau-week-nav">
            <button type="button" aria-label="Sept jours précédents" onClick={() => moveWeek(-1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" className="is-today" onClick={() => { setWeekOffset(0); setSelected(null); }}>Aujourd’hui</button>
            <button type="button" aria-label="Sept jours suivants" onClick={() => moveWeek(1)}><ChevronRight aria-hidden="true" /></button>
          </div>
        </header>
        <div className="bureau-board" role="group" aria-label="Dates des collectes">
          {days.map((date) => {
            const key = dashboardDateKey(date);
            const items = byDay.get(key) ?? [];
            const sunday = date.getDay() === 0;
            return <div key={key} className={cn("bureau-day", key === today && "is-today", sunday && "is-weekend", key === day && "is-selected")}>
              <button type="button" className="bureau-day-head" aria-label={`${formatDate(key)}, ${unavailable ? loading ? "collectes en chargement" : "collectes indisponibles" : `${items.length} collecte${items.length > 1 ? "s" : ""}`}`}
                aria-current={key === today ? "date" : undefined} aria-pressed={key === day} onClick={() => setSelected(key)}>
                <span>{date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</span><strong>{date.getDate()}</strong><em>{date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</em>
              </button>
              <div className="bureau-day-body">
                {items.slice(0, DAY_EVENTS_SHOWN).map((item) => <Link key={item.id} to={item.route} className={cn("bureau-event", item.bucket === "overdue" && "is-overdue")}>
                  <strong>{item.societeName}</strong><span>{collecteStatutLabel(item)}</span>
                </Link>)}
                {items.length > DAY_EVENTS_SHOWN && <span className="bureau-day-more">+ {items.length - DAY_EVENTS_SHOWN} autre{items.length - DAY_EVENTS_SHOWN > 1 ? "s" : ""}</span>}
                {!unavailable && items.length === 0 && !sunday && <span className="bureau-day-empty" aria-hidden="true">Rien de prévu</span>}
                {!unavailable && items.length === 0 && sunday && <span className="bureau-day-weekend" aria-hidden="true">Dimanche</span>}
              </div>
            </div>;
          })}
        </div>

        <div className="bureau-day-detail" data-tour="dashboard-attention" aria-live="polite">
          <h3>Collectes du {formatDate(day)}<span>{loading ? "Chargement…" : error ? "Indisponibles" : `${collections.length} collecte${collections.length > 1 ? "s" : ""}`}</span></h3>
          {loading ? <WorkspaceLoading /> : error ? <p className="admin-brief-empty">Le suivi des collectes est indisponible.</p>
            : collections.length ? <ul>{collections.map((item) => <li key={item.id}><Link to={item.route} className="bureau-line">
              <div className="min-w-0"><strong>{item.societeName}</strong><p>{item.periode}</p></div>
              <span className="bureau-line-note">{item.daysFromToday < 0 ? `${-item.daysFromToday} j de retard` : ""}</span>
              <CollecteCircuit item={item} />
            </Link></li>)}</ul>
            : <p className="admin-brief-empty">Aucune collecte prévue à cette date.</p>}
        </div>
      </section>

      <section className="bureau-card bureau-registres" aria-label="Registres du cabinet">
        <Tabs value={registre} onValueChange={setRegistre}>
          <TabsList className="bureau-registre-tabs" style={{ "--tiles": tiles } as React.CSSProperties} aria-label="Registres">
            <TabsTrigger value="travail">Travail à avancer{count(tasks.length)}</TabsTrigger>
            <TabsTrigger value="echeances">Échéances{!unavailable && count(upcoming.length)}</TabsTrigger>
            {canUseMessaging && <TabsTrigger value="messages">Messages{count(data.unreadMessages.length)}</TabsTrigger>}
            {showTeam && <TabsTrigger value="equipe">Équipe{count(data.team.length)}</TabsTrigger>}
          </TabsList>

          <TabsContent value="travail" forceMount data-tour="dashboard-tasks" className="bureau-registre data-[state=inactive]:hidden">
            {tasks.length ? <ul>{tasks.slice(0, 5).map((task) => <li key={task.id}><Link to="/taches" className="bureau-line">
              <div className="min-w-0"><strong>{task.titre}</strong><p>{task.societeName} · {toTitleCase(task.assigneeName)}</p></div>
              <span className="bureau-line-note" />
              <span className="bureau-line-status">{TACHE_STATUT_LABELS[task.statut]}</span>
            </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune tâche ouverte dans ce périmètre.</p>}
          </TabsContent>
          <TabsContent value="echeances" forceMount data-tour="dashboard-transmissions" className="bureau-registre data-[state=inactive]:hidden">
            {loading ? <WorkspaceLoading /> : error ? <p className="admin-brief-empty">Les échéances sont indisponibles.</p>
              : upcoming.length ? <ul>{upcoming.map((item) => <li key={item.id}><Link to={item.route} className="bureau-line">
                <div className="min-w-0"><strong>{item.societeName}</strong><p><time dateTime={item.echeance}>{formatDate(item.echeance).slice(0, 5)}</time> · {item.periode}</p></div>
                <span className="bureau-line-note" />
                <CollecteCircuit item={item} />
              </Link></li>)}</ul> : <p className="admin-brief-empty">Aucune échéance après cette date.</p>}
          </TabsContent>
          {canUseMessaging && <TabsContent value="messages" forceMount data-tour="dashboard-communication" className="bureau-registre data-[state=inactive]:hidden">
            <AdminMessageRows messages={data.unreadMessages} />
          </TabsContent>}
          {showTeam && <TabsContent value="equipe" forceMount className="bureau-registre data-[state=inactive]:hidden">
            <AdminTeamRows members={data.team} />
          </TabsContent>}
        </Tabs>
      </section>
    </div>
  );
}
