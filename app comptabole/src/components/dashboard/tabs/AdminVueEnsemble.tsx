import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import { cn, formatDate, formatRelative, toTitleCase } from "@/lib/utils";
import { dashboardDateKey, type DashboardPortefeuilleItem, type DashboardTriageItem, type DashboardViewModel, type TriageGroupe } from "@/lib/dashboard/dashboardData";
import { circuitOuvert, dossiersDeLEtat, etatClient, type EtapeOuverte, type EtatClient } from "@/lib/dashboard/portefeuille";
import { collecteStatutLabel } from "../AdminBureauCards";
import "../admin-vue-ensemble.css";

interface Props {
  data: DashboardViewModel;
  loading: boolean;
  error: boolean;
  canUseMessaging: boolean;
  now: Date;
}

/** Écran étroit (téléphone) ; faux quand matchMedia n'existe pas (tests). */
function useMobile(): boolean {
  const requete = "(max-width: 767px)";
  const [mobile, setMobile] = useState(() => window.matchMedia?.(requete).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia?.(requete);
    if (!mql) return;
    const suivre = (e: MediaQueryListEvent) => setMobile(e.matches);
    setMobile(mql.matches);
    mql.addEventListener("change", suivre);
    return () => mql.removeEventListener("change", suivre);
  }, []);
  return mobile;
}

const LIBELLE_ETAT: Record<EtatClient, string> = { retard: "En retard de transmission", traiter: "En révision", jour: "À jour" };
const ETAT_SIGLE_TON: Record<EtatClient, string> = { retard: "ve-ton-retard", traiter: "ve-ton-marine", jour: "ve-ton-neutre" };
const ETAPE_LIBELLE: Record<EtapeOuverte, string> = { brouillon: "Chez le client", transmis: "Transmise", aCorriger: "À corriger" };
const DOSSIERS_PAR_GROUPE = 5;

const sigle = (nom: string) => nom.replace(/\(.*?\)/g, "").split(/[\s&'’-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase()).join("");
const jours = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

/** Retard ou échéance, en toutes lettres. */
function delai(item: DashboardTriageItem): { texte: string; retard: boolean } {
  const d = item.daysFromToday;
  if (d === null) return { texte: "Sans échéance", retard: false };
  if (d < 0) return { texte: jours(-d), retard: true };
  if (d === 0) return { texte: "Aujourd'hui", retard: false };
  if (d === 1) return { texte: "Demain", retard: false };
  return { texte: `Dans ${jours(d)}`, retard: false };
}

const GROUPES: Array<{ groupe: TriageGroupe; titre: string }> = [
  { groupe: "retard", titre: "En retard de transmission" },
  { groupe: "examiner", titre: "Pièces à examiner" },
  { groupe: "corriger", titre: "Rejets à reprendre" },
];
const LIGNES_VISIBLES = 8;

/** En-tête commun des cartes : repère doré, titre en Playfair, précision et lien d'action, filet double. */
function CarteEntete({ id, repere, titre, precision, lien }: { id: string; repere: string; titre: string; precision?: string; lien?: { to: string; texte: string } }) {
  return (
    <header className="ve-carte__entete">
      <div className="min-w-0">
        <small>{repere}</small>
        <h2 id={id}>{titre}</h2>
      </div>
      {precision && <p>{precision}</p>}
      {lien && <Link to={lien.to}>{lien.texte}</Link>}
    </header>
  );
}

/**
 * Synthèse du cabinet (sous le bloc marine) : quatre chemises d'indicateurs, portefeuille clients en mosaïque,
 * registre de révision, puis échéancier, charge de travail, échanges clients et journal d'activité.
 * Chaque information n'apparaît qu'une fois ; tout vient de chiffres déjà calculés ailleurs.
 */
export function AdminVueEnsemble({ data, loading, error, canUseMessaging, now }: Props) {
  const mobile = useMobile();
  const [ouverts, setOuverts] = useState<Record<EtatClient, boolean>>({ retard: true, traiter: false, jour: false });
  const [etendus, setEtendus] = useState<Record<EtatClient, boolean>>({ retard: false, traiter: false, jour: false });
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [jour, setJour] = useState<string | null>(null);
  const [toutVoir, setToutVoir] = useState(false);
  const indisponible = loading || error;

  const clients = useMemo(() => (indisponible ? [] : data.portefeuille.map((item) => ({ item, etat: etatClient(item) }))), [data.portefeuille, indisponible]);
  const nb = (etat: EtatClient) => clients.filter((c) => c.etat === etat).length;
  const total = clients.length;
  const dossiersActifs = `${total} dossier${total > 1 ? "s" : ""} actif${total > 1 ? "s" : ""}`;
  const part = (n: number) => (total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0);
  const clientsAvec = (cle: "transmis" | "aCorriger") => clients.filter((c) => c.item[cle] > 0).length;

  const chemises: Array<{ cle: string; onglet: string; nombre: number | string; unite: string; repere: number | null; action: string; lien: string; ton: string }> = [
    { cle: "retard", onglet: "Retards de transmission", nombre: indisponible ? "…" : nb("retard"), unite: "dossiers", repere: part(nb("retard")), action: "Consulter les retards", lien: "/?tab=deadlines", ton: "retard" },
    { cle: "examiner", onglet: "Pièces à examiner", nombre: indisponible ? "…" : clientsAvec("transmis"), unite: "dossiers", repere: part(clientsAvec("transmis")), action: "Ouvrir la révision", lien: "/collectes", ton: "marine" },
    { cle: "corriger", onglet: "Rejets à reprendre", nombre: indisponible ? "…" : clientsAvec("aCorriger"), unite: "dossiers", repere: part(clientsAvec("aCorriger")), action: "Suivre les corrections", lien: "/collectes", ton: "or" },
    ...(canUseMessaging ? [{ cle: "messages", onglet: "Échanges clients", nombre: data.unreadMessages.length, unite: data.unreadMessages.length > 1 ? "messages non lus" : "message non lu", repere: null, action: "Ouvrir la messagerie", lien: "/messagerie", ton: "neutre" }] : []),
  ];

  const groupesPortefeuille = (["retard", "traiter", "jour"] as const).map((etat) => ({ etat, dossiers: dossiersDeLEtat(indisponible ? [] : data.portefeuille, etat) }));
  // Pour chaque dossier, le travail le plus urgent du registre donne le délai affiché.
  const urgent = new Map<string, DashboardTriageItem>();
  for (const t of data.triage) if (!urgent.has(t.societeId)) urgent.set(t.societeId, t);

  const courant = ouvert ? data.portefeuille.find((p) => p.societeId === ouvert) ?? null : null;

  // Échéancier : sept jours à partir d'aujourd'hui, un point par collecte (rouge si en retard).
  const aujourdhui = dashboardDateKey(now);
  const semaine = Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  const parJour = new Map<string, typeof data.deadlines>();
  if (!indisponible) for (const d of data.deadlines) parJour.set(d.echeance, [...(parJour.get(d.echeance) ?? []), d]);
  const jourAgenda = jour ?? aujourdhui;
  const agenda = parJour.get(jourAgenda) ?? [];
  const memeMois = semaine[0].getMonth() === semaine[6].getMonth();
  const debutSemaine = semaine[0].toLocaleDateString("fr-FR", memeMois ? { day: "numeric" } : { day: "numeric", month: "long" });
  const finSemaine = semaine[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  // Registre de révision : la file de traitement, filtrée par le jour choisi à l'échéancier.
  const file = indisponible ? [] : data.triage.filter((t) => !jour || t.echeance === jour);
  const lignes = toutVoir ? file : file.slice(0, LIGNES_VISIBLES);
  const restent = file.length - lignes.length;

  const equipe = data.role === "admin" ? data.team.filter((m) => m.active) : [];
  const totalEnCours = equipe.reduce((s, m) => s + m.enCours, 0);
  const totalAFaire = equipe.reduce((s, m) => s + m.aFaire, 0);

  const journal = [
    ...data.recentFiles.map((f) => ({ id: `f-${f.id}`, titre: "Document déposé", detail: `${f.societeName} · ${f.name}`, quand: f.updatedAt, to: "/structuration", or: false })),
    ...data.collections.filter((c) => c.statut === "transmis" || c.statut === "valide").map((c) => ({ id: `c-${c.id}`, titre: `Collecte ${c.libelle.charAt(0).toLowerCase()}${c.libelle.slice(1)} ${c.statut === "valide" ? "validée" : "transmise"}`, detail: COLLECTE_STATUT_LABELS[c.statut], quand: c.updatedAt, to: c.route, or: true })),
  ].sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, 4);

  return (
    <div className="ve" data-tour="dashboard-vue-ensemble">
      <section className="ve-chemises" aria-label="Indicateurs du portefeuille" data-count={chemises.length} data-tour="dashboard-chemises">
        {chemises.map((c) => (
          <article key={c.cle} className={cn("ve-chemise", `ve-ton-${c.ton}`)}>
            <p className="ve-chemise__onglet">{c.onglet}</p>
            <p className="ve-chemise__nombre"><b>{c.nombre}</b><span>{c.unite}</span></p>
            <div className="ve-chemise__repere">
              {c.repere !== null && !indisponible ? (
                <>
                  <div className="ve-barre" role="img" aria-label={`${c.repere} % des ${dossiersActifs}`}><i style={{ width: `${c.repere}%` }} /></div>
                  <span>{c.repere} % des {dossiersActifs}</span>
                </>
              ) : c.cle === "messages" && data.unreadMessages.length > 0 ? (
                <div className="ve-expediteurs">
                  {data.unreadMessages.slice(0, 3).map((m) => <s key={m.id} aria-hidden="true">{m.initials}</s>)}
                  <em>Dernier : {toTitleCase(data.unreadMessages[0].label)}</em>
                </div>
              ) : c.cle === "messages" ? <span>Aucun message en attente</span> : null}
            </div>
            <Link to={c.lien} className="ve-chemise__action"><span>{c.action}</span><ArrowRight aria-hidden="true" /></Link>
          </article>
        ))}
      </section>

      <div className="ve-grille">
        <div className="ve-principal">
          <section className="ve-carte" aria-labelledby="ve-portefeuille-titre" data-tour="dashboard-portefeuille">
            <header className="ve-carte__entete">
              <div className="min-w-0"><small>Portefeuille clients</small><h2 id="ve-portefeuille-titre">Avancement des collectes par dossier</h2></div>
              <Link to="/?tab=portefeuille">Registre complet →</Link>
            </header>
            <div className="ve-carte__corps">
              {indisponible ? <p className="admin-brief-empty">{loading ? "Chargement du portefeuille…" : "Le portefeuille est indisponible."}</p>
                : total === 0 ? <p className="admin-brief-empty">Aucune collecte en cours dans le portefeuille.</p>
                : (
                  <>
                    <div className="ve-repartition" role="img" aria-label={`${nb("retard")} en retard de transmission, ${nb("traiter")} en révision, ${nb("jour")} à jour`}>
                      <i className="ve-retard" style={{ flexGrow: nb("retard") }} /><i className="ve-traiter" style={{ flexGrow: nb("traiter") }} /><i className="ve-jour" style={{ flexGrow: nb("jour") }} />
                    </div>
                    <p className="ve-repartition__legende">
                      <span className="ve-retard"><b>{nb("retard")}</b> en retard de transmission</span>
                      <span className="ve-traiter"><b>{nb("traiter")}</b> en révision</span>
                      <span className="ve-jour"><b>{nb("jour")}</b> à jour</span>
                      <em>{total} dossier{total > 1 ? "s" : ""} actif{total > 1 ? "s" : ""}</em>
                    </p>
                    <div className="ve-groupes">
                      {groupesPortefeuille.map(({ etat, dossiers }) => {
                        const visibles = etendus[etat] ? dossiers : dossiers.slice(0, DOSSIERS_PAR_GROUPE);
                        const corpsId = `ve-groupe-${etat}`;
                        return (
                          <section key={etat} className={cn("ve-groupe", ETAT_SIGLE_TON[etat], mobile && !ouverts[etat] && "is-ferme")} aria-labelledby={`${corpsId}-titre`}>
                            <h3 id={`${corpsId}-titre`}>
                              <button type="button" aria-expanded={!mobile || ouverts[etat]} aria-controls={corpsId} disabled={!mobile} onClick={() => setOuverts((o) => ({ ...o, [etat]: !o[etat] }))}>
                                <span>{LIBELLE_ETAT[etat]}</span><b>{dossiers.length}</b><ChevronDown aria-hidden="true" />
                              </button>
                            </h3>
                            <div id={corpsId} className="ve-groupe__corps">
                              {dossiers.length === 0 ? <p className="ve-groupe__vide">Aucun dossier.</p> : visibles.map((d) => {
                                const t = urgent.get(d.societeId);
                                const delaiPastille = etat === "jour" ? { texte: "À jour", retard: false } : t ? delai(t) : null;
                                const circuit = circuitOuvert(d);
                                return (
                                  <button key={d.societeId} type="button" className="ve-dossier" onClick={() => setOuvert(d.societeId)} aria-label={`Ouvrir le détail de ${d.societeName}`}>
                                    <span className="ve-dossier__sigle" aria-hidden="true">{sigle(d.societeName) || "?"}</span>
                                    <span className="ve-dossier__texte">
                                      <b>{d.societeName}</b>
                                      <span className="ve-dossier__meta">
                                        {delaiPastille && <span className={cn("ve-pastille", etat === "retard" ? "ve-pastille--retard" : etat === "jour" ? "ve-pastille--jour" : "ve-pastille--revision")}>{etat === "retard" ? `${delaiPastille.texte} de retard` : delaiPastille.texte}</span>}
                                        <small>{d.enCours === 0 ? "Aucune collecte ouverte" : `${d.enCours} collecte${d.enCours > 1 ? "s" : ""} ouverte${d.enCours > 1 ? "s" : ""}${d.enRetard > 0 ? ` · ${d.enRetard} en retard` : ""}`}</small>
                                      </span>
                                    </span>
                                    {circuit.length > 0 && (
                                      <span className="ve-circuit-trait" role="img" aria-label={circuit.map((p) => `${p.n} ${ETAPE_LIBELLE[p.etape].toLowerCase()}`).join(", ")}>
                                        {circuit.map((p) => <i key={p.etape} data-etape={p.etape} style={{ flexGrow: p.n }} />)}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                              {dossiers.length > DOSSIERS_PAR_GROUPE && (
                                <button type="button" className="ve-groupe__plus" onClick={() => setEtendus((e) => ({ ...e, [etat]: !e[etat] }))}>
                                  {etendus[etat] ? "Réduire la liste" : `Voir les ${dossiers.length} dossiers →`}
                                </button>
                              )}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                    <p className="ve-circuit-legende" aria-hidden="true"><span data-etape="brouillon">Chez le client</span><span data-etape="transmis">Transmise</span><span data-etape="aCorriger">À corriger</span><em>Un trait par étape où se trouvent des collectes ouvertes</em></p>
                  </>
                )}
            </div>
          </section>

          <section className="ve-carte ve-registre" id="registre-revision" aria-labelledby="ve-registre-titre" data-tour="dashboard-triage">
            <header className="ve-carte__entete">
              <div className="min-w-0"><small>Registre de révision</small><h2 id="ve-registre-titre">Travaux à traiter</h2></div>
              <p>{indisponible ? "" : `${file.length} dossier${file.length > 1 ? "s" : ""}${jour ? ` · échéance du ${formatDate(jour)}` : ""}`}</p>
              {jour && <button type="button" className="ve-lien" onClick={() => setJour(null)}>Effacer le filtre</button>}
            </header>
            <div className="ve-carte__corps">
              {indisponible ? <p className="admin-brief-empty">{loading ? "Chargement du registre…" : "Le registre de révision est indisponible."}</p>
                : file.length === 0 ? <p className="admin-brief-empty">{jour ? "Aucun dossier à traiter pour cette échéance." : "Aucun dossier ne demande d'action du cabinet pour le moment."}</p>
                : (
                  <div className="ve-table-defile">
                    <table className="ve-table">
                      <thead><tr><th scope="col">Dossier</th><th scope="col">Période</th><th scope="col">Étape</th><th scope="col">Retard ou échéance</th></tr></thead>
                      <tbody>
                        {GROUPES.flatMap(({ groupe, titre }) => {
                          const groupeLignes = lignes.filter((t) => t.groupe === groupe);
                          if (groupeLignes.length === 0) return [];
                          const nbGroupe = file.filter((t) => t.groupe === groupe).length;
                          return [
                            <tr key={`g-${groupe}`} className={cn("ve-table__groupe", groupe === "retard" && "ve-retard")}><td colSpan={4}>{titre} · {nbGroupe}</td></tr>,
                            ...groupeLignes.map((t) => {
                              const d = delai(t);
                              return (
                                <tr key={t.id}>
                                  <td><button type="button" className="ve-table__dossier" onClick={() => setOuvert(t.societeId)} aria-label={`Ouvrir le détail de ${t.societeName}`}>{t.societeName}</button></td>
                                  <td>{t.periode || "—"}</td>
                                  <td><span className="ve-etape">{COLLECTE_STATUT_LABELS[t.statut]}</span></td>
                                  <td className={cn("ve-table__delai", d.retard && "ve-retard-texte")}>{d.texte}</td>
                                </tr>
                              );
                            }),
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              {restent > 0 && <button type="button" className="ve-pied" onClick={() => setToutVoir(true)}>Afficher les {file.length} dossiers →</button>}
            </div>
          </section>
        </div>

        <aside className="ve-colonne" aria-label="Suivi du cabinet">
          <section className="ve-carte" aria-labelledby="ve-echeancier-titre" data-tour="dashboard-deadline-strip">
            <CarteEntete id="ve-echeancier-titre" repere="Échéancier" titre={`Semaine du ${debutSemaine} au ${finSemaine}`} />
            <div className="ve-carte__corps">
              <ol className="ve-semaine" aria-label="Choisir un jour">
                {semaine.map((j) => {
                  const cle = dashboardDateKey(j);
                  const items = parJour.get(cle) ?? [];
                  return (
                    <li key={cle}>
                      <button type="button" aria-pressed={jour === cle} aria-current={cle === aujourdhui ? "date" : undefined} aria-label={`${formatDate(cle)}, ${items.length} échéance${items.length > 1 ? "s" : ""}`} className={cn(cle === aujourdhui && "is-aujourdhui")} onClick={() => setJour(jour === cle ? null : cle)}>
                        <span>{j.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</span>
                        <b>{j.getDate()}</b>
                        <em aria-hidden="true">{items.slice(0, 3).map((d, k) => <s key={k} className={cn(d.bucket === "overdue" && "ve-point-retard")} />)}</em>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <ul className="ve-agenda" aria-label={`Échéances du ${formatDate(jourAgenda)}`}>
                {indisponible ? null : agenda.length === 0 ? <li className="ve-agenda__vide">Aucune échéance le {formatDate(jourAgenda)}.</li>
                  : agenda.slice(0, 3).map((d) => <li key={d.id}><Link to={d.route}><span>{d.societeName}</span><small className={cn(d.bucket === "overdue" && "ve-retard-texte")}>{collecteStatutLabel(d).toLowerCase()}</small></Link></li>)}
              </ul>
            </div>
          </section>

          {equipe.length > 0 && (
            <section className="ve-carte" aria-labelledby="ve-charge-titre">
              <CarteEntete id="ve-charge-titre" repere="Charge de travail" titre="Collaborateurs du cabinet" lien={{ to: "/?tab=team", texte: "Détail →" }} />
              <div className="ve-carte__corps">
                <table className="ve-charge">
                  <thead><tr><th scope="col">Collaborateur</th><th scope="col">En cours</th><th scope="col">À faire</th></tr></thead>
                  <tbody>{equipe.slice(0, 5).map((m) => (
                    <tr key={m.id}><td><span className={cn("ve-avatar", m.online && "is-en-ligne")} aria-hidden="true">{m.initials}</span>{toTitleCase(m.name)}</td><td>{m.enCours}</td><td>{m.aFaire}</td></tr>
                  ))}</tbody>
                  <tfoot><tr><td>Total des tâches ouvertes</td><td>{totalEnCours}</td><td>{totalAFaire}</td></tr></tfoot>
                </table>
              </div>
            </section>
          )}

          {canUseMessaging && (
            <section className="ve-carte" aria-labelledby="ve-echanges-titre" data-tour="dashboard-communication">
              <CarteEntete id="ve-echanges-titre" repere="Échanges clients" titre="Messages non lus" lien={{ to: "/messagerie", texte: "Ouvrir →" }} />
              <div className="ve-carte__corps">
                {data.unreadMessages.length === 0 ? <p className="admin-brief-empty">Aucun message non lu.</p>
                  : <ul className="ve-messages">{data.unreadMessages.slice(0, 3).map((m) => (
                    <li key={m.id}><Link to="/messagerie">
                      <span className="ve-avatar" aria-hidden="true">{m.initials}</span>
                      <span className="min-w-0"><b><i aria-hidden="true" />{toTitleCase(m.label)}<span className="sr-only"> · {m.unread} non lu{m.unread > 1 ? "s" : ""}</span></b><small>{m.preview || "Nouveau message"}</small></span>
                      <time>{formatRelative(m.updatedAt)}</time>
                    </Link></li>
                  ))}</ul>}
              </div>
            </section>
          )}

          <section className="ve-carte" aria-labelledby="ve-journal-titre">
            <CarteEntete id="ve-journal-titre" repere="Journal d'activité" titre="Derniers mouvements" lien={{ to: "/?tab=activity", texte: "Tout voir →" }} />
            <div className="ve-carte__corps">
              {journal.length === 0 ? <p className="admin-brief-empty">Aucun mouvement récent.</p>
                : <ol className="ve-journal">{journal.map((j) => <li key={j.id} className={cn(j.or && "is-or")}><Link to={j.to}>{j.titre}<small>{j.detail} · {formatRelative(j.quand)}</small></Link></li>)}</ol>}
            </div>
          </section>
        </aside>
      </div>

      <Sheet open={Boolean(courant)} onOpenChange={(o) => { if (!o) setOuvert(null); }}>
        {courant && <ClientVolet item={courant} triage={data.triage.filter((t) => t.societeId === courant.societeId)} side={mobile ? "bottom" : "right"} />}
      </Sheet>
    </div>
  );
}

const CIRCUIT: Array<{ cle: "brouillon" | "transmis" | "aCorriger" | "valide"; libelle: string }> = [
  { cle: "brouillon", libelle: "Chez le client" },
  { cle: "transmis", libelle: "À examiner" },
  { cle: "aCorriger", libelle: "À corriger" },
  { cle: "valide", libelle: "Validées" },
];

const ACTION: Record<TriageGroupe, string> = { retard: "Relance à prévoir", examiner: "À examiner", corriger: "Correction attendue" };

function ClientVolet({ item, triage, side }: { item: DashboardPortefeuilleItem; triage: DashboardTriageItem[]; side: "right" | "bottom" }) {
  const etat = etatClient(item);
  return (
    <SheetContent side={side} className={cn("ve-volet", side === "bottom" && "max-h-[85vh]")}>
      <SheetHeader>
        <p className={`ve-etat ve-${etat}`}>{LIBELLE_ETAT[etat]}</p>
        <SheetTitle>{item.societeName}</SheetTitle>
        <SheetDescription>{item.enCours} collecte{item.enCours > 1 ? "s" : ""} ouverte{item.enCours > 1 ? "s" : ""}{item.prochaine ? ` · prochaine échéance le ${formatDate(item.prochaine.echeance)}` : ""}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <h3 className="ve-volet-titre">Circuit des collectes</h3>
        <ul className="ve-circuit">
          {CIRCUIT.map((c) => <li key={c.cle} data-cle={c.cle}><b>{item[c.cle]}</b><span>{c.libelle}</span></li>)}
        </ul>
        <h3 className="ve-volet-titre">À traiter</h3>
        {triage.length === 0 ? <p className="admin-brief-empty">Rien à traiter pour ce client.</p>
          : <ul className="ve-volet-liste">{triage.map((t) => <li key={t.id}><Link to={t.route}><strong>{t.periode}</strong><span>{ACTION[t.groupe]} · {delai(t).texte}</span><ArrowRight aria-hidden="true" /></Link></li>)}</ul>}
      </SheetBody>
      <SheetFooter>
        <Link to={item.route} className="ve-cta">Ouvrir le dossier <ArrowRight aria-hidden="true" /></Link>
      </SheetFooter>
    </SheetContent>
  );
}

