// Ligne « libellé / valeur » des fiches détail (Sheet) — Fiche collaborateur,
// Fiche société… Un seul patron visuel pour toutes les fiches de carte :
// `<dl className="divide-y divide-border rounded-sm border border-border">`
// autour d'une ou plusieurs `DetailRow`.
import { cn } from "@/lib/utils";

export function DetailRow({
  label,
  value,
  href,
  className,
}: {
  label: string;
  value: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 py-2.5", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-sm font-medium text-foreground">
        {href ? (
          <a className="underline-offset-4 hover:underline" href={href}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
