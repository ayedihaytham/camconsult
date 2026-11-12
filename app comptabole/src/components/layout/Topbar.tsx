import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Keyboard, LogOut, MonitorOff, ShieldCheck, ShieldHalf, User } from "lucide-react";
import { useUi } from "@/store/ui";
import { toast } from "sonner";
import { cn, formatRelative, toTitleCase } from "@/lib/utils";
import { DossierTabs } from "./DossierTabs";
import { RechercheBouton } from "./RechercheBouton";
import { RepriseBouton } from "./RepriseBouton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/store/auth";
import { useData, useNotifications } from "@/store/data";
import { SocieteActiveSelect } from "./SocieteActiveSelect";
import { TourHelpButton } from "@/components/tour/TourHelpButton";
import { visuelNotification } from "./notificationVisuel";
import { MesAppareilsDialog } from "@/components/auth/AppareilsConnectes";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const rangee = "gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary focus:bg-[#F5F8FD] focus:text-primary";

  return (
    <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground no-print">
      <div className="flex h-[60px] items-center gap-2 px-3 lg:px-5">
        <SidebarTrigger
          className="h-9 w-9 shrink-0 text-sidebar-foreground hover:bg-white/10 hover:text-white"
          aria-label="Afficher ou réduire le menu"
        />

        {/* Le fil d'Ariane est dans la bande sous la barre ; la barre porte les onglets de dossiers (grand écran) et reste dégagée sur petit écran. */}
        <div className="hidden min-w-0 flex-1 items-end self-end lg:flex">
          <DossierTabs />
        </div>
        <div className="min-w-0 flex-1 lg:hidden" />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="hidden items-center gap-2 pr-1 lg:flex">
            <RechercheBouton />
            <RepriseBouton />
          </div>
          <TourHelpButton />
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
            <DropdownMenuContent align="end" sideOffset={12} className="topbar-account-menu w-[21rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border-primary/10 p-0 shadow-pop">
              <div className="flex items-center gap-3.5 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-primary">{initiales}</span>
                <div className="min-w-0">
                  <p className="truncate font-display text-[1rem] font-extrabold text-primary">{nom}</p>
                  {libelleRole && <p className="truncate text-xs text-muted-foreground">{libelleRole} · Cabinet Ayadi Mohamed</p>}
                </div>
              </div>
              <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-xl bg-[#E8F4EC] px-3 py-2.5 text-[#1D5D41]">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="text-[13px] font-bold leading-4">Session sécurisée<span className="block text-xs font-normal text-[#2F6F52]">Cet appareil, connecté en ce moment</span></div>
              </div>
              <div className="px-2 pb-2">
                {isAdmin && (
                  <DropdownMenuItem className={rangee} onClick={() => navigate("/parametres")}>
                    <User className="size-[17px] text-muted-foreground" aria-hidden="true" />
                    Mon profil
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={rangee} onClick={() => setAppareilsOpen(true)}>
                  <ShieldHalf className="size-[17px] text-muted-foreground" aria-hidden="true" />
                  Sécurité et appareils
                </DropdownMenuItem>
                <DropdownMenuItem className={rangee} onClick={() => setAutresOpen(true)}>
                  <MonitorOff className="size-[17px] text-muted-foreground" aria-hidden="true" />
                  Déconnecter mes autres appareils
                </DropdownMenuItem>
                <DropdownMenuItem className={rangee} onClick={() => useUi.getState().setPaletteOpen(true)}>
                  <Keyboard className="size-[17px] text-muted-foreground" aria-hidden="true" />
                  Raccourcis et recherche
                  <kbd className="ml-auto rounded border border-primary/15 px-1.5 text-[10.5px] font-semibold text-muted-foreground">Ctrl K</kbd>
                </DropdownMenuItem>
              </div>
              <DropdownMenuItem className="gap-3 rounded-none border-t border-primary/10 bg-[#FBF9F3] px-4 py-3.5 text-sm font-bold text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={handleLogout}>
                <LogOut className="size-[17px]" aria-hidden="true" />
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
  const [filtre, setFiltre] = useState<"toutes" | "non_lues">("toutes");
  const recent = (filtre === "non_lues" ? notifications.filter((n) => !n.lu) : notifications).slice(0, 10);

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
      <DropdownMenuContent align="end" sideOffset={12} className="w-[26rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border-primary/10 p-0 shadow-pop">
        <div className="flex items-baseline justify-between gap-3 px-5 pb-3 pt-4">
          <DropdownMenuLabel className="p-0 font-display text-xl font-extrabold normal-case tracking-normal text-primary">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button onClick={() => markRead()} className="text-xs font-bold text-primary underline underline-offset-2 hover:text-primary/80">
              Tout marquer comme lu
            </button>
          )}
        </div>
        <div className="mx-5 mb-3 inline-flex rounded-xl bg-[#F4F7FB] p-1" role="group" aria-label="Filtrer les notifications">
          {([["toutes", "Toutes"], ["non_lues", "Non lues"]] as const).map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={filtre === valeur}
              onClick={() => setFiltre(valeur)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors", filtre === valeur && "bg-card text-primary shadow-sm")}
            >
              {libelle}
              {valeur === "non_lues" && unread > 0 && <span className="rounded-full bg-[#2A6DBF] px-1.5 text-[11px] font-bold text-white">{unread}</span>}
            </button>
          ))}
        </div>
        {recent.length === 0 && (
          <p className="px-3 pb-6 pt-3 text-center text-sm text-muted-foreground">
            {filtre === "non_lues" ? "Aucune notification non lue." : "Aucune notification."}
          </p>
        )}
        <div className="max-h-[24rem] overflow-y-auto px-2 pb-2">
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
                  "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#F5F8FD]",
                  !n.lu && "bg-[#F0F5FC]",
                )}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tuile)} aria-hidden="true">
                  <Icone className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[0.9rem] leading-snug text-primary", n.lu ? "font-semibold" : "font-bold")}>{n.titre}</span>
                  {n.corps && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{n.corps}</span>}
                  <span className="mt-1 block text-[11.5px] text-muted-foreground">{formatRelative(n.creeLe)}</span>
                </span>
                {!n.lu && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#2A6DBF]" aria-label="Non lue" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-primary/10 bg-[#FBF9F3] px-5 py-3 text-xs font-bold text-primary">
          <button type="button" onClick={() => navigate("/taches")} className="underline underline-offset-2">Voir mes tâches</button>
          <button type="button" onClick={() => navigate("/parametres")} className="underline underline-offset-2">Préférences</button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
