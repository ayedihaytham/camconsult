import { X } from "lucide-react";

/** Puce de filtre actif, retirable — remplace un select fermé par un
 * indicateur visible directement dans la barre d'outils (voir
 * DESIGN-SYSTEM.md : fond `--accent` teinté, jamais l'or en texte). */
export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Retirer le filtre ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
