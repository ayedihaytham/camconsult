import { useEffect, useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Boxes, Coins } from "lucide-react";
import { LedgerCompactHeader } from "@/components/ledger/LedgerCompactHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { useData, useSocietes } from "@/store/data";
import { useStock, type SyntheseStock } from "@/store/stock";
import { cn, initials } from "@/lib/utils";

const montant = (valeur: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valeur);
const jourMois = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));

/** État des cours de change d'une société : « Saisi », « n à saisir », ou rien quand elle n'a aucun mouvement en devise. */
export function etatCours(ligne: Pick<SyntheseStock, "enDevise" | "coursManquants"> | undefined): { label: string; tone: "ok" | "warn" | "none" } {
  if (!ligne || ligne.enDevise === 0) return { label: "—", tone: "none" };
  if (ligne.coursManquants > 0) return { label: `${ligne.coursManquants} à saisir`, tone: "warn" };
  return { label: "Saisi", tone: "ok" };
}

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
  const hydrated = useData((s) => s.hydrated);
  const synthese = useStock((s) => s.synthese);
  const fetchSynthese = useStock((s) => s.fetchSynthese);

  useEffect(() => {
    void fetchSynthese();
  }, [fetchSynthese]);

  // Une société est déjà choisie en haut : son stock s'ouvre directement, sans lui redemander laquelle.
  if (societeActive) return <Navigate to={`/stock/${societeActive.id}`} replace />;

  const lignes = societes.map((s) => synthese[s.id]);
  const total = lignes.reduce((n, l) => n + (l?.mouvements ?? 0), 0);
  const coursManquants = lignes.reduce((n, l) => n + (l?.coursManquants ?? 0), 0);
  const alertes = lignes.reduce((n, l) => n + (l?.alertes ?? 0), 0);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <LedgerCompactHeader
        eyebrow="Clients & travail · Stock"
        title="Gestion de stock"
        metrics={[
          { label: total > 1 ? "Mouvements au total" : "Mouvement au total", value: total },
          { label: coursManquants > 1 ? "Cours manquants" : "Cours manquant", value: coursManquants },
          { label: alertes > 1 ? "Alertes stock" : "Alerte stock", value: alertes },
        ]}
        actions={
          <Link
            to="/cours-change"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-accent/60 px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
          >
            <Coins className="size-4" aria-hidden="true" />
            Cours de change
          </Link>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card" data-tour="stock-societes">
        {societes.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={hydrated ? "Aucune société accessible" : "Chargement…"}
            description="Créez une société ou faites-vous assigner un périmètre pour voir son stock."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Stock par société</caption>
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {["Société", "Mouvements", "Valeur du stock", "Dernier mouvement", "Cours de change"].map((titre) => (
                    <th key={titre} scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{titre}</th>
                  ))}
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {societes.map((s) => {
                  const ligne = synthese[s.id];
                  const cours = etatCours(ligne);
                  return (
                    <tr key={s.id} onClick={() => navigate(`/stock/${s.id}`)} className="cursor-pointer border-t border-border first:border-t-0 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary/60 text-xs font-extrabold text-primary">{initials(s.raisonSociale)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{s.raisonSociale}</p>
                            <p className="truncate text-xs text-muted-foreground">{s.theme} · {s.rne || "RNE non renseigné"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{ligne?.mouvements ?? 0}</td>
                      <td className="px-4 py-3 tabular-nums">{ligne && ligne.valeur > 0 ? montant(ligne.valeur) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{ligne?.dernierLe ? jourMois(ligne.dernierLe) : "—"}</td>
                      <td className="px-4 py-3">
                        {cours.tone === "none" ? <span className="text-muted-foreground">—</span> : (
                          <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", cours.tone === "ok" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{cours.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/stock/${s.id}`); }}
                          aria-label={`Ouvrir le stock de ${s.raisonSociale}`}
                          className="min-h-9 whitespace-nowrap rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Ouvrir →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
