import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number;
  delta: number;
  icon: LucideIcon;
}

export function KpiCard({ label, value, delta, icon: Icon }: KpiCardProps) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatNumber(value)}
        </p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
        {delta > 0 && (
          <Badge variant="success" className="mt-3 gap-1">
            <TrendingUp className="size-3" aria-hidden="true" />
            +{formatNumber(delta)} ce mois
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
