import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Trash2 } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useBalances } from "@/store/balances";
import { POSTE_OPTIONS } from "@/lib/etatsFinanciers/postes";
import type { GrilleAffectatCode } from "@/types";

const POSTE_GROUPES = [...new Set(POSTE_OPTIONS.map((o) => o.groupe))];

export function GrilleAffectatPage() {
  const codes = useBalances((s) => s.grilleCodes);
  const comptes = useBalances((s) => s.grilleComptes);
  const fetchGrille = useBalances((s) => s.fetchGrille);
  const updateCode = useBalances((s) => s.updateCode);
  const renameCode = useBalances((s) => s.renameCode);
  const removeCode = useBalances((s) => s.removeCode);

  const [renaming, setRenaming] = useState<GrilleAffectatCode | null>(null);
  const [newCode, setNewCode] = useState("");
  const [toDelete, setToDelete] = useState<GrilleAffectatCode | null>(null);

  useEffect(() => {
    fetchGrille();
  }, [fetchGrille]);

  const countFor = (code: string) => comptes.filter((c) => c.affectatCode === code).length;

  async function submitRename() {
    if (!renaming || !newCode.trim()) return;
    const merging = codes.some((c) => c.code === newCode.trim().toUpperCase());
    await renameCode(renaming.code, newCode.trim().toUpperCase());
    toast.success(merging ? "Codes fusionnés" : "Code renommé");
    setRenaming(null);
    setNewCode("");
  }

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        title="Grille de reclassement"
        description="Référentiel unique du cabinet — les codes AFFECTAT appris lors des saisies et imports de balance, pour tous les clients."
      />

      {codes.length === 0 ? (
        <LedgerSheet className="mt-6 flex-1">
          <EmptyState
            title="Aucun code pour le moment"
            description="Les codes apparaîtront ici dès qu'une ligne de balance leur sera assignée."
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className="mt-6 flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b-2 border-foreground px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Code
                  </th>
                  <th className="border-b-2 border-foreground px-[18px] py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Libellé
                  </th>
                  <th className="border-b-2 border-foreground px-2 py-2.5 text-left text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Poste (Bilan/CPC)
                  </th>
                  <th className="border-b-2 border-foreground px-[18px] py-2.5 text-right text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground">
                    Comptes rattachés
                  </th>
                  <th className="w-[1%] border-b-2 border-foreground px-[18px] py-2.5" />
                </tr>
              </thead>
              <tbody>
                {codes.map((c, i) => (
                  <tr
                    key={c.code}
                    className={
                      i === codes.length - 1
                        ? ""
                        : (i + 1) % 5 === 0
                          ? "border-b-[1.5px] border-rule-strong"
                          : "border-b border-border"
                    }
                  >
                    <td className="px-[18px] py-2 font-mono text-xs font-bold text-foreground">
                      {c.code}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        defaultValue={c.libelle}
                        placeholder="Libellé (facultatif pour l'instant)"
                        className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-1"
                        onBlur={(e) => {
                          if (e.target.value !== c.libelle) {
                            updateCode(c.code, { libelle: e.target.value });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={c.poste}
                        onChange={(e) => updateCode(c.code, { poste: e.target.value })}
                        className="h-8 w-full rounded-[4px] border border-transparent bg-transparent px-1 text-sm outline-none hover:border-input focus:border-accent"
                      >
                        <option value="">— non assigné —</option>
                        {POSTE_GROUPES.map((groupe) => (
                          <optgroup key={groupe} label={groupe}>
                            {POSTE_OPTIONS.filter((o) => o.groupe === groupe).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-[18px] py-2 text-right tabular-nums text-muted-foreground">
                      {countFor(c.code)}
                    </td>
                    <td className="px-[18px] py-2">
                      <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => {
                            setRenaming(c);
                            setNewCode(c.code);
                          }}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Renommer / fusionner"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setToDelete(c)}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Retirer du référentiel"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LedgerSheet>
      )}

      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renommer « {renaming?.code} »</DialogTitle>
            <DialogDescription>
              Si le nouveau code existe déjà, les deux codes fusionnent — toutes les
              lignes de balance déjà saisies sont mises à jour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-code">Nouveau code</Label>
            <Input
              id="new-code"
              autoFocus
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
              }}
              className="font-mono uppercase"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Annuler
            </Button>
            <Button variant="ledger" disabled={!newCode.trim()} onClick={submitRename}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Retirer ce code du référentiel ?"
        description={
          <>
            Le code <span className="font-medium text-foreground">{toDelete?.code}</span>{" "}
            disparaît de la liste — les lignes de balance qui l'utilisent déjà ne sont
            pas modifiées, et il réapparaîtra automatiquement s'il est réassigné.
          </>
        }
        confirmLabel="Retirer"
        onConfirm={() => {
          if (toDelete) removeCode(toDelete.code);
          setToDelete(null);
        }}
      />
    </div>
  );
}
