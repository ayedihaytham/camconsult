import { cn } from "@/lib/utils";

/** Onglets/vues soulignés (remplace les boutons pleins bg-primary) — utilisé
 * pour les vues Actives/Archivées/Toutes (Collecte) et les onglets de type
 * (Bordereaux). */
export function LedgerSegmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "Choisir une vue",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div className="flex min-w-0 gap-5 overflow-x-auto border-b border-border" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "-mb-px shrink-0 border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors",
            value === o.value
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
