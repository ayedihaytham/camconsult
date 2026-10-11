import { useEffect, useMemo } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Boxes, Coins } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { useData, useSocietes } from "@/store/data";
import { useStock } from "@/store/stock";
import { useCoursChange } from "@/store/coursChange";
import { coursDuMois } from "@/lib/coursChange";
import { formatRelative, initials } from "@/lib/utils";

/** Cours de change du mois courant qui manquent : ils servent aux factures en devise du stock. */
export function nombreCoursManquants(devises: { code: string }[], cours: Parameters<typeof coursDuMois>[0], aujourdhui: Date): number {
  const iso = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}-01`;
  return devises.filter((d) => !coursDuMois(cours, d.code, iso)).length;
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
  const fetchCours = useCoursChange((s) => s.fetch);
  const devises = useCoursChange((s) => s.devises);
  const cours = useCoursChange((s) => s.cours);

  useEffect(() => {
    void fetchSynthese();
    void fetchCours();
  }, [fetchSynthese, fetchCours]);

  // Une société est déjà choisie en haut : son stock s'ouvre directement, sans lui redemander laquelle.
  if (societeActive) return <Navigate to={`/stock/${societeActive.id}`} replace />;

  const total = societes.reduce((n, s) => n + (synthese[s.id]?.mouvements ?? 0), 0);
  const manquants = nombreCoursManquants(devises, cours, new Date());

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        variant="compact"
        icon={Boxes}
        eyebrow="Clients & travail · Stock"
        title="Gestion de stock"
        description="Suivez les mouvements de chaque société, puis ouvrez son stock."
        metrics={[
          { label: "Mouvements", value: total },
          { label: "Sociétés", value: societes.length },
          { label: manquants === 1 ? "Cours du mois manquant" : "Cours du mois manquants", value: manquants, tone: manquants > 0 ? "warning" : "default" },
        ]}
        actions={
          <Link
            to="/cours-change"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary-foreground/30 px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
          >
            <Coins className="size-4" aria-hidden="true" />
            Cours de change
          </Link>
        }
      />

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card" data-tour="stock-societes">
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
                  {["Société", "Mouvements", "Dernier mouvement"].map((titre) => (
                    <th key={titre} scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{titre}</th>
                  ))}
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {societes.map((s) => {
                  const ligne = synthese[s.id];
                  const n = ligne?.mouvements ?? 0;
                  return (
                    <tr key={s.id} onClick={() => navigate(`/stock/${s.id}`)} className="cursor-pointer border-t border-border first:border-t-0 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary/60 text-xs font-extrabold text-primary">{initials(s.raisonSociale)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{s.raisonSociale}</p>
                            <p className="truncate text-xs text-muted-foreground">{s.theme} · {s.rne || "RNE non renseigné"} · {s.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{n > 0 ? n : <span className="text-muted-foreground">Aucun</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{ligne?.dernierLe ? formatRelative(ligne.dernierLe) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/stock/${s.id}`); }}
                          aria-label={`Ouvrir le stock de ${s.raisonSociale}`}
                          className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Ouvrir<ArrowRight className="size-3.5" aria-hidden="true" />
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
