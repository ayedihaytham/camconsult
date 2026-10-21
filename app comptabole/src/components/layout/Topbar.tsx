import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, LogOut, MonitorOff, MonitorSmartphone, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelative, toTitleCase } from "@/lib/utils";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useHistoriqueNavigation } from "@/hooks/useHistoriqueNavigation";
import { useAuth } from "@/store/auth";
import { useData, useNotifications } from "@/store/data";
import { SocieteActiveSelect } from "./SocieteActiveSelect";
import { MesAppareilsDialog } from "@/components/auth/AppareilsConnectes";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { session, logout, deconnecterAutresAppareils } = useAuth();
  const navigate = useNavigate();
  const [autresOpen, setAutresOpen] = useState(false);
  const [appareilsOpen, setAppareilsOpen] = useState(false);

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
    <header className="sticky top-0 z-30 border-b border-border bg-card no-print after:pointer-events-none after:absolute after:-bottom-px after:left-0 after:h-[2px] after:w-[72px] after:bg-accent">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger
          className="h-10 w-10 shrink-0 lg:h-9 lg:w-9"
          aria-label="Afficher ou réduire le menu"
        />

        <NavigationHistorique />

        <Separator orientation="vertical" className="h-4" />
        <AppBreadcrumbs />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <SocieteActiveSelect />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:pr-2.5"
                aria-label={`Menu du compte de ${nom}`}
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-accent lg:h-9 lg:w-9">
                  <span className="text-xs font-semibold tracking-wide">
                    {initiales}
                  </span>
                  <span aria-hidden="true" className="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-card bg-success" />
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium text-foreground">
                    {nom}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {isAdmin ? "Administrateur" : role}
                  </span>
                </span>
                <ChevronDown
                  className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block"
                  aria-hidden="true"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="topbar-account-menu w-64 rounded-xl border-border/70 p-1.5 shadow-pop">
              <div className="px-3 pb-2 pt-1.5">
                <p className="truncate text-sm font-semibold text-foreground">{nom}</p>
                <p className="truncate text-xs text-muted-foreground">{isAdmin ? "Administrateur" : role}</p>
              </div>
              <DropdownMenuSeparator className="mx-2 my-1" />
              {isAdmin && (
                <>
                  <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-[0.95rem]" onClick={() => navigate("/parametres")}>
                    <Settings className="h-[18px] w-[18px] text-muted-foreground" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-3 my-1" />
                </>
              )}
              <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-[0.95rem]" onClick={() => setAppareilsOpen(true)}>
                <MonitorSmartphone className="h-[18px] w-[18px] text-muted-foreground" />
                Mes appareils connectés
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-[0.95rem]" onClick={() => setAutresOpen(true)}>
                <MonitorOff className="h-[18px] w-[18px] text-muted-foreground" />
                Déconnecter mes autres appareils
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-[0.95rem]" onClick={handleLogout}>
                <LogOut className="h-[18px] w-[18px] text-muted-foreground" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <MesAppareilsDialog open={appareilsOpen} onOpenChange={setAppareilsOpen} />
      <ConfirmDialog
        open={autresOpen}
        onOpenChange={setAutresOpen}
        title="Déconnecter mes autres appareils ?"
        description="Toutes vos autres sessions (autres ordinateurs, téléphones, navigateurs) seront fermées : il faudra s'y reconnecter. Cette session reste ouverte."
        confirmLabel="Déconnecter les autres"
        destructive={false}
        onConfirm={async () => {
          const r = await deconnecterAutresAppareils();
          if (r.ok) toast.success("Vos autres appareils sont déconnectés");
          else toast.error(r.error ?? "Action impossible");
        }}
      />
    </header>
  );
}

/** Page précédente / suivante (même effet que les flèches du navigateur, Alt + ← / Alt + →). Grisés quand il n'y a pas de page de ce côté. */
function NavigationHistorique() {
  const { peutReculer, peutAvancer, reculer, avancer } = useHistoriqueNavigation();
  const bouton =
    "flex h-10 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35 lg:h-9 lg:w-8";
  return (
    <div className="flex shrink-0 items-center" role="group" aria-label="Navigation dans l'historique">
      <button type="button" className={bouton} onClick={reculer} disabled={!peutReculer} aria-label="Page précédente" title="Page précédente (Alt + ←)">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={bouton} onClick={avancer} disabled={!peutAvancer} aria-label="Page suivante" title="Page suivante (Alt + →)">
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const refresh = useData((s) => s.refreshNotifications);
  const markRead = useData((s) => s.markNotificationsRead);

  // Les notifications du navigateur se demandent à un clic de l'utilisateur (à l'ouverture de la cloche), jamais au chargement de la
  // page : les navigateurs ignorent la demande sans geste et la signalent dans la console.
  function demanderPermissionNotifications() {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        void Notification.requestPermission().catch(() => {});
      } catch {
        /* navigateur sans cette API */
      }
    }
  }

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
          onClick={demanderPermissionNotifications}
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
      <DropdownMenuContent align="end" sideOffset={8} className="w-[22rem] rounded-xl p-1.5 shadow-pop">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              onClick={() => markRead()}
              className="text-xs font-medium text-primary underline-offset-2 transition-colors hover:underline"
            >
              Tout marquer lu
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="mx-1" />
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
                "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-muted",
                !n.lu && "bg-accent/10",
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
