import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Truck } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeaderBar } from "@/components/ledger/PageHeaderBar";
import { usePermissions } from "@/hooks/usePermissions";
import { cn, formatDate, initials } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import { aDesFactures, effectifs, listerSocietes, totauxCabinet, type FiltreFournisseurs } from "@/lib/fournisseursSocietes";
import { useFournisseurs } from "@/store/fournisseurs";
import { useData, useSocietes } from "@/store/data";
import { FournisseursSocietesVolet, PastilleEtat } from "./FournisseursSocietesVolet";

/** Choix de la société du Suivi fournisseur : les sociétés qui ont du travail d'abord (factures à régler, paiements à rapprocher, anomalies). */
export function FournisseursPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const societes = useSocietes()
    .filter((s) => canSeeSociete(s.id))
    .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true }));
  const hydrated = useData((s) => s.hydrated);
  const synthese = useFournisseurs((s) => s.synthese);
  const chargee = useFournisseurs((s) => s.syntheseChargee);
  const fetchSynthese = useFournisseurs((s) => s.fetchSynthese);
  useEffect(() => {
    void fetchSynthese();
  }, [fetchSynthese]);

  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreFournisseurs>("toutes");
  // Présentation : « liste et volet » (par défaut) ou tableau ; gardée dans ce navigateur.
  const [vue, setVue] = useState<"volet" | "tableau">(() => {
    try { return window.localStorage.getItem("fournisseurs:vue") === "volet" ? "volet" : "tableau"; } catch { return "tableau"; }
  });
  const changerVue = (v: "volet" | "tableau") => {
    setVue(v);
    try { window.localStorage.setItem("fournisseurs:vue", v); } catch { /* stockage bloqué : le choix n'est pas gardé */ }
  };
  const [selection, setSelection] = useState<string | null>(null);

  const affichees = useMemo(() => listerSocietes(societes, synthese, { recherche, filtre }), [societes, synthese, recherche, filtre]);
  const nombres = useMemo(() => effectifs(societes, synthese), [societes, synthese]);
  const cabinet = useMemo(() => totauxCabinet(societes, synthese), [societes, synthese]);
  // La société choisie reste celle de l'utilisateur tant qu'elle est affichée ; sinon la première de la liste (les sociétés à traiter d'abord).
  const selectionId = affichees.some((s) => s.id === selection) ? selection : affichees[0]?.id ?? null;
  const ouvrir = (id: string) => navigate(`/fournisseurs/${id}`);

  return (
    <div className="fournisseurs-page flex flex-1 flex-col gap-3">
      <PageHeaderBar title="Fournisseurs" description="Choisissez une société pour suivre les factures d'achat de ses fournisseurs et leurs règlements." />

      <div className="overflow-hidden rounded-xl border border-border bg-card" data-tour="fournisseurs-societes">
        {societes.length === 0 ? (
          <EmptyState icon={Truck} title={hydrated ? "Aucune société accessible" : "Chargement…"} description="Créez une société ou faites-vous assigner un périmètre." />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 px-3 py-2">
              <label className="flex h-10 min-w-[14rem] flex-1 items-center gap-2 rounded-[10px] border border-border bg-muted/40 px-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="sr-only">Rechercher une société</span>
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une société ou un matricule…" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </label>
              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground" aria-live="polite">{affichees.length} société{affichees.length > 1 ? "s" : ""}</span>
              <div role="group" aria-label="Présentation des sociétés" className="hidden rounded-[10px] bg-muted p-[3px] lg:inline-flex">
                {([["volet", "Liste et volet"], ["tableau", "Tableau"]] as const).map(([valeur, libelle]) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={vue === valeur}
                    onClick={() => changerVue(valeur)}
                    className={cn("h-8 rounded-[7px] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", vue === valeur && "bg-card font-semibold text-primary shadow-sm")}
                  >
                    {libelle}
                  </button>
                ))}
              </div>
            </div>
            <div data-tour="fournisseurs-summary" className="flex flex-wrap items-stretch gap-x-0.5 border-b border-border/80 bg-muted/20 px-3">
              <div role="group" aria-label="Filtrer les sociétés" className="flex flex-wrap items-stretch">
                {([["toutes", "Toutes", nombres.toutes, "text-primary"], ["traiter", "À traiter", nombres.traiter, "text-warning"], ["jour", "À jour", nombres.jour, "text-success"], ["sans", "Sans facture", nombres.sans, "text-muted-foreground"]] as const).map(([valeur, nom, n, ton]) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={filtre === valeur}
                    onClick={() => setFiltre(valeur)}
                    className={cn("relative flex items-baseline gap-2 px-4 py-3 text-[0.8125rem] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", filtre === valeur ? "font-semibold text-foreground after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:rounded after:bg-[#C9A96A]" : "text-muted-foreground")}
                  >
                    <b className={cn("text-sm font-bold leading-none tabular-nums tracking-tight", !chargee && valeur !== "toutes" ? "text-muted-foreground/50" : n === 0 ? "text-muted-foreground/50" : ton)}>{!chargee && valeur !== "toutes" ? "–" : n}</b>
                    {nom}
                  </button>
                ))}
              </div>
              {chargee && (
                <dl className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
                  {([
                    ["Factures à régler", String(cabinet.impayees), cabinet.impayees > 0 ? "text-warning" : "text-muted-foreground/60"],
                    ["Paiements à rapprocher", String(cabinet.paiements), cabinet.paiements > 0 ? "text-warning" : "text-muted-foreground/60"],
                    ...cabinet.soldes.slice(0, 3).map((d) => [`Solde dû ${d.devise}`, fmtMontant(d.montant), "text-destructive"] as const),
                  ] as const).map(([libelle, valeur, ton]) => (
                    <div key={libelle} className="flex flex-col border-l border-border/80 pl-4 leading-tight">
                      <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
                      <dd className={cn("m-0 text-sm font-bold tabular-nums", ton)}>{valeur}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {vue === "volet" ? (
              <FournisseursSocietesVolet
                societes={affichees}
                synthese={synthese}
                chargee={chargee}
                selectionId={selectionId}
                onSelection={(id) => {
                  // Sur petit écran, la fiche n'a pas de place : un clic ouvre directement le suivi de la société.
                  if (typeof window.matchMedia === "function" && !window.matchMedia("(min-width: 1024px)").matches) ouvrir(id);
                  else setSelection(id);
                }}
                onOuvrir={ouvrir}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-accent/[0.07] text-left">
                      {["Société", "Fournisseurs", "Factures à régler", "Solde dû", "À rapprocher", "Dernier règlement", "État"].map((t, i) => (
                        <th key={t} className={cn("border-b border-border px-3 py-2.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground", (i === 1 || i === 2 || i === 3 || i === 4) && "text-right")}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {affichees.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Aucune société ne correspond.</td></tr>
                    )}
                    {affichees.map((s) => {
                      const l = synthese[s.id];
                      return (
                        <tr key={s.id} onClick={() => ouvrir(s.id)} className="cursor-pointer border-t border-border/70 hover:bg-accent/10">
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-3">
                              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/90 to-primary text-[0.7rem] font-bold text-primary-foreground">{initials(s.raisonSociale)}</span>
                              <span className="min-w-0">
                                <b className="block truncate font-serif text-[0.9375rem] font-medium text-primary">{s.raisonSociale}</b>
                                <span className="block truncate text-xs text-muted-foreground">{s.theme} · {s.rne || "RNE non renseigné"} · {s.code}</span>
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{aDesFactures(l) ? l.fournisseurs : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{aDesFactures(l) ? <span className={cn(l.impayees > 0 ? "font-bold text-warning" : "text-muted-foreground")}>{l.impayees} <span className="text-xs font-normal text-muted-foreground">/ {l.factures}</span></span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{l && l.soldes.length > 0 ? l.soldes.map((d) => <div key={d.devise} className="font-semibold text-warning">{fmtMontant(d.montant)} <span className="text-xs font-normal text-muted-foreground">{d.devise}</span></div>) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{l && l.paiementsARapprocher > 0 ? <b className="text-warning">{l.paiementsARapprocher}</b> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{l?.dernierReglement ? formatDate(l.dernierReglement) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2.5"><PastilleEtat synthese={l} chargee={chargee} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
