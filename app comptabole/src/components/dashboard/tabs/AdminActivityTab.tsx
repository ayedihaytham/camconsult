import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, FileText, Search } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { ACTION_LABELS, DAY_LABELS, buildActivityItems, dayLabel, groupConsecutive, hourlyRhythm, type ActivityGroup, type ActivityItem, type ActivitySource } from "@/lib/dashboard/activityFeed";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { cn, formatRelative, formatTime, initials } from "@/lib/utils";
import "../admin-activity.css";

type Filtre = "Tout" | ActivitySource;
const SOURCE_CLASS: Record<ActivitySource, string> = { Fichier: "is-file", Message: "is-message", Journal: "is-journal" };

/** Onglet Activité (administrateur, responsable) : rythme du jour, filtres avec compteurs, chronologie par jour avec acteur et action du journal.
 * Même périmètre qu'avant (derniers éléments accessibles, 16 au plus) ; les écritures identiques d'une même minute sont regroupées. */
export function AdminActivityTab({ data, canUseMessaging, loading = false, error = false, now = new Date() }: { data: DashboardViewModel; canUseMessaging: boolean; loading?: boolean; error?: boolean; now?: Date }) {
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState<Filtre>("Tout");
  const [recherche, setRecherche] = useState("");
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const items = useMemo(() => buildActivityItems(data, canUseMessaging), [data, canUseMessaging]);
  const filtres: Filtre[] = ["Tout", "Fichier", ...(canUseMessaging ? ["Message" as const] : []), ...(data.role === "admin" ? ["Journal" as const] : [])];
  const compte = (option: Filtre) => items.filter((item) => option === "Tout" || item.source === option).length;
  const requete = recherche.trim().toLocaleLowerCase("fr");
  const visibles = items.filter((item) => (filtre === "Tout" || item.source === filtre) && (!requete || `${item.title} ${item.description}`.toLocaleLowerCase("fr").includes(requete)));
  const jours = DAY_LABELS.map((label) => ({ label, groupes: groupConsecutive(visibles.filter((item) => dayLabel(item.at, now) === label)), total: visibles.filter((item) => dayLabel(item.at, now) === label).length })).filter((jour) => jour.total > 0);
  const rythme = hourlyRhythm(items, now);
  const maxHeure = Math.max(1, ...rythme.map((heure) => heure.count));
  const aujourdhui = items.filter((item) => dayLabel(item.at, now) === "Aujourd'hui");
  const parSource = (source: ActivitySource) => aujourdhui.filter((item) => item.source === source).length;
  const heureCourante = now.getHours();

  function basculer(cle: string) {
    setOuverts((courant) => {
      const suivant = new Set(courant);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  const carte = (groupe: ActivityGroup) => {
    const [premier] = groupe.items;
    const groupee = groupe.items.length > 1;
    const action = premier.action ? ACTION_LABELS[premier.action] : null;
    return (
      <li key={groupe.key} className="aat-event">
        <div className="aat-time"><strong>{formatTime(premier.at)}</strong><span>{formatRelative(premier.at)}</span></div>
        <span className={cn("aat-dot", SOURCE_CLASS[premier.source])} aria-hidden="true">
          {premier.source === "Fichier" ? <FileText /> : initials(premier.source === "Message" ? premier.initials ?? premier.title : premier.title)}
          {premier.source === "Message" && <i className={premier.online ? "is-online" : undefined} />}
        </span>
        <div className="aat-body">
          <div className="aat-top">
            <span className="aat-who">{premier.title}</span>
            {action && <span className={cn("aat-tag", `is-${action.tone}`)}>{groupee ? `${groupe.items.length} ${action.plural}` : action.label}</span>}
            <span className="aat-tag is-source">{premier.source}</span>
            {premier.unread ? <span className="aat-tag is-unread">{premier.unread} non lu{premier.unread > 1 ? "s" : ""}</span> : null}
          </div>
          {groupee ? (
            <>
              <p>{groupe.items.length} éléments à {formatTime(premier.at)}</p>
              {ouverts.has(groupe.key) && <ul className="aat-sub">{groupe.items.map((item) => <li key={item.id}>{item.description}</li>)}</ul>}
              <button type="button" className="aat-more" aria-expanded={ouverts.has(groupe.key)} onClick={() => basculer(groupe.key)}>{ouverts.has(groupe.key) ? "Réduire" : `Voir les ${groupe.items.length} éléments`}</button>
            </>
          ) : <p>{premier.description}</p>}
        </div>
        {premier.route && !groupee ? <button type="button" className="aat-open" onClick={() => navigate(premier.route as string)} aria-label={`Ouvrir ${premier.source.toLowerCase()} : ${premier.title}`}><ArrowRight className="size-4" aria-hidden="true" /></button> : <span />}
      </li>
    );
  };

  return (
    <section className="aat" aria-label="Activité récente">
      <header className="admin-view-header">
        <div><h2>Activité récente</h2><p>Derniers éléments accessibles, pas un historique complet. Les messages sont ceux de votre compte.</p></div>
        {data.role === "admin" && <Link to="/journal" className="admin-view-link">Journal complet<ArrowRight className="size-4" aria-hidden="true" /></Link>}
      </header>
      {(loading || error) && <p role="status" className="aat-status">{loading ? "Le journal est en chargement." : "Le journal est indisponible ; les fichiers et messages restent consultables."}</p>}

      <section className="aat-pulse" aria-label="Rythme d'aujourd'hui">
        <div>
          <h3>Rythme d’aujourd’hui · événements par heure</h3>
          <div className="aat-hours" role="img" aria-label={`${aujourdhui.length} événement${aujourdhui.length > 1 ? "s" : ""} aujourd’hui, par heure`}>
            {rythme.map(({ hour, count }) => <div key={hour} className={cn("aat-hour", count > 0 && "is-active", hour === heureCourante && "is-now")} title={`${hour} h : ${count} événement${count > 1 ? "s" : ""}`}><i style={{ height: count ? 12 + (count / maxHeure) * 46 : 3 }} /><small>{hour}</small></div>)}
          </div>
        </div>
        <dl className="aat-kpis">
          <div><dd>{aujourdhui.length}</dd><dt>aujourd’hui</dt></div>
          {data.role === "admin" && <div><dd>{parSource("Journal")}</dd><dt>journal</dt></div>}
          <div><dd>{parSource("Fichier")}</dd><dt>fichiers</dt></div>
          {canUseMessaging && <div><dd>{parSource("Message")}</dd><dt>messages</dt></div>}
        </dl>
      </section>

      <div className="aat-toolbar">
        <label className="aat-search"><Search className="size-4" aria-hidden="true" /><input type="search" aria-label="Rechercher dans l’activité" placeholder="Rechercher dans l’activité…" value={recherche} onChange={(event) => setRecherche(event.target.value)} /></label>
        <div className="aat-chips" role="group" aria-label="Filtrer l’activité">
          {filtres.map((option) => <button key={option} type="button" aria-pressed={filtre === option} aria-label={`${option} ${compte(option)}`} onClick={() => setFiltre(option)}>
            {option !== "Tout" && <i className={SOURCE_CLASS[option]} aria-hidden="true" />}{option}<b aria-hidden="true">{compte(option)}</b>
          </button>)}
        </div>
      </div>

      {visibles.length === 0 ? (
        <DashboardEmptyState icon={Activity} title={items.length > 0 ? "Aucun résultat" : loading || error ? "Aucun élément parmi les sources chargées" : "Aucune activité récente"} description={items.length > 0 ? "Modifiez la recherche ou le filtre." : loading || error ? "Ce résultat est partiel." : "Les nouveaux fichiers, messages et écritures du journal apparaîtront ici, classés par heure."} />
      ) : jours.map((jour) => (
        <div key={jour.label}>
          <h3 className="aat-day"><span>{jour.label}</span><b>{jour.total}</b></h3>
          <ul className="aat-timeline">{jour.groupes.map(carte)}</ul>
        </div>
      ))}
      {items.length > 0 && <p className="aat-foot">{items.length} élément{items.length > 1 ? "s" : ""} chargé{items.length > 1 ? "s" : ""} · les 16 plus récents au plus.</p>}
    </section>
  );
}

export type { ActivityItem };
