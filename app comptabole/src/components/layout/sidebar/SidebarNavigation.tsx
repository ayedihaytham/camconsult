import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  hasPendingNotification,
  isChildRouteActive,
  isRouteActive,
  type NavGroup,
} from "./navigation";

interface SidebarNavigationProps {
  groups: NavGroup[];
  unreadMessages: number;
  unreadNotifications: AppNotification[];
}

export function SidebarNavigation({
  groups,
  unreadMessages,
  unreadNotifications,
}: SidebarNavigationProps) {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const previousPathname = useRef(pathname);

  useEffect(() => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      let changed = false;

      for (const group of groups) {
        for (const item of group.items) {
          if (
            item.children &&
            isChildRouteActive(pathname, item.children) &&
            !next.has(item.label)
          ) {
            next.add(item.label);
            changed = true;
          }
        }
      }

      return changed ? next : previous;
    });
  }, [groups, pathname]);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      setOpenMobile(false);
    }
    previousPathname.current = pathname;
  }, [pathname, setOpenMobile]);

  return (
    <>
      {groups.map((group, groupIndex) => (
        <SidebarGroup key={group.label ?? `group-${groupIndex}`}>
          <SidebarGroupLabel>{group.label ?? "Overview"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge =
                  item.badgeKey === "unread" && unreadMessages > 0
                    ? unreadMessages
                    : null;

                if (item.children) {
                  const active = isChildRouteActive(pathname, item.children);
                  const pending = item.children.some((child) =>
                    hasPendingNotification(unreadNotifications, child.to),
                  );
                  const open = openGroups.has(item.label);

                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        aria-expanded={open}
                        onClick={() =>
                          setOpenGroups((previous) => {
                            const next = new Set(previous);
                            if (next.has(item.label)) next.delete(item.label);
                            else next.add(item.label);
                            return next;
                          })
                        }
                        className="text-sidebar-muted data-[active=true]:text-sidebar-primary"
                      >
                        <Icon />
                        <span>{item.label}</span>
                        <ChevronDown
                          className={cn(
                            "ml-auto transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                            pending && "mr-5",
                            open && "rotate-180",
                          )}
                        />
                      </SidebarMenuButton>
                      {pending && <PendingBadge />}
                      {open && (
                        <SidebarMenuSub>
                          {item.children.map((child) => {
                            const childActive = isRouteActive(
                              pathname,
                              child.to,
                            );
                            const childPending = hasPendingNotification(
                              unreadNotifications,
                              child.to,
                            );

                            return (
                              <SidebarMenuSubItem key={child.to}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={childActive}
                                  className="text-sidebar-muted data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary"
                                >
                                  <NavLink to={child.to}>
                                    {childPending && <PendingDot />}
                                    <span>{child.label}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                const to = item.to!;
                const active = isRouteActive(pathname, to);
                const pending = badge
                  ? false
                  : hasPendingNotification(unreadNotifications, to);

                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="text-sidebar-muted data-[active=true]:text-sidebar-primary"
                    >
                      <NavLink to={to} end={to === "/"}>
                        <Icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {badge ? (
                      <SidebarMenuBadge className="bg-sidebar-primary font-bold text-sidebar-primary-foreground">
                        {badge}
                      </SidebarMenuBadge>
                    ) : pending ? (
                      <PendingBadge />
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function PendingBadge() {
  return (
    <SidebarMenuBadge aria-label="Notification en attente">
      <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
    </SidebarMenuBadge>
  );
}

function PendingDot() {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full bg-destructive"
      aria-hidden="true"
    />
  );
}
