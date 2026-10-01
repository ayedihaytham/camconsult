import { ArrowRight, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { DashboardMessageActivity } from "@/lib/dashboard/dashboardData";
import { WorkspaceSection } from "./WorkspaceSection";

export function UnreadMessagesPreview({ messages }: { messages: DashboardMessageActivity[] }) {
  return <WorkspaceSection title="Mes messages non lus" icon={Mail} target="dashboard-communication" route="/messagerie" linkLabel="Messagerie">
    {messages.length ? <ul className="dashboard-context-register">{messages.slice(0, 3).map((message) => <li key={message.id}>
      <Link to="/messagerie" className="dashboard-message-unread dashboard-context-row dashboard-navigation">
        <span className="dashboard-monogram" aria-hidden="true">{message.initials}</span>
        <div className="min-w-0">
          <div className="dashboard-message-heading"><p>{message.label}</p><Badge className="dashboard-badge dashboard-badge--info">{message.unread} non lu{message.unread > 1 ? "s" : ""}</Badge></div>
          <p className="dashboard-context-preview">{message.preview || "Nouveau message"}</p>
        </div>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </li>)}</ul> : <p className="dashboard-section-empty">Aucun message non lu.</p>}
  </WorkspaceSection>;
}
