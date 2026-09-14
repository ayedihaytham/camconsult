import { cn } from "@/lib/utils";

export interface RadialSegment {
  label: string;
  value: number;
  colorClassName: string;
}

/**
 * Anneaux concentriques — un anneau par segment (pas un donut empilé), la
 * plus grande valeur à l'extérieur. La longueur de chaque arc encode
 * value / max(valeurs) : lecture directe des écarts entre catégories, sans
 * empilement qui rendrait chaque segment dépendant du précédent. Toujours
 * accompagné d'une légende texte à côté (jamais la couleur seule).
 */
export function RadialBarChart({
  segments,
  size = 180,
  strokeWidth = 12,
  gap = 4,
}: {
  segments: RadialSegment[];
  size?: number;
  strokeWidth?: number;
  gap?: number;
}) {
  const max = Math.max(1, ...segments.map((s) => s.value));
  const outerR = (size - strokeWidth) / 2;

  return (
    <svg width={size} height={size} className="-rotate-90">
      {segments.map((s, i) => {
        const r = outerR - i * (strokeWidth + gap);
        if (r <= 0) return null;
        const circumference = 2 * Math.PI * r;
        const ratio = s.value / max;
        const dash = circumference * ratio;
        return (
          <g key={s.label}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={strokeWidth}
              fill="none"
              className="stroke-muted"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className={cn("transition-[stroke-dasharray] duration-500 ease-out", s.colorClassName)}
            />
          </g>
        );
      })}
    </svg>
  );
}
