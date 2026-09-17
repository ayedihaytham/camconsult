import { FileSpreadsheet, FileText, Folder, FolderTree, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_ACCENT, THEME_BAR, THEME_ICON, THEME_LINE } from "@/lib/societeTheme";
import type { Noeud, Societe } from "@/types";

/**
 * Vue d'ensemble complète : toutes les arborescences (une par société,
 * parfois plusieurs) sont rendues côte à côte, chacune comme son propre
 * arbre — jamais reliées entre elles par un trait (elles n'ont aucun lien
 * réel), pour que l'admin voie tout le cabinet d'un coup d'œil sans avoir à
 * sélectionner une société à la fois. Chaque branche a sa propre couleur
 * (celle du thème de sa société, réutilisée depuis Sociétés/Stock) reportée
 * sur ses traits de connexion et une barre d'accent sur chacune de ses
 * cartes, pour distinguer visuellement où commence/finit chaque société
 * dans un schéma qui en contient plusieurs.
 *
 * Rendu en pur CSS (avant/après + bordures), pas de librairie de graphe :
 * l'arbre reste raisonnablement petit (dossiers/fichiers d'un cabinet
 * comptable), pas besoin d'un moteur de layout dédié.
 */
const GENERIC_BAR = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const GENERIC_LINE = [
  "before:border-chart-1 after:border-chart-1",
  "before:border-chart-2 after:border-chart-2",
  "before:border-chart-3 after:border-chart-3",
  "before:border-chart-4 after:border-chart-4",
  "before:border-chart-5 after:border-chart-5",
];

interface Branch {
  /** Barre d'accent pleine (fond) — cartes + points de jonction. */
  bar: string;
  /** Classes before:/after: complètes — couleur des traits de connexion. */
  line: string;
}

export function OrganigrammeView({
  nodes,
  roots,
  getSocieteById,
  onOpenNode,
}: {
  nodes: Noeud[];
  roots: Noeud[];
  getSocieteById: (id: string | null) => Societe | null;
  onOpenNode: (n: Noeud) => void;
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-border bg-secondary/20 px-10 py-10"
      style={{
        backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.09) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="flex flex-wrap items-start gap-x-14 gap-y-10">
        {roots.map((root, i) => {
          const societe = getSocieteById(root.societeId);
          const branch: Branch = societe
            ? { bar: THEME_BAR[societe.theme], line: THEME_LINE[societe.theme] }
            : { bar: GENERIC_BAR[i % GENERIC_BAR.length], line: GENERIC_LINE[i % GENERIC_LINE.length] };
          const { dossiers, fichiers } = countDescendants(root.id, nodes);
          const children = nodes
            .filter((n) => n.parentId === root.id)
            .sort((a, b) => a.libelle.localeCompare(b.libelle));

          return (
            <ul key={root.id} className="inline-flex flex-col items-center">
              <li className="flex flex-col items-center">
                <OrgChartHero
                  node={root}
                  societe={societe}
                  dossiers={dossiers}
                  fichiers={fichiers}
                  branch={branch}
                  hasChildren={children.length > 0}
                />
                {children.length > 0 && (
                  <ul
                    className={cn(
                      "relative flex pt-6 before:absolute before:left-1/2 before:top-0 before:h-6 before:border-l before:content-['']",
                      branch.line,
                    )}
                  >
                    {children.map((c) => (
                      <OrgChartNode
                        key={c.id}
                        nodeId={c.id}
                        nodes={nodes}
                        depth={1}
                        branch={branch}
                        onOpenNode={onOpenNode}
                      />
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          );
        })}
      </div>
    </div>
  );
}

function countDescendants(id: string, nodes: Noeud[]): { dossiers: number; fichiers: number } {
  let dossiers = 0;
  let fichiers = 0;
  for (const n of nodes) {
    if (n.parentId !== id) continue;
    if (n.type === "dossier") {
      dossiers += 1;
      const sub = countDescendants(n.id, nodes);
      dossiers += sub.dossiers;
      fichiers += sub.fichiers;
    } else {
      fichiers += 1;
    }
  }
  return { dossiers, fichiers };
}

function OrgChartHero({
  node,
  societe,
  dossiers,
  fichiers,
  branch,
  hasChildren,
}: {
  node: Noeud;
  societe: Societe | null;
  dossiers: number;
  fichiers: number;
  branch: Branch;
  hasChildren: boolean;
}) {
  const Icon = societe ? THEME_ICON[societe.theme] : FolderTree;
  const accentClass = societe ? THEME_ACCENT[societe.theme] : "bg-accent/12 text-accent";
  return (
    <div className="relative">
      <div className="relative flex min-w-[15rem] max-w-[17rem] flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card py-4 pl-5 pr-4 shadow-card-hover">
        <span className={cn("absolute inset-y-0 left-0 w-1.5", branch.bar)} aria-hidden />
        <span
          className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accentClass)}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-foreground">{node.libelle}</p>
          <p className="truncate text-xs text-muted-foreground">
            {societe ? societe.raisonSociale : "Modèle générique"}
          </p>
        </div>
        <div className="flex items-center gap-x-2.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
          <span>
            {dossiers} dossier{dossiers !== 1 ? "s" : ""}
          </span>
          <span aria-hidden>·</span>
          <span>
            {fichiers} fichier{fichiers !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      {hasChildren && (
        <span
          className={cn(
            "absolute -bottom-[7px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full",
            branch.bar,
          )}
          aria-hidden
        />
      )}
    </div>
  );
}

function OrgChartNode({
  nodeId,
  nodes,
  depth,
  branch,
  onOpenNode,
}: {
  nodeId: string;
  nodes: Noeud[];
  depth: number;
  branch: Branch;
  onOpenNode: (n: Noeud) => void;
}) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const children = nodes
    .filter((n) => n.parentId === nodeId)
    .sort((a, b) => a.libelle.localeCompare(b.libelle));

  return (
    <li
      className={cn(
        "relative flex flex-col items-center px-3 pt-6",
        "before:absolute before:right-1/2 before:top-0 before:h-6 before:w-1/2 before:border-t before:content-['']",
        "after:absolute after:left-1/2 after:top-0 after:h-6 after:w-1/2 after:border-l after:border-t after:content-['']",
        branch.line,
        "only:before:hidden only:after:hidden only:pt-0",
        "first:before:border-none",
        "last:before:rounded-tr-md last:before:border-r",
        "last:after:border-none",
        "first:after:rounded-tl-md",
      )}
    >
      <OrgChartBox
        node={node}
        depth={depth}
        childCount={children.length}
        branch={branch}
        hasChildren={children.length > 0}
        onOpenNode={onOpenNode}
      />
      {children.length > 0 && (
        <ul
          className={cn(
            "relative flex pt-6 before:absolute before:left-1/2 before:top-0 before:h-6 before:border-l before:content-['']",
            branch.line,
          )}
        >
          {children.map((c) => (
            <OrgChartNode
              key={c.id}
              nodeId={c.id}
              nodes={nodes}
              depth={depth + 1}
              branch={branch}
              onOpenNode={onOpenNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function fileIcon(format: string | undefined) {
  const f = (format ?? "").toLowerCase();
  if (/^(xlsx?|csv|ods)$/.test(f)) return FileSpreadsheet;
  if (/^(png|jpe?g|gif|webp|svg)$/.test(f)) return ImageIcon;
  return FileText;
}

function OrgChartBox({
  node,
  depth,
  childCount,
  branch,
  hasChildren,
  onOpenNode,
}: {
  node: Noeud;
  depth: number;
  childCount: number;
  branch: Branch;
  hasChildren: boolean;
  onOpenNode: (n: Noeud) => void;
}) {
  const isFolder = node.type === "dossier";
  const Icon = isFolder ? Folder : fileIcon(node.format);
  const compact = depth >= 2;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => isFolder && onOpenNode(node)}
        disabled={!isFolder}
        className={cn(
          "relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border border-border bg-card text-center shadow-sm transition-all duration-200",
          compact
            ? "min-w-[8.5rem] max-w-[11.5rem] py-2.5 pl-4 pr-2.5"
            : "min-w-[9.5rem] max-w-[13rem] py-3 pl-4 pr-3",
          isFolder
            ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover"
            : "cursor-default",
        )}
      >
        <span className={cn("absolute inset-y-0 left-0 w-1", branch.bar)} aria-hidden />
        <span
          className={cn(
            "flex items-center justify-center rounded-lg",
            compact ? "h-7 w-7" : "h-8 w-8",
            isFolder ? "bg-accent/12 text-accent" : "bg-secondary text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </span>
        <span className={cn("line-clamp-2 font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
          {node.libelle}
        </span>
        {isFolder ? (
          <span className="text-xs text-muted-foreground">
            {childCount} élément{childCount !== 1 ? "s" : ""}
          </span>
        ) : (
          node.format && (
            <span className="text-[11px] uppercase text-muted-foreground">{node.format}</span>
          )
        )}
      </button>
      {hasChildren && (
        <span
          className={cn(
            "absolute -bottom-[7px] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full",
            branch.bar,
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
