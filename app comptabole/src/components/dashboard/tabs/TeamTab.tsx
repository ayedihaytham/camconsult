import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardTaskCounts, DashboardTeamMember } from "@/lib/dashboard/dashboardData";
import { avatarColor, cn, formatNumber } from "@/lib/utils";

export function TeamTab({ members, counts }: { members: DashboardTeamMember[]; counts: DashboardTaskCounts }) {
  const active = members.filter((member) => member.active).length;
  const open = counts.a_faire + counts.en_cours;
  const maxOpen = Math.max(...members.map((member) => member.open), 1);
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="py-3"><h2 className="text-base font-semibold text-primary">Charge de l'équipe</h2><p className="mt-0.5 text-xs text-muted-foreground">Lecture relative des tâches ouvertes, sans objectif de capacité.</p></header>
      <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <InlineStat label="Collaborateurs actifs" value={active} />
        <InlineStat label="Tâches ouvertes" value={open} />
        <InlineStat label="En cours" value={counts.en_cours} />
        <InlineStat label="Terminées" value={counts.termine} />
      </dl>
      {members.length === 0 ? <DashboardEmptyState title="Aucun collaborateur" /> : (
        <ul>
          {members.slice(0, 8).map((member) => (
            <li key={member.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border py-3 md:grid-cols-[auto_minmax(10rem,0.7fr)_minmax(12rem,1fr)_auto] md:items-center">
              <span className="relative shrink-0">
                <Avatar className="size-8"><AvatarFallback className={cn("text-[0.65rem] font-semibold", avatarColor(member.id))}>{member.initials}</AvatarFallback></Avatar>
                <span className={cn("absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-background", member.online ? "bg-success" : "bg-muted-foreground/40")} aria-label={member.online ? "En ligne" : "Hors ligne"} />
              </span>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium">{member.name}</p>{!member.active && <Badge variant="muted">Inactif</Badge>}</div><p className="mt-0.5 text-xs text-muted-foreground">{member.aFaire} à faire · {member.enCours} en cours</p></div>
              <div className="col-span-2 md:col-span-1"><Progress value={(member.open / maxOpen) * 100} className="h-1.5" aria-label={`Charge relative de ${member.name}`} /><p className="mt-1 text-[0.68rem] text-muted-foreground">Charge relative aux tâches ouvertes visibles</p></div>
              <div className="col-span-2 flex items-baseline justify-between gap-4 md:col-span-1 md:block md:text-right"><p className="font-semibold tabular-nums text-primary">{formatNumber(member.open)} <span className="text-xs font-normal text-muted-foreground">ouvertes</span></p><p className="text-xs tabular-nums text-muted-foreground">{formatNumber(member.done)} terminées</p></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InlineStat({ label, value }: { label: string; value: number }) {
  return <div className="border-b border-r border-border px-3 py-3 last:border-r-0 sm:border-b-0"><dt className="text-[0.68rem] text-muted-foreground">{label}</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{formatNumber(value)}</dd></div>;
}
