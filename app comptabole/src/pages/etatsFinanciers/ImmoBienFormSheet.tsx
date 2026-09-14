import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BienInput } from "@/store/immobilisations";
import type { ImmoBien, ImmoCategorie } from "@/types";

const EMPTY: BienInput = {
  categorieId: "",
  libelle: "",
  dateAcquisition: "",
  coutAcquisition: 0,
  taux: 0,
  dateCession: null,
  valeurCession: 0,
};

export function ImmoBienFormSheet({
  open,
  onOpenChange,
  categories,
  bien,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ImmoCategorie[];
  /** Présent = édition (dont possibilité de céder) ; absent = création. */
  bien: ImmoBien | null;
  onSubmit: (data: BienInput) => void;
}) {
  const [form, setForm] = useState<BienInput>(EMPTY);

  useEffect(() => {
    if (bien) {
      setForm({
        categorieId: bien.categorieId,
        libelle: bien.libelle,
        dateAcquisition: bien.dateAcquisition,
        coutAcquisition: bien.coutAcquisition,
        taux: bien.taux,
        dateCession: bien.dateCession,
        valeurCession: bien.valeurCession,
      });
    } else {
      setForm(EMPTY);
    }
  }, [bien, open]);

  function selectCategorie(categorieId: string) {
    const cat = categories.find((c) => c.id === categorieId);
    setForm((f) => ({ ...f, categorieId, taux: bien ? f.taux : (cat?.taux ?? f.taux) }));
  }

  function submit() {
    if (!form.categorieId || !form.libelle.trim() || !form.dateAcquisition) return;
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{bien ? "Modifier le bien" : "Nouveau bien"}</DialogTitle>
          <DialogDescription>
            Saisi une seule fois — l'amortissement de chaque exercice se calcule automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.categorieId} onValueChange={selectCategorie}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom} ({c.taux}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Libellé</Label>
            <Input
              value={form.libelle}
              onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
              placeholder="Ex. Camion Iveco"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date d'acquisition</Label>
              <Input
                type="date"
                value={form.dateAcquisition}
                onChange={(e) => setForm((f) => ({ ...f, dateAcquisition: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Taux (%)</Label>
              <Input
                value={form.taux || ""}
                onChange={(e) => setForm((f) => ({ ...f, taux: Number(e.target.value) || 0 }))}
                placeholder="Ex. 20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Coût d'acquisition (DT)</Label>
            <Input
              value={form.coutAcquisition || ""}
              onChange={(e) => setForm((f) => ({ ...f, coutAcquisition: Number(e.target.value) || 0 }))}
            />
          </div>

          {bien && (
            <div className="space-y-3 rounded-sm border border-border p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Cession (facultatif)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date de cession</Label>
                  <Input
                    type="date"
                    value={form.dateCession ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, dateCession: e.target.value || null }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valeur de cession (DT)</Label>
                  <Input
                    value={form.valeurCession || ""}
                    onChange={(e) => setForm((f) => ({ ...f, valeurCession: Number(e.target.value) || 0 }))}
                    disabled={!form.dateCession}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={!form.categorieId || !form.libelle.trim() || !form.dateAcquisition}
            onClick={submit}
          >
            {bien ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
