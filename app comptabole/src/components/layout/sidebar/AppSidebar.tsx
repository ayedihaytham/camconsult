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
  const { isAdmin, can, employeId, lectureSeule } = usePermissions();
  const { pathname } = useLocation();
  const markNotificationsRead = useData((s) => s.markNotificationsRead);
  const conversations = useConversations(
    isAdmin ? "me" : (employeId ?? "me"),
  );
  const unreadNotifications = useNotifications().filter(
    (notification) => !notification.lu,
  );
  const groups = visibleNavigation({ isAdmin, lectureSeule, can });
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
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="CAMCONSULT"
              className="hover:bg-transparent active:bg-transparent"
              aria-label="CAMCONSULT"
            >
              <img
                src="/brand/logo-mark-dark.png"
                alt=""
                className="size-8 shrink-0 object-contain"
              />
              <span className="font-bold tracking-[0.16em] text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                CAMCONSULT
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
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
