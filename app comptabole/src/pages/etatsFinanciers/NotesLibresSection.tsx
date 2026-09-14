import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BlocLibre } from "@/types";

/**
 * Notes narratives libres (faits marquants, régularisation intergroupe,
 * restructuration financière...) — propres à chaque exercice, ajoutées au
 * besoin (rien ne s'affiche si vide).
 */
export function NotesLibresSection({
  blocs,
  onSave,
}: {
  blocs: BlocLibre[];
  onSave: (blocs: BlocLibre[]) => void;
}) {
  const [local, setLocal] = useState<BlocLibre[]>(blocs);

  useEffect(() => setLocal(blocs), [blocs]);

  function update(next: BlocLibre[]) {
    setLocal(next);
  }

  return (
    <LedgerSheet className="p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Notes complémentaires</p>
        <button
          onClick={() => update([...local, { titre: "", texte: "" }])}
          className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
        >
          <Plus className="h-3 w-3" />
          Ajouter une note
        </button>
      </div>
      {local.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune note pour cet exercice — ajoutez-en une si un événement le justifie (faits
          marquants, régularisation intergroupe, restructuration financière…).
        </p>
      ) : (
        <div className="space-y-3">
          {local.map((bloc, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_1fr_auto]">
              <Input
                value={bloc.titre}
                placeholder="Titre de la note"
                onChange={(e) => update(local.map((b, j) => (j === i ? { ...b, titre: e.target.value } : b)))}
                onBlur={() => onSave(local)}
              />
              <Textarea
                value={bloc.texte}
                placeholder="Texte"
                className="min-h-[72px]"
                onChange={(e) => update(local.map((b, j) => (j === i ? { ...b, texte: e.target.value } : b)))}
                onBlur={() => onSave(local)}
              />
              <button
                onClick={() => {
                  const next = local.filter((_, j) => j !== i);
                  update(next);
                  onSave(next);
                }}
                className="flex h-8 w-8 items-center justify-center self-start rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </LedgerSheet>
  );
}
