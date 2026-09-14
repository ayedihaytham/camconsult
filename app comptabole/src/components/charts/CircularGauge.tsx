import { cn } from "@/lib/utils";

/**
 * Jauge circulaire simple (SVG) — un seul anneau, progression 0-1 tracée
 * depuis midi dans le sens horaire. Utilisée pour les KPI du tableau de
 * bord : la progression encode la part de cette valeur par rapport au
 * maximum du groupe de KPI affiché (jamais un pourcentage inventé), pour
 * rester une information honnête plutôt qu'un simple décor.
 */
export function CircularGauge({
  progress,
  size = 96,
  strokeWidth = 9,
  colorClassName = "stroke-primary",
  trackClassName = "stroke-muted",
  children,
}: {
  /** 0 à 1. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  colorClassName?: string;
  trackClassName?: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const dash = circumference * clamped;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          fill="none"
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={cn("transition-[stroke-dasharray] duration-500 ease-out", colorClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
