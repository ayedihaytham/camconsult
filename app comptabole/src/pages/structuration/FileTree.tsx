import { Fragment, useMemo, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  FileSpreadsheet,
  FilePlus,
  Download,
  Eye,
  Home,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Trash2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { downloadDataUrl } from "@/lib/file";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSocietes } from "@/store/data";
import type { Noeud } from "@/types";

interface FileTreeProps {
  nodes: Noeud[];
  currentId: string | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onNavigate: (id: string | null) => void;
  onAddFolder: (parentId: string | null) => void;
  onAddFile: (parentId: string) => void;
  onRename: (node: Noeud) => void;
  onMove: (node: Noeud) => void;
  onPreview: (node: Noeud) => void;
  onReparent: (nodeId: string, targetParentId: string | null) => void;
  onDelete: (node: Noeud) => void;
}

export function FileTree({
  nodes,
  currentId,
  canCreate,
  canEdit,
  canDelete,
  onNavigate,
  onAddFolder,
  onAddFile,
  onRename,
  onMove,
  onPreview,
  onReparent,
  onDelete,
}: FileTreeProps) {
  const societes = useSocietes();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);

  const byParent = useMemo(() => {
    const map = new Map<string | null, Noeud[]>();
    for (const n of nodes) {
      const key = n.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return map;
  }, [nodes]);

  const childrenOf = (id: string | null) =>
    (byParent.get(id) ?? []).sort((a, b) => {
      if (a.type !== b.type) return a.type === "dossier" ? -1 : 1;
      return a.libelle.localeCompare(b.libelle);
    });

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const breadcrumb = useMemo(() => {
    const chain: Noeud[] = [];
    let cur = currentId ? nodeById.get(currentId) : undefined;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
    }
    return chain;
  }, [currentId, nodeById]);

  const currentChildren = childrenOf(currentId);

  /** Un nœud peut-il être déposé dans `targetId` ? (pas dans lui-même ni ses descendants) */
  function canDrop(nodeId: string, targetId: string | null): boolean {
    if (nodeId === targetId) return false;
    const dragged = nodeById.get(nodeId);
    if (!dragged) return false;
    if (dragged.parentId === targetId) return false;
    let cur = targetId ? nodeById.get(targetId) : undefined;
    while (cur) {
      if (cur.id === nodeId) return false;
      cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
    }
    return true;
  }

  function handleDrop(targetId: string | null) {
    if (dragId && canDrop(dragId, targetId)) onReparent(dragId, targetId);
    setDragId(null);
    setDropTarget(null);
  }

  const dragProps = (node: Noeud) =>
    canEdit
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", node.id);
            setDragId(node.id);
          },
          onDragEnd: () => {
            setDragId(null);
            setDropTarget(null);
          },
        }
      : {};

  const dropProps = (targetId: string | null, key: string | "root") =>
    canEdit
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (dragId && canDrop(dragId, targetId)) {
              e.preventDefault();
              setDropTarget(key);
            }
          },
          onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            handleDrop(targetId);
          },
        }
      : {};

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Colonne arbre */}
      <div className="rounded-sm border border-border bg-card p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Arborescence
          </span>
          {canCreate && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onAddFolder(null)}
              aria-label="Nouveau dossier racine"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <button
          onClick={() => onNavigate(null)}
          {...dropProps(null, "root")}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary",
            currentId === null && "bg-secondary font-medium",
            dropTarget === "root" && "ring-2 ring-accent",
          )}
        >
          <Home className="h-4 w-4 text-muted-foreground" />
          Racine
        </button>
        <div className="mt-1 space-y-0.5">
          {childrenOf(null)
            .filter((n) => n.type === "dossier")
            .map((n) => (
              <TreeBranch
                key={n.id}
                node={n}
                depth={0}
                currentId={currentId}
                childrenOf={childrenOf}
                onNavigate={onNavigate}
                dragProps={dragProps}
                dropProps={dropProps}
                dropTarget={dropTarget}
              />
            ))}
        </div>
      </div>

      {/* Colonne contenu */}
      <div className="rounded-sm border border-border bg-card">
        {/* Fil d'Ariane */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-3 text-sm">
          <button
            onClick={() => onNavigate(null)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
            Racine
          </button>
          {breadcrumb.map((n) => (
            <Fragment key={n.id}>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                onClick={() => onNavigate(n.id)}
                className={cn(
                  "rounded px-1.5 py-0.5 transition-colors hover:bg-secondary",
                  n.id === currentId
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n.libelle}
              </button>
            </Fragment>
          ))}
          {canCreate && (
            <div className="ml-auto flex items-center gap-2">
              {currentId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddFile(currentId)}
                >
                  <FilePlus className="h-4 w-4" />
                  Ajouter un fichier
                </Button>
              )}
              <Button
                variant="ledger"
                size="sm"
                onClick={() => onAddFolder(currentId)}
              >
                <FolderPlus className="h-4 w-4" />
                Nouveau dossier
              </Button>
            </div>
          )}
        </div>

        {/* Bandeau société courante */}
        {currentId && breadcrumb[0]?.societeId && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Dossier rattaché à{" "}
            <span className="font-medium text-foreground">
              {
                societes.find((s) => s.id === breadcrumb[0].societeId)
                  ?.raisonSociale
              }
            </span>
          </div>
        )}

        {/* Liste des enfants */}
        {currentChildren.length === 0 ? (
          <div
            {...dropProps(currentId, currentId ?? "root")}
            className={cn(
              "flex flex-col items-center justify-center gap-3 px-4 py-16 text-center",
              dropTarget === (currentId ?? "root") && "bg-accent/5",
            )}
          >
            <Folder className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {currentId ? "Ce dossier est vide." : "Aucune arborescence."}
            </p>
            {canCreate && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ledger"
                  size="sm"
                  onClick={() => onAddFolder(currentId)}
                >
                  <FolderPlus className="h-4 w-4" />
                  {currentId ? "Sous-dossier" : "Nouvelle arborescence"}
                </Button>
                {currentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddFile(currentId)}
                  >
                    <FilePlus className="h-4 w-4" />
                    Ajouter un fichier
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <ul>
            {currentChildren.map((n, i) => {
              const isFolder = n.type === "dossier";
              const isDropHere =
                isFolder && dropTarget === n.id && dragId !== n.id;
              const isSheet = /^(xlsx?|csv|ods)$/i.test(n.format ?? "");
              const FileTypeIcon = isSheet ? FileSpreadsheet : FileText;
              return (
                <li
                  key={n.id}
                  {...dragProps(n)}
                  {...(isFolder ? dropProps(n.id, n.id) : {})}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/50",
                    i === currentChildren.length - 1
                      ? ""
                      : (i + 1) % 5 === 0
                        ? "border-b-[1.5px] border-rule-strong"
                        : "border-b border-border",
                    canEdit && "cursor-grab active:cursor-grabbing",
                    dragId === n.id && "opacity-40",
                    isDropHere && "bg-accent/10 ring-1 ring-inset ring-accent",
                  )}
                >
                  <button
                    onClick={() =>
                      isFolder ? onNavigate(n.id) : onPreview(n)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {isFolder ? (
                      <Folder className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <FileTypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {n.libelle}
                      </span>
                      {n.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {n.description}
                        </span>
                      )}
                    </span>
                  </button>

                  {!isFolder && n.format && (
                    <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground sm:block">
                      {n.format}
                    </span>
                  )}

                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {!isFolder && n.taille ? `${n.taille} · ` : ""}
                    {formatDate(n.majLe)}
                  </span>

                  {!isFolder && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                      onClick={() => onPreview(n)}
                      aria-label="Aperçu"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isFolder && (
                        <DropdownMenuItem onClick={() => onNavigate(n.id)}>
                          <FolderOpen className="h-4 w-4" />
                          Ouvrir
                        </DropdownMenuItem>
                      )}
                      {!isFolder && (
                        <DropdownMenuItem onClick={() => onPreview(n)}>
                          <Eye className="h-4 w-4" />
                          Aperçu
                        </DropdownMenuItem>
                      )}
                      {!isFolder && n.dataUrl && (
                        <DropdownMenuItem
                          onClick={() => downloadDataUrl(n.dataUrl!, n.libelle)}
                        >
                          <Download className="h-4 w-4" />
                          Télécharger
                        </DropdownMenuItem>
                      )}
                      {!isFolder && !n.dataUrl && (
                        <DropdownMenuItem
                          onClick={() =>
                            toast.info(
                              "Contenu non conservé (fichier > 2 Mo) — référence seule.",
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                          Télécharger
                        </DropdownMenuItem>
                      )}
                      {(canEdit || canDelete) && <DropdownMenuSeparator />}
                      {canEdit && (
                        <>
                          <DropdownMenuItem onClick={() => onRename(n)}>
                            <Pencil className="h-4 w-4" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMove(n)}>
                            <MoveRight className="h-4 w-4" />
                            Déplacer…
                          </DropdownMenuItem>
                        </>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(n)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

type DragPropsFn = (node: Noeud) => Record<string, unknown>;
type DropPropsFn = (
  targetId: string | null,
  key: string | "root",
) => Record<string, unknown>;

function TreeBranch({
  node,
  depth,
  currentId,
  childrenOf,
  onNavigate,
  dragProps,
  dropProps,
  dropTarget,
}: {
  node: Noeud;
  depth: number;
  currentId: string | null;
  childrenOf: (id: string | null) => Noeud[];
  onNavigate: (id: string | null) => void;
  dragProps: DragPropsFn;
  dropProps: DropPropsFn;
  dropTarget: string | "root" | null;
}) {
  const subFolders = childrenOf(node.id).filter((n) => n.type === "dossier");
  const hasChildren = subFolders.length > 0;
  const [open, setOpen] = useState(depth < 1);
  const active = currentId === node.id;

  return (
    <div>
      <div
        {...dragProps(node)}
        {...dropProps(node.id, node.id)}
        className={cn(
          "flex items-center rounded-md text-sm transition-colors hover:bg-secondary",
          active && "bg-secondary font-medium",
          dropTarget === node.id && "ring-2 ring-inset ring-accent",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-7 w-5 items-center justify-center text-muted-foreground"
          aria-label={open ? "Réduire" : "Développer"}
        >
          {hasChildren && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          )}
        </button>
        <button
          onClick={() => onNavigate(node.id)}
          className="flex flex-1 items-center gap-1.5 py-1.5 pr-2 text-left"
        >
          {active ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-primary/80" />
          )}
          <span className="truncate">{node.libelle}</span>
        </button>
      </div>
      {open &&
        subFolders.map((child) => (
          <TreeBranch
            key={child.id}
            node={child}
            depth={depth + 1}
            currentId={currentId}
            childrenOf={childrenOf}
            onNavigate={onNavigate}
            dragProps={dragProps}
            dropProps={dropProps}
            dropTarget={dropTarget}
          />
        ))}
    </div>
  );
}
