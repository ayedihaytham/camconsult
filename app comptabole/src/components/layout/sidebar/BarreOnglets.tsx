import { NavLink, useLocation } from "react-router-dom";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { isRouteActive, type NavItem } from "./navigation";
import { useCompteursMenu } from "./useCompteursMenu";
import { useNavigationGroups } from "./useNavigationGroups";

/** Les quatre entrées de la barre : les plus utiles qui existent pour ce compte, dans cet ordre (le reste est dans « Plus »). */
const ORDRE: { label: string; court: string }[] = [
  { label: "Tableau de bord", court: "Accueil" },
  { label: "Sociétés", court: "Sociétés" },
  { label: "Collectes de pièces", court: "Collectes" },
  { label: "Messagerie", court: "Messages" },
  { label: "Structuration", court: "Dossiers" },
  { label: "Mes tâches", court: "Tâches" },
];

/** Barre d'onglets du téléphone : navigation à portée du pouce. « Plus » ouvre le menu complet. Absente sur grand écran (le menu latéral est là). */
export function BarreOnglets() {
  const groups = useNavigationGroups();
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const { compteurs, unreadMessages } = useCompteursMenu();

  const entrees = groups.flatMap((g) => g.items).filter((i): i is NavItem & { to: string } => Boolean(i.to));
  const onglets = ORDRE.map((o) => ({ ...o, item: entrees.find((i) => i.label === o.label) }))
    .filter((o): o is typeof o & { item: NavItem & { to: string } } => Boolean(o.item))
    .slice(0, 4);

  const decompte = (item: NavItem) => (item.badgeKey === "unread" ? unreadMessages : item.badgeKey === "taches" ? (compteurs.taches ?? 0) : item.badgeKey === "collectes" ? (compteurs.collectes ?? 0) : 0);

  return (
    <nav aria-label="Navigation principale" className="barre-onglets no-print lg:hidden">
      {onglets.map(({ item, court }) => {
        const actif = isRouteActive(pathname, item.to);
        const Icone: LucideIcon = item.icon;
        const n = decompte(item);
        return (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} aria-current={actif ? "page" : undefined} aria-label={n > 0 ? `${court}, ${n}` : court} className={cn("barre-onglets__item", actif && "is-actif")}>
            <span className="relative">
              <Icone className="size-[22px]" aria-hidden="true" />
              {n > 0 && <b className="barre-onglets__badge">{n > 9 ? "9+" : n}</b>}
            </span>
            <span>{court}</span>
          </NavLink>
        );
      })}
      <button type="button" className="barre-onglets__item" onClick={() => setOpenMobile(true)} aria-label="Plus : ouvrir le menu complet">
        <Ellipsis className="size-[22px]" aria-hidden="true" />
        <span>Plus</span>
      </button>
    </nav>
  );
}
