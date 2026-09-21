import { useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, MessageCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelative, toTitleCase } from "@/lib/utils";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/store/auth";
import { useConversations, useData, useNotifications } from "@/store/data";
import { unreadMessageCount } from "./sidebar/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const nom = toTitleCase(session?.nom ?? "Utilisateur");
  const role = session?.fonction ?? "";
  const isAdmin = session?.role === "admin";
  const initiales =
    nom
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "?";

  async function handleLogout() {
    await logout();
    toast.success("Déconnexion réussie");
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card no-print">
      <div className="flex h-[64px] items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger
          className="h-10 w-10 shrink-0 lg:h-9 lg:w-9"
          aria-label="Afficher ou réduire le menu"
        />

        <Separator orientation="vertical" className="h-4" />
        <AppBreadcrumbs />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <NotificationBell />
          <MessengerShortcut />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:pr-2.5"
                aria-label={`Menu du compte de ${nom}`}
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-accent lg:h-9 lg:w-9">
                  <span className="text-xs font-bold tracking-wide">
                    {initiales}
                  </span>
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium text-foreground">
                    {nom}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {isAdmin ? "Administrateur" : role}
                  </span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg">
              <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/parametres")}>
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function MessengerShortcut() {
  const { isAdmin, can, employeId } = usePermissions();
  const hasAccess = isAdmin || can("messagerie");
  const conversations = useConversations(
    isAdmin ? "me" : (employeId ?? "me"),
  );
  const refreshMessages = useData((state) => state.refreshMessages);
  const unreadMessages = unreadMessageCount(
    conversations,
    isAdmin,
    employeId,
  );

  useEffect(() => {
    if (!hasAccess) return;
    const id = setInterval(refreshMessages, 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshMessages();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasAccess, refreshMessages]);

  if (!hasAccess) return null;

  return (
    <NavLink
      to="/messagerie"
      aria-label="Messagerie"
      className={({ isActive }) =>
        cn(
          "relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-9 lg:w-9",
          isActive && "bg-secondary text-foreground",
        )
      }
    >
      <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
      {unreadMessages > 0 && (
        <Badge
          variant="destructive"
          className="absolute -right-0.5 -top-0.5 h-4 min-w-4 justify-center border-0 px-1 py-0 text-[10px] font-bold"
          aria-label={`${unreadMessages} message${unreadMessages > 1 ? "s" : ""} non lu${unreadMessages > 1 ? "s" : ""}`}
        >
          {unreadMessages > 9 ? "9+" : unreadMessages}
        </Badge>
      )}
    </NavLink>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const refresh = useData((s) => s.refreshNotifications);
  const markRead = useData((s) => s.markNotificationsRead);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Poll en continu (même onglet en arrière-plan, où le navigateur ralentit
    // à ~1×/min) + rafraîchissement immédiat au retour sur l'onglet.
    const id = setInterval(refresh, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const unread = notifications.filter((n) => !n.lu).length;
  const recent = notifications.slice(0, 10);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-9 lg:w-9"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-lg">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              onClick={() => markRead()}
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              Tout marquer lu
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {recent.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune notification.
          </p>
        )}
        <div className="max-h-80 overflow-y-auto">
          {recent.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                markRead([n.id]);
                navigate(n.lien || "/taches");
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-secondary",
                !n.lu && "bg-accent/5",
              )}
            >
              <span className="flex w-full items-start gap-2">
                {!n.lu && (
                  <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {n.titre}
                </span>
              </span>
              {n.corps && (
                <span className="pl-3.5 text-xs text-muted-foreground">
                  {n.corps}
                </span>
              )}
              <span className="pl-3.5 text-[11px] text-muted-foreground">
                {formatRelative(n.creeLe)}
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
