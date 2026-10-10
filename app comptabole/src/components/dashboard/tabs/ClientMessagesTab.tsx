import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardMessageActivity } from "@/lib/dashboard/dashboardData";
import { avatarColor, cn, formatRelative } from "@/lib/utils";

/** Messages du responsable de société : un contact et seulement les échanges non lus. */
export function ClientMessagesTab({ messages }: { messages: DashboardMessageActivity[] }) {
  const navigate = useNavigate();
  const contact = messages[0] ?? null;
  const unread = messages.filter((message) => message.unread > 0);
  const ouvrir = (conversationId: string | null) => navigate(conversationId ? `/messagerie?conversation=${encodeURIComponent(conversationId)}` : "/messagerie");
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="py-3"><h2 className="text-base font-semibold text-primary">Messages</h2><p className="mt-0.5 text-xs text-muted-foreground">Vos échanges avec le cabinet</p></header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent bg-accent/10 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <Avatar className="size-10"><AvatarFallback className="bg-primary text-xs font-semibold text-accent">{contact?.initials ?? "CA"}</AvatarFallback></Avatar>
            {contact?.online && <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-success" aria-label="En ligne" />}
          </span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{contact?.label ?? "Votre cabinet"}</p><p className="text-xs text-muted-foreground">Votre contact au cabinet</p></div>
        </div>
        <Button className="min-h-11" onClick={() => ouvrir(contact?.id ?? null)}>Écrire au cabinet</Button>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">Messages non lus</h3>
      {unread.length === 0 ? <DashboardEmptyState icon={MessageCircle} title="Aucun message non lu" description="Vous êtes à jour avec le cabinet." /> : (
        <ul className="overflow-hidden rounded-md border border-border bg-card">
          {unread.map((message) => (
            <li key={message.id} className="border-t border-border first:border-t-0">
              <button type="button" onClick={() => ouvrir(message.id)} aria-label={`Ouvrir la conversation avec ${message.label}, ${message.unread} non lu${message.unread > 1 ? "s" : ""}`} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <Avatar className="size-9"><AvatarFallback className={cn("text-[0.7rem] font-semibold", avatarColor(message.id))}>{message.initials}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{message.label}</span><span className="block truncate text-xs text-foreground">{message.preview}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(message.updatedAt)}</span>
                <Badge>{message.unread}</Badge>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
