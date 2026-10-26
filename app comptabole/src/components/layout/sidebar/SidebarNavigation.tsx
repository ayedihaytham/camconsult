import { useEffect, useId, useRef, useState } from "react";
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
  getActiveExpandableGroupId,
  hasPendingNotification,
  isChildRouteActive,
  isRouteActive,
  toggleExpandableGroup,
  type NavGroup,
} from "./navigation";

/** Page active : pastille blanche, icône dorée et petit point doré à droite (jamais en menu réduit, où seule l'icône reste). */
const NAV_ITEM_CLASS = "relative text-sidebar-foreground/80 hover:bg-white/10 hover:text-white data-[active=true]:bg-white data-[active=true]:font-semibold data-[active=true]:text-sidebar-deep data-[active=true]:hover:bg-white data-[active=true]:hover:text-sidebar-deep data-[active=true]:[&>svg]:text-sidebar-primary data-[active=true]:after:absolute data-[active=true]:after:right-3 data-[active=true]:after:top-1/2 data-[active=true]:after:size-1.5 data-[active=true]:after:-translate-y-1/2 data-[active=true]:after:rounded-full data-[active=true]:after:bg-sidebar-primary data-[active=true]:after:content-[''] group-data-[collapsible=icon]:data-[active=true]:after:hidden";

/** Page parente d'un sous-menu : reste sur le fond marine ; c'est sa sous-page active qui porte la pastille (en menu réduit, c'est elle qui l'a). */
const PARENT_ITEM_CLASS = "relative text-sidebar-foreground/80 hover:bg-white/10 hover:text-white data-[active=true]:bg-transparent data-[active=true]:font-semibold data-[active=true]:text-white data-[active=true]:hover:bg-white/10 data-[active=true]:[&>svg:first-child]:text-sidebar-primary group-data-[collapsible=icon]:data-[active=true]:bg-white group-data-[collapsible=icon]:data-[active=true]:text-sidebar-deep group-data-[collapsible=icon]:data-[active=true]:hover:bg-white";

const SUB_ITEM_CLASS = "relative text-sidebar-muted hover:bg-white/10 hover:text-white data-[active=true]:bg-white data-[active=true]:font-semibold data-[active=true]:text-sidebar-deep data-[active=true]:hover:bg-white data-[active=true]:hover:text-sidebar-deep data-[active=true]:after:absolute data-[active=true]:after:right-2.5 data-[active=true]:after:top-1/2 data-[active=true]:after:size-1.5 data-[active=true]:after:-translate-y-1/2 data-[active=true]:after:rounded-full data-[active=true]:after:bg-sidebar-primary data-[active=true]:after:content-['']";

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
  const [openGroupId, setOpenGroupId] = useState(() =>
    getActiveExpandableGroupId(pathname, groups),
  );
  /** Groupes repliés par l'utilisateur (le titre du groupe est un bouton) ; un groupe qui contient la page affichée se rouvre tout seul. */
  const [groupesFermes, setGroupesFermes] = useState<ReadonlySet<string>>(() => new Set());
  const submenuIdPrefix = useId();
  const previousPathname = useRef(pathname);
  const isCollapsedDesktop = state === "collapsed" && !isMobile;

  useEffect(() => {
    const actif = groups.find((g) => g.items.some((i) => (i.children ? isChildRouteActive(pathname, i.children) : i.to ? isRouteActive(pathname, i.to) : false)));
    const cle = actif ? (actif.label ?? "Overview") : null;
    if (cle) {
      setGroupesFermes((courants) => {
        if (!courants.has(cle)) return courants;
        const suivants = new Set(courants);
        suivants.delete(cle);
        return suivants;
      });
    }
  }, [pathname, groups]);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      setOpenGroupId(getActiveExpandableGroupId(pathname, groups));
      setOpenMobile(false);
      previousPathname.current = pathname;
    }
  }, [pathname, groups, setOpenMobile]);

  return (
    <>
      {groups.map((group, groupIndex) => {
        const cleGroupe = group.label ?? "Overview";
        const replie = groupesFermes.has(cleGroupe) && !isCollapsedDesktop;
        const idContenu = `${submenuIdPrefix}-groupe-${groupIndex}`;
        return (
        <SidebarGroup
          key={group.label ?? `group-${groupIndex}`}
          className={
            groupIndex === 0
              ? "pb-1 pt-1.5"
              : "signature-sidebar__group--boundary py-1.5"
          }
        >
          <SidebarGroupLabel
            asChild
            className="signature-sidebar__group-label group/label h-7 w-full cursor-pointer gap-2.5 rounded-md px-2 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-sidebar-primary hover:bg-transparent hover:text-sidebar-primary"
          >
            <button
              type="button"
              aria-expanded={!replie}
              aria-controls={idContenu}
              onClick={() =>
                setGroupesFermes((courants) => {
                  const suivants = new Set(courants);
                  if (suivants.has(cleGroupe)) suivants.delete(cleGroupe);
                  else suivants.add(cleGroupe);
                  return suivants;
                })
              }
            >
              <span>{cleGroupe}</span>
              <ChevronDown
                className={cn(
                  "order-last size-3.5 shrink-0 text-sidebar-primary/80 opacity-0 transition-[opacity,transform] duration-200 group-hover/label:opacity-100 group-focus-visible/label:opacity-100 motion-reduce:transition-none",
                  replie && "-rotate-90 opacity-100",
                )}
                aria-hidden="true"
              />
            </button>
          </SidebarGroupLabel>
          <div
            id={idContenu}
            aria-hidden={replie}
            {...(replie ? ({ inert: "" } as object) : {})}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
              replie ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
            )}
          >
          <div className="min-h-0 overflow-hidden">
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item, itemIndex) => {
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
                  const open = openGroupId === item.label;
                  const submenuId = `${submenuIdPrefix}-${groupIndex}-${itemIndex}`;

                  return (
                    <SidebarMenuItem key={item.label}>
                      {isCollapsedDesktop ? (
                        <DropdownMenu>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={item.label}
                            aria-label={pending ? `${item.label}, notification en attente` : item.label}
                            className={PARENT_ITEM_CLASS}
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
                            className="w-56 rounded-md border-border bg-popover p-1.5 shadow-pop"
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
                                    "relative before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-accent before:content-[''] font-semibold text-primary",
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
                          aria-controls={submenuId}
                          onClick={() => setOpenGroupId((current) =>
                            toggleExpandableGroup(current, item.label),
                          )}
                          aria-label={pending ? `${item.label}, notification en attente` : item.label}
                          className={PARENT_ITEM_CLASS}
                        >
                          <Icon />
                          <span>{item.label}</span>
                          <ChevronDown
                            className={cn(
                              "ml-auto transition-transform duration-200 ease-out motion-reduce:transition-none group-data-[collapsible=icon]:hidden",
                              pending && "mr-5",
                              open && "rotate-180",
                            )}
                          />
                        </SidebarMenuButton>
                      )}
                      {pending && <PendingBadge />}
                      {pending && <CollapsedPendingIndicator />}
                      {!isCollapsedDesktop && (
                        <div
                          id={submenuId}
                          aria-hidden={!open}
                          className={cn(
                            "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                            open
                              ? "grid-rows-[1fr] opacity-100"
                              : "grid-rows-[0fr] opacity-0",
                          )}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <SidebarMenuSub className="signature-sidebar__nested">
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
                                      tabIndex={open ? 0 : -1}
                                      className={SUB_ITEM_CLASS}
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
                          </div>
                        </div>
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
                        <SidebarMenuBadge className="bg-sidebar-primary font-bold text-sidebar-deep peer-hover/menu-button:text-sidebar-deep peer-data-[active=true]/menu-button:text-sidebar-deep">
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
          </div>
          </div>
        </SidebarGroup>
        );
      })}
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
      className="pointer-events-none absolute -right-1 -top-1 hidden h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sidebar-foreground px-0.5 text-[8px] font-bold leading-none text-sidebar-deep group-data-[collapsible=icon]:flex"
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
