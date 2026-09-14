import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Boxes,
  Building2,
  Calculator,
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

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
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
  {
    label: "États financiers",
    icon: Calculator,
    hideForSocieteEmploye: true,
    children: [
      { label: "Balance & synthèse", to: "/etats-financiers" },
      { label: "Grille de reclassement", to: "/grille-affectat", adminOnly: true },
    ],
  },
  {
    label: "Bordereaux bancaires",
    to: "/bordereaux",
    icon: Landmark,
    adminOnly: true,
  },
  { label: "Structuration", to: "/structuration", icon: FolderTree },
  {
    label: "Messagerie",
    to: "/messagerie",
    icon: MessageSquare,
    badgeKey: "unread",
    perm: "messagerie",
  },
  { label: "Journal", to: "/journal", icon: ScrollText, adminOnly: true },
  { label: "Paramètres", to: "/parametres", icon: Settings, adminOnly: true },
];

/**
 * Rail d'icônes fixe (jamais dépliée en texte) avec sous-menu flottant au
 * clic pour les rubriques à enfants — direction visuelle "SaaS moderne"
 * (fond bleu marine, coins arrondis) plutôt que l'accordéon texte
 * précédent. Sur mobile, le rail se glisse en overlay (voir mobileOpen).
 */
export function Sidenav() {
  const { mobileOpen, setMobileOpen } = useUi();
  const { isAdmin, can, employeId, lectureSeule } = usePermissions();
  const conversations = useConversations(isAdmin ? "me" : (employeId ?? "me"));
  const unreadMessages = conversations
    .filter((c) => isAdmin || c.type === "groupe" || c.employeId === employeId)
    .reduce((n, c) => n + c.nonLus, 0);
  const location = useLocation();

  const nav = NAV.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForSocieteEmploye && lectureSeule) return false;
    if (item.perm && !can(item.perm)) return false;
    return true;
  }).map((item) =>
    item.children
      ? {
          ...item,
          children: item.children.filter((c) => !c.adminOnly || isAdmin),
        }
      : item,
  );

  const isChildActive = (children?: NavChild[]) =>
    children?.some((c) => location.pathname.startsWith(c.to)) ?? false;

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
          "fixed inset-y-0 left-0 z-50 flex w-20 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 no-print",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Marque — monogramme CAMCONSULT */}
        <div className="flex h-20 shrink-0 items-center justify-center">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-sidebar-accent text-sidebar-accent">
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
        </div>
        <div className="mx-5 h-px shrink-0 bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const badge =
              item.badgeKey === "unread" && unreadMessages > 0
                ? unreadMessages
                : null;

            if (item.children) {
              const active = isChildActive(item.children);
              return (
                <DropdownMenu key={item.label}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="block w-full">
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
                              ? "bg-accent/10 font-semibold text-accent"
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

            return (
              <NavLink key={item.to} to={item.to!} end={item.to === "/"}>
                {({ isActive }) => (
                  <RailIcon icon={Icon} label={item.label} active={isActive} badge={badge} />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="h-4" />
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
              ? "bg-sidebar-accent/15 text-sidebar-accent"
              : "text-sidebar-muted hover:bg-white/5 hover:text-white",
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
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-accent px-1 text-[10px] font-bold text-white">
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
