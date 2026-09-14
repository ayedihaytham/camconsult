import { cn } from "@/lib/utils";

/** Onglets/vues soulignés (remplace les boutons pleins bg-primary) — utilisé
 * pour les vues Actives/Archivées/Toutes (Collecte) et les onglets de type
 * (Bordereaux). */
export function LedgerSegmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-5 border-b border-border" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "-mb-px border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors",
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
