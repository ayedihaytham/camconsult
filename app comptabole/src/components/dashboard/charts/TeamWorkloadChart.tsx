import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardTeamMember } from "@/lib/dashboard/dashboardData";

export function TeamWorkloadChart({ members }: { members: DashboardTeamMember[] }) {
  const withWork = members.filter((member) => member.open > 0);
  const maximum = Math.max(1, ...withWork.map((member) => member.open));
  return (
    <Card className="shadow-none">
      <CardHeader className="p-4">
        <CardTitle>Charge actuelle</CardTitle>
        <CardDescription>Répartition relative des tâches ouvertes dans l'équipe</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {withWork.length === 0 ? (
          <DashboardEmptyState icon={Users} title="Aucune tâche assignée" />
        ) : (
          <ul className="space-y-4">
            {withWork.slice(0, 8).map((member) => (
              <li key={member.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{member.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{member.open} ouverte{member.open > 1 ? "s" : ""}</span>
                </div>
                <Progress
                  value={(member.open / maximum) * 100}
                  aria-label={`${member.name} : ${member.open} tâches ouvertes`}
                  className="h-2 bg-muted [&>div]:bg-primary"
                />
              </li>
            ))}
          </ul>
        )}
        {withWork.length > 0 && <p className="mt-4 text-xs text-muted-foreground">La barre la plus longue indique le volume ouvert le plus élevé, pas une capacité.</p>}
      </CardContent>
    </Card>
  );
}
