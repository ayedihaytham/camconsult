import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  Calculator,
  Download,
  FileText,
  MoreHorizontal,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FinancialIdentityHeader } from "./FinancialIdentityHeader";
import {
  FinancialViewNavigation,
  financialViewLabel,
  type FinancialView,
} from "./FinancialViewNavigation";
import {
  ROWS_BILAN_ACTIF,
  ROWS_BILAN_PASSIF,
  ROWS_ETAT_RESULTAT,
  resultatNet,
} from "@/lib/etatsFinanciers/postes";
import {
  massesCouvertesParRegistre,
  mergeImmoMouvements,
} from "@/lib/etatsFinanciers/immobilisationsRegistre";
import { FinancialTable } from "./FinancialTable";
import { AffectatSyntheseTable } from "./AffectatSyntheseTable";
import { SigTable } from "./SigTable";
import { ImmoVariationTable } from "./ImmoVariationTable";
import { FluxTable } from "./FluxTable";
import { TdrfTable } from "./TdrfTable";
import { ControleTable } from "./ControleTable";
import { NotesView } from "./NotesView";
import { ImmobilisationsRegistrePage } from "./ImmobilisationsRegistrePage";
import {
  controleSheet,
  downloadSectionPdf,
  downloadSingleSheetXlsx,
  exportClasseurExcel,
  exportClasseurPdf,
  loadNotesSheet,
  financialSheet,
  fluxSheet,
  immoSheet,
  registreSheet,
  sigSheet,
  syntheseSheet,
  tdrfSheet,
  type Aoa,
} from "@/lib/etatsFinanciers/exportClasseur";
import type { Balance } from "@/types";

type Vue = FinancialView;

const SECTION_SHEET_NAMES: Record<Exclude<Vue, "exercices">, string> = {
  actif: "Bilan Actif",
  passif: "Bilan Passif",
  resultat: "Etat de résultat",
  sig: "SIG",
  synthese: "Synthèse AFFECTAT",
  immo: "TAB VAR Immob",
  registre: "Registre immobilisations",
  flux: "Flux",
  tdrf: "TDRF",
  controle: "Contrôle",
  notes: "Notes",
};

/** Sections dont le tableau commence par une ligne d'en-têtes (« Actif | 2025 | 2024 »). */
const SECTIONS_AVEC_EN_TETES = new Set<Vue>([
  "actif",
  "passif",
  "resultat",
  "synthese",
]);

const VUE_DESCRIPTIONS: Record<Vue, string> = {
  exercices: "Une balance importée ou saisie par exercice.",
  actif: "Actif comparé entre les exercices disponibles.",
  passif: "Capitaux propres et passifs par exercice.",
  resultat: "Produits et charges selon les postes AFFECTAT.",
  sig: "Soldes intermédiaires de gestion.",
  synthese: "Soldes regroupés par code AFFECTAT brut.",
  immo: "Variations des immobilisations par exercice.",
  registre: "Registre des immobilisations du dossier.",
  flux: "Flux de trésorerie par exercice.",
  tdrf: "Détermination du résultat fiscal.",
  controle: "Contrôles et rapprochements des données comptables.",
  notes: "Notes et informations complémentaires des exercices.",
};

function societyMonogram(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function BalancesListPage() {
  const { societeId = "" } = useParams();
  const navigate = useNavigate();
  const societe = useSocieteById(societeId);

  const list = useBalances((s) => s.list);
  const loading = useBalances((s) => s.loadingList);
  const listError = useBalances((s) => s.listError);
  const fetchList = useBalances((s) => s.fetchList);
  const clearList = useBalances((s) => s.clearList);
  const create = useBalances((s) => s.create);
  const remove = useBalances((s) => s.remove);

  const postesParExercice = useBalances((s) => s.postesParExercice);
  const loadingPostes = useBalances((s) => s.loadingPostes);
  const postesError = useBalances((s) => s.postesError);
  const fetchPostes = useBalances((s) => s.fetchPostes);
  const clearPostes = useBalances((s) => s.clearPostes);

  const grilleCodes = useBalances((s) => s.grilleCodes);
  const fetchGrille = useBalances((s) => s.fetchGrille);
  const grilleLoading = useBalances((s) => s.grilleLoading);
  const grilleError = useBalances((s) => s.grilleError);

  const immoMouvements = useBalances((s) => s.immoMouvements);
  const fetchImmoMouvements = useBalances((s) => s.fetchImmoMouvements);
  const clearImmoMouvements = useBalances((s) => s.clearImmoMouvements);
  const saveImmoMouvement = useBalances((s) => s.saveImmoMouvement);

  const financementMouvements = useBalances((s) => s.financementMouvements);
  const fetchFinancementMouvements = useBalances(
    (s) => s.fetchFinancementMouvements,
  );
  const clearFinancementMouvements = useBalances(
    (s) => s.clearFinancementMouvements,
  );
  const saveFinancementMouvement = useBalances(
    (s) => s.saveFinancementMouvement,
  );

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
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetchList(societeId).catch(() => {});
    return () => clearList();
  }, [societeId, fetchList, clearList]);

  useEffect(() => {
    if (vue === "exercices") return;
    void fetchPostes(societeId).catch(() => {});
    return () => clearPostes();
  }, [vue, societeId, fetchPostes, clearPostes]);

  useEffect(() => {
    if (vue !== "synthese") return;
    void fetchGrille().catch(() => {});
  }, [vue, fetchGrille]);

  useEffect(() => {
    if (
      vue !== "immo" &&
      vue !== "flux" &&
      vue !== "notes" &&
      vue !== "controle"
    )
      return;
    fetchImmoMouvements(societeId);
    return () => clearImmoMouvements();
  }, [vue, societeId, fetchImmoMouvements, clearImmoMouvements]);

  useEffect(() => {
    if (vue !== "flux" && vue !== "controle") return;
    fetchFinancementMouvements(societeId);
    return () => clearFinancementMouvements();
  }, [vue, societeId, fetchFinancementMouvements, clearFinancementMouvements]);

  useEffect(() => {
    if (vue !== "tdrf" && vue !== "controle") return;
    fetchTdrfLignes(societeId);
    fetchTdrfParametres(societeId);
    return () => {
      clearTdrfLignes();
      clearTdrfParametres();
    };
  }, [
    vue,
    societeId,
    fetchTdrfLignes,
    clearTdrfLignes,
    fetchTdrfParametres,
    clearTdrfParametres,
  ]);

  useEffect(() => {
    if (
      vue !== "immo" &&
      vue !== "flux" &&
      vue !== "notes" &&
      vue !== "registre" &&
      vue !== "controle"
    )
      return;
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
    if (!exercice.trim() || creating) return;
    setCreating(true);
    try {
      const b = await create(societeId, exercice.trim());
      toast.success("Exercice créé");
      setCreateOpen(false);
      setExercice("");
      navigate(`/etats-financiers/${societeId}/${b.id}`);
    } catch {
      // fail() du store affiche déjà le toast d'erreur (ex. exercice en doublon)
    } finally {
      setCreating(false);
    }
  }

  const [exporting, setExporting] = useState(false);
  const societeName = societe?.raisonSociale ?? "Société";

  /** Tableau de la seule section affichée (onglet actif) — le même pour
   * l'Excel et le PDF ; réutilise les données déjà chargées, sauf « Notes »
   * qui refait son propre fetch (voir loadNotesSheet). */
  async function sectionAoa(v: Exclude<Vue, "exercices">): Promise<Aoa> {
    switch (v) {
      case "actif":
        return financialSheet(ROWS_BILAN_ACTIF, postesParExercice, "Actif");
      case "passif":
        return financialSheet(
          ROWS_BILAN_PASSIF,
          postesParExercice,
          "Capitaux propres et passifs",
          (ex) => {
            const p = postesParExercice.find((e) => e.exercice === ex);
            return { resultat_exercice: p ? resultatNet(p.postes) : 0 };
          },
        );
      case "resultat":
        return financialSheet(
          ROWS_ETAT_RESULTAT,
          postesParExercice,
          "Etat de résultat",
        );
      case "sig":
        return sigSheet(postesParExercice);
      case "synthese":
        return syntheseSheet(postesParExercice, grilleCodes);
      case "immo":
        return immoSheet(postesParExercice, effectiveImmoMouvements);
      case "registre":
        return registreSheet(postesParExercice, immoBiens, immoCategories);
      case "flux":
        return fluxSheet(
          postesParExercice,
          effectiveImmoMouvements,
          financementMouvements,
        );
      case "tdrf":
        return tdrfSheet(postesParExercice, tdrfLignes, tdrfParametres);
      case "controle":
        return controleSheet(
          postesParExercice,
          effectiveImmoMouvements,
          financementMouvements,
          tdrfLignes,
          tdrfParametres,
        );
      case "notes":
        return loadNotesSheet(societeId, societeName, postesParExercice);
    }
  }

  /** Classeur complet (vue « Exercices ») ou section active, en Excel ou en vrai PDF. */
  async function handleExport(format: "xlsx" | "pdf") {
    setExporting(true);
    try {
      if (vue === "exercices") {
        await (format === "xlsx" ? exportClasseurExcel : exportClasseurPdf)(
          societeId,
          societeName,
        );
        toast.success(
          format === "xlsx" ? "Classeur exporté" : "PDF enregistré",
        );
      } else {
        const sheetName = SECTION_SHEET_NAMES[vue];
        const aoa = await sectionAoa(vue);
        if (format === "xlsx")
          await downloadSingleSheetXlsx(aoa, sheetName, societeName);
        else
          await downloadSectionPdf(
            aoa,
            sheetName,
            societeName,
            SECTIONS_AVEC_EN_TETES.has(vue),
          );
        toast.success(
          format === "xlsx"
            ? `${sheetName} exporté`
            : `${sheetName} — PDF enregistré`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-w-0">
      <h1 className="sr-only">États financiers — {societe?.raisonSociale ?? "Société"}</h1>
      <FinancialIdentityHeader
          variant="dossier"
          eyebrow="Dossier financier"
          title={societe?.raisonSociale ?? "Société"}
          description="Exercices, balances et états comptables du dossier."
          monogram={societyMonogram(societe?.raisonSociale ?? "S")}
          details={[
            { label: "Code", value: societe?.code || "—" },
            { label: "RNE", value: societe?.rne || "Non renseigné" },
          ]}
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-h-11 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground lg:min-h-8">
                    Outils
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => void handleExport("pdf")}
                    disabled={exporting || list.length === 0 || (vue !== "exercices" && postesParExercice.length === 0)}
                    title={vue === "exercices" ? "Tout le classeur en PDF" : "Cette section en PDF"}
                  >
                    <FileText /> Enregistrer PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => navigate(vue === "exercices" ? `/etats-financiers/${societeId}/imprimer` : `/etats-financiers/${societeId}/imprimer/${vue}`)}
                    disabled={list.length === 0 || (vue !== "exercices" && postesParExercice.length === 0)}
                  >
                    <Printer /> Imprimer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void handleExport("xlsx")}
                    disabled={exporting || list.length === 0 || (vue !== "exercices" && postesParExercice.length === 0)}
                    title={vue === "exercices" ? "Tout le classeur en Excel" : "Cette section en Excel"}
                  >
                    <Download /> {exporting ? "Export…" : "Excel"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="accent" size="sm" className="min-h-11 lg:min-h-8" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" /> Nouvel exercice
              </Button>
            </>
          }
        />
      <div aria-hidden="true" className="my-2 h-px bg-accent" />

      <div className="grid min-w-0 grid-cols-1 border border-border bg-card lg:grid-cols-[208px_minmax(0,1fr)]">
        <FinancialViewNavigation value={vue} onChange={setVue} />

        <main className="min-w-0 px-3 py-3 lg:px-5 lg:py-4">
          <div className="mb-2 flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-primary">
                {financialViewLabel(vue)}
              </h2>
              <p className="text-xs text-muted-foreground">
                {VUE_DESCRIPTIONS[vue]}
              </p>
            </div>
            {vue === "exercices" ? (
              <p className="mt-0.5 text-[0.65rem] font-normal uppercase tracking-wide text-muted-foreground sm:mt-0 sm:font-medium">
                Portée des exports · classeur complet
              </p>
            ) : postesParExercice.length > 0 && (
              <p className="text-xs tabular-nums text-muted-foreground">
                Exercices ·{" "}
                {postesParExercice.map((item) => item.exercice).join(" · ")}
              </p>
            )}
          </div>

          {vue === "synthese" && grilleLoading && (
            <p role="status" className="mb-2 text-xs text-muted-foreground">
              Chargement des libellés AFFECTAT…
            </p>
          )}
          {vue === "synthese" && grilleError && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-l-2 border-warning bg-warning/10 px-3 py-2 text-xs">
              <p role="status" className="text-foreground">
                Les libellés de la grille ne sont pas disponibles; les codes et montants restent visibles.
              </p>
              <Button variant="outline" size="sm" onClick={() => void fetchGrille().catch(() => {})}>
                Réessayer
              </Button>
            </div>
          )}

          {vue === "exercices" ? (
            loading ? (
              <div
                aria-label="Chargement des exercices"
                className="divide-y divide-border border-y border-border"
              >
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="flex min-h-14 items-center justify-between gap-4 px-3"
                  >
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : listError ? (
              <div className="border-y border-border px-3 py-5">
                <EmptyState
                  icon={Calculator}
                  title="Exercices indisponibles"
                  description={listError}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void fetchList(societeId).catch(() => {})}
                    >
                      Réessayer
                    </Button>
                  }
                />
              </div>
            ) : list.length === 0 ? (
              <div className="border-y border-border px-3 pb-5 pt-0">
                <EmptyState
                  icon={Calculator}
                  title="Aucun exercice"
                  description="Créez un exercice (ex. « 2025 ») pour saisir ou importer sa balance."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 lg:min-h-8"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus className="size-4" />
                      Nouvel exercice
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <ul className="hidden border-t border-border md:block" aria-label="Registre des exercices">
                  {list.map((balance) => (
                    <li key={balance.id} className="grid min-h-[59px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{balance.exercice}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Mis à jour le {formatDate(balance.majLe)}{balance.note ? ` · ${balance.note}` : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/etats-financiers/${societeId}/${balance.id}`)}>
                        Ouvrir la balance <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions de l'exercice ${balance.exercice}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(balance)}>
                            <Trash2 /> Supprimer l'exercice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
                <ul
                  className="divide-y divide-border border-y border-border md:hidden"
                  aria-label="Registre des exercices"
                >
                  {list.map((balance) => (
                    <li
                      key={balance.id}
                      className="flex min-h-[68px] items-center gap-3 px-2 py-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/etats-financiers/${societeId}/${balance.id}`,
                          )
                        }
                        className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="block font-semibold text-primary">
                          Exercice {balance.exercice}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          Mis à jour le {formatDate(balance.majLe)}
                          {balance.note ? ` · ${balance.note}` : ""}
                        </span>
                        <span className="mt-1 inline-block text-xs font-semibold text-primary">
                          Ouvrir la balance →
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer l'exercice ${balance.exercice}`}
                        onClick={() => setToDelete(balance)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : loadingPostes ? (
            <div
              aria-label={`Chargement de ${financialViewLabel(vue)}`}
              className="space-y-2 border-y border-border py-3"
            >
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </div>
          ) : postesError ? (
            <div className="border-y border-border px-3 py-5">
              <EmptyState
                icon={Calculator}
                title="Données financières indisponibles"
                description={postesError}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchPostes(societeId).catch(() => {})}
                  >
                    Réessayer
                  </Button>
                }
              />
            </div>
          ) : postesParExercice.length === 0 ? (
            <div className="border-y border-border px-3 py-4">
              <EmptyState
                icon={Calculator}
                title="Aucune donnée"
                description="Importez ou saisissez une balance dans un exercice pour construire cette vue."
              />
            </div>
          ) : vue === "actif" ? (
            <div className="min-w-0 overflow-x-auto border-y border-border bg-background">
              <FinancialTable rows={ROWS_BILAN_ACTIF} exercices={postesParExercice} titre="Actif" />
            </div>
          ) : vue === "passif" ? (
            <div className="min-w-0 overflow-x-auto border-y border-border bg-background">
              <FinancialTable
                rows={ROWS_BILAN_PASSIF}
                exercices={postesParExercice}
                extraByExercice={(ex) => {
                  const p = postesParExercice.find((e) => e.exercice === ex);
                  return { resultat_exercice: p ? resultatNet(p.postes) : 0 };
                }}
                titre="Capitaux propres et passifs"
              />
            </div>
          ) : vue === "resultat" ? (
            <div className="min-w-0 overflow-x-auto border-y border-border bg-background">
              <FinancialTable rows={ROWS_ETAT_RESULTAT} exercices={postesParExercice} titre="État de résultat" />
            </div>
          ) : vue === "sig" ? (
            <div className="min-w-0 overflow-x-auto border-y border-border bg-background"><SigTable exercices={postesParExercice} /></div>
          ) : vue === "synthese" ? (
            <div className="min-w-0 overflow-x-auto border-y border-border bg-background"><AffectatSyntheseTable exercices={postesParExercice} grilleCodes={grilleCodes} /></div>
          ) : vue === "immo" ? (
            <ImmoVariationTable exercices={postesParExercice} immoMouvements={effectiveImmoMouvements} readOnlyMasses={readOnlyMasses} onSave={(ex, masse, data) => saveImmoMouvement(societeId, ex, masse, data)} />
          ) : vue === "registre" ? (
            <ImmobilisationsRegistrePage societeId={societeId} exercices={postesParExercice} />
          ) : vue === "flux" ? (
            <FluxTable exercices={postesParExercice} immoMouvements={effectiveImmoMouvements} financementMouvements={financementMouvements} onSaveFinancement={(ex, data) => saveFinancementMouvement(societeId, ex, data)} />
          ) : vue === "tdrf" ? (
            <TdrfTable exercices={postesParExercice} lignes={tdrfLignes} parametres={tdrfParametres} onAdd={(ex, kind, libelle, montant) => addTdrfLigne(societeId, ex, kind, libelle, montant)} onUpdate={updateTdrfLigne} onRemove={removeTdrfLigne} onSaveParametres={(ex, data) => saveTdrfParametres(societeId, ex, data)} />
          ) : vue === "controle" ? (
            <ControleTable exercices={postesParExercice} immoMouvements={effectiveImmoMouvements} financementMouvements={financementMouvements} tdrfLignes={tdrfLignes} tdrfParametres={tdrfParametres} />
          ) : (
            <NotesView societeId={societeId} societeName={societe?.raisonSociale ?? ""} exercices={postesParExercice} immoMouvements={effectiveImmoMouvements} />
          )}
        </main>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => !creating && setCreateOpen(open)}
      >
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
            <Button
              variant="outline"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="ledger"
              disabled={!exercice.trim() || creating}
              onClick={submitCreate}
            >
              {creating ? "Création…" : "Créer"}
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
            <span className="font-medium text-foreground">
              {toDelete?.exercice}
            </span>{" "}
            sera définitivement supprimé, avec sa balance et toutes les saisies
            qui lui sont propres (TAB VAR Immob, mouvements de financement,
            TDRF, Notes de l'exercice).
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (toDelete) await remove(toDelete.id);
        }}
      />
    </div>
  );
}
