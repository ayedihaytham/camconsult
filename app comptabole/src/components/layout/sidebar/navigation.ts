import {
  ArrowLeftRight,
  BarChart3,
  BookText,
  Boxes,
  Building2,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  Coins,
  FileText,
  FolderTree,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Percent,
  ScrollText,
  SlidersHorizontal,
  Truck,
  Users,
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
  badgeKey?: "unread" | "taches" | "collectes";
  adminOnly?: boolean;
  /** Visible aussi pour le responsable de société (pas son délégué), en plus
   * de l'admin — la page reste en lecture seule pour lui. */
  responsableSocieteOk?: boolean;
  /** Visible aussi pour le responsable des collaborateurs (voir usePermissions().canManageCollaborateurs). */
  equipeManagerOk?: boolean;
  perm?: PermissionKey;
  hideForSocieteEmploye?: boolean;
  /** Masqué pour un délégué de société seulement : l'équipe du cabinet et le responsable de société le voient. */
  hideForDelegue?: boolean;
  /** Seulement pour le compte de société cliente (responsable ou délégué). */
  societeOnly?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Aujourd'hui",
    items: [
      { label: "Tableau de bord", to: "/", icon: LayoutDashboard },
      { label: "Mes tâches", to: "/taches", icon: ListChecks, badgeKey: "taches" },
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
    label: "Clients",
    items: [
      { label: "Sociétés", to: "/societes", icon: Building2, hideForSocieteEmploye: true },
      { label: "Collectes de pièces", to: "/collectes", icon: ClipboardList, badgeKey: "collectes" },
      { label: "Structuration", to: "/structuration", icon: FolderTree },
      {
        label: "Honoraires",
        to: "/honoraires",
        icon: CircleDollarSign,
        adminOnly: true,
        responsableSocieteOk: true,
      },
      {
        label: "Facturation",
        to: "/facturation",
        icon: FileText,
        adminOnly: true,
      },
    ],
  },
  {
    label: "Comptabilité",
    items: [
      { label: "Apurement TVA", to: "/apurement", icon: Percent, hideForSocieteEmploye: true },
      { label: "Fournisseurs", to: "/fournisseurs", icon: Truck, hideForDelegue: true },
      { label: "Stock", to: "/stock", icon: Boxes, hideForSocieteEmploye: true },
      { label: "Journal", to: "/journal", icon: ScrollText, adminOnly: true },
      { label: "États financiers", to: "/etats-financiers", icon: BarChart3, hideForSocieteEmploye: true },
      { label: "Paramétrage AFFECTAT", to: "/grille-affectat", icon: Calculator, adminOnly: true },
    ],
  },
  {
    label: "Banque & devises",
    items: [
      { label: "Suivi bancaire", to: "/banque", icon: Landmark, hideForDelegue: true },
      { label: "Souche de chèques", to: "/souche-cheques", icon: BookText, adminOnly: true },
      { label: "Ma souche", to: "/ma-souche", icon: BookText, societeOnly: true },
      { label: "Bordereaux", to: "/bordereaux", icon: ListChecks, adminOnly: true },
      { label: "Cours de change", to: "/cours-change", icon: ArrowLeftRight, hideForSocieteEmploye: true },
      { label: "Suivi client devise", to: "/suivi-devise", icon: Coins, hideForSocieteEmploye: true },
      { label: "État SWIFT", to: "/etat-swift", icon: CircleDollarSign },
    ],
  },
  {
    label: "Cabinet",
    items: [
      { label: "Équipe", to: "/employes", icon: Users, adminOnly: true, equipeManagerOk: true },
      { label: "Conversions", to: "/conversions", icon: ArrowLeftRight, hideForSocieteEmploye: true },
      { label: "Simulation de paie", to: "/simulation-paie", icon: Calculator, hideForSocieteEmploye: true },
      { label: "Paramètres", to: "/parametres", icon: SlidersHorizontal, adminOnly: true },
    ],
  },
];

/** Espace du compte de société cliente : son Dashboard, la Collecte de pièces, la Structuration et la Messagerie, rien d'autre. */
export function cheminAutoriseClient(pathname: string): boolean {
  return (
    pathname === "/" ||
    ["/collectes", "/structuration", "/messagerie", "/etat-swift", "/ma-souche"].some((base) => pathname === base || pathname.startsWith(`${base}/`))
  );
}

export function visibleNavigation({
  isAdmin,
  lectureSeule,
  can,
  canManageCollaborateurs = false,
  isResponsableSociete = false,
  espaceCollecteSeul = false,
}: {
  isAdmin: boolean;
  lectureSeule: boolean;
  can: (permission: PermissionKey) => boolean;
  canManageCollaborateurs?: boolean;
  isResponsableSociete?: boolean;
  /** Compte de société cliente : Dashboard, Collecte de pièces, Structuration et Messagerie. */
  espaceCollecteSeul?: boolean;
}): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        if (espaceCollecteSeul) return Boolean(item.to) && cheminAutoriseClient(item.to!) && !item.adminOnly && (!item.perm || can(item.perm));
        if (
          item.adminOnly &&
          !isAdmin &&
          !(item.responsableSocieteOk && isResponsableSociete) &&
          !(item.equipeManagerOk && canManageCollaborateurs)
        )
          return false;
        if (item.societeOnly && !lectureSeule) return false;
        if (item.hideForSocieteEmploye && lectureSeule) return false;
        if (item.hideForDelegue && lectureSeule && !isResponsableSociete) return false;
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

/** Returns the single expandable navigation item that owns the current route. */
export function getActiveExpandableGroupId(
  pathname: string,
  groups: NavGroup[],
): string | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.children && isChildRouteActive(pathname, item.children)) {
        return item.label;
      }
    }
  }

  return null;
}

/** Toggle one expanded navigation item while enforcing accordion behavior. */
export function toggleExpandableGroup(
  currentGroupId: string | null,
  groupId: string,
): string | null {
  return currentGroupId === groupId ? null : groupId;
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
