import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Boxes,
  Building2,
  Calculator,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FolderTree,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useConversations } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavChild {
  label: string;
  to: string;
  adminOnly?: boolean;
}
interface NavItem {
  label: string;
  to?: string;
  icon: typeof LayoutDashboard;
  children?: NavChild[];
  badgeKey?: "unread";
  adminOnly?: boolean;
  perm?: PermissionKey;
  /** masqué pour un employé de société cliente */
  hideForSocieteEmploye?: boolean;
}
interface NavGroup {
  /** pas d'en-tête pour le groupe « Vue d'ensemble » (un seul item) */
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }],
  },
  {
    label: "Clients & travail",
    items: [
      {
        label: "Sociétés",
        icon: Building2,
        hideForSocieteEmploye: true,
        children: [
          { label: "Liste des sociétés", to: "/societes" },
          { label: "Collaborateurs", to: "/employes", adminOnly: true },
        ],
      },
      {
        label: "Tâches",
        to: "/taches",
        icon: ListChecks,
        hideForSocieteEmploye: true,
      },
      { label: "Collecte de pièces", to: "/collectes", icon: ClipboardList },
      {
        label: "Gestion de stock",
        to: "/stock",
        icon: Boxes,
        hideForSocieteEmploye: true,
      },
    ],
  },
  {
    label: "Comptabilité",
    items: [
      {
        label: "États financiers",
        icon: Calculator,
        hideForSocieteEmploye: true,
        children: [
          { label: "Balance & synthèse", to: "/etats-financiers" },
          {
            label: "Grille de reclassement",
            to: "/grille-affectat",
            adminOnly: true,
          },
        ],
      },
      {
        label: "Bordereaux bancaires",
        to: "/bordereaux",
        icon: Landmark,
        adminOnly: true,
      },
    ],
  },
  {
    label: "Organisation",
    items: [
      { label: "Structuration", to: "/structuration", icon: FolderTree },
      {
        label: "Messagerie",
        to: "/messagerie",
        icon: MessageSquare,
        badgeKey: "unread",
        perm: "messagerie",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Journal", to: "/journal", icon: ScrollText, adminOnly: true },
      {
        label: "Paramètres",
        to: "/parametres",
        icon: Settings,
        adminOnly: true,
      },
    ],
  },
];

/**
 * Rail de navigation à deux modes : déplié (icône + libellé, groupes
 * en accordéon — lisible et prévisible pour un usage quotidien) et replié
 * (icônes seules avec info-bulle + sous-menu flottant, pour gagner de la
 * place). L'état replié est un choix desktop persisté ; sur mobile, le
 * tiroir s'ouvre toujours en mode déplié quel que soit ce réglage.
 */
export function Sidenav() {
  const { mobileOpen, setMobileOpen, collapsed, toggleCollapsed } = useUi();
  const { isAdmin, can, employeId, lectureSeule } = usePermissions();
  const conversations = useConversations(isAdmin ? "me" : (employeId ?? "me"));
  const unreadMessages = conversations
    .filter((c) => isAdmin || c.type === "groupe" || c.employeId === employeId)
    .reduce((n, c) => n + c.nonLus, 0);
  const location = useLocation();

  // Mobile est toujours affiché tiroir ouvert = déplié, quel que soit le
  // réglage desktop (mobileOpen n'est jamais vrai sur desktop, le bouton
  // qui le déclenche est masqué à partir de lg:).
  const showLabels = mobileOpen || !collapsed;

  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items
          .filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.hideForSocieteEmploye && lectureSeule) return false;
            if (item.perm && !can(item.perm)) return false;
            return true;
          })
          .map((item) =>
            item.children
              ? {
                  ...item,
                  children: item.children.filter(
                    (c) => !c.adminOnly || isAdmin,
                  ),
                }
              : item,
          ),
      })).filter((group) => group.items.length > 0),
    [isAdmin, lectureSeule, can],
  );

  const isChildActive = (children?: NavChild[]) =>
    children?.some((c) => location.pathname.startsWith(c.to)) ?? false;

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const group of groups) {
        for (const item of group.items) {
          if (item.children && isChildActive(item.children) && !next.has(item.label)) {
            next.add(item.label);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      {/* Overlay mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-primary/30 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-hidden bg-gradient-to-b from-sidebar to-sidebar-deep text-sidebar-foreground transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 no-print",
          collapsed ? "lg:w-20" : "lg:w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Halo décoratif — évite l'aplat plat, écho aux motifs du site vitrine */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-70"
          style={{
            background:
              "radial-gradient(120% 100% at 20% 0%, hsl(var(--sidebar-accent) / 0.12), transparent 60%)",
          }}
          aria-hidden="true"
        />

        {/* Marque */}
        <div
          className={cn(
            "relative flex h-20 shrink-0 items-center gap-3",
            showLabels ? "px-5" : "justify-center",
          )}
        >
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-sidebar-accent text-sidebar-accent">
            <span className="font-serif text-lg font-bold">C</span>
            <div
              className="absolute inset-0 rounded-full opacity-30"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--sidebar-accent)) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />
          </div>
          {showLabels && (
            <span className="min-w-0 truncate text-sm font-bold tracking-[0.16em] text-sidebar-foreground">
              CAMCONSULT
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {groups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`}>
              {showLabels && group.label && (
                <div className="mb-2 mt-1 flex items-center gap-2 px-2.5">
                  <p className="shrink-0 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-sidebar-muted/60">
                    {group.label}
                  </p>
                  <span className="h-px flex-1 bg-gradient-to-r from-sidebar-border/70 to-transparent" />
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const badge =
                    item.badgeKey === "unread" && unreadMessages > 0
                      ? unreadMessages
                      : null;

                  if (item.children) {
                    const active = isChildActive(item.children);

                    if (!showLabels) {
                      return (
                        <DropdownMenu key={item.label}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="block w-full"
                              aria-label={item.label}
                            >
                              <RailIcon icon={Icon} label={item.label} active={active} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side="right"
                            align="start"
                            sideOffset={14}
                            className="w-56 rounded-2xl border-border/60 p-2 shadow-pop"
                          >
                            <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[0.72rem] font-bold uppercase tracking-wide text-foreground">
                              {item.label}
                            </DropdownMenuLabel>
                            {item.children.map((child) => (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                className={({ isActive }) =>
                                  cn(
                                    "block rounded-xl px-3 py-2 text-sm transition-colors",
                                    isActive
                                      ? "bg-primary/8 font-semibold text-primary"
                                      : "text-foreground/80 hover:bg-secondary hover:text-foreground",
                                  )
                                }
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    }

                    const open = openGroups.has(item.label);
                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroups((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.label)) next.delete(item.label);
                              else next.add(item.label);
                              return next;
                            })
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
                            active
                              ? "text-sidebar-accent"
                              : "text-sidebar-muted hover:bg-sidebar-accent/10 hover:text-white",
                          )}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-left">
                            {item.label}
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                              open && "rotate-180",
                            )}
                          />
                        </button>
                        {open && (
                          <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3.5">
                            {item.children.map((child) => (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                className={({ isActive }) =>
                                  cn(
                                    "block truncate rounded-lg px-2.5 py-1.5 text-[0.83rem] transition-colors",
                                    isActive
                                      ? "font-semibold text-sidebar-accent"
                                      : "text-sidebar-muted hover:bg-sidebar-accent/10 hover:text-white",
                                  )
                                }
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (!showLabels) {
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to!}
                        end={item.to === "/"}
                        aria-label={item.label}
                      >
                        {({ isActive }) => (
                          <RailIcon icon={Icon} label={item.label} active={isActive} badge={badge} />
                        )}
                      </NavLink>
                    );
                  }

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to!}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-gradient-to-r from-sidebar-accent/20 via-sidebar-accent/8 to-transparent text-sidebar-accent"
                            : "text-sidebar-muted hover:bg-sidebar-accent/10 hover:text-white",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span
                              className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-accent"
                              aria-hidden="true"
                            />
                          )}
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {badge ? (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-sidebar-accent px-1 text-[10px] font-bold text-sidebar">
                              {badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Repli / dépli (desktop uniquement) */}
        <div className="hidden shrink-0 border-t border-sidebar-border p-3 lg:block">
          {showLabels ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent/10 hover:text-white"
            >
              <ChevronsLeft className="h-[18px] w-[18px] shrink-0" />
              Réduire
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-muted transition-colors hover:bg-sidebar-accent/10 hover:text-white"
                  aria-label="Déplier le menu"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Déplier</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </>
  );
}

function RailIcon({
  icon: Icon,
  label,
  active,
  badge,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  badge?: number | null;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200",
            active
              ? "bg-gradient-to-r from-sidebar-accent/20 via-sidebar-accent/8 to-transparent text-sidebar-accent"
              : "text-sidebar-muted hover:bg-sidebar-accent/10 hover:text-white",
          )}
        >
          {active && (
            <span
              className="absolute -left-3.5 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-accent"
              aria-hidden="true"
            />
          )}
          <Icon className="h-5 w-5" />
          {badge ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-accent px-1 text-[10px] font-bold text-sidebar">
              {badge}
            </span>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
