import { StatutDot } from "@/components/ledger/StatusDot";
import { THEME_ACCENT, THEME_ICON } from "@/lib/societeTheme";
import { cn, sinceLabel } from "@/lib/utils";
import type { Societe } from "@/types";

/**
 * Carte société compacte — même habillage que la vue Cartes de "Liste des
 * sociétés" (icône de thème, statut, repères réels), réutilisée partout où
 * on doit choisir une société sans avoir besoin du menu d'actions complet
 * (⋯ Dupliquer/Modifier/Supprimer) : ici juste une navigation par clic sur
 * la carte entière (le survol — léger soulèvement — signale déjà l'action,
 * pas besoin d'un chevron en plus).
 */
export function SocieteCard({
  societe,
  employeCount,
  onClick,
}: {
  societe: Societe;
  /** Nombre d'employés de la société cliente — omis si non pertinent pour
   * l'écran appelant plutôt que d'afficher une fausse valeur. */
  employeCount?: number;
  onClick?: () => void;
}) {
  const ThemeIcon = THEME_ICON[societe.theme];
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200",
        onClick &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            THEME_ACCENT[societe.theme],
          )}
          aria-hidden
        >
          <ThemeIcon className="h-5 w-5" />
        </span>
        <StatutDot statut={societe.statut} pill pulse={societe.statut === "actif"} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{societe.raisonSociale}</p>
        <p className="truncate text-xs text-muted-foreground">
          {societe.code} · {societe.theme}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
        {employeCount !== undefined && (
          <>
            <span>
              {employeCount === 0
                ? "Aucun responsable"
                : `${employeCount} responsable${employeCount > 1 ? "s" : ""}`}
            </span>
            <span aria-hidden>·</span>
          </>
        )}
        <span>{sinceLabel(societe.creeLe, "Client depuis")}</span>
      </div>
    </div>
  );
}
