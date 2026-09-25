import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBalances } from "@/store/balances";
import { POSTE_OPTIONS } from "@/lib/etatsFinanciers/postes";
import type { GrilleAffectatCode } from "@/types";
import { FinancialIdentityHeader } from "./FinancialIdentityHeader";

const POSTE_GROUPES = [...new Set(POSTE_OPTIONS.map((o) => o.groupe))];

export function GrilleAffectatPage() {
  const codes = useBalances((s) => s.grilleCodes);
  const comptes = useBalances((s) => s.grilleComptes);
  const loading = useBalances((s) => s.grilleLoading);
  const error = useBalances((s) => s.grilleError);
  const fetchGrille = useBalances((s) => s.fetchGrille);
  const updateCode = useBalances((s) => s.updateCode);
  const renameCode = useBalances((s) => s.renameCode);
  const removeCode = useBalances((s) => s.removeCode);

  const [renaming, setRenaming] = useState<GrilleAffectatCode | null>(null);
  const [newCode, setNewCode] = useState("");
  const [toDelete, setToDelete] = useState<GrilleAffectatCode | null>(null);
  const [renamingPending, setRenamingPending] = useState(false);

  useEffect(() => {
    void fetchGrille().catch(() => {});
  }, [fetchGrille]);

  const countFor = (code: string) => comptes.filter((c) => c.affectatCode === code).length;

  async function submitRename() {
    if (!renaming || !newCode.trim() || renamingPending) return;
    const merging = codes.some((c) => c.code === newCode.trim().toUpperCase());
    setRenamingPending(true);
    try {
      await renameCode(renaming.code, newCode.trim().toUpperCase());
      toast.success(merging ? "Codes fusionnés" : "Code renommé");
      setRenaming(null);
      setNewCode("");
    } catch {
      // Le store affiche l'erreur; conserver le dialogue et la saisie permet de corriger.
    } finally {
      setRenamingPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <FinancialIdentityHeader
        eyebrow="Paramétrage cabinet"
        title="Grille AFFECTAT"
        description="Référentiel global de reclassement du cabinet, appliqué aux sociétés autorisées."
        monogram="A"
      />

      <div className="mt-3 divide-y divide-border border-y border-border" aria-label="Fonctionnement de la grille AFFECTAT">
        <div className="grid gap-1 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
          <p className="font-mono text-xs font-semibold text-foreground">Code brut</p>
          <p className="text-xs text-muted-foreground">Le code conservé sur la ligne de balance importée ou saisie.</p>
        </div>
        <div className="grid gap-1 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
          <p className="font-mono text-xs font-semibold text-foreground">Poste global</p>
          <p className="text-xs text-muted-foreground">Le poste comptable utilisé pour présenter les états financiers de l’ensemble du cabinet.</p>
        </div>
        <div className="grid gap-1 py-2.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
          <p className="font-mono text-xs font-semibold text-foreground">Dérogation société</p>
          <p className="text-xs text-muted-foreground">Une association compte → code peut être limitée à un dossier; elle prend alors priorité sur l’association globale.</p>
        </div>
      </div>

      {loading ? (
        <div aria-label="Chargement de la grille AFFECTAT" className="mt-3 divide-y divide-border border-y border-border">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex min-h-12 items-center gap-4 px-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 flex-1" /><Skeleton className="h-4 w-24" /></div>)}
        </div>
      ) : error ? (
        <div className="mt-3 border-y border-border px-3 py-4">
          <EmptyState
            title="Grille indisponible"
            description={error}
            action={<Button variant="outline" size="sm" onClick={() => void fetchGrille().catch(() => {})}>Réessayer</Button>}
          />
        </div>
      ) : codes.length === 0 ? (
        <div className="mt-3 border-y border-border px-3 py-3">
          <EmptyState
            title="Aucun code pour le moment"
            description="Les codes apparaîtront ici dès qu'une ligne de balance leur sera assignée."
          />
        </div>
      ) : (
        <div className="mt-3 min-w-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead scope="col" className="pl-4">
                    Code
                  </TableHead>
                  <TableHead scope="col">
                    Libellé
                  </TableHead>
                  <TableHead scope="col">
                    Poste (Bilan/CPC)
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Comptes rattachés
                  </TableHead>
                  <TableHead scope="col" className="w-[1%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow
                    key={c.code}
                  >
                    <TableCell className="pl-4 font-mono text-xs font-bold text-foreground">
                      {c.code}
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
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
                    </TableCell>
                    <TableCell className="px-2 py-1.5">
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
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {countFor(c.code)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => {
                            setRenaming(c);
                            setNewCode(c.code);
                          }}
                          aria-label={`Renommer le code ${c.code}`}
                          className="flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Renommer / fusionner"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setToDelete(c)}
                          aria-label={`Retirer le code ${c.code}`}
                          className="flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Retirer du référentiel"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
      )}

      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm" aria-busy={renamingPending}>
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
                if (e.key === "Enter") void submitRename();
              }}
              className="font-mono uppercase"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={renamingPending} onClick={() => setRenaming(null)}>
              Annuler
            </Button>
            <Button variant="ledger" disabled={!newCode.trim() || renamingPending} onClick={submitRename}>
              {renamingPending ? "En cours…" : "Confirmer"}
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
        onConfirm={async () => {
          if (toDelete) await removeCode(toDelete.code);
        }}
      />
    </div>
  );
}
