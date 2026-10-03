import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CircleDollarSign, Trash2 } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerToolbar,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
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
  const [recherche, setRecherche] = useState("");

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

  const avecSolde = list.filter((f) => f.solde > 0.01).length;
  const q = recherche.trim().toLowerCase();
  const visibles = !q
    ? list
    : list.filter((f) => [f.client, f.exercice, f.devise].some((v) => (v || "").toLowerCase().includes(q)));

  const searchControl = (
    <Input data-tour="devise-search"
      value={recherche}
      onChange={(e) => setRecherche(e.target.value)}
      placeholder="Rechercher un client, un exercice ou une devise…"
      className="h-9"
    />
  );

  return (
    <div className="flex flex-1 flex-col">
      <SignatureLedgerBanner
        icon={CircleDollarSign}
        className="mb-0 sm:mb-2"
        eyebrow="Comptabilité · Financial Ledger"
        title={societe?.raisonSociale ?? "Société"}
        description="Une fiche par client, exercice et devise — un même client en EUR et en USD sur la même année, c'est deux fiches."
        metrics={[
          { label: "Fiches", value: list.length, loading },
          { label: "Avec solde dû", value: avecSolde, tone: avecSolde > 0 ? "warning" : "default", loading },
        ]}
        action={{ label: "Nouvelle fiche", onClick: () => setCreateOpen(true) }}
      />

      <LedgerWorkSurface className="ledger-soft-rows mt-3">
        <OperationalLedgerToolbar label="Recherche du suivi client devise" search={searchControl} />
        <OperationalMobileUtility label="Recherche du suivi client devise">{searchControl}</OperationalMobileUtility>
        <OperationalContentHeader>
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">Registre des fiches</h2>
            <p className="hidden truncate text-[11px] text-muted-foreground md:block">Client, exercice et devise</p>
          </div>
          {!loading && (
            <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
              {visibles.length} fiche{visibles.length === 1 ? "" : "s"} visible{visibles.length === 1 ? "" : "s"}
            </span>
          )}
        </OperationalContentHeader>

        {visibles.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-5">
            <div className="flex items-start gap-3 text-sm">
              <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">{loading ? "Chargement…" : list.length === 0 ? "Aucune fiche" : "Aucun résultat"}</p>
                <p className="text-muted-foreground">
                  {list.length > 0
                    ? "Aucune fiche ne correspond à ce filtre."
                    : "Créez une fiche pour suivre les ventes export d'un client."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div data-tour="devise-register" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead className="text-right">Total ventes</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/suivi-devise/${societeId}/${f.id}`)}
                  >
                    <TableCell>
                      <span className="ledger-soft-name block font-semibold text-foreground">{f.client}</span>
                      {f.exercice && <span className="block text-xs text-muted-foreground">{f.exercice}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.devise}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {fmt(f.totalVentes)} {f.devise}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right font-semibold tabular-nums",
                        f.solde > 0.01 && "text-warning",
                      )}
                    >
                      {fmt(f.solde)} {f.devise}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete(f);
                        }}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Supprimer"
                        aria-label={`Supprimer la fiche ${f.client}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </LedgerWorkSurface>

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
