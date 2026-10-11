import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Folder,
  FolderTree,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { THEME_ACCENT, THEME_BAR, THEME_ICON, THEME_LINE } from "@/lib/societeTheme";
import { anneeDuLibelle, comptesParMois, fichiersDuMois, MOIS_COURTS, type OptionsMois } from "@/lib/structurationMois";
import type { Noeud, Societe } from "@/types";

/**
 * Organigramme d'UNE société à la fois (sélecteur en haut), en format
 * compact + zoom, pour que tout son arbre tienne à l'écran. Chaque société
 * garde sa couleur (celle de son thème, réutilisée depuis Sociétés/Stock)
 * sur ses traits de connexion et la barre d'accent de ses cartes.
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

const COMMUN = "__commun__";
const ZOOMS = [0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3];

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
  // Un organigramme par société (choisie en haut) plutôt que toutes côte à
  // côte : chaque schéma reste lisible. Les arborescences sans société
  // (modèle générique…) forment leur propre entrée « Commun ».
  const groupes = useMemo(() => {
    const map = new Map<string, { cle: string; label: string; roots: Noeud[] }>();
    for (const r of roots) {
      const cle = r.societeId ?? COMMUN;
      const label = r.societeId ? (getSocieteById(r.societeId)?.raisonSociale ?? r.libelle) : "Commun (sans société)";
      const g = map.get(cle) ?? { cle, label, roots: [] };
      g.roots.push(r);
      map.set(cle, g);
    }
    return [...map.values()].sort((a, b) =>
      a.cle === COMMUN ? 1 : b.cle === COMMUN ? -1 : a.label.localeCompare(b.label, "fr"),
    );
  }, [roots, getSocieteById]);
  const [choix, setChoix] = useState<string | null>(null);
  const groupe = groupes.find((g) => g.cle === choix) ?? groupes[0];
  const [zoomIdx, setZoomIdx] = useState(ZOOMS.indexOf(1));
  const zoom = ZOOMS[zoomIdx];
  // Les mois : sous chaque dossier de l'année, les fichiers rangés par mois d'après leur date d'ajout.
  const [afficherMois, setAfficherMois] = useState(true);
  const [moisTous, setMoisTous] = useState(false);
  const mois: OptionsMois = { afficher: afficherMois, tous: moisTous };
  const [moisChoisi, setMoisChoisi] = useState<{ node: Noeud; mois: number; annee: number | null } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Société</span>
          <Select value={groupe?.cle} onValueChange={setChoix}>
            <SelectTrigger className="h-9 w-64" aria-label="Organigramme de la société">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupes.map((g) => (
                <SelectItem key={g.cle} value={g.cle}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={afficherMois} onChange={(e) => setAfficherMois(e.target.checked)} className="size-4 accent-primary" />
            Afficher les mois
          </label>
          {afficherMois && (
            <Button variant="outline" size="sm" onClick={() => setMoisTous((v) => !v)}>
              {moisTous ? "Replier les mois" : "Déplier les mois"}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1" aria-label="Zoom">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Réduire"
            disabled={zoomIdx === 0}
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            className="w-12 text-center text-xs tabular-nums text-muted-foreground hover:text-foreground"
            title="Taille normale"
            onClick={() => setZoomIdx(ZOOMS.indexOf(1))}
          >
            {Math.round(zoom * 100)} %
          </button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Agrandir"
            disabled={zoomIdx === ZOOMS.length - 1}
            onClick={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <OrganigrammeSociete
        nodes={nodes}
        roots={groupe?.roots ?? []}
        getSocieteById={getSocieteById}
        onOpenNode={onOpenNode}
        zoom={zoom}
        mois={mois}
        onChoisirMois={setMoisChoisi}
      />
      {afficherMois && moisChoisi && (
        <section className="rounded-lg border border-accent bg-card px-4 py-3" aria-label="Fichiers du mois">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {moisChoisi.node.libelle} · {MOIS_COURTS[moisChoisi.mois]}{moisChoisi.annee ? ` ${moisChoisi.annee}` : ""}
            </p>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenNode(moisChoisi.node)}>Ouvrir le dossier</Button>
              <Button variant="ghost" size="sm" onClick={() => setMoisChoisi(null)}>Fermer</Button>
            </span>
          </div>
          {(() => {
            const fichiers = fichiersDuMois(moisChoisi.node.id, nodes, moisChoisi.annee, moisChoisi.mois);
            return fichiers.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucun fichier ce mois-ci.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {fichiers.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {f.libelle}
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      )}
    </div>
  );
}

function OrganigrammeSociete({
  nodes,
  roots,
  getSocieteById,
  onOpenNode,
  zoom,
  mois,
  onChoisirMois,
}: {
  nodes: Noeud[];
  roots: Noeud[];
  getSocieteById: (id: string | null) => Societe | null;
  onOpenNode: (n: Noeud) => void;
  zoom: number;
  mois: OptionsMois;
  onChoisirMois: (m: { node: Noeud; mois: number; annee: number | null }) => void;
}) {
  return (
    <div
      className="overflow-auto rounded-xl border border-border bg-secondary/20 px-4 py-6"
      style={{
        backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.09) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="flex w-max min-w-full flex-wrap items-start justify-center gap-x-10 gap-y-8" style={{ zoom }}>
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
                      "relative flex pt-4 before:absolute before:left-1/2 before:top-0 before:h-4 before:border-l before:content-['']",
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
                        mois={mois}
                        annee={null}
                        onChoisirMois={onChoisirMois}
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
      <div className="relative flex min-w-[12rem] max-w-[14rem] flex-col gap-2 overflow-hidden rounded-lg border border-border bg-card py-2.5 pl-4 pr-3 shadow-card-hover">
        <span className={cn("absolute inset-y-0 left-0 w-1", branch.bar)} aria-hidden />
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", accentClass)}
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{node.libelle}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {societe ? societe.raisonSociale : "Modèle générique"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-x-2 border-t border-border pt-1.5 text-[11px] text-muted-foreground">
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
  mois,
  annee,
  onChoisirMois,
}: {
  onChoisirMois: (m: { node: Noeud; mois: number; annee: number | null }) => void;
  nodeId: string;
  nodes: Noeud[];
  depth: number;
  branch: Branch;
  onOpenNode: (n: Noeud) => void;
  mois: OptionsMois;
  /** Année du dossier « Comptabilité générale … » qui contient ce nœud : les mois ne comptent que ses fichiers. */
  annee: number | null;
}) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const anneeNoeud = annee ?? anneeDuLibelle(node.libelle);
  const children = nodes
    .filter((n) => n.parentId === nodeId)
    .sort((a, b) => a.libelle.localeCompare(b.libelle));

  return (
    <li
      className={cn(
        "relative flex flex-col items-center px-1.5 pt-4",
        "before:absolute before:right-1/2 before:top-0 before:h-4 before:w-1/2 before:border-t before:content-['']",
        "after:absolute after:left-1/2 after:top-0 after:h-4 after:w-1/2 after:border-l after:border-t after:content-['']",
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
      {mois.afficher && depth === 2 && node.type === "dossier" && (
        <MoisDuDossier key={`${node.id}-${mois.tous}`} node={node} nodes={nodes} annee={anneeNoeud} ouvertAuDepart={mois.tous} branch={branch} onChoisirMois={onChoisirMois} />
      )}
      {children.length > 0 && (
        <ul
          className={cn(
            "relative flex pt-4 before:absolute before:left-1/2 before:top-0 before:h-4 before:border-l before:content-['']",
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
              mois={mois}
              annee={anneeNoeud}
              onChoisirMois={onChoisirMois}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Les 12 mois d'un dossier : un fichier est rangé sous le mois de sa date d'ajout. Un clic sur un mois ouvre le dossier. */
function MoisDuDossier({ node, nodes, annee, ouvertAuDepart, branch, onChoisirMois }: { node: Noeud; nodes: Noeud[]; annee: number | null; ouvertAuDepart: boolean; branch: Branch; onChoisirMois: (m: { node: Noeud; mois: number; annee: number | null }) => void }) {
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  const comptes = useMemo(() => comptesParMois(node.id, nodes, annee), [node.id, nodes, annee]);
  return (
    <div className="mt-2 flex flex-col items-center">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="rounded px-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {ouvert ? "▾ masquer les mois" : "▸ voir les mois"}
      </button>
      {ouvert && (
        <ul className="mt-1 grid w-[11.5rem] grid-cols-3 gap-1" aria-label={`Mois de ${node.libelle}`}>
          {MOIS_COURTS.map((m, i) => (
            <li key={m}>
              <button
                type="button"
                title={`${m} : ${comptes[i]} fichier${comptes[i] > 1 ? "s" : ""}`}
                onClick={() => onChoisirMois({ node, mois: i, annee })}
                className={cn(
                  "w-full rounded border px-1 py-1 text-center text-[11px] font-semibold tabular-nums",
                  comptes[i] > 0 ? "border-success/40 bg-success/10 text-success hover:bg-success/20" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary",
                )}
              >
                {m}{comptes[i] > 0 ? ` · ${comptes[i]}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className={cn("sr-only", branch.bar)} aria-hidden />
    </div>
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
          "relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border border-border bg-card text-center shadow-sm transition-all duration-200",
          compact
            ? "min-w-[6rem] max-w-[8.5rem] py-1.5 pl-2.5 pr-1.5"
            : "min-w-[6.5rem] max-w-[9.5rem] py-2 pl-3 pr-2",
          isFolder
            ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover"
            : "cursor-default",
        )}
      >
        <span className={cn("absolute inset-y-0 left-0 w-1", branch.bar)} aria-hidden />
        <span
          className={cn(
            "flex items-center justify-center rounded-md",
            compact ? "h-5 w-5" : "h-6 w-6",
            isFolder ? "bg-accent/12 text-accent" : "bg-secondary text-muted-foreground",
          )}
          aria-hidden
        >
          <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </span>
        <span className={cn("line-clamp-2 font-semibold text-foreground", compact ? "text-[11px]" : "text-xs")}>
          {node.libelle}
        </span>
        {isFolder ? (
          <span className="text-[10px] text-muted-foreground">
            {childCount} élément{childCount !== 1 ? "s" : ""}
          </span>
        ) : (
          node.format && (
            <span className="text-[10px] uppercase text-muted-foreground">{node.format}</span>
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
