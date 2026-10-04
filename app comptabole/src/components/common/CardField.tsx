import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Classes à donner au champ de saisie placé dans un CardField (sans cadre propre). */
export const CARD_FIELD_INPUT =
  "mt-1 block w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-60";

/** Champ « carte » : l'étiquette est dans le cadre, au-dessus de la saisie.
 * À la saisie, le cadre passe en marine, le fond en blanc et le repère doré
 * se transforme en losange. */
export function CardField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "card-field group rounded-lg border bg-secondary/60 px-4 pb-2.5 pt-3 transition-[border-color,background-color,box-shadow] duration-150 focus-within:border-primary focus-within:bg-card focus-within:shadow-[0_0_0_3px_hsl(var(--accent)/0.22)]",
          error ? "border-destructive/60" : "border-accent/35",
        )}
      >
        <label
          htmlFor={id}
          className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span
            className="size-1.5 bg-accent transition-transform duration-150 group-focus-within:rotate-45"
            aria-hidden="true"
          />
          {label}
        </label>
        {children}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Intertitre de section : libellé en petites majuscules suivi d'un filet. */
export function CardSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </p>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}
