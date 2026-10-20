import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, CheckCheck, FileText, ListChecks, Plus, Search, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { actionTache, peutChangerStatut } from "@/lib/tachePermissions";
import { cn, formatDate, formatRelative, initials } from "@/lib/utils";
import { dashboardDateKey, type DashboardTaskRow, type DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { useData } from "@/store/data";
import { TACHE_STATUT_LABELS, type TacheStatut } from "@/types";
import "../admin-tasks.css";

type Vue = "colonnes" | "liste";

const COLONNES: { statut: TacheStatut; titre: string; sous: string; icone: typeof Timer; cible: string; max: number }[] = [
  { statut: "a_faire", titre: "À faire", sous: "Tâches à commencer", icone: FileText, cible: "dashboard-task-todo", max: 6 },
  { statut: "en_cours", titre: "En cours", sous: "Travail déjà commencé", icone: Timer, cible: "dashboard-task-ongoing", max: 6 },
  { statut: "termine", titre: "Terminées", sous: "Travail fait", icone: CheckCheck, cible: "dashboard-task-completed", max: 3 },
];
const ORDRE_LISTE: Record<TacheStatut, number> = { en_cours: 0, a_faire: 1, termine: 2 };

/** Onglet Tâches du Dashboard (administrateur, responsable des collaborateurs) : avancement global, filtre par collaborateur, tableau à colonnes ou liste.
 * Les actions de statut suivent les droits de la page Tâches (`peutChangerStatut`) ; la fin prévue n'est montrée que si elle est renseignée. */
export function AdminTasksTab({ data, now = new Date() }: { data: DashboardViewModel; now?: Date }) {
  const [vue, setVue] = useState<Vue>("colonnes");
  const [search, setSearch] = useState("");
  const [collab, setCollab] = useState<string>("tous");
  const [depliees, setDepliees] = useState<Set<TacheStatut>>(new Set());
  const setTacheStatut = useData((state) => state.setTacheStatut);
  const { isResponsableSociete, isDelegue, canManageCollaborateurs, employeId } = usePermissions();
  const droits = { isResponsableSociete, isDelegue, canManageCollaborateurs, employeId };
  const today = dashboardDateKey(now);

  const all = useMemo(() => [...data.taskRows, ...data.otherTaskRows], [data.taskRows, data.otherTaskRows]);
  const count = (statut: TacheStatut) => all.filter((task) => task.statut === statut).length;
  const total = all.length;
  const done = count("termine");
  const query = search.trim().toLocaleLowerCase("fr");
  const visibles = all.filter((task) => (collab === "tous" || task.assigneId === collab) && (!query || `${task.titre} ${task.societeName} ${task.assigneeName}`.toLocaleLowerCase("fr").includes(query)));
  const equipe = data.team.filter((member) => all.some((task) => task.assigneId === member.id)).slice(0, 8);

  async function changer(task: DashboardTaskRow) {
    const action = actionTache(task.statut);
    const avant = task.statut;
    await setTacheStatut(task.id, action.vers);
    toast.success(action.message, {
      description: task.titre,
      action: peutChangerStatut({ ...task, statut: action.vers }, avant, droits) ? { label: "Annuler", onClick: () => void setTacheStatut(task.id, avant) } : undefined,
    });
  }

  const carte = (task: DashboardTaskRow) => {
    const action = actionTache(task.statut);
    const peut = peutChangerStatut(task, action.vers, droits);
    const enRetard = task.statut !== "termine" && Boolean(task.finPrevue) && (task.finPrevue as string) < today;
    return (
      <article className={cn("atk-card", `atk-card--${task.statut}`)}>
        <h4><Link to="/taches">{task.titre}</Link></h4>
        <p className="atk-company"><span aria-hidden="true">{initials(task.societeName)}</span>{task.societeName}</p>
        {task.origine === "societe" && <p className="atk-readonly">Tâche de société (lecture seule au cabinet)</p>}
        {task.finPrevue && task.statut !== "termine" && <p className={cn("atk-planned", enRetard && "is-late")}>Fin prévue {formatDate(task.finPrevue)}{enRetard && " · en retard"}</p>}
        <div className="atk-foot">
          <span className="atk-avatar" aria-hidden="true">{task.assigneId ? initials(task.assigneeName) : "—"}</span>
          <span className="atk-name">{task.assigneeName}</span>
          <time dateTime={task.majLe}>{formatRelative(task.majLe)}</time>
        </div>
        {peut && <div className="atk-actions"><Button type="button" variant="outline" size="sm" className="atk-move" aria-label={`${action.libelle} : ${task.titre}`} onClick={() => void changer(task)}>{action.libelle}</Button></div>}
      </article>
    );
  };

  const nouvelle = canManageCollaborateurs && (
    <Button asChild className="atk-new"><Link to="/taches?nouvelle=1"><Plus className="size-4" aria-hidden="true" />Nouvelle tâche</Link></Button>
  );

  return (
    <section className="dashboard-tasks-workspace atk" data-tour="dashboard-tasks">
      <header className="admin-view-header"><div><h2>Tâches du cabinet</h2><p>Retrouvez le travail par état, société ou collaborateur.</p></div><Link to="/taches" className="admin-view-link">Ouvrir les tâches<ArrowUpRight className="size-4" aria-hidden="true" /></Link></header>

      <section className="atk-progress" aria-label="Avancement des tâches" data-tour="dashboard-task-lens">
        <div>
          <h3>{total ? `${total} tâche${total > 1 ? "s" : ""} dans le périmètre` : "Avancement global"}</h3>
          <div className="atk-bar" role="img" aria-label={`${done} terminée${done > 1 ? "s" : ""}, ${count("en_cours")} en cours, ${count("a_faire")} à faire`}>
            {total > 0 && (["termine", "en_cours", "a_faire"] as TacheStatut[]).map((statut) => <i key={statut} className={`is-${statut}`} style={{ width: `${(count(statut) / total) * 100}%` }} />)}
          </div>
          <p className="atk-legend">
            {(["termine", "en_cours", "a_faire"] as TacheStatut[]).map((statut) => <span key={statut}><i className={`is-${statut}`} aria-hidden="true" />{TACHE_STATUT_LABELS[statut]} <strong>{count(statut)}</strong></span>)}
          </p>
        </div>
        <p className="atk-percent"><strong>{total ? Math.round((done / total) * 100) : 0} %</strong><span>terminées</span></p>
      </section>

      <div className="atk-toolbar">
        <label className="atk-search"><Search className="size-4" aria-hidden="true" /><input type="search" aria-label="Rechercher une tâche" placeholder="Tâche, société ou collaborateur…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {total > 0 && <div className="atk-who" role="group" aria-label="Filtrer par collaborateur">
          <button type="button" className="atk-all" aria-pressed={collab === "tous"} onClick={() => setCollab("tous")}>Tous</button>
          {equipe.map((member) => {
            const ouvertes = all.filter((task) => task.assigneId === member.id && task.statut !== "termine").length;
            return <button key={member.id} type="button" className="atk-member" aria-pressed={collab === member.id} aria-label={`${member.name}, ${ouvertes} ouverte${ouvertes > 1 ? "s" : ""}`} title={member.name} onClick={() => setCollab(collab === member.id ? "tous" : member.id)}>
              <span className="atk-avatar" aria-hidden="true">{member.initials}</span><span className="atk-member-count" aria-hidden="true">{ouvertes}</span>
            </button>;
          })}
        </div>}
        <div className="atk-views" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={vue === "colonnes"} onClick={() => setVue("colonnes")}>Colonnes</button>
          <button type="button" aria-pressed={vue === "liste"} onClick={() => setVue("liste")}>Liste</button>
        </div>
        {nouvelle}
      </div>

      {total === 0 ? (
        <div className="atk-start">
          <span className="atk-start-icon" aria-hidden="true"><ListChecks /></span>
          <h3>Aucune tâche pour le moment</h3>
          <p>Créez une tâche, rattachez-la à une société et confiez-la à un collaborateur. Elle apparaîtra ici et avancera de colonne en colonne.</p>
          {canManageCollaborateurs && <Button asChild className="atk-new"><Link to="/taches?nouvelle=1"><Plus className="size-4" aria-hidden="true" />Créer la première tâche</Link></Button>}
          <ol><li><strong>À faire</strong>La tâche est créée et attend d’être commencée.</li><li><strong>En cours</strong>Le collaborateur l’a démarrée.</li><li><strong>Terminée</strong>Le travail est fait ; la tâche reste consultable.</li></ol>
        </div>
      ) : visibles.length === 0 ? (
        <p className="atk-none">Aucune tâche ne correspond. Modifiez la recherche ou le collaborateur sélectionné.</p>
      ) : vue === "colonnes" ? (
        <div className="atk-board">
          {COLONNES.map(({ statut, titre, sous, icone: Icone, cible, max }) => {
            const liste = visibles.filter((task) => task.statut === statut);
            const deplie = depliees.has(statut);
            return (
              <section key={statut} className={cn("atk-col", `atk-col--${statut}`)} aria-label={titre} data-tour={cible}>
                <header><span className="atk-col-icon" aria-hidden="true"><Icone /></span><div><h3>{titre}</h3><p>{sous}</p></div><span className="atk-col-count">{liste.length}</span></header>
                {liste.length ? <ul>{(deplie ? liste : liste.slice(0, max)).map((task) => <li key={task.id}>{carte(task)}</li>)}</ul> : <p className="atk-col-empty"><strong>Rien ici</strong>{statut === "a_faire" ? "Aucune tâche à commencer." : statut === "en_cours" ? "Aucune tâche en cours." : "Aucune tâche terminée."}</p>}
                {liste.length > max && <button type="button" className="atk-more" onClick={() => setDepliees((current) => { const next = new Set(current); if (next.has(statut)) next.delete(statut); else next.add(statut); return next; })}>{deplie ? "Réduire" : `Voir les ${liste.length - max} autres`}</button>}
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="atk-list" aria-label="Liste des tâches">
          {[...visibles].sort((a, b) => ORDRE_LISTE[a.statut] - ORDRE_LISTE[b.statut]).map((task) => {
            const action = actionTache(task.statut);
            return (
              <li key={task.id} className="atk-row">
                <span className="atk-row-title"><Link to="/taches">{task.titre}</Link>{task.origine === "societe" && <small>Tâche de société (lecture seule au cabinet)</small>}</span>
                <span className="atk-company"><span aria-hidden="true">{initials(task.societeName)}</span>{task.societeName}</span>
                <span className="atk-foot"><span className="atk-avatar" aria-hidden="true">{task.assigneId ? initials(task.assigneeName) : "—"}</span><span className="atk-name">{task.assigneeName}</span></span>
                <span className={cn("atk-state", `is-${task.statut}`)}>{TACHE_STATUT_LABELS[task.statut]}</span>
                <span className="atk-row-end"><time dateTime={task.majLe}>{formatRelative(task.majLe)}</time>{peutChangerStatut(task, action.vers, droits) && <Button type="button" variant="outline" size="sm" className="atk-move" aria-label={`${action.libelle} : ${task.titre}`} onClick={() => void changer(task)}>{action.libelle}</Button>}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
