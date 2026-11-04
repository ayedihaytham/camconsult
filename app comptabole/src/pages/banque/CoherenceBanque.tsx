import { Link } from "react-router-dom";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlerteCoherence } from "@/types";

const ICONES = { erreur: AlertOctagon, attention: AlertTriangle, info: Info } as const;
const TONS = {
  erreur: "text-destructive",
  attention: "text-warning",
  info: "text-muted-foreground",
} as const;
const LIBELLES = { erreur: "Incohérence", attention: "À traiter", info: "À savoir" } as const;

/** Ce qui ne tombe pas juste entre le suivi bancaire, le suivi fournisseur et le suivi client devise : chaque alerte dit quoi et mène à l'écran où le corriger. */
/** `ici` : l'écran où l'on se trouve, dont le lien n'est pas proposé ; `sansTitre` : le titre est déjà donné par le bandeau qui contient la liste. */
export function CoherenceBanque({ alertes, ici, sansTitre }: { alertes: AlerteCoherence[]; ici?: string; sansTitre?: boolean }) {
  if (alertes.length === 0) {
    return (
      <section aria-label="Cohérence entre modules" className="flex items-center gap-2 border-t border-border px-5 py-4 text-sm text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Tout est cohérent : encaissements affectés, règlements égaux à la banque, factures non sur-réglées, changes reliés.
      </section>
    );
  }
  return (
    <section aria-label="Cohérence entre modules" className="border-t-2 border-accent/40 bg-accent/[0.07] px-5 py-4">
      {!sansTitre && <h3 className="mb-2 text-sm font-bold text-primary">Cohérence entre modules ({alertes.length})</h3>}
      <ul className="space-y-1.5">
        {alertes.slice(0, 50).map((a, i) => {
          const Icone = ICONES[a.gravite];
          return (
            <li key={`${a.code}-${i}`} className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
              <Icone className={cn("mt-0.5 size-3.5 shrink-0", TONS[a.gravite])} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={cn("mr-1.5 font-semibold", TONS[a.gravite])}>{LIBELLES[a.gravite]}</span>
                {a.message}
              </span>
              {a.lien.route !== ici && (
                <Link to={a.lien.route} className="shrink-0 font-semibold text-primary hover:underline">
                  {a.lien.libelle}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {alertes.length > 50 && <p className="mt-2 text-xs text-muted-foreground">… et {alertes.length - 50} autres alertes.</p>}
    </section>
  );
}
