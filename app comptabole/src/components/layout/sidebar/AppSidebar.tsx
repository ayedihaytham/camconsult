import type { ComponentProps } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useConversations, useNotifications } from "@/store/data";
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
