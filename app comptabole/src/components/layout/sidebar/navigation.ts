import {
  Boxes,
  Building2,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  FolderTree,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type {
  AppNotification,
  Conversation,
  PermissionKey,
} from "@/types";

export interface NavChild {
  label: string;
  to: string;
  adminOnly?: boolean;
  /** Aussi visible pour le responsable des collaborateurs, pas seulement
   * l'admin (voir usePermissions().canManageCollaborateurs). */
  equipeManagerOk?: boolean;
}

export interface NavItem {
  label: string;
  to?: string;
  icon: LucideIcon;
  children?: NavChild[];
  badgeKey?: "unread";
  adminOnly?: boolean;
  perm?: PermissionKey;
  hideForSocieteEmploye?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
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
          {
            label: "Collaborateurs",
            to: "/employes",
            adminOnly: true,
            equipeManagerOk: true,
          },
        ],
      },
      {
        label: "Tâches",
        to: "/taches",
        icon: ListChecks,
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
            label: "Paramétrage",
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
      {
        label: "État client",
        to: "/honoraires",
        icon: Receipt,
        adminOnly: true,
      },
      {
        label: "Suivi client devise",
        to: "/suivi-devise",
        icon: CircleDollarSign,
        hideForSocieteEmploye: true,
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

export function visibleNavigation({
  isAdmin,
  lectureSeule,
  can,
  canManageCollaborateurs = false,
}: {
  isAdmin: boolean;
  lectureSeule: boolean;
  can: (permission: PermissionKey) => boolean;
  canManageCollaborateurs?: boolean;
}): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
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
                (child) =>
                  !child.adminOnly ||
                  isAdmin ||
                  (child.equipeManagerOk && canManageCollaborateurs),
              ),
            }
          : item,
      ),
  })).filter((group) => group.items.length > 0);
}

/** React Router NavLink matching for the leaf destinations in this menu. */
export function isRouteActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Preserve the existing parent-group matching behavior. */
export function isChildRouteActive(
  pathname: string,
  children?: NavChild[],
): boolean {
  return children?.some((child) => pathname.startsWith(child.to)) ?? false;
}

export function hasPendingNotification(
  notifications: AppNotification[],
  to: string,
): boolean {
  return to === "/"
    ? notifications.some((notification) => notification.lien === "/")
    : notifications.some(
        (notification) =>
          notification.lien === to ||
          notification.lien.startsWith(`${to}/`),
      );
}

export function unreadMessageCount(
  conversations: Conversation[],
  isAdmin: boolean,
  employeId: string | null,
): number {
  return conversations
    .filter(
      (conversation) =>
        isAdmin ||
        conversation.type === "groupe" ||
        conversation.employeId === employeId,
    )
    .reduce((total, conversation) => total + conversation.nonLus, 0);
}
