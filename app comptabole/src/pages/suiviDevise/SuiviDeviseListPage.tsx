import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CircleDollarSign, Plus, Trash2 } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmt } from "@/lib/etatsFinanciers/postes";
import { useSocieteById } from "@/store/data";
import { useSuiviDevise } from "@/store/suiviDevise";
import type { SuiviDeviseResume } from "@/store/suiviDevise";

const DEVISES = ["EUR", "USD", "TND"];

export function SuiviDeviseListPage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const list = useSuiviDevise((s) => s.list);
  const loading = useSuiviDevise((s) => s.loadingList);
  const fetchList = useSuiviDevise((s) => s.fetchList);
  const clearList = useSuiviDevise((s) => s.clearList);
  const create = useSuiviDevise((s) => s.create);
  const remove = useSuiviDevise((s) => s.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [client, setClient] = useState("");
  const [exercice, setExercice] = useState(String(new Date().getFullYear()));
  const [devise, setDevise] = useState("EUR");
  const [soldeOuverture, setSoldeOuverture] = useState("0");
  const [toDelete, setToDelete] = useState<SuiviDeviseResume | null>(null);

  useEffect(() => {
    fetchList(societeId);
    return () => clearList();
  }, [societeId, fetchList, clearList]);

  async function submitCreate() {
    if (!client.trim()) return;
    try {
      const f = await create({
        societeId,
        client: client.trim(),
        exercice: exercice.trim(),
        devise,
        soldeOuverture: Number(soldeOuverture) || 0,
      });
      toast.success("Fiche créée");
      setCreateOpen(false);
      setClient("");
      setSoldeOuverture("0");
      navigate(`/suivi-devise/${societeId}/${f.id}`);
    } catch {
      // fail() du store affiche déjà le toast d'erreur (ex. fiche en doublon)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        breadcrumb={
          <button
            onClick={() => navigate("/suivi-devise")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Toutes les sociétés
          </button>
        }
        title={`Suivi client devise — ${societe?.raisonSociale ?? "Société"}`}
        description="Une fiche par client, exercice et devise — un même client en EUR et en USD sur la même année, c'est deux fiches."
        actions={
          <Button variant="ledger" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle fiche
          </Button>
        }
      />

      {list.length === 0 ? (
        <LedgerSheet className="mt-4 flex-1">
          <EmptyState
            icon={CircleDollarSign}
            title={loading ? "Chargement…" : "Aucune fiche"}
            description="Créez une fiche pour suivre les ventes export d'un client."
            action={
              <Button variant="ledger" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nouvelle fiche
              </Button>
            }
          />
        </LedgerSheet>
      ) : (
        <LedgerSheet className="mt-4 flex-1">
          {list.map((f, i) => (
            <div
              key={f.id}
              className={
                "flex items-center justify-between gap-3 border-border px-[18px] py-3 " +
                (i === list.length - 1 ? "" : "border-b")
              }
            >
              <button
                onClick={() => navigate(`/suivi-devise/${societeId}/${f.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-semibold text-foreground">
                  {f.client}
                  {f.exercice && <span className="text-muted-foreground"> — {f.exercice}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total ventes {fmt(f.totalVentes)} {f.devise} · Solde{" "}
                  <span className={f.solde > 0.01 ? "font-semibold text-warning" : ""}>
                    {fmt(f.solde)} {f.devise}
                  </span>
                </p>
              </button>
              <button
                onClick={() => setToDelete(f)}
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </LedgerSheet>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle fiche</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="suivi-client">Client</Label>
              <Input
                id="suivi-client"
                autoFocus
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Ex. GROUP BYOUT EZZ COMPANY"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="suivi-exercice">Exercice</Label>
                <Input
                  id="suivi-exercice"
                  value={exercice}
                  onChange={(e) => setExercice(e.target.value)}
                  placeholder="Ex. 2025"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCreate();
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select value={devise} onValueChange={setDevise}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVISES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suivi-solde-ouverture">Solde d'ouverture (facultatif)</Label>
              <Input
                id="suivi-solde-ouverture"
                type="number"
                step="any"
                value={soldeOuverture}
                onChange={(e) => setSoldeOuverture(e.target.value)}
                placeholder="0"
                className="text-right tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Report de l'exercice précédent (ex. « Avoir 31/12/2022 »), inclus tel quel dans le solde.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button variant="ledger" disabled={!client.trim()} onClick={submitCreate}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette fiche ?"
        description={
          <>
            La fiche <span className="font-medium text-foreground">{toDelete?.client}</span> sera
            définitivement supprimée, avec ses lots, factures et mouvements.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (toDelete) remove(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
