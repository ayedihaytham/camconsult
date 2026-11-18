import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { isRouteActive, type NavGroup } from "./navigation";

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Zone des entrées du menu : le repère doré (fond et barre) est UN seul élément qui glisse jusqu'à l'entrée active, au lieu d'un fond
 * qui saute d'une entrée à l'autre. Il se recale quand un groupe se replie, quand le menu se réduit ou quand la fenêtre change de taille.
 * `cle` change à chaque événement qui déplace les entrées.
 */
export function ZoneNavigation({ cle, children }: { cle: string; children: ReactNode }) {
  const zone = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [anime, setAnime] = useState(false);

  const mesurer = useCallback(() => {
    const racine = zone.current;
    if (!racine) return;
    // La sous-page l'emporte sur son parent (les deux portent data-active) : on prend la dernière entrée visible.
    const actives = [...racine.querySelectorAll<HTMLElement>('[data-active="true"]')].filter((e) => e.offsetParent !== null);
    const cible = actives[actives.length - 1];
    if (!cible) {
      setPosition(null);
      return;
    }
    const z = racine.getBoundingClientRect();
    const c = cible.getBoundingClientRect();
    setPosition((avant) => {
      const suivante = { top: Math.round(c.top - z.top), left: Math.round(c.left - z.left), width: Math.round(c.width), height: Math.round(c.height) };
      return avant && avant.top === suivante.top && avant.left === suivante.left && avant.width === suivante.width && avant.height === suivante.height ? avant : suivante;
    });
  }, []);

  useLayoutEffect(() => {
    mesurer();
  }, [mesurer, cle]);

  // Les groupes se replient en 200 ms : on se recale une fois l'animation terminée.
  useEffect(() => {
    const t = window.setTimeout(mesurer, 260);
    return () => window.clearTimeout(t);
  }, [mesurer, cle]);

  useEffect(() => {
    const racine = zone.current;
    if (!racine || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(mesurer);
    o.observe(racine);
    return () => o.disconnect();
  }, [mesurer]);

  // Pas de glissement au premier affichage : le repère apparaît directement sur la page courante.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setAnime(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div ref={zone} className="relative">
      {position && (
        <span
          aria-hidden="true"
          className="signature-sidebar__indicateur"
          data-anime={anime}
          style={{ transform: `translate(${position.left}px, ${position.top}px)`, width: position.width, height: position.height }}
        />
      )}
      {children}
    </div>
  );
}

interface PageRecente {
  label: string;
  to: string;
}

const CLE_RECENTES = "cabinet-menu-recents";

const lire = (): PageRecente[] => {
  try {
    const brut = window.localStorage.getItem(CLE_RECENTES);
    const liste = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(liste) ? liste.filter((p): p is PageRecente => typeof p?.label === "string" && typeof p?.to === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
};

/** Pages visitées en dernier (3 au plus, sans la page affichée) : un clic y revient sans défiler le menu. */
export function PagesRecentes({ groups }: { groups: NavGroup[] }) {
  const { pathname } = useLocation();
  const [recentes, setRecentes] = useState<PageRecente[]>(lire);

  useEffect(() => {
    const entrees = groups.flatMap((g) => g.items.flatMap((i) => (i.children ? i.children.map((c) => ({ label: c.label, to: c.to })) : i.to ? [{ label: i.label, to: i.to }] : [])));
    const courante = entrees.find((e) => isRouteActive(pathname, e.to));
    if (!courante) return;
    setRecentes((avant) => {
      const suivantes = [courante, ...avant.filter((p) => p.label !== courante.label)].slice(0, 4);
      try {
        window.localStorage.setItem(CLE_RECENTES, JSON.stringify(suivantes));
      } catch {
        /* stockage bloqué : la liste n'est pas gardée */
      }
      return suivantes;
    });
  }, [pathname, groups]);

  // Seules les entrées encore visibles pour ce compte, hors page affichée.
  const visibles = new Set(groups.flatMap((g) => g.items.flatMap((i) => (i.children ? i.children.map((c) => c.label) : [i.label]))));
  // Icône de chaque page (une sous-page reprend celle de son menu parent).
  const icones = new Map(groups.flatMap((g) => g.items.flatMap((i) => (i.children ? i.children.map((c) => [c.label, i.icon] as const) : [[i.label, i.icon] as const]))));
  const autres = recentes.filter((p) => visibles.has(p.label) && !isRouteActive(pathname, p.to)).slice(0, 3);
  if (autres.length === 0) return null;

  return (
    <nav aria-label="Pages récentes" className="signature-sidebar__recents flex shrink-0 items-center gap-1.5 px-4 pb-1 pt-3 group-data-[collapsible=icon]:hidden">
      <p className="mr-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#7F95AA]">Récents</p>
      {autres.map((p) => {
        const Icone = icones.get(p.label);
        return (
          <NavLink
            key={p.label}
            to={p.to}
            title={p.label}
            className="grid size-[30px] place-items-center rounded-[9px] bg-[rgba(254,244,232,.08)] text-[#DCE6F2] transition-colors hover:bg-[rgba(254,244,232,.16)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary"
          >
            {Icone ? <Icone className="size-4" aria-hidden="true" /> : <span aria-hidden="true" className="text-[11px] font-bold">{p.label[0]}</span>}
            <span className="sr-only">{p.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
