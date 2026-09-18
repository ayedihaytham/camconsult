import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TACHE_STATUT_LABELS } from "@/types";
import type { TacheStatut } from "@/types";

const STATUS_BADGE: Record<
  TacheStatut,
  { variant: NonNullable<BadgeProps["variant"]>; className: string }
> = {
  a_faire: {
    variant: "muted",
    className: "border-border/70",
  },
  en_cours: {
    variant: "warning",
    className: "border-warning/25",
  },
  termine: {
    variant: "success",
    className: "border-success/25",
  },
};

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TacheStatut;
  className?: string;
}) {
  const config = STATUS_BADGE[status];

  return (
    <Badge
      variant={config.variant}
      className={cn("border px-2 py-0.5 text-xs font-medium", config.className, className)}
    >
      {TACHE_STATUT_LABELS[status]}
    </Badge>
  );
}
