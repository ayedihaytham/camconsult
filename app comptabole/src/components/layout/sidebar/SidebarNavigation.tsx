import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const NAV_ITEM_CLASS = "relative text-sidebar-muted data-[active=true]:text-sidebar-primary data-[active=true]:before:absolute data-[active=true]:before:inset-y-2 data-[active=true]:before:left-0 data-[active=true]:before:w-px data-[active=true]:before:bg-sidebar-primary data-[active=true]:before:content-['']";

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
  const { isMobile, setOpenMobile, state } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const previousPathname = useRef(pathname);
  const isCollapsedDesktop = state === "collapsed" && !isMobile;

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
        <SidebarGroup
          key={group.label ?? `group-${groupIndex}`}
          className={groupIndex === 0 ? "pb-1 pt-1.5" : "py-1.5"}
        >
          <SidebarGroupLabel className="h-6 px-2 text-[0.68rem] font-semibold text-sidebar-foreground/60 group-data-[collapsible=icon]:-mt-6">
            {group.label ?? "Overview"}
          </SidebarGroupLabel>
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
                      {isCollapsedDesktop ? (
                        <DropdownMenu>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                            aria-label={pending ? `${item.label}, notification en attente` : item.label}
                            className={NAV_ITEM_CLASS}
                          >
                            <DropdownMenuTrigger>
                              <Icon />
                              <span>{item.label}</span>
                            </DropdownMenuTrigger>
                          </SidebarMenuButton>
                          <DropdownMenuContent
                            side="right"
                            align="start"
                            sideOffset={8}
                            className="w-52 rounded-xl border-border bg-popover p-1.5 shadow-pop"
                          >
                            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
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
                                <DropdownMenuItem
                                  key={child.to}
                                  asChild
                                  className={cn(
                                    "min-h-8 text-foreground focus:bg-secondary focus:text-foreground",
                                    childActive &&
                                      "before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-accent before:content-[''] font-semibold text-primary",
                                  )}
                                >
                                  <NavLink to={child.to}>
                                    {childPending && <PendingDot />}
                                    <span>{child.label}</span>
                                  </NavLink>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
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
                          aria-label={pending ? `${item.label}, notification en attente` : item.label}
                          className={NAV_ITEM_CLASS}
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
                      )}
                      {pending && <PendingBadge />}
                      {pending && <CollapsedPendingIndicator />}
                      {!isCollapsedDesktop && open && (
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
                      className={NAV_ITEM_CLASS}
                    >
                      <NavLink
                        to={to}
                        end={to === "/"}
                        aria-label={badge ? `${item.label}, ${badge} message${badge > 1 ? "s" : ""} non lu${badge > 1 ? "s" : ""}` : pending ? `${item.label}, notification en attente` : item.label}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {badge ? (
                      <>
                        <SidebarMenuBadge className="bg-sidebar-primary font-bold text-sidebar-primary-foreground">
                          {badge}
                        </SidebarMenuBadge>
                        <CollapsedUnreadBadge count={badge} />
                      </>
                    ) : pending ? (
                      <>
                        <PendingBadge />
                        <CollapsedPendingIndicator />
                      </>
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

function CollapsedUnreadBadge({ count }: { count: number }) {
  return (
    <span
      className="pointer-events-none absolute -right-1 -top-1 hidden h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sidebar-primary px-0.5 text-[8px] font-bold leading-none text-sidebar-primary-foreground group-data-[collapsible=icon]:flex"
      aria-hidden="true"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function CollapsedPendingIndicator() {
  return (
    <span
      className="pointer-events-none absolute -right-0.5 -top-0.5 hidden size-2.5 rounded-full border border-sidebar bg-destructive group-data-[collapsible=icon]:block"
      aria-hidden="true"
    />
  );
}
