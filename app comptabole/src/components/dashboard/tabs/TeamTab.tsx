import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TeamWorkloadChart } from "@/components/dashboard/charts/TeamWorkloadChart";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardTaskCounts, DashboardTeamMember } from "@/lib/dashboard/dashboardData";
import { avatarColor, cn } from "@/lib/utils";

export function TeamTab({ members, counts }: { members: DashboardTeamMember[]; counts: DashboardTaskCounts }) {
  const active = members.filter((member) => member.active).length;
  const open = counts.a_faire + counts.en_cours;
  return (
    <div className="min-w-0 space-y-3">
      <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-border/70 bg-card px-4 py-3 text-sm">
        <InlineStat label="Collaborateurs actifs" value={active} />
        <InlineStat label="Tâches ouvertes" value={open} />
        <InlineStat label="En cours" value={counts.en_cours} />
        <InlineStat label="Terminées" value={counts.termine} />
      </dl>
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <TeamWorkloadChart members={members} />
        <Card className="shadow-none">
          <CardHeader className="p-4">
            <CardTitle>Collaborateurs</CardTitle>
            <CardDescription>Charge ouverte et historique terminé</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {members.length === 0 ? <DashboardEmptyState title="Aucun collaborateur actif" /> : (
              <ul>
                {members.slice(0, 8).map((member, index) => (
                  <li key={member.id}>
                    {index > 0 && <Separator />}
                    <div className="flex min-w-0 items-center gap-3 py-3">
                      <span className="relative shrink-0">
                        <Avatar className="size-8"><AvatarFallback className={cn("text-[0.65rem] font-semibold", avatarColor(member.id))}>{member.initials}</AvatarFallback></Avatar>
                        <span className={cn("absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card", member.online ? "bg-success" : "bg-muted-foreground/40")} aria-label={member.online ? "En ligne" : "Hors ligne"} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{member.open} ouvertes · {member.done} terminées</p>
                      </div>
                      {!member.active && <Badge variant="muted">Inactif</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: number }) {
  return <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums text-foreground">{value}</dd></div>;
}
