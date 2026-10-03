// Ligne « libellé / valeur » des fiches détail (Sheet) — Fiche collaborateur,
// Fiche société… Un seul patron visuel pour toutes les fiches de carte :
// `<dl className="divide-y divide-accent/25 overflow-hidden rounded-xl border border-accent/30 bg-card">`
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
    <div className={cn("flex items-center justify-between gap-4 px-5 py-3.5", className)}>
      <dt className="text-[0.95rem] text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-[0.95rem] font-medium text-primary">
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
