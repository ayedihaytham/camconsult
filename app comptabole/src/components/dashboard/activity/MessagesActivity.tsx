import { ArrowRight, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardMessageActivity } from "@/lib/dashboard/dashboardData";
import { avatarColor, cn, formatRelative } from "@/lib/utils";

export function MessagesActivity({ messages, onOpen }: { messages: DashboardMessageActivity[]; onOpen: () => void }) {
  if (messages.length === 0) return <DashboardEmptyState icon={MessageCircle} title="Aucun échange récent" />;
  return (
    <ul>
      {messages.map((message, index) => (
        <li key={message.id}>
          {index > 0 && <Separator />}
          <div className="flex min-w-0 items-center gap-3 py-3">
            <span className="relative shrink-0">
              <Avatar className="size-8">
                <AvatarFallback className={cn("text-[0.65rem] font-semibold", avatarColor(message.id))}>
                  {message.initials}
                </AvatarFallback>
              </Avatar>
              <span className={cn("absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card", message.online ? "bg-success" : "bg-muted-foreground/40")} aria-label={message.online ? "En ligne" : "Hors ligne"} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">{message.label}</p>
                <span className="shrink-0 text-[0.68rem] text-muted-foreground">{formatRelative(message.updatedAt)}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{message.preview}</p>
            </div>
            {message.unread > 0 && <Badge className="shrink-0">{message.unread}</Badge>}
            <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label={`Ouvrir la conversation avec ${message.label}`}>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
