import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Calculator, Download, FileText, Plus, Trash2 } from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
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
import { formatDate } from "@/lib/utils";
import { useSocieteById } from "@/store/data";
import { useBalances } from "@/store/balances";
import { useImmobilisations } from "@/store/immobilisations";
import { ROWS_BILAN_ACTIF, ROWS_BILAN_PASSIF, ROWS_ETAT_RESULTAT, resultatNet } from "@/lib/etatsFinanciers/postes";
import { massesCouvertesParRegistre, mergeImmoMouvements } from "@/lib/etatsFinanciers/immobilisationsRegistre";
import { FinancialTable } from "./FinancialTable";
import { AffectatSyntheseTable } from "./AffectatSyntheseTable";
import { SigTable } from "./SigTable";
import { ImmoVariationTable } from "./ImmoVariationTable";
import { FluxTable } from "./FluxTable";
import { TdrfTable } from "./TdrfTable";
import { NotesView } from "./NotesView";
import { ImmobilisationsRegistrePage } from "./ImmobilisationsRegistrePage";
import { exportClasseurExcel } from "@/lib/etatsFinanciers/exportClasseur";
import type { Balance } from "@/types";

type Vue =
  | "exercices"
  | "actif"
  | "passif"
  | "resultat"
  | "sig"
  | "synthese"
  | "immo"
  | "registre"
  | "flux"
  | "tdrf"
  | "notes";

const VUE_OPTIONS: { value: Vue; label: string }[] = [
  { value: "exercices", label: "Exercices" },
  { value: "actif", label: "Bilan Actif" },
  { value: "passif", label: "Bilan Passif" },
  { value: "resultat", label: "Etat de résultat" },
  { value: "sig", label: "SIG" },
  { value: "synthese", label: "Synthèse AFFECTAT" },
  { value: "immo", label: "TAB VAR Immob" },
  { value: "registre", label: "Registre immobilisations" },
  { value: "flux", label: "Flux de trésorerie" },
  { value: "tdrf", label: "TDRF" },
  { value: "notes", label: "Notes" },
];

export function BalancesListPage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const list = useBalances((s) => s.list);
  const loading = useBalances((s) => s.loadingList);
  const fetchList = useBalances((s) => s.fetchList);
  const clearList = useBalances((s) => s.clearList);
  const create = useBalances((s) => s.create);
  const remove = useBalances((s) => s.remove);

  const postesParExercice = useBalances((s) => s.postesParExercice);
  const loadingPostes = useBalances((s) => s.loadingPostes);
  const fetchPostes = useBalances((s) => s.fetchPostes);
  const clearPostes = useBalances((s) => s.clearPostes);

  const grilleCodes = useBalances((s) => s.grilleCodes);
  const fetchGrille = useBalances((s) => s.fetchGrille);

  const immoMouvements = useBalances((s) => s.immoMouvements);
  const fetchImmoMouvements = useBalances((s) => s.fetchImmoMouvements);
  const clearImmoMouvements = useBalances((s) => s.clearImmoMouvements);
  const saveImmoMouvement = useBalances((s) => s.saveImmoMouvement);

  const financementMouvements = useBalances((s) => s.financementMouvements);
  const fetchFinancementMouvements = useBalances((s) => s.fetchFinancementMouvements);
  const clearFinancementMouvements = useBalances((s) => s.clearFinancementMouvements);
  const saveFinancementMouvement = useBalances((s) => s.saveFinancementMouvement);

  const tdrfLignes = useBalances((s) => s.tdrfLignes);
  const fetchTdrfLignes = useBalances((s) => s.fetchTdrfLignes);
  const clearTdrfLignes = useBalances((s) => s.clearTdrfLignes);
  const addTdrfLigne = useBalances((s) => s.addTdrfLigne);
  const updateTdrfLigne = useBalances((s) => s.updateTdrfLigne);
  const removeTdrfLigne = useBalances((s) => s.removeTdrfLigne);

  const tdrfParametres = useBalances((s) => s.tdrfParametres);
  const fetchTdrfParametres = useBalances((s) => s.fetchTdrfParametres);
  const clearTdrfParametres = useBalances((s) => s.clearTdrfParametres);
  const saveTdrfParametres = useBalances((s) => s.saveTdrfParametres);

  const immoCategories = useImmobilisations((s) => s.categories);
  const fetchImmoCategories = useImmobilisations((s) => s.fetchCategories);
  const immoBiens = useImmobilisations((s) => s.biens);
  const fetchImmoBiens = useImmobilisations((s) => s.fetchBiens);
  const clearImmoBiens = useImmobilisations((s) => s.clearBiens);

  const [createOpen, setCreateOpen] = useState(false);
  const [exercice, setExercice] = useState("");
  const [toDelete, setToDelete] = useState<Balance | null>(null);
  const [vue, setVue] = useState<Vue>("exercices");

  useEffect(() => {
    fetchList(societeId);
    return () => clearList();
  }, [societeId, fetchList, clearList]);

  useEffect(() => {
    if (vue === "exercices") return;
    fetchPostes(societeId);
    return () => clearPostes();
  }, [vue, societeId, fetchPostes, clearPostes]);

  useEffect(() => {
    if (vue !== "synthese") return;
    fetchGrille();
  }, [vue, fetchGrille]);

  useEffect(() => {
    if (vue !== "immo" && vue !== "flux" && vue !== "notes") return;
    fetchImmoMouvements(societeId);
    return () => clearImmoMouvements();
  }, [vue, societeId, fetchImmoMouvements, clearImmoMouvements]);

  useEffect(() => {
    if (vue !== "flux") return;
    fetchFinancementMouvements(societeId);
    return () => clearFinancementMouvements();
  }, [vue, societeId, fetchFinancementMouvements, clearFinancementMouvements]);

  useEffect(() => {
    if (vue !== "tdrf") return;
    fetchTdrfLignes(societeId);
    fetchTdrfParametres(societeId);
    return () => {
      clearTdrfLignes();
      clearTdrfParametres();
    };
  }, [vue, societeId, fetchTdrfLignes, clearTdrfLignes, fetchTdrfParametres, clearTdrfParametres]);

  useEffect(() => {
    if (vue !== "immo" && vue !== "flux" && vue !== "notes" && vue !== "registre") return;
    fetchImmoCategories();
    fetchImmoBiens(societeId);
    return () => clearImmoBiens();
  }, [vue, societeId, fetchImmoCategories, fetchImmoBiens, clearImmoBiens]);

  const readOnlyMasses = massesCouvertesParRegistre(immoBiens, immoCategories);
  const effectiveImmoMouvements = mergeImmoMouvements(
    societeId,
    postesParExercice,
    immoMouvements,
    immoBiens,
    immoCategories,
  );

  async function submitCreate() {
    if (!exercice.trim()) return;
    try {
      const b = await create(societeId, exercice.trim());
      toast.success("Exercice créé");
      setCreateOpen(false);
      setExercice("");
      navigate(`/etats-financiers/${societeId}/${b.id}`);
    } catch {
      // fail() du store affiche déjà le toast d'erreur (ex. exercice en doublon)
    }
  }

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportClasseurExcel(societeId, societe?.raisonSociale ?? "Société");
      toast.success("Classeur exporté");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        breadcrumb={
          <button
            onClick={() => navigate("/etats-financiers")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Toutes les sociétés
          </button>
        }
        title={`États financiers — ${societe?.raisonSociale ?? "Société"}`}
        description="Un exercice = une balance importée ou saisie, reclassée par code AFFECTAT."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/etats-financiers/${societeId}/imprimer`)}
              disabled={list.length === 0}
            >
              <FileText className="h-4 w-4" />
              Exporter PDF
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={exporting || list.length === 0}>
              <Download className="h-4 w-4" />
              {exporting ? "Export…" : "Exporter Excel"}
            </Button>
            <Button variant="ledger" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvel exercice
            </Button>
          </div>
        }
      />

      <div className="mt-4">
        <LedgerSegmented value={vue} onChange={setVue} options={VUE_OPTIONS} />
      </div>

      {vue === "exercices" ? (
        list.length === 0 ? (
          <LedgerSheet className="mt-4 flex-1">
            <EmptyState
              icon={Calculator}
              title={loading ? "Chargement…" : "Aucun exercice"}
              description="Créez un exercice (ex. « 2025 ») pour importer sa balance."
              action={
                <Button variant="ledger" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nouvel exercice
                </Button>
              }
            />
          </LedgerSheet>
        ) : (
          <LedgerSheet className="mt-4 flex-1">
            {list.map((b, i) => (
              <div
                key={b.id}
                className={
                  "flex items-center justify-between gap-3 border-border px-[18px] py-3 " +
                  (i === list.length - 1
                    ? ""
                    : (i + 1) % 5 === 0
                      ? "border-b-[1.5px] border-rule-strong"
                      : "border-b")
                }
              >
                <button
                  onClick={() => navigate(`/etats-financiers/${societeId}/${b.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-semibold text-foreground">
                    Exercice {b.exercice}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mis à jour le {formatDate(b.majLe)}
                    {b.note && ` · ${b.note}`}
                  </p>
                </button>
                <button
                  onClick={() => setToDelete(b)}
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </LedgerSheet>
        )
      ) : postesParExercice.length === 0 ? (
        <LedgerSheet className="mt-4 flex-1">
          <EmptyState
            icon={Calculator}
            title={loadingPostes ? "Chargement…" : "Aucune donnée"}
            description="Importez ou saisissez une balance dans un exercice pour voir ce tableau se construire."
          />
        </LedgerSheet>
      ) : vue === "actif" ? (
        <LedgerSheet className="mt-4 flex-1">
          <FinancialTable rows={ROWS_BILAN_ACTIF} exercices={postesParExercice} titre="Actif" />
        </LedgerSheet>
      ) : vue === "passif" ? (
        <LedgerSheet className="mt-4 flex-1">
          <FinancialTable
            rows={ROWS_BILAN_PASSIF}
            exercices={postesParExercice}
            extraByExercice={(ex) => {
              const p = postesParExercice.find((e) => e.exercice === ex);
              return { resultat_exercice: p ? resultatNet(p.postes) : 0 };
            }}
            titre="Capitaux propres et passifs"
          />
        </LedgerSheet>
      ) : vue === "resultat" ? (
        <LedgerSheet className="mt-4 flex-1">
          <FinancialTable rows={ROWS_ETAT_RESULTAT} exercices={postesParExercice} titre="Etat de résultat" />
        </LedgerSheet>
      ) : vue === "sig" ? (
        <div className="mt-4">
          <SigTable exercices={postesParExercice} />
        </div>
      ) : vue === "synthese" ? (
        <LedgerSheet className="mt-4 flex-1">
          <AffectatSyntheseTable exercices={postesParExercice} grilleCodes={grilleCodes} />
        </LedgerSheet>
      ) : vue === "immo" ? (
        <div className="mt-4">
          <ImmoVariationTable
            exercices={postesParExercice}
            immoMouvements={effectiveImmoMouvements}
            readOnlyMasses={readOnlyMasses}
            onSave={(ex, masse, data) => saveImmoMouvement(societeId, ex, masse, data)}
          />
        </div>
      ) : vue === "registre" ? (
        <div className="mt-4">
          <ImmobilisationsRegistrePage societeId={societeId} exercices={postesParExercice} />
        </div>
      ) : vue === "flux" ? (
        <div className="mt-4">
          <FluxTable
            exercices={postesParExercice}
            immoMouvements={effectiveImmoMouvements}
            financementMouvements={financementMouvements}
            onSaveFinancement={(ex, data) => saveFinancementMouvement(societeId, ex, data)}
          />
        </div>
      ) : vue === "tdrf" ? (
        <div className="mt-4">
          <TdrfTable
            exercices={postesParExercice}
            lignes={tdrfLignes}
            parametres={tdrfParametres}
            onAdd={(ex, kind, libelle, montant) => addTdrfLigne(societeId, ex, kind, libelle, montant)}
            onUpdate={updateTdrfLigne}
            onRemove={removeTdrfLigne}
            onSaveParametres={(ex, data) => saveTdrfParametres(societeId, ex, data)}
          />
        </div>
      ) : (
        <div className="mt-4">
          <NotesView
            societeId={societeId}
            societeName={societe?.raisonSociale ?? ""}
            exercices={postesParExercice}
            immoMouvements={effectiveImmoMouvements}
          />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvel exercice</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="exercice">Exercice</Label>
            <Input
              id="exercice"
              autoFocus
              value={exercice}
              onChange={(e) => setExercice(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
              }}
              placeholder="Ex. 2025"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button variant="ledger" disabled={!exercice.trim()} onClick={submitCreate}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cet exercice ?"
        description={
          <>
            L'exercice{" "}
            <span className="font-medium text-foreground">{toDelete?.exercice}</span> sera
            définitivement supprimé, avec sa balance et toutes les saisies qui lui sont
            propres (TAB VAR Immob, mouvements de financement, TDRF, Notes de l'exercice).
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
