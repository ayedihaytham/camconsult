import { useEffect, useState } from "react";
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
  /** Nom du fichier à classer, pour le titre du dialogue. */
  attachmentLabel: string | null;
  /** Tous les dossiers existants (mêmes règles de visibilité que Structuration). */
  nodes: Noeud[];
  /** Société connue de la conversation (client) — restreint la liste à son
   * espace de Structuration uniquement, plutôt que de mélanger toutes les
   * sociétés : le document appartient forcément à ce client. */
  restrictToSocieteId?: string | null;
  restrictToSocieteLabel?: string | null;
  onConfirm: (targetParentId: string | null) => void;
}

/** Même présentation que MoveNodeDialog (Structuration), sans la notion de
 * nœud déplacé/descendants interdits — ici on choisit juste une destination
 * pour un nouveau fichier issu d'une pièce jointe de message. */
export function ClasserPieceJointeDialog({
  open,
  onOpenChange,
  attachmentLabel,
  nodes,
  restrictToSocieteId,
  restrictToSocieteLabel,
  onConfirm,
}: Props) {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTarget(null);
  }, [open]);

  const scopedNodes = restrictToSocieteId
    ? nodes.filter((n) => n.societeId === restrictToSocieteId)
    : nodes;
  const folders = scopedNodes.filter((n) => n.type === "dossier");

  const pathOf = (id: string): string => {
    const chain: string[] = [];
    let cur: Noeud | undefined = nodes.find((n) => n.id === id);
    while (cur) {
      chain.unshift(cur.libelle);
      cur = cur.parentId ? nodes.find((n) => n.id === cur!.parentId) : undefined;
    }
    return chain.join(" / ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Classer « {attachmentLabel} »</DialogTitle>
          <DialogDescription>
            {restrictToSocieteId
              ? `Choisissez le dossier de destination dans l'espace Structuration de ${restrictToSocieteLabel ?? "cette société"}.`
              : "Choisissez le dossier de destination dans la Structuration."}
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
            {restrictToSocieteId
              ? `Racine de ${restrictToSocieteLabel ?? "la société"}`
              : "Racine"}
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
          <Button variant="ledger" onClick={() => onConfirm(target)}>
            Classer ici
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
