import { useRef, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { COLLECTE_TABS } from "@/lib/collecte/tabs";
import { CollecteTableSelection } from "./CollecteTableSelection";

interface Props {
  demandes: string[];
  /** Ajout atomique de tous les tableaux sélectionnés. */
  onAjouter: (keys: string[]) => Promise<void>;
}

export function TableauxNonDemandes({ demandes, onAjouter }: Props) {
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const available = COLLECTE_TABS.filter((table) => !demandes.includes(table.key)).map((table) => table.key);
  const selection = selected.filter((key) => available.includes(key));

  function changeOpen(next: boolean) {
    if (busyRef.current) return;
    setOpen(next);
    setSelected([]);
    setError(false);
  }

  async function ajouter() {
    if (busyRef.current || selection.length === 0) return;
    busyRef.current = true;
    setSaving(true);
    setError(false);
    try {
      await onAjouter(selection);
      setOpen(false);
      setSelected([]);
    } catch {
      setError(true);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }

  if (available.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Ajouter des tableaux" title={`Ajouter des tableaux (${available.length} disponibles)`} className="size-11 shrink-0 sm:size-9 lg:w-auto lg:px-2 lg:text-xs">
          <Plus className="size-4" aria-hidden="true" /><span className="hidden lg:inline">Ajouter des tableaux</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-xl p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>Ajouter des tableaux</DialogTitle>
          <DialogDescription>Sélectionnez les tableaux à ajouter à cette collecte.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <CollecteTableSelection label="Tableaux à ajouter" selected={selection} available={available} disabled={saving} onChange={setSelected} />
        </div>
        <div className="shrink-0 space-y-2 border-t border-border px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-6">
          {error && <p role="alert" className="text-xs text-destructive">Ajout impossible. Votre sélection est conservée ; réessayez.</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" className="min-h-11 px-4" disabled={saving} onClick={() => changeOpen(false)}>Annuler</Button>
            <Button type="button" variant="ledger" className="min-h-11 px-5" disabled={saving || selection.length === 0} aria-busy={saving} onClick={() => void ajouter()}>
              {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              {saving ? "Ajout…" : `Ajouter (${selection.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
