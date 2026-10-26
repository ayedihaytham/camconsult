import { Link } from "react-router-dom";
import { UsersRound } from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import type { DashboardMessageActivity, DashboardTeamMember } from "@/lib/dashboard/dashboardData";
import { WorkspaceSection } from "./WorkspaceSection";

/** Teintes des avatars : marine, or et bleu ardoise (jetons de l'application), en alternance. */
const TONES = ["is-navy", "is-gold", "is-slate"] as const;
const tone = (index: number) => TONES[index % TONES.length];

/** Avatar à initiales avec point de présence (en ligne / hors ligne). */
function PresenceAvatar({ initials, index, online }: { initials: string; index: number; online: boolean }) {
  return <span className={cn("bureau-avatar", tone(index))} aria-hidden="true">{initials}<i className={online ? "is-online" : undefined} /></span>;
}

/** « Messages à lire » : conversations non lues, avec présence et « Répondre » (ouvre la messagerie). */
export function AdminMessageRows({ messages }: { messages: DashboardMessageActivity[] }) {
  if (!messages.length) return <p className="admin-brief-empty">Aucun message non lu.</p>;
  return (
    <ul>
      {messages.slice(0, 4).map((message, index) => (
        <li key={message.id} className="bureau-message">
          <PresenceAvatar initials={message.initials} index={index} online={message.online} />
          <div className="min-w-0">
            <p className="bureau-message-name">{message.label}<span className="bureau-unread-dot" aria-hidden="true" /><span className="sr-only"> · {message.unread} non lu{message.unread > 1 ? "s" : ""}</span></p>
            <p className="bureau-message-preview">{message.preview || "Nouveau message"}</p>
          </div>
          <Link to="/messagerie" className="bureau-reply" aria-label={`Répondre à ${message.label}`}>Répondre</Link>
        </li>
      ))}
    </ul>
  );
}

/** Équipe (administrateur) : au plus trois collaborateurs par ordre alphabétique, avec présence et barre de charge (en cours / à faire, relative au plus chargé). Consultation seule : aucun lien, aucune note, aucun classement. */
export function AdminTeamCard({ members }: { members: DashboardTeamMember[] }) {
  const busiest = Math.max(1, ...members.map((member) => member.open));
  return (
    <div className="bureau-card">
      <WorkspaceSection title="Équipe" icon={UsersRound}>
        {members.length ? <ul>{members.slice(0, 3).map((member, index) => (
          <li key={member.id} className="bureau-member">
            <PresenceAvatar initials={member.initials} index={index + 1} online={member.online} />
            <div className="min-w-0">
              <p className="bureau-member-name">{toTitleCase(member.name)}{!member.active && <span> · Inactif</span>}</p>
              <p className="bureau-member-detail">{member.open > 0 ? `${member.enCours} en cours · ${member.aFaire} à faire` : "Aucune tâche ouverte"}</p>
            </div>
            <span className={cn("bureau-member-count", member.open === 0 && "is-zero")} title={`${member.enCours} en cours · ${member.aFaire} à faire`}>{member.open}</span>
            <div className="bureau-load" role="img" aria-label={`${member.open} ouverte${member.open > 1 ? "s" : ""} : ${member.enCours} en cours, ${member.aFaire} à faire`}>
              <i className="is-doing" style={{ width: `${(member.enCours / busiest) * 100}%` }} />
              <i className="is-todo" style={{ width: `${(member.aFaire / busiest) * 100}%` }} />
            </div>
          </li>
        ))}</ul> : <p className="admin-brief-empty">Aucun collaborateur dans ce périmètre.</p>}
        <p className="bureau-load-legend" aria-hidden="true"><span><i className="is-doing" />En cours</span><span><i className="is-todo" />À faire</span></p>
      </WorkspaceSection>
    </div>
  );
}
