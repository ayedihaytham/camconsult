import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ChevronRight, LogOut, MonitorOff, MonitorSmartphone, Settings, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelative, toTitleCase } from "@/lib/utils";
import { AppBreadcrumbs } from "./AppBreadcrumbs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/store/auth";
import { useData, useNotifications } from "@/store/data";
import { SocieteActiveSelect } from "./SocieteActiveSelect";
import { visuelNotification } from "./notificationVisuel";
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

  const libelleRole = isAdmin ? "Administrateur" : role;
  const rangee = "group gap-3 rounded-xl px-2.5 py-2 text-sm font-medium focus:bg-muted focus:text-foreground";
  const tuile = "grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-primary";
  const fleche = <ChevronRight className="ml-auto size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />;

  return (
    <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground no-print">
      <div className="flex h-[60px] items-center gap-2 px-3 lg:px-5">
        <SidebarTrigger
          className="h-9 w-9 shrink-0 text-sidebar-foreground hover:bg-white/10 hover:text-white"
          aria-label="Afficher ou réduire le menu"
        />

        <AppBreadcrumbs />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SocieteActiveSelect />
          <span className="mx-2 hidden h-[22px] w-px bg-white/15 sm:block" aria-hidden="true" />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary transition-shadow hover:ring-4 hover:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                aria-label={`Menu du compte de ${nom}`}
              >
                <span className="text-xs font-bold tracking-wide">{initiales}</span>
                <span aria-hidden="true" className="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-sidebar bg-success" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="topbar-account-menu w-[21rem] max-w-[calc(100vw-1rem)] rounded-2xl border-border/70 p-0 shadow-pop">
              <div className="flex items-center gap-3.5 p-4">
                <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-primary">
                  {initiales}
                  <span aria-hidden="true" className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-success" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] font-semibold text-foreground">{nom}</p>
                  {libelleRole && (
                    <p className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
                      <ShieldCheck className="size-3 shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate">{libelleRole}</span>
                    </p>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator className="mx-3.5 my-0" />
              <div className="p-1.5">
                {isAdmin && (
                  <DropdownMenuItem className={rangee} onClick={() => navigate("/parametres")}>
                    <span className={tuile}><Settings className="size-[17px]" /></span>
                    Paramètres
                    {fleche}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={rangee} onClick={() => setAppareilsOpen(true)}>
                  <span className={tuile}><MonitorSmartphone className="size-[17px]" /></span>
                  Mes appareils connectés
                  {fleche}
                </DropdownMenuItem>
                <DropdownMenuItem className={rangee} onClick={() => setAutresOpen(true)}>
                  <span className={tuile}><MonitorOff className="size-[17px]" /></span>
                  Déconnecter mes autres appareils
                  {fleche}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-2 my-1.5" />
                <DropdownMenuItem className="group gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={handleLogout}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive"><LogOut className="size-[17px]" /></span>
                  Se déconnecter
                </DropdownMenuItem>
              </div>
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
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
          onClick={demanderPermissionNotifications}
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-sidebar bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-[24rem] max-w-[calc(100vw-1rem)] rounded-2xl p-0 shadow-pop">
        <div className="flex items-start justify-between gap-3 px-4 pb-2.5 pt-4">
          <div>
            <DropdownMenuLabel className="p-0 text-[0.95rem] font-semibold normal-case tracking-normal text-foreground">Notifications</DropdownMenuLabel>
            <p className="mt-0.5 text-xs text-muted-foreground">{unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}</p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => markRead()}
              className="-mr-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-muted"
            >
              <CheckCheck className="size-3.5 text-accent" aria-hidden="true" />
              Tout marquer lu
            </button>
          )}
        </div>
        {recent.length === 0 && (
          <p className="px-3 pb-6 pt-3 text-center text-sm text-muted-foreground">
            Aucune notification.
          </p>
        )}
        <div className="max-h-[22rem] overflow-y-auto px-1.5 pb-1.5">
          {recent.map((n) => {
            const { icone: Icone, tuile } = visuelNotification(n.type, n.lien);
            return (
              <button
                key={n.id}
                onClick={() => {
                  markRead([n.id]);
                  navigate(n.lien || "/taches");
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted",
                  !n.lu && "bg-accent/10",
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", tuile)} aria-hidden="true">
                  <Icone className="size-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("line-clamp-2 block text-[0.84rem] leading-snug text-foreground", n.lu ? "font-medium" : "font-semibold")}>{n.titre}</span>
                  {n.corps && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.corps}</span>}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatRelative(n.creeLe)}</span>
                </span>
                {!n.lu && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
