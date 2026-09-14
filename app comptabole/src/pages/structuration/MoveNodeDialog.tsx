import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, Home } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Noeud } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: Noeud | null;
  nodes: Noeud[];
  onMove: (nodeId: string, targetParentId: string | null) => void;
}

export function MoveNodeDialog({
  open,
  onOpenChange,
  node,
  nodes,
  onMove,
}: Props) {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTarget(node?.parentId ?? null);
  }, [open, node]);

  // Descendants du nœud déplacé (destinations interdites) + lui-même
  const forbidden = useMemo(() => {
    if (!node) return new Set<string>();
    const set = new Set<string>([node.id]);
    const walk = (id: string) =>
      nodes
        .filter((n) => n.parentId === id)
        .forEach((c) => {
          set.add(c.id);
          walk(c.id);
        });
    walk(node.id);
    return set;
  }, [node, nodes]);

  const folders = nodes.filter(
    (n) => n.type === "dossier" && !forbidden.has(n.id),
  );

  const pathOf = (id: string): string => {
    const chain: string[] = [];
    let cur: Noeud | undefined = nodes.find((n) => n.id === id);
    while (cur) {
      chain.unshift(cur.libelle);
      cur = cur.parentId
        ? nodes.find((n) => n.id === cur!.parentId)
        : undefined;
    }
    return chain.join(" / ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Déplacer « {node?.libelle} »</DialogTitle>
          <DialogDescription>
            Choisissez le dossier de destination.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-1.5">
          <button
            onClick={() => setTarget(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
              target === null ? "bg-secondary font-medium" : "hover:bg-secondary/60",
            )}
          >
            <Home className="h-4 w-4 text-muted-foreground" />
            Racine
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setTarget(f.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                target === f.id
                  ? "bg-secondary font-medium"
                  : "hover:bg-secondary/60",
              )}
            >
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{f.libelle}</span>
                {f.parentId && (
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <ChevronRight className="h-3 w-3" />
                    {pathOf(f.parentId)}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={!node || target === (node?.parentId ?? null)}
            onClick={() => node && onMove(node.id, target)}
          >
            Déplacer ici
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
