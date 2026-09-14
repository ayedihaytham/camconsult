import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI en « ligne de relevé » (direction Ledger Rule) au lieu d'une carte
 * icône+chiffre+label. La hiérarchie vient de la taille/graisse du texte
 * (prop `hero`), pas d'un layout en bento — voir DESIGN-SYSTEM.md §1 pour le
 * critère qui décide si un écran a une ligne héros.
 *
 * Le delta ("+6 ce mois-ci") ne colore que la petite flèche (--success,
 * repère non-textuel) : le chiffre du delta reste en encre neutre, car
 * --success est sous le seuil de contraste AA en texte (voir §2).
 */
export function LedgerKpiRow({
  label,
  value,
  hero = false,
  danger = false,
  delta,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hero?: boolean;
  /** Valeur en --destructive (contraste ≈5,8:1, autorisé en texte) — pour un signal critique comme les écarts de stock. */
  danger?: boolean;
  delta?: string;
  hint?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-4 border-b border-border px-5 last:border-b-0",
        hero ? "py-5" : "py-4",
        onClick && "text-left transition-colors hover:bg-primary/[0.03]",
      )}
    >
      <span
        className={cn(
          "font-bold text-foreground",
          hero ? "text-base" : "text-[0.84rem]",
        )}
      >
        {label}
      </span>
      <span className="flex items-center gap-3">
        {delta && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
            <TrendingUp className="h-[11px] w-[11px] text-success" aria-hidden />
            {delta}
          </span>
        )}
        {hint && (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
        <span
          className={cn(
            "font-extrabold tabular-nums tracking-tight",
            hero ? "text-4xl" : "text-xl",
            danger && "text-destructive",
          )}
        >
          {value}
        </span>
      </span>
    </Comp>
  );
}
