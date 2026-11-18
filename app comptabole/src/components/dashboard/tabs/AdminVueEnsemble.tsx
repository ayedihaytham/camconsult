import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, formatDate, toTitleCase } from "@/lib/utils";
import { dashboardDateKey, type DashboardPortefeuilleItem, type DashboardTriageItem, type DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { etatClient, mosaique, poidsClient, type EtatClient } from "@/lib/dashboard/mosaique";
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

const LIBELLE_ETAT: Record<EtatClient, string> = { retard: "En retard", traiter: "À traiter", jour: "À jour" };

function delai(item: DashboardTriageItem): string {
  const d = item.daysFromToday;
  if (d === null) return "";
  if (d < 0) return `${-d} j de retard`;
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "demain";
  return `dans ${d} j`;
}

const VERBE: Record<DashboardTriageItem["groupe"], string> = { retard: "Relancer", examiner: "Examiner", corriger: "Suivre la correction de" };

/**
 * Haut de « Mon bureau » (cabinet) : le point à faire en premier, quatre indicateurs en une bande, le portefeuille en mosaïque
 * (surface = collectes ouvertes), puis santé, semaine et charge de l'équipe. Ne présente que des chiffres déjà calculés ailleurs.
 */
export function AdminVueEnsemble({ data, loading, error, canUseMessaging, now }: Props) {
  const mobile = useMobile();
  const [filtre, setFiltre] = useState<"tous" | EtatClient>("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const indisponible = loading || error;

  const clients = useMemo(() => (indisponible ? [] : data.portefeuille.map((item) => ({ item, etat: etatClient(item) }))), [data.portefeuille, indisponible]);
  const nb = (etat: EtatClient) => clients.filter((c) => c.etat === etat).length;
  const total = clients.length;
  const enRetard = indisponible ? 0 : data.deadlines.filter((d) => d.bucket === "overdue").length;
  const part = (n: number) => (total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0);
  const clientsAvec = (cle: "transmis" | "aCorriger") => clients.filter((c) => c.item[cle] > 0).length;

  const premier = indisponible ? null : data.triage[0] ?? null;

  const segments: Array<{ cle: string; nombre: number | string; libelle: string; part: number | null; lien: string; action: string; ton?: "retard" | "attention" }> = [
    { cle: "retard", nombre: indisponible ? "…" : enRetard, libelle: "en retard", part: part(nb("retard")), lien: "/?tab=deadlines", action: "Voir les retards", ton: "retard" },
    { cle: "examiner", nombre: indisponible ? "…" : data.collectionCounts.transmis, libelle: "à examiner", part: part(clientsAvec("transmis")), lien: "/collectes", action: "Examiner" },
    { cle: "corriger", nombre: indisponible ? "…" : data.collectionCounts.a_corriger, libelle: "à corriger", part: part(clientsAvec("aCorriger")), lien: "/collectes", action: "Suivre", ton: "attention" },
    ...(canUseMessaging ? [{ cle: "messages", nombre: data.unreadMessages.length, libelle: "messages non lus", part: null, lien: "/messagerie", action: "Lire" }] : []),
  ];

  const tuiles = useMemo(() => {
    const visibles = clients.filter((c) => filtre === "tous" || c.etat === filtre);
    const ordre = { retard: 0, traiter: 1, jour: 2 } as const;
    const tries = [...visibles].sort((a, b) => ordre[a.etat] - ordre[b.etat] || poidsClient(b.item) - poidsClient(a.item) || a.item.societeName.localeCompare(b.item.societeName, "fr"));
    return mosaique(tries, (c) => poidsClient(c.item) + (c.etat === "retard" ? 0.5 : 0), mobile ? 100 : 160, mobile ? 120 : 90);
  }, [clients, filtre, mobile]);

  const courant = ouvert ? data.portefeuille.find((p) => p.societeId === ouvert) ?? null : null;

  const jours = Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  const parJour = new Map<string, number>();
  if (!indisponible) for (const d of data.deadlines) parJour.set(d.echeance, (parJour.get(d.echeance) ?? 0) + 1);
  const prochaine = indisponible ? null : data.deadlines.filter((d) => d.bucket !== "overdue").sort((a, b) => a.echeance.localeCompare(b.echeance))[0] ?? null;

  const equipe = data.role === "admin" ? [...data.team].filter((m) => m.active).sort((a, b) => b.open - a.open).slice(0, 5) : [];
  const chargeMax = Math.max(1, ...equipe.map((m) => m.open));

  const donut = total > 0
    ? `conic-gradient(var(--ve-terracotta) 0 ${(nb("retard") / total) * 100}%, var(--ve-marine) 0 ${((nb("retard") + nb("traiter")) / total) * 100}%, var(--ve-gris) 0)`
    : "var(--ve-gris)";

  return (
    <div className="ve" data-tour="dashboard-vue-ensemble">
      <section className="ve-focus" aria-label="À faire en premier">
        <div>
          <p className="ve-eyebrow">À faire en premier</p>
          {indisponible ? <h2>{loading ? "Chargement du suivi…" : "Le suivi est indisponible"}</h2>
            : premier ? <>
              <h2>{VERBE[premier.groupe]} {premier.societeName}</h2>
              <p className="ve-focus-detail">{premier.periode}{delai(premier) ? ` · ${delai(premier)}` : ""} · {premier.tableauxTransmis}/{premier.tableauxDemandes} tableaux transmis</p>
            </> : <>
              <h2>Rien d'urgent</h2>
              <p className="ve-focus-detail">Aucune collecte ne demande d'action du cabinet pour le moment.</p>
            </>}
        </div>
        {premier && <Link to={premier.route} className="ve-cta">Ouvrir le dossier <ArrowRight aria-hidden="true" /></Link>}
      </section>

      <section className="ve-k1" aria-label="Indicateurs du jour" data-count={segments.length}>
        {segments.map((s) => (
          <div key={s.cle} className={cn("ve-seg", s.ton && `ve-${s.ton}`)}>
            <strong>{s.nombre}</strong>
            <span>{s.libelle}</span>
            {s.part !== null && !indisponible && <div className="ve-part" role="img" aria-label={`${s.part} % des ${total} dossiers`}><i style={{ width: `${s.part}%` }} /><small>{s.part} % des {total} dossiers</small></div>}
            <Link to={s.lien}>{s.action} <ArrowRight aria-hidden="true" /></Link>
          </div>
        ))}
      </section>

      <div className="ve-grille">
        <section className="ve-carte ve-portefeuille" aria-labelledby="ve-portefeuille-titre">
          <header>
            <h2 id="ve-portefeuille-titre">Portefeuille</h2>
            <div className="ve-filtres" role="group" aria-label="Filtrer les clients">
              {([["tous", "Tous", total], ["retard", "En retard", nb("retard")], ["traiter", "À traiter", nb("traiter")], ["jour", "À jour", nb("jour")]] as const).map(([cle, lib, n]) => (
                <button key={cle} type="button" aria-pressed={filtre === cle} onClick={() => setFiltre(cle)}>{lib} <b>{n}</b></button>
              ))}
            </div>
          </header>
          {indisponible ? <p className="admin-brief-empty">{loading ? "Chargement du portefeuille…" : "Le portefeuille est indisponible."}</p>
            : total === 0 ? <p className="admin-brief-empty">Aucune collecte en cours dans le portefeuille.</p>
            : <div className="ve-mosaique" style={{ aspectRatio: mobile ? "100 / 120" : "160 / 90" }} role="list" aria-label="Clients, surface proportionnelle aux collectes ouvertes">
              {tuiles.map(({ item: { item, etat }, x, y, w, h }) => (
                <button key={item.societeId} type="button" role="listitem" className={`ve-tuile ve-${etat}`} data-etat={etat}
                  style={{ left: `${x / (mobile ? 100 : 160) * 100}%`, top: `${y / (mobile ? 120 : 90) * 100}%`, width: `${w / (mobile ? 100 : 160) * 100}%`, height: `${h / (mobile ? 120 : 90) * 100}%` }}
                  onClick={() => setOuvert(item.societeId)} aria-label={`${item.societeName}, ${LIBELLE_ETAT[etat].toLowerCase()}, ${item.enCours} collecte${item.enCours > 1 ? "s" : ""} ouverte${item.enCours > 1 ? "s" : ""}`}>
                  <span>{item.societeName}</span>
                  <small>{item.enCours} ouverte{item.enCours > 1 ? "s" : ""}{item.enRetard > 0 ? ` · ${item.enRetard} en retard` : ""}</small>
                </button>
              ))}
            </div>}
          <footer className="ve-legende" aria-hidden="true"><span className="ve-retard">En retard</span><span className="ve-traiter">À traiter</span><span className="ve-jour">À jour</span><em>Surface = collectes ouvertes</em></footer>
        </section>

        <aside className="ve-colonne">
          <section className="ve-carte" aria-labelledby="ve-sante-titre">
            <h2 id="ve-sante-titre">Santé du portefeuille</h2>
            <div className="ve-sante">
              <div className="ve-donut" style={{ background: donut }} role="img" aria-label={`${nb("jour")} dossiers à jour sur ${total}`}><b>{total ? Math.round((nb("jour") / total) * 100) : 0} %</b><span>à jour</span></div>
              <ul>
                <li className="ve-retard"><b>{nb("retard")}</b> en retard</li>
                <li className="ve-traiter"><b>{nb("traiter")}</b> à traiter</li>
                <li className="ve-jour"><b>{nb("jour")}</b> à jour</li>
              </ul>
            </div>
          </section>

          <section className="ve-carte" aria-labelledby="ve-semaine-titre">
            <h2 id="ve-semaine-titre">Cette semaine</h2>
            <ol className="ve-semaine">
              {jours.map((j) => {
                const cle = dashboardDateKey(j);
                const n = parJour.get(cle) ?? 0;
                return <li key={cle} className={cn(n > 0 && "has", cle === dashboardDateKey(now) && "is-today")}>
                  <span>{j.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").slice(0, 3)}</span><b>{j.getDate()}</b><i aria-label={`${n} échéance${n > 1 ? "s" : ""}`}>{n || ""}</i>
                </li>;
              })}
            </ol>
            {prochaine && <p className="ve-suite">Prochaine échéance : <Link to={prochaine.route}>{prochaine.societeName}</Link> · {formatDate(prochaine.echeance)}</p>}
          </section>

          {equipe.length > 0 && <section className="ve-carte" aria-labelledby="ve-equipe-titre">
            <h2 id="ve-equipe-titre">Charge de l'équipe</h2>
            <ul className="ve-equipe">
              {equipe.map((m) => <li key={m.id}><span>{toTitleCase(m.name)}</span><div><i style={{ width: `${(m.open / chargeMax) * 100}%` }} /></div><b>{m.open}</b></li>)}
            </ul>
          </section>}
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
          : <ul className="ve-volet-liste">{triage.map((t) => <li key={t.id}><Link to={t.route}><strong>{t.periode}</strong><span>{VERBE[t.groupe]}{delai(t) ? ` · ${delai(t)}` : ""}</span><ArrowRight aria-hidden="true" /></Link></li>)}</ul>}
      </SheetBody>
      <SheetFooter>
        <Link to={item.route} className="ve-cta">Ouvrir le dossier <ArrowRight aria-hidden="true" /></Link>
      </SheetFooter>
    </SheetContent>
  );
}
