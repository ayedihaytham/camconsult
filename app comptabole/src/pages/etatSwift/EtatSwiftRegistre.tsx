import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Building2, CalendarDays, CheckCircle2, ChevronRight, Clock, Coins, Globe, MinusCircle, Search, Activity } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";
import { montantSwift } from "./SwiftStatut";
import type { SwiftResumeSociete } from "@/types";

type Etat = "a_justifier" | "en_cours" | "justifie" | "aucun";
type Filtre = "all" | Etat;

const ETATS: Record<Etat, { libelle: string; icone: typeof Clock; classe: string; bande: string; ordre: number }> = {
  a_justifier: { libelle: "À justifier", icone: AlertCircle, classe: "text-warning", bande: "border-l-warning", ordre: 0 },
  en_cours: { libelle: "En cours", icone: Clock, classe: "text-accent-foreground", bande: "border-l-accent", ordre: 1 },
  justifie: { libelle: "Tout justifié", icone: CheckCircle2, classe: "text-success", bande: "border-l-success", ordre: 2 },
  aucun: { libelle: "Sans virement", icone: MinusCircle, classe: "text-muted-foreground", bande: "border-l-border", ordre: 3 },
};

/** État d'une société : le plus urgent de ses virements l'emporte (à justifier, puis en cours, puis justifié). */
function etatDe(r: SwiftResumeSociete | undefined): Etat {
  if (!r || r.virements === 0) return "aucun";
  if (r.aJustifier > 0) return "a_justifier";
  if (r.enCours > 0) return "en_cours";
  return "justifie";
}

/** Choix de société de l'État SWIFT, côté cabinet : un registre trié par urgence, avec recherche et filtres par état. */
export function EtatSwiftRegistre() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const hydrated = useData((s) => s.hydrated);
  const societes = useSocietes().filter((s) => canSeeSociete(s.id));
  const [resume, setResume] = useState<SwiftResumeSociete[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("all");

  useEffect(() => {
    api
      .get<SwiftResumeSociete[]>("/etat-swift/resume")
      .then(setResume)
      .catch(() => setResume([]));
  }, []);

  const lignes = useMemo(() => {
    const parSociete = new Map((resume ?? []).map((r) => [r.societeId, r]));
    return societes
      .map((s) => {
        const r = parSociete.get(s.id);
        return { societe: s, resume: r, etat: etatDe(r) };
      })
      .sort((a, b) => ETATS[a.etat].ordre - ETATS[b.etat].ordre || a.societe.raisonSociale.localeCompare(b.societe.raisonSociale, "fr", { numeric: true }));
  }, [societes, resume]);

  const compte = (e: Etat) => lignes.filter((l) => l.etat === e).length;
  const totaux = useMemo(
    () => ({
      virements: lignes.reduce((s, l) => s + (l.resume?.virements ?? 0), 0),
      aJustifier: lignes.reduce((s, l) => s + (l.resume?.aJustifier ?? 0), 0),
      enCours: lignes.reduce((s, l) => s + (l.resume?.enCours ?? 0), 0),
      justifies: lignes.reduce((s, l) => s + (l.resume?.justifies ?? 0), 0),
    }),
    [lignes],
  );

  const q = recherche.trim().toLowerCase();
  const visibles = lignes.filter((l) => (filtre === "all" || l.etat === filtre) && (!q || `${l.societe.raisonSociale} ${l.societe.code} ${l.societe.rne ?? ""}`.toLowerCase().includes(q)));
  const chargement = !hydrated || resume === null;

  const chips: { key: Filtre; label: string; n: number }[] = [
    { key: "all", label: "Toutes", n: lignes.length },
    { key: "a_justifier", label: "À justifier", n: compte("a_justifier") },
    { key: "en_cours", label: "En cours", n: compte("en_cours") },
    { key: "justifie", label: "Tout justifié", n: compte("justifie") },
    { key: "aucun", label: "Sans virement", n: compte("aucun") },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        icon={Globe}
        eyebrow="Comptabilité · Devises"
        title="État SWIFT"
        description="Choisissez une société pour suivre ses virements SWIFT en dinars et les factures d'achat qui les justifient."
        metrics={[
          { label: "Virements", value: totaux.virements, icon: Globe, loading: chargement },
          { label: "À justifier", value: totaux.aJustifier, icon: AlertCircle, tone: totaux.aJustifier > 0 ? "warning" : "default", loading: chargement },
          { label: "En cours", value: totaux.enCours, icon: Clock, loading: chargement },
          { label: "Justifiés", value: totaux.justifies, icon: CheckCircle2, tone: "success", loading: chargement },
        ]}
      />

      <div className="my-3 flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-sm flex-1 basis-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une société" aria-label="Rechercher une société" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par état">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={filtre === c.key}
              onClick={() => setFiltre(c.key)}
              className={cn(
                "inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                filtre === c.key ? "border-accent bg-accent/15 text-foreground" : "border-border bg-card text-foreground hover:border-accent",
              )}
            >
              {c.label}
              <span className="rounded-full border border-border bg-muted px-1.5 text-xs tabular-nums">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-accent/30 bg-card" data-tour="etat-swift-societes">
        {visibles.length === 0 ? (
          <EmptyState
            icon={Globe}
            title={chargement ? "Chargement…" : lignes.length === 0 ? "Aucune société accessible" : "Aucune société ne correspond"}
            description={lignes.length === 0 ? "Créez une société ou faites-vous assigner un périmètre." : "Modifiez la recherche ou le filtre."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-left text-[11px] uppercase tracking-wide text-primary-foreground">
                  <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-accent" aria-hidden="true" />Société</span></th>
                  <th className="px-3 py-3 text-right"><span className="inline-flex items-center gap-1.5"><Globe className="size-3.5 text-accent" aria-hidden="true" />Virements</span></th>
                  <th className="px-3 py-3 text-right"><span className="inline-flex items-center gap-1.5"><Coins className="size-3.5 text-accent" aria-hidden="true" />Montant à justifier (TND)</span></th>
                  <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><Activity className="size-3.5 text-accent" aria-hidden="true" />Avancement</span></th>
                  <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-accent" aria-hidden="true" />État</span></th>
                  <th className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-accent" aria-hidden="true" />Dernier virement</span></th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ societe: s, resume: r, etat }) => {
                  const e = ETATS[etat];
                  const Icone = e.icone;
                  const total = r?.virements ?? 0;
                  const pct = total > 0 ? Math.round(((r?.justifies ?? 0) / total) * 100) : 0;
                  return (
                    <tr key={s.id} className={cn("cursor-pointer border-b border-l-[3px] border-border transition-colors hover:bg-muted/50", e.bande)} onClick={() => navigate(`/etat-swift/${s.id}`)}>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent/15 text-sm font-extrabold text-primary">
                            {(s.raisonSociale.match(/^\d{1,3}/)?.[0] ?? s.raisonSociale.slice(0, 1)).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-serif text-base font-semibold text-primary">{s.raisonSociale}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.theme} · {s.rne || "RNE non renseigné"} · {s.code}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", total === 0 && "text-muted-foreground/50")}>{total}</td>
                      <td className={cn("px-3 py-3 text-right font-bold tabular-nums", total === 0 && "font-normal text-muted-foreground/50")}>{total === 0 ? "—" : montantSwift(r?.montant ?? 0)}</td>
                      <td className="px-3 py-3">
                        {total === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="min-w-[130px]">
                            <div className="h-2 overflow-hidden rounded-full border border-border bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.raisonSociale} : virements justifiés`}>
                              <div className={cn("h-full", etat === "justifie" ? "bg-success" : "bg-accent")} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              {r?.justifies ?? 0} / {total} justifié{(r?.justifies ?? 0) > 1 ? "s" : ""}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold", e.classe)}>
                          <Icone className="size-4 shrink-0" aria-hidden="true" />
                          {e.libelle}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{r?.dernierVirement ? formatDate(r.dernierVirement) : "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={etat === "a_justifier" ? "default" : "outline"}
                          className={cn("h-8 gap-1.5 text-xs", etat === "a_justifier" && "border-accent bg-accent text-accent-foreground hover:bg-accent/90")}
                          aria-label={`Ouvrir l'État SWIFT de ${s.raisonSociale}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            navigate(`/etat-swift/${s.id}`);
                          }}
                        >
                          Ouvrir
                          <ChevronRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">
          <AlertCircle className="size-4" aria-hidden="true" />
          Triées par urgence : d'abord les sociétés qui attendent des factures, puis celles en cours, puis les justifiées.
        </div>
      </div>
    </div>
  );
}
