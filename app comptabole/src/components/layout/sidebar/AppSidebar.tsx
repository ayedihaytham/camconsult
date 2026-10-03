import { type ComponentProps, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useConversations, useData, useNotifications } from "@/store/data";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarNavigation } from "./SidebarNavigation";
import {
  unreadMessageCount,
  visibleNavigation,
} from "./navigation";

/** Pied du menu : réduit / développe le menu (même action que le bouton de la
 * barre du haut et le raccourci clavier). Masqué sur mobile, où le menu est un
 * tiroir qui se ferme au clic hors du panneau. */
function SidebarCollapseButton() {
  const { state, isMobile, toggleSidebar } = useSidebar();
  if (isMobile) return null;
  const collapsed = state === "collapsed";
  const Icon = collapsed ? ChevronsRight : ChevronsLeft;
  const label = collapsed ? "Développer le menu" : "Réduire le menu";
  return (
    <SidebarFooter className="signature-sidebar__footer shrink-0 gap-0 border-t border-white/10 p-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={label}
            aria-label={label}
            onClick={toggleSidebar}
            className="h-10 gap-3 text-sidebar-muted hover:text-sidebar-accent-foreground"
          >
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const {
    isAdmin,
    can,
    employeId,
    lectureSeule,
    canManageCollaborateurs,
    isResponsableSociete,
  } = usePermissions();
  const { pathname } = useLocation();
  const markNotificationsRead = useData((s) => s.markNotificationsRead);
  const conversations = useConversations(
    isAdmin ? "me" : (employeId ?? "me"),
  );
  const unreadNotifications = useNotifications().filter(
    (notification) => !notification.lu,
  );
  const groups = visibleNavigation({
    isAdmin,
    lectureSeule,
    can,
    canManageCollaborateurs,
    isResponsableSociete,
  });
  const unreadMessages = unreadMessageCount(
    conversations,
    isAdmin,
    employeId,
  );

  // La pastille rouge du menu (et le badge de la cloche) ne se dissipait
  // qu'en cliquant explicitement une notification ou « Tout marquer lu » —
  // jamais en visitant simplement la page concernée, même après y avoir
  // tout lu (ex. une conversation entièrement lue dans Messagerie). On
  // marque ici comme lue toute notification dont le lien correspond à la
  // page actuellement affichée — même correspondance que `hasPendingNotification`
  // (préfixe de chemin), dans l'autre sens.
  useEffect(() => {
    const toMark = unreadNotifications
      .filter(
        (n) => n.lien === pathname || pathname.startsWith(`${n.lien}/`),
      )
      .map((n) => n.id);
    if (toMark.length > 0) markNotificationsRead(toMark);
    // unreadNotifications volontairement absent des deps : ce tableau est
    // recréé à chaque rendu (.filter()), le réintégrer ferait tourner cet
    // effet en boucle sans navigation réelle. Ne réagir qu'aux changements
    // de page est le comportement voulu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, markNotificationsRead]);

  return (
    <Sidebar collapsible="icon" className="signature-sidebar border-r-0" {...props}>
      <SidebarHeader className="signature-sidebar__brand-cap h-16 shrink-0 gap-0 p-0">
        <SidebarMenu className="h-full gap-0 p-2">
          <SidebarMenuItem className="h-full">
            <SidebarMenuButton
              size="lg"
              tooltip="Cabinet Ayadi Mohamed"
              className="h-12 w-full gap-2.5 rounded-md px-2.5 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:!p-0"
              aria-label="Cabinet Ayadi Mohamed"
            >
              {/* Menu ouvert : logo officiel complet ; menu réduit : symbole seul. */}
              <img
                src="/brand/logo-cabinet-white.png"
                alt="Cabinet Ayadi Mohamed — Accounting & Consulting"
                width={1500}
                height={382}
                className="h-7 w-auto max-w-full group-data-[collapsible=icon]:hidden"
              />
              <img
                src="/brand/logo-mark-cabinet-white.png"
                alt="Cabinet Ayadi Mohamed"
                width={256}
                height={256}
                className="hidden size-7 shrink-0 object-contain group-data-[collapsible=icon]:block"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="signature-sidebar__content">
        <SidebarNavigation
          groups={groups}
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
        />
      </SidebarContent>

      <SidebarCollapseButton />

      <SidebarRail />
    </Sidebar>
  );
}
