import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Boxes, ChevronRight, Coins } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermissions } from "@/hooks/usePermissions";
import { useData, useSocietes } from "@/store/data";
import { useStock } from "@/store/stock";
import { initials } from "@/lib/utils";

export function StockPage() {
  const navigate = useNavigate();
  const { canSeeSociete } = usePermissions();
  const allSocietes = useSocietes();
  const societes = allSocietes
    .filter((s) => canSeeSociete(s.id))
    .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true }));
  const hydrated = useData((s) => s.hydrated);
  const counts = useStock((s) => s.counts);
  const fetchCounts = useStock((s) => s.fetchCounts);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        variant="compact"
        icon={Boxes}
        eyebrow="Clients & travail · Stock"
        title="Gestion de stock"
        description="Choisissez une société pour consulter et enregistrer ses mouvements de stock."
        metrics={[]}
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

      <div className="mt-4 overflow-hidden rounded-xl border border-accent/30 bg-card" data-tour="stock-societes">
        {societes.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={hydrated ? "Aucune société accessible" : "Chargement…"}
            description="Créez une société ou faites-vous assigner un périmètre pour voir son stock."
          />
        ) : (
          <ul className="divide-y divide-accent/25">
            {societes.map((s) => {
              const n = counts[s.id] ?? 0;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/stock/${s.id}`)}
                    aria-label={`Ouvrir le stock de ${s.raisonSociale}`}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/[0.06] focus-visible:bg-accent/[0.06] focus-visible:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-[54px] shrink-0 place-items-center rounded-xl bg-accent/15 text-sm font-bold text-primary"
                    >
                      {initials(s.raisonSociale)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-xl font-medium leading-tight text-primary">
                        {s.raisonSociale}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {s.theme} · {s.rne || "RNE non renseigné"} · {s.code}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {n} mouvement{n > 1 ? "s" : ""}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
