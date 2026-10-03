import { UsersRound } from "lucide-react";
import type { DashboardTeamMember } from "@/lib/dashboard/dashboardData";
import { WorkspaceSection } from "./WorkspaceSection";

export function TeamWorkPreview({ members }: { members: DashboardTeamMember[] }) {
  return <WorkspaceSection title="Répartition du travail" icon={UsersRound} target="dashboard-team" route="/?tab=team" linkLabel="Voir l’équipe" footerLink>
    {members.length ? <ul className="dashboard-context-register">{members.slice(0, 3).map((member) => <li key={member.id} className="dashboard-context-row dashboard-team-row">
      <span className="dashboard-monogram" aria-hidden="true">{member.initials}</span>
      <div className="min-w-0"><p className="dashboard-context-name">{member.name}{!member.active && <span className="ml-1 text-xs font-normal text-muted-foreground"> · Inactif</span>}</p>
        <p className="dashboard-team-breakdown"><strong>{member.open} ouverte{member.open > 1 ? "s" : ""}</strong><span> · {member.aFaire} à faire · {member.enCours} en cours</span></p>
      </div>
    </li>)}</ul> : <p className="dashboard-section-empty">Aucun collaborateur dans ce périmètre.</p>}
  </WorkspaceSection>;
}
