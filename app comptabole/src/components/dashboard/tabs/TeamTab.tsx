import { ArrowRight } from "lucide-react";
import { DashboardEmptyState } from "../DashboardEmptyState";
import { WorkspaceSection } from "../WorkspaceSection";
import type { DashboardTaskCounts, DashboardTeamMember } from "@/lib/dashboard/dashboardData";

export function TeamTab({ members, counts, onOpenMember }: {
  members: DashboardTeamMember[];
  counts: DashboardTaskCounts;
  onOpenMember?: (id: string) => void;
}) {
  function identity(member: DashboardTeamMember) {
    const label = <><span className="min-w-0 break-words">{member.name}{!member.active && <span className="ml-2 text-xs font-normal text-muted-foreground">Inactif</span>}</span>{onOpenMember && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}</>;
    return onOpenMember ? <button type="button" onClick={() => onOpenMember(member.id)} aria-label={`Voir les tâches de ${member.name}`} className="dashboard-navigation flex min-h-11 items-center gap-2 rounded text-left font-medium text-primary hover:underline">{label}</button> : <span className="flex min-h-11 items-center text-primary">{label}</span>;
  }
  return <WorkspaceSection title="Répartition du travail" description={`${counts.a_faire + counts.en_cours} tâches ouvertes dans le périmètre affiché. Comptages de tâches, sans mesure de capacité ni classement.`}>
    {!members.length ? <DashboardEmptyState title="Aucun collaborateur dans ce périmètre" /> : <>
      <table className="hidden w-full table-fixed text-left text-sm sm:table">
        <caption className="sr-only">Tâches par collaborateur</caption>
        <thead className="bg-muted/60 text-xs text-primary"><tr className="border-b border-primary/20">
          <th scope="col" className="w-[44%] px-3 py-3 font-semibold">Collaborateur</th>
          {["À faire", "En cours", "Terminées", "Ouvertes"].map((label) => <th key={label} scope="col" className="px-3 py-3 text-right font-medium">{label}</th>)}
        </tr></thead>
        <tbody>{members.map((member) => <tr key={member.id} className="dashboard-row border-b border-border">
          <th scope="row" className="px-3 py-1.5 font-medium">{identity(member)}</th>
          {[member.aFaire, member.enCours, member.done, member.open].map((value, index) => <td key={index} className={`px-3 py-1.5 text-right tabular-nums ${index === 3 ? "font-semibold text-primary" : "text-muted-foreground"}`}>{value}</td>)}
        </tr>)}</tbody>
      </table>
      <ul className="sm:hidden">{members.map((member) => <li key={member.id} className="dashboard-row border-b border-border py-3">
        <h3 className="text-sm">{identity(member)}</h3>
        <dl className="mt-1 grid grid-cols-4 gap-2 text-xs">{[["À faire", member.aFaire], ["En cours", member.enCours], ["Terminées", member.done], ["Ouvertes", member.open]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 text-base font-semibold tabular-nums text-primary">{value}</dd></div>)}</dl>
      </li>)}</ul>
    </>}
  </WorkspaceSection>;
}
