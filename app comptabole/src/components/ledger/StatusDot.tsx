import { cn } from "@/lib/utils";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { CollecteStatut, Statut } from "@/types";

export type StatusTone = "success" | "warning" | "muted" | "destructive" | "primary";

const toneDot: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground",
  destructive: "bg-destructive",
  primary: "bg-primary",
};

/** Fond de pastille pour la variante `pill` — toujours accompagné du même
 * texte neutre + point coloré que StatusDot (jamais le texte en couleur,
 * --success/--warning sont sous le seuil de contraste AA — voir plus bas). */
const tonePillBg: Record<StatusTone, string> = {
  success: "bg-success/10",
  warning: "bg-warning/10",
  muted: "bg-muted",
  destructive: "bg-destructive/10",
  primary: "bg-primary/10",
};

/**
 * Statut = point coloré + texte en encre neutre — jamais le mot lui-même en
 * couleur. --success (émeraude) et --warning (orange) sont sous le seuil de
 * contraste AA (4,5:1) en texte — voir DESIGN-SYSTEM.md §2 pour l'audit. Le
 * point seul porte la couleur (repère non-textuel, seuil 3:1, largement
 * respecté) ; le mot reste toujours lisible et présent pour ne pas dépendre
 * de la couleur seule (daltonisme compris).
 */
export function StatusDot({
  tone,
  label,
  className,
  pill = false,
  pulse = false,
}: {
  tone: StatusTone;
  label: string;
  className?: string;
  /** Rendu en pastille colorée (fond teinté + coins arrondis) au lieu du
   * simple point + texte — même contenu accessible, juste plus visuel dans
   * un tableau. */
  pill?: boolean;
  /** Léger halo qui pulse autour du point — réservé aux statuts "vivants"
   * (ex. actif). Purement décoratif (CSS uniquement, animation lente et
   * discrète) : l'information reste portée par le point + le texte, jamais
   * par l'animation seule. */
  pulse?: boolean;
}) {
  const shape = pill ? "rounded-full" : "rounded-[2px]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-foreground",
        pill && ["rounded-full px-2.5 py-1 text-xs font-semibold", tonePillBg[tone]],
        className,
      )}
    >
      <span className="relative inline-flex h-[7px] w-[7px] shrink-0" aria-hidden>
        {pulse && (
          <span
            className={cn(
              "absolute inset-0 opacity-50 [animation:ledger-pulse_2.4s_ease-out_infinite]",
              shape,
              toneDot[tone],
            )}
          />
        )}
        <span className={cn("relative h-[7px] w-[7px]", shape, toneDot[tone])} />
      </span>
      {label}
    </span>
  );
}

const SOCIETE_STATUT: Record<Statut, { label: string; tone: StatusTone }> = {
  actif: { label: "Actif", tone: "success" },
  inactif: { label: "Inactif", tone: "muted" },
  en_attente: { label: "En attente", tone: "warning" },
};

/** Statut générique actif/inactif/en_attente — sociétés ET collaborateurs
 * partagent le même type `Statut`. */
export function StatutDot({
  statut,
  pill,
  pulse,
}: {
  statut: Statut;
  pill?: boolean;
  pulse?: boolean;
}) {
  const { label, tone } = SOCIETE_STATUT[statut];
  return <StatusDot tone={tone} label={label} pill={pill} pulse={pulse} />;
}

const COLLECTE_STATUT_TONE: Record<CollecteStatut, StatusTone> = {
  brouillon: "muted",
  transmis: "warning",
  valide: "success",
  a_corriger: "destructive",
  archive: "muted",
};

export function CollecteStatusDot({ statut }: { statut: CollecteStatut }) {
  return (
    <StatusDot
      tone={COLLECTE_STATUT_TONE[statut]}
      label={COLLECTE_STATUT_LABELS[statut]}
    />
  );
}
