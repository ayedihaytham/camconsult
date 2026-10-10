import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardMessageActivity } from "@/lib/dashboard/dashboardData";
import { avatarColor, cn, formatRelative } from "@/lib/utils";

const SUJETS = [
  { titre: "Question sur une collecte", detail: "Un tableau, un montant, un bordereau", brouillon: "Bonjour, j'ai une question sur ma collecte : " },
  { titre: "Document manquant ou à envoyer", detail: "Facture, relevé, justificatif", brouillon: "Bonjour, concernant un document manquant ou à envoyer : " },
  { titre: "Demande de prolongation", detail: "Plus de temps pour une échéance", brouillon: "Bonjour, je souhaite demander un délai supplémentaire pour : " },
  { titre: "Autre question", detail: "Écrire librement", brouillon: "" },
];

/** Messages du responsable de société : un contact, des sujets rapides, et seulement les échanges non lus. */
export function ClientMessagesTab({ messages }: { messages: DashboardMessageActivity[] }) {
  const navigate = useNavigate();
  const contact = messages[0] ?? null;
  const unread = messages.filter((message) => message.unread > 0);
  const ouvrir = (conversationId: string | null, brouillon = "") => {
    const params = new URLSearchParams();
    if (conversationId) params.set("conversation", conversationId);
    if (brouillon) params.set("brouillon", brouillon);
    navigate(params.size ? `/messagerie?${params}` : "/messagerie");
  };
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="py-3"><h2 className="text-base font-semibold text-primary">Messages</h2><p className="mt-0.5 text-xs text-muted-foreground">Une question ? Choisissez un sujet, le message est déjà préparé.</p></header>
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
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {SUJETS.map((sujet) => (
          <li key={sujet.titre}>
            <button type="button" onClick={() => ouvrir(contact?.id ?? null, sujet.brouillon)} className="flex min-h-16 w-full flex-col justify-center rounded-md border border-border bg-card px-3.5 py-2.5 text-left hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-sm font-semibold">{sujet.titre}</span><span className="text-xs text-muted-foreground">{sujet.detail}</span>
            </button>
          </li>
        ))}
      </ul>
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
