import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, ChevronRight, Coins, Search } from "lucide-react";
import { PageHeaderBar } from "@/components/ledger/PageHeaderBar";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { useData, useSocietes } from "@/store/data";
import { useStock, type SyntheseStock } from "@/store/stock";
import { cn, initials } from "@/lib/utils";
import { api } from "@/lib/api";
import { StockSocietesVolet, operationsRecentes, type OperationRecente } from "./StockSocietesVolet";
import "./stock-page.css";
import type { Societe, StockMouvement } from "@/types";

const montant = (valeur: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valeur);
const jourMois = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));

/** État des cours de change d'une société : « Saisi », « n à saisir », ou rien quand elle n'a aucun mouvement en devise. */
export function etatCours(ligne: Pick<SyntheseStock, "enDevise" | "coursManquants"> | undefined): { label: string; tone: "ok" | "warn" | "none" } {
  if (!ligne || ligne.enDevise === 0) return { label: "—", tone: "none" };
  if (ligne.coursManquants > 0) return { label: `${ligne.coursManquants} à saisir`, tone: "warn" };
  return { label: "Saisi", tone: "ok" };
}

export type FiltreStock = "toutes" | "avec" | "sans";
export type ColonneStock = "societe" | "mouvements" | "valeur" | "alertes" | "dernier" | "cours";

const ordreCours = (l: SyntheseStock | undefined) => {
  const t = etatCours(l).tone;
  return t === "warn" ? 2 : t === "ok" ? 1 : 0;
};

/** Sociétés affichées : recherche (nom, thème, RNE), filtre sur l'activité, puis tri par colonne. */
export function listerSocietes<T extends Pick<Societe, "id" | "raisonSociale" | "theme" | "rne">>(
  societes: T[],
  synthese: Record<string, SyntheseStock | undefined>,
  options: { recherche: string; filtre: FiltreStock; tri: ColonneStock; sens: 1 | -1 },
): T[] {
  const q = options.recherche.trim().toLowerCase();
  const liste = societes.filter((s) => {
    const n = synthese[s.id]?.mouvements ?? 0;
    if (options.filtre === "avec" && n === 0) return false;
    if (options.filtre === "sans" && n > 0) return false;
    return !q || `${s.raisonSociale} ${s.theme} ${s.rne}`.toLowerCase().includes(q);
  });
  const valeur = (s: T): number | string => {
    const l = synthese[s.id];
    switch (options.tri) {
      case "mouvements": return l?.mouvements ?? 0;
      case "valeur": return l?.valeur ?? 0;
      case "alertes": return l?.alertes ?? 0;
      case "dernier": return l?.dernierLe ?? "";
      case "cours": return ordreCours(l);
      default: return s.raisonSociale;
    }
  };
  return [...liste].sort((a, b) => {
    const x = valeur(a);
    const y = valeur(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr", { numeric: true });
    return c * options.sens || a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true });
  });
}

/** « aujourd'hui », « hier », « il y a 5 jours »… sous la date du dernier mouvement. */
export function ilYA(iso: string, maintenant = new Date()): string {
  const jours = Math.floor((Date.UTC(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()) - Date.UTC(new Date(iso).getFullYear(), new Date(iso).getMonth(), new Date(iso).getDate())) / 86_400_000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 31) return `il y a ${jours} jours`;
  const mois = Math.floor(jours / 30);
  return mois < 12 ? `il y a ${mois} mois` : `il y a ${Math.floor(mois / 12)} an${mois >= 24 ? "s" : ""}`;
}

const LARGEURS = [29, 10, 14, 9, 14, 13, 11];

export function StockPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const societeActive = useSocieteActive();
  const allSocietes = useSocietes();
  const societes = useMemo(
    () => allSocietes
      .filter((s) => canSeeSociete(s.id))
      .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true })),
    [allSocietes, canSeeSociete],
  );
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreStock>("toutes");
  const [tri, setTri] = useState<ColonneStock>("societe");
  const [sens, setSens] = useState<1 | -1>(1);
  const hydrated = useData((s) => s.hydrated);
  const synthese = useStock((s) => s.synthese);
  const fetchSynthese = useStock((s) => s.fetchSynthese);

  useEffect(() => {
    void fetchSynthese();
  }, [fetchSynthese]);

  const affichees = useMemo(() => listerSocietes(societes, synthese, { recherche, filtre, tri, sens }), [societes, synthese, recherche, filtre, tri, sens]);
  // Présentation : « liste et volet » (par défaut) ou tableau ; gardée dans ce navigateur.
  const [vue, setVue] = useState<"volet" | "tableau">(() => {
    try { return window.localStorage.getItem("stock:vue") === "volet" ? "volet" : "tableau"; } catch { return "tableau"; }
  });
  const changerVue = (v: "volet" | "tableau") => {
    setVue(v);
    try { window.localStorage.setItem("stock:vue", v); } catch { /* stockage bloqué : le choix n'est pas gardé */ }
  };
  const [selection, setSelection] = useState<string | null>(null);
  // La société choisie reste celle de l'utilisateur tant qu'elle est affichée ; sinon la première avec des mouvements, ou la première de la liste.
  const selectionId = affichees.some((x) => x.id === selection)
    ? selection
    : (affichees.find((x) => (synthese[x.id]?.mouvements ?? 0) > 0) ?? affichees[0])?.id ?? null;
  const operations = useRef(new Map<string, OperationRecente[]>());
  const [recentes, setRecentes] = useState<OperationRecente[] | null>(null);
  useEffect(() => {
    if (!selectionId || vue !== "volet") return;
    const gardees = operations.current.get(selectionId);
    if (gardees) {
      setRecentes(gardees);
      return;
    }
    let annule = false;
    setRecentes(null);
    api.get<StockMouvement[]>(`/stock/mouvements?societeId=${selectionId}`)
      .then((liste) => {
        const ops = operationsRecentes(liste);
        operations.current.set(selectionId, ops);
        if (!annule) setRecentes(ops);
      })
      .catch(() => { if (!annule) setRecentes([]); });
    return () => { annule = true; };
  }, [selectionId, vue]);

  // Une société est déjà choisie en haut : son stock s'ouvre directement, sans lui redemander laquelle.
  if (societeActive) return <Navigate to={`/stock/${societeActive.id}`} replace />;

  const nbAvec = societes.filter((s) => (synthese[s.id]?.mouvements ?? 0) > 0).length;
  const trier = (colonne: ColonneStock) => {
    if (tri === colonne) setSens((x) => (x === 1 ? -1 : 1));
    else {
      setTri(colonne);
      setSens(1);
    }
  };
  const lignes = societes.map((s) => synthese[s.id]);
  const total = lignes.reduce((n, l) => n + (l?.mouvements ?? 0), 0);
  const coursManquants = lignes.reduce((n, l) => n + (l?.coursManquants ?? 0), 0);
  const alertes = lignes.reduce((n, l) => n + (l?.alertes ?? 0), 0);

  return (
    <div className="stock-page flex flex-1 flex-col gap-3">
      <PageHeaderBar
        title="Stock"
        description="Mouvements d'achat, de vente et de douane de toutes vos sociétés"
        actions={
          <Link to="/cours-change">
            <Coins className="size-4" aria-hidden="true" />
            Cours de change
          </Link>
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-primary/10 bg-card shadow-[0_1px_2px_hsl(var(--primary)/0.05),0_12px_32px_-18px_hsl(var(--primary)/0.18)]" data-tour="stock-societes">
        {societes.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={hydrated ? "Aucune société accessible" : "Chargement…"}
            description="Créez une société ou faites-vous assigner un périmètre pour voir son stock."
          />
        ) : (
          <>
            <div data-tour="stock-summary" className="stock-bande">
              {([
                [total > 1 ? "Mouvements" : "Mouvement", total, ""],
                [coursManquants > 1 ? "Cours manquants" : "Cours manquant", coursManquants, coursManquants > 0 ? "is-warn" : ""],
                [alertes > 1 ? "Alertes stock" : "Alerte stock", alertes, alertes > 0 ? "is-alerte" : ""],
              ] as const).map(([libelle, valeur, ton]) => (
                <div key={libelle} className={cn("stock-bande__case", ton)}>
                  <span>{libelle}</span>
                  <b>{valeur}</b>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 bg-[#FBF8F1] px-4 py-3">
              <label className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-[10px] border border-[#c3cbd9] bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="sr-only">Rechercher une société</span>
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une société ou un matricule…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </label>
              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground" aria-live="polite">{affichees.length} société{affichees.length > 1 ? "s" : ""}</span>
              <div role="group" aria-label="Présentation des sociétés" className="stock-seg hidden lg:inline-flex">
                {([["volet", "Liste et volet"], ["tableau", "Tableau"]] as const).map(([valeur, libelle]) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={vue === valeur}
                    onClick={() => changerVue(valeur)}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {libelle}
                  </button>
                ))}
              </div>
            </div>
            <div role="group" aria-label="Filtrer les sociétés" className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-2.5">
              {([["toutes", "Toutes", societes.length], ["avec", "Avec mouvements", nbAvec], ["sans", "Sans mouvement", societes.length - nbAvec]] as const).map(([valeur, nom, n]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={filtre === valeur}
                  onClick={() => setFiltre(valeur)}
                  className={cn("h-8 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", filtre === valeur ? "border-primary bg-primary text-primary-foreground" : "border-[#c3cbd9] bg-card text-primary hover:bg-[#FBF8F1]")}
                >
                  {nom} · {n}
                </button>
              ))}
            </div>
            {vue === "volet" && (
              <StockSocietesVolet
                societes={affichees}
                synthese={synthese}
                selectionId={selectionId}
                onSelection={(id) => {
                  // Sur petit écran, la fiche n'a pas de place : un clic ouvre directement le stock.
                  if (typeof window.matchMedia === "function" && !window.matchMedia("(min-width: 1024px)").matches) navigate(`/stock/${id}`);
                  else setSelection(id);
                }}
                onOuvrir={(id) => navigate(`/stock/${id}`)}
                recentes={recentes}
                ilYA={ilYA}
              />
            )}
            <div className={cn("overflow-x-auto", vue === "volet" && "hidden")}>
              <table className="stock-societes-table w-full min-w-[1040px] table-fixed border-collapse text-[0.8125rem] tabular-nums">
                <caption className="sr-only">Stock par société</caption>
                <colgroup>{LARGEURS.map((l, i) => <col key={i} style={{ width: `${l}%` }} />)}</colgroup>
                <thead className="bg-[#FBF8F1] text-muted-foreground">
                  <tr>
                    {([["societe", "Société", "left"], ["mouvements", "Mouvements", "right"], ["valeur", "Valeur du stock", "right"], ["alertes", "Alertes", "right"], ["dernier", "Dernier mouvement", "left"], ["cours", "Cours de change", "center"]] as const).map(([colonne, titre, align]) => (
                      <th
                        key={colonne}
                        scope="col"
                        aria-sort={tri === colonne ? (sens === 1 ? "ascending" : "descending") : undefined}
                        className="sticky top-0 border-b-2 border-primary px-4 py-3 text-left text-[0.66rem] font-bold uppercase tracking-[0.1em]"
                      >
                        <button type="button" onClick={() => trier(colonne)} className={cn("group/tri flex w-full items-center gap-1.5 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", align === "right" && "justify-end", align === "center" && "justify-center")}>
                          {titre}
                          {tri === colonne ? (sens === 1 ? <ArrowUp className="size-3 text-accent" aria-hidden="true" /> : <ArrowDown className="size-3 text-accent" aria-hidden="true" />) : <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover/tri:opacity-40" aria-hidden="true" />}
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="sticky top-0 border-b-2 border-primary px-4 py-3"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {affichees.map((s) => {
                    const ligne = synthese[s.id];
                    const cours = etatCours(ligne);
                    const actif = (ligne?.mouvements ?? 0) > 0;
                    const cellule = "h-[58px] border-b border-border/70 px-4 py-2.5 align-middle";
                    return (
                      <tr key={s.id} onClick={() => navigate(`/stock/${s.id}`)} className="cursor-pointer hover:bg-[#F5F8FD]">
                        <td className={cellule}>
                          <div className="flex min-w-0 items-center gap-3">
                            <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-md text-[0.72rem] font-semibold", actif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{initials(s.raisonSociale)}</span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{s.raisonSociale}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.theme} · {s.rne || "RNE non renseigné"}</p>
                            </div>
                          </div>
                        </td>
                        <td className={cn(cellule, "text-right", actif ? "font-semibold" : "text-muted-foreground")}>{ligne?.mouvements ?? 0}</td>
                        <td className={cn(cellule, "text-right")}>{ligne && ligne.valeur > 0 ? montant(ligne.valeur) : <span className="text-muted-foreground/60">—</span>}</td>
                        <td className={cn(cellule, "text-right")}>{(ligne?.alertes ?? 0) > 0 ? <span className="font-bold text-[#A8402B]">{ligne?.alertes}</span> : <span className="text-muted-foreground/60">—</span>}</td>
                        <td className={cellule}>
                          {ligne?.dernierLe ? (
                            <>
                              {jourMois(ligne.dernierLe)}
                              <span className="block text-xs text-muted-foreground">{ilYA(ligne.dernierLe)}</span>
                            </>
                          ) : <span className="text-muted-foreground/60">—</span>}
                        </td>
                        <td className={cn(cellule, "text-center")}>
                          {cours.tone === "none" ? <span className="text-muted-foreground/60">—</span> : (
                            <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", cours.tone === "ok" ? "bg-[#DDF0E5] text-[#1D5D41]" : "bg-[#FBEBC4] text-[#8A5A0B]")}>
                              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                              {cours.label}
                            </span>
                          )}
                        </td>
                        <td className="h-[58px] border-b border-border/70 px-4 py-2.5 text-right align-middle">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/stock/${s.id}`); }}
                            aria-label={`Ouvrir le stock de ${s.raisonSociale}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#c3cbd9] px-3 text-[12.5px] font-bold text-primary transition-colors hover:bg-[#e6eaf1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Ouvrir
                            <ChevronRight className="size-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {affichees.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucune société ne correspond.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-primary bg-[#FBF8F1] font-semibold text-primary">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right">{affichees.reduce((n, x) => n + (synthese[x.id]?.mouvements ?? 0), 0)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-muted-foreground">{(() => { const v = affichees.reduce((n, x) => n + (synthese[x.id]?.valeur ?? 0), 0); return v > 0 ? montant(v) : "—"; })()}</td>
                    <td className={cn("px-4 py-2.5 text-right", affichees.reduce((n, x) => n + (synthese[x.id]?.alertes ?? 0), 0) > 0 && "text-[#A8402B]")}>{(() => { const a = affichees.reduce((n, x) => n + (synthese[x.id]?.alertes ?? 0), 0); return a > 0 ? a : "—"; })()}</td>
                    <td colSpan={3} className="px-4 py-2.5 font-medium text-muted-foreground">{affichees.length} société{affichees.length > 1 ? "s" : ""} affichée{affichees.length > 1 ? "s" : ""}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
