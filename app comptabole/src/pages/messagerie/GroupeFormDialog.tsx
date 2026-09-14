import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { employeNomComplet } from "@/data/employes";
import type { Conversation, Employe } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = création */
  groupe?: Conversation | null;
  employes: Employe[];
  onSubmit: (values: { titre: string; membreIds: string[] }) => void;
}

export function GroupeFormDialog({
  open,
  onOpenChange,
  groupe,
  employes,
  onSubmit,
}: Props) {
  const isEdit = Boolean(groupe);
  const [titre, setTitre] = useState("");
  const [membreIds, setMembreIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitre(groupe?.titre ?? "");
    setMembreIds(groupe?.membreIds ?? []);
  }, [open, groupe]);

  function toggle(id: string) {
    setMembreIds((m) =>
      m.includes(id) ? m.filter((x) => x !== id) : [...m, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le groupe" : "Nouveau groupe"}
          </DialogTitle>
          <DialogDescription>
            Une conversation partagée entre le responsable et les collaborateurs
            choisis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="grp-titre">Nom du groupe</Label>
            <Input
              id="grp-titre"
              autoFocus
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. Équipe TVA"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Membres</Label>
              <span className="text-xs text-muted-foreground">
                {membreIds.length} sélectionné{membreIds.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {employes.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Aucun collaborateur. Créez-en d'abord.
                </p>
              )}
              {employes.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary"
                >
                  <Checkbox
                    checked={membreIds.includes(e.id)}
                    onCheckedChange={() => toggle(e.id)}
                  />
                  <span className="text-sm text-foreground">
                    {employeNomComplet(e)}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {e.type}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={!titre.trim()}
            onClick={() => {
              onSubmit({ titre: titre.trim(), membreIds });
              onOpenChange(false);
            }}
          >
            {isEdit ? "Enregistrer" : "Créer le groupe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
