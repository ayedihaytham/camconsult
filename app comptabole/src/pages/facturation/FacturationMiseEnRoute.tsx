import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CibleEtape, EtapeMiseEnRoute } from "./miseEnRoute";

const CLE_REPLI = "facturation:mise-en-route:replie";

function lireRepli(): boolean {
  try {
    return window.localStorage.getItem(CLE_REPLI) === "1";
  } catch {
    return false;
  }
}

interface Props {
  etapes: EtapeMiseEnRoute[];
  /** Étape dont l'action est en cours (bouton « Tester » désactivé pendant l'essai). */
  occupe?: CibleEtape | null;
  onAction: (cible: CibleEtape) => void;
}

/**
 * Liste de mise en route de la facture électronique : ce qui est prêt, ce qu'il reste à faire, avec un lien direct pour chaque étape.
 * Une fois toutes les étapes terminées, la carte se réduit à une ligne ; l'utilisateur peut aussi la replier (mémorisé dans le navigateur).
 */
export function FacturationMiseEnRoute({ etapes, occupe = null, onAction }: Props) {
  const faites = etapes.filter((e) => e.etat === "ok").length;
  const complete = faites === etapes.length;
  const [replieChoix, setReplieChoix] = useState<boolean>(lireRepli);
  // Tout est prêt : une seule ligne, sauf si une étape demande attention (certificat bientôt expiré).
  const attention = etapes.some((e) => e.avertissement);
  const replie = (complete && !attention) || replieChoix;

  function basculer() {
    const suivant = !replieChoix;
    setReplieChoix(suivant);
    try {
      window.localStorage.setItem(CLE_REPLI, suivant ? "1" : "0");
    } catch {
      // stockage indisponible : le choix vaut pour cette visite seulement
    }
  }

  return (
    <section aria-label="Mise en route de la facture électronique" className="rounded-xl border border-accent/30 bg-card px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-center gap-3 font-serif text-base font-bold text-primary">
          {complete && !attention ? (
            <span className="flex items-center gap-2">
              <Check className="size-4 text-success" aria-hidden="true" /> Facture électronique prête
            </span>
          ) : (
            "Mise en route de la facture électronique"
          )}
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={etapes.length} aria-valuenow={faites} aria-label="Étapes terminées">
            <span className="block h-full rounded-full bg-success transition-[width]" style={{ width: `${(faites / etapes.length) * 100}%` }} />
          </span>
          <span className="font-sans text-xs font-semibold text-muted-foreground">
            {faites} étape{faites > 1 ? "s" : ""} sur {etapes.length}
          </span>
        </h2>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs font-semibold text-primary" onClick={basculer} aria-expanded={!replie} disabled={complete && !attention}>
          {replie ? (
            <>
              Afficher <ChevronDown className="ml-1 size-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              Masquer <ChevronUp className="ml-1 size-3.5" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>

      {!replie && (
        <ol className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {etapes.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 rounded-lg border border-accent/25 bg-background/60 px-3 py-2.5"
              data-etat={e.etat}
            >
              <span
                className={cn(
                  "row-span-2 grid size-6 place-items-center rounded-full",
                  e.etat === "ok" && !e.avertissement && "bg-success/15 text-success",
                  e.etat === "ok" && e.avertissement && "bg-warning/15 text-warning",
                  e.etat === "a_faire" && "bg-warning/15 text-warning",
                  e.etat === "attente" && "bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {e.etat === "ok" && !e.avertissement ? <Check className="size-3.5" strokeWidth={3} /> : e.etat === "attente" ? <LoaderCircle className="size-3.5 animate-spin" /> : e.avertissement ? <AlertTriangle className="size-3.5" /> : <CircleAlert className="size-3.5" />}
              </span>
              <p className="text-[13px] font-semibold text-primary">
                {e.titre}
                <span className="sr-only"> : {e.etat === "ok" ? (e.avertissement ? "à surveiller" : "terminé") : e.etat === "attente" ? "vérification" : "à faire"}</span>
              </p>
              <p className="text-xs text-muted-foreground">{e.detail}</p>
              {e.action && (
                <button
                  type="button"
                  className="col-start-2 mt-1 w-fit text-xs font-semibold text-primary underline underline-offset-4 hover:text-primary/80 disabled:no-underline disabled:opacity-60"
                  onClick={() => onAction(e.action!.cible)}
                  disabled={occupe === e.action.cible}
                >
                  {occupe === e.action.cible ? "En cours…" : e.action.libelle}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
