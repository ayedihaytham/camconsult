import { type ComponentProps, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useConversations, useData, useNotifications } from "@/store/data";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarNavigation } from "./SidebarNavigation";
import {
  unreadMessageCount,
  visibleNavigation,
} from "./navigation";

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { isAdmin, can, employeId, lectureSeule, canManageCollaborateurs } =
    usePermissions();
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
              tooltip="CAMCONSULT"
              className="h-12 w-full gap-2.5 rounded-md px-2.5 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:!p-0"
              aria-label="CAMCONSULT"
            >
              <svg
                viewBox="0 0 40 40"
                aria-hidden="true"
                className="size-8 shrink-0 group-data-[collapsible=icon]:!size-8"
              >
                <rect x="2" y="2" width="16" height="16" rx="3" fill="#fff8ee" />
                <rect x="22" y="2" width="16" height="16" rx="3" fill="#fff8ee" />
                <rect x="2" y="22" width="16" height="16" rx="3" fill="#fff8ee" />
                <rect x="22" y="22" width="16" height="16" rx="3" fill="#fff8ee" />
                <path
                  d="m7 7 6 6m0-6-6 6M27 10h7m-3.5-3.5v7M7 30h7m-3.5-3.5h.01m0 7h.01M27 30h7"
                  fill="none"
                  stroke="#0b2545"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[0.72rem] font-bold leading-none tracking-[0.16em] text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                CAMCONSULT
              </span>
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

      <SidebarRail />
    </Sidebar>
  );
}
