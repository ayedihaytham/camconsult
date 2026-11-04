import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AlerteCoherence } from "@/types";
import { CoherenceBanque } from "./CoherenceBanque";

/**
 * Les alertes de cohérence entre modules qui concernent l'écran où l'on se trouve (fournisseur, client devise, stock) : un bandeau replié qui dit combien,
 * et qui s'ouvre sur le détail avec le lien vers l'écran où corriger. Réservé au cabinet : sans droit (compte de société), rien ne s'affiche.
 * `garde` affine la liste (par exemple, les factures d'une seule fiche).
 */
export function CoherenceModule({ societeId, module, garde, className }: { societeId: string | undefined; module: AlerteCoherence["modules"][number]; garde?: (a: AlerteCoherence) => boolean; className?: string }) {
  const [alertes, setAlertes] = useState<AlerteCoherence[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!societeId) return;
    let courant = true;
    setAlertes([]);
    api
      .get<{ alertes: AlerteCoherence[] }>(`/banque/coherence?societeId=${societeId}`)
      .then((r) => courant && setAlertes(r.alertes.filter((a) => a.modules.includes(module) && (garde ? garde(a) : true))))
      .catch(() => undefined); // pas de droit sur la cohérence (compte de société) ou serveur indisponible : pas de bandeau
    return () => {
      courant = false;
    };
    // `garde` est recréée à chaque rendu par l'appelant : seule la société et le module relancent la lecture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societeId, module]);
  if (alertes.length === 0) return null;
  const erreurs = alertes.filter((a) => a.gravite === "erreur").length;
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)} data-testid="coherence-module">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", erreurs > 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>{alertes.length}</span>
        <span className="min-w-0 flex-1 font-semibold text-primary">
          Cohérence avec les autres modules
          <span className="ml-2 font-normal text-muted-foreground">{alertes.length} point{alertes.length > 1 ? "s" : ""} à vérifier{erreurs > 0 ? ` dont ${erreurs} incohérence${erreurs > 1 ? "s" : ""}` : ""}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", ouvert && "rotate-180")} aria-hidden="true" />
      </button>
      {ouvert && <CoherenceBanque alertes={alertes} ici={pathname} sansTitre />}
    </div>
  );
}
