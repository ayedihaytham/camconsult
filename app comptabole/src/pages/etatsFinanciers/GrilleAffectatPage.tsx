import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  GitBranch,
  Info,
  MoreHorizontal,
  PencilLine,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataTable } from "@/components/data-table/useDataTable";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerFooter,
  OperationalMobilePagination,
} from "@/components/ledger/OperationalLedgerLayout";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { GrilleAffectatPosteCombobox } from "./GrilleAffectatPosteCombobox";
import { usePageTour } from "@/components/tour/TourProvider";
import { useBalances } from "@/store/balances";
import { POSTE_OPTIONS } from "@/lib/etatsFinanciers/postes";
import type { GrilleAffectatCode } from "@/types";

const PAGE_SIZE = 7;
const PAGINATION_COLUMNS: ColumnDef<GrilleAffectatCode, unknown>[] = [
  { accessorKey: "code" },
];
type MappingFilter = "all" | "yes" | "no";
type SaveStatus = {
  field: "libelle" | "poste";
  state: "saving" | "saved" | "error";
};

function posteLabel(poste: string) {
  return (
    POSTE_OPTIONS.find((option) => option.value === poste)?.label ??
    "non assigné"
  );
}

export function GrilleAffectatPage() {
  const { start: startTour } = usePageTour();
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
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
  const [posteToConfirm, setPosteToConfirm] = useState<{
    code: GrilleAffectatCode;
    nextPoste: string;
  } | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [search, setSearch] = useState("");
  const [posteFilter, setPosteFilter] = useState<MappingFilter>("all");
  const [accountFilter, setAccountFilter] = useState<MappingFilter>("all");

  useEffect(() => {
    void fetchGrille().catch(() => {});
  }, [fetchGrille]);

  const accountCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const compte of comptes) {
      counts.set(
        compte.affectatCode,
        (counts.get(compte.affectatCode) ?? 0) + 1,
      );
    }
    return counts;
  }, [comptes]);
  const countFor = (code: string) => accountCounts.get(code) ?? 0;
  const activeFilterCount =
    Number(posteFilter !== "all") + Number(accountFilter !== "all");
  const filteredCodes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");
    return codes.filter((code) => {
      if (
        query &&
        ![code.code, code.libelle, posteLabel(code.poste), code.poste].some(
          (value) => value.toLocaleLowerCase("fr-FR").includes(query),
        )
      )
        return false;
      if (
        posteFilter !== "all" &&
        Boolean(code.poste) !== (posteFilter === "yes")
      )
        return false;
      if (
        accountFilter !== "all" &&
        countFor(code.code) > 0 !== (accountFilter === "yes")
      )
        return false;
      return true;
    });
  }, [codes, search, posteFilter, accountFilter, accountCounts]);

  function markSave(
    code: string,
    field: SaveStatus["field"],
    state: SaveStatus["state"],
  ) {
    setSaveStatus((previous) => ({ ...previous, [code]: { field, state } }));
  }

  async function saveLabel(code: GrilleAffectatCode) {
    const libelle = labelDrafts[code.code] ?? code.libelle;
    if (libelle === code.libelle || saveStatus[code.code]?.state === "saving")
      return;
    markSave(code.code, "libelle", "saving");
    try {
      await updateCode(code.code, { libelle });
      markSave(code.code, "libelle", "saved");
    } catch {
      markSave(code.code, "libelle", "error");
    } finally {
      setLabelDrafts((previous) => {
        const next = { ...previous };
        delete next[code.code];
        return next;
      });
    }
  }

  async function confirmPosteChange() {
    if (!posteToConfirm) return;
    const { code, nextPoste } = posteToConfirm;
    markSave(code.code, "poste", "saving");
    try {
      await updateCode(code.code, { poste: nextPoste });
      markSave(code.code, "poste", "saved");
    } catch (error) {
      markSave(code.code, "poste", "error");
      throw error;
    }
  }

  const normalizedNewCode = newCode.trim().toUpperCase();
  const unchangedCode = normalizedNewCode === renaming?.code;
  const merging = codes.some(
    (code) => code.code === normalizedNewCode && code.code !== renaming?.code,
  );

  async function submitRename() {
    if (
      !renaming ||
      !normalizedNewCode ||
      unchangedCode ||
      renamingPending ||
      saveStatus[renaming.code]?.state === "saving"
    )
      return;
    setRenamingPending(true);
    try {
      await renameCode(renaming.code, normalizedNewCode);
      toast.success(merging ? "Codes fusionnés" : "Code renommé");
      setRenaming(null);
      setNewCode("");
    } catch {
      // Le store affiche l'erreur; conserver le dialogue et la saisie permet de corriger.
    } finally {
      setRenamingPending(false);
    }
  }

  function renderLabel(code: GrilleAffectatCode) {
    return (
      <>
        <Input
          value={labelDrafts[code.code] ?? code.libelle}
          placeholder="Libellé (facultatif pour l'instant)"
          className="h-8 border border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring focus-visible:ring-2"
          aria-label={`Libellé du code ${code.code}`}
          disabled={saveStatus[code.code]?.state === "saving"}
          onChange={(event) => {
            setLabelDrafts((previous) => ({
              ...previous,
              [code.code]: event.target.value,
            }));
            setSaveStatus((previous) => {
              const next = { ...previous };
              delete next[code.code];
              return next;
            });
          }}
          onBlur={() => void saveLabel(code)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        {saveStatus[code.code]?.field === "libelle" && (
          <p
            aria-live="polite"
            className={`px-2 text-[0.7rem] ${saveStatus[code.code].state === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {saveStatus[code.code].state === "saving"
              ? "Enregistrement…"
              : saveStatus[code.code].state === "saved"
                ? "Enregistré"
                : "Échec : valeur rétablie. Réessayez."}
          </p>
        )}
      </>
    );
  }

  function renderPoste(code: GrilleAffectatCode) {
    return (
      <>
        <GrilleAffectatPosteCombobox
          code={code.code}
          value={code.poste}
          valueLabel={code.poste ? posteLabel(code.poste) : "— Non assigné —"}
          disabled={saveStatus[code.code]?.state === "saving"}
          onSelect={(nextPoste) => {
            if (nextPoste !== code.poste) {
              setPosteToConfirm({ code, nextPoste });
            }
          }}
        />
        {saveStatus[code.code]?.field === "poste" && (
          <p
            aria-live="polite"
            className={`px-1 text-[0.7rem] ${saveStatus[code.code].state === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {saveStatus[code.code].state === "saving"
              ? "Enregistrement…"
              : saveStatus[code.code].state === "saved"
                ? "Enregistré"
                : "Échec : poste inchangé. Réessayez."}
          </p>
        )}
      </>
    );
  }

  function renderActions(code: GrilleAffectatCode) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-tour="affectat-actions"
            variant="ghost"
            size="icon-sm"
            disabled={saveStatus[code.code]?.state === "saving"}
            className="size-11 text-muted-foreground lg:size-8"
            aria-label={`Actions pour le code ${code.code}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setRenaming(code);
              setNewCode(code.code);
            }}
          >
            <PencilLine className="h-4 w-4" /> Renommer ou fusionner
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setToDelete(code)}
          >
            <Trash2 className="h-4 w-4" /> Retirer du référentiel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const table = useDataTable({
    columns: PAGINATION_COLUMNS,
    data: filteredCodes,
    getRowId: (code) => code.code,
    pageSize: PAGE_SIZE,
    resetKey: [search, posteFilter, accountFilter].join("|"),
  });

  const filters = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="affectat-poste-filter" className="text-xs">
          Poste global
        </Label>
        <select
          id="affectat-poste-filter"
          value={posteFilter}
          onChange={(event) => {
            setPosteFilter(event.target.value as MappingFilter);
            table.setPageIndex(0);
          }}
          className="h-11 w-full rounded-sm border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
        >
          <option value="all">Tous les postes</option>
          <option value="yes">Poste assigné</option>
          <option value="no">Poste non assigné</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="affectat-accounts-filter" className="text-xs">
          Comptes globaux
        </Label>
        <select
          id="affectat-accounts-filter"
          value={accountFilter}
          onChange={(event) => {
            setAccountFilter(event.target.value as MappingFilter);
            table.setPageIndex(0);
          }}
          className="h-11 w-full rounded-sm border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
        >
          <option value="all">Tous les codes</option>
          <option value="yes">Avec comptes rattachés</option>
          <option value="no">Sans compte rattaché</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <SignatureLedgerBanner
        icon={GitBranch}
        variant="compact"
        className="mb-0 sm:mb-2"
        eyebrow="Paramétrage cabinet · Référentiel global"
        title="Grille AFFECTAT"
        description="Référentiel global de reclassement du cabinet, appliqué aux sociétés autorisées."
        metrics={[]}
        contextLabel="Référentiel global du cabinet"
      />

      <LedgerWorkSurface className="mt-1">
        <div
          role="toolbar"
          aria-label="Recherche et filtres des codes AFFECTAT"
          className="flex min-w-0 items-center gap-2 border-b border-border/80 px-3 py-1.5"
        >
          <div data-tour="affectat-search" className="min-w-0 flex-1">
            <LedgerSearchFilter
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                table.setPageIndex(0);
              }}
              onClearSearch={() => {
                setSearch("");
                table.setPageIndex(0);
              }}
              placeholder="Rechercher un code, un libellé ou un poste"
              mobilePlaceholder="Code, libellé ou poste…"
              searchLabel="Rechercher un code, un libellé ou un poste AFFECTAT"
              filterLabel="Filtrer les codes AFFECTAT"
              activeFilterCount={activeFilterCount}
              onReset={() => {
                setPosteFilter("all");
                setAccountFilter("all");
                table.setPageIndex(0);
              }}
            >
              {filters}
            </LedgerSearchFilter>
          </div>
          <Popover open={helpOpen} onOpenChange={setHelpOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={helpTriggerRef}
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Aide sur la grille AFFECTAT"
                className="h-11 shrink-0 gap-1.5 px-2 text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
              >
                <Info aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Aide</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className="max-h-[75dvh] w-[min(25rem,calc(100vw-1.5rem))] overflow-y-auto p-3.5"
            >
              <button
                type="button"
                className="mb-3 flex min-h-11 w-full items-center rounded border border-border px-3 text-left text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setHelpOpen(false);
                  requestAnimationFrame(() => startTour(helpTriggerRef.current));
                }}
              >
                Visite guidée
              </button>
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Comprendre la grille
              </h2>
              <dl className="divide-y divide-border/70 border-y border-border/70 text-xs">
                <div className="grid gap-1 py-2 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-3">
                  <dt className="font-mono font-semibold text-foreground">
                    Code brut
                  </dt>
                  <dd className="text-muted-foreground">
                    Le code conservé sur la ligne de balance importée ou saisie.
                  </dd>
                </div>
                <div className="grid gap-1 py-2 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-3">
                  <dt className="font-mono font-semibold text-foreground">
                    Poste global
                  </dt>
                  <dd className="text-muted-foreground">
                    Le poste comptable utilisé pour présenter les états
                    financiers de l’ensemble du cabinet.
                  </dd>
                </div>
                <div className="grid gap-1 py-2 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-3">
                  <dt className="font-mono font-semibold text-foreground">
                    Dérogation société
                  </dt>
                  <dd className="text-muted-foreground">
                    Une association compte → code peut être limitée à un
                    dossier; elle prend alors priorité sur l’association
                    globale.
                  </dd>
                </div>
              </dl>
              <p className="pt-2 text-xs text-muted-foreground">
                Les comptes rattachés affichés ici sont les associations
                globales; les dérogations société ne sont pas comptées.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <OperationalContentHeader className="items-start sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col items-stretch gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <h2 data-tour="affectat-register" className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">
              Registre des codes AFFECTAT
            </h2>
            <div className="flex min-w-0 items-baseline justify-between gap-2 sm:contents">
              <p className="min-w-0 truncate text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Référentiel global du cabinet
              </p>
              {!loading && !error && (
                <span
                  className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground sm:hidden"
                  aria-live="polite"
                >
                  {filteredCodes.length} code
                  {filteredCodes.length === 1 ? "" : "s"} visibles
                </span>
              )}
            </div>
          </div>
          {!loading && !error && (
            <span
              className="hidden shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground sm:inline"
              aria-live="polite"
            >
              {filteredCodes.length} code{filteredCodes.length === 1 ? "" : "s"}{" "}
              visible{filteredCodes.length === 1 ? "" : "s"}
            </span>
          )}
        </OperationalContentHeader>

        {loading ? (
          <div
            aria-label="Chargement de la grille AFFECTAT"
            className="divide-y divide-border border-b border-border"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="flex min-h-12 items-center gap-4 px-3"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="border-b border-border px-3 py-4">
            <EmptyState
              title="Grille indisponible"
              description={error}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchGrille().catch(() => {})}
                >
                  Réessayer
                </Button>
              }
            />
          </div>
        ) : codes.length === 0 ? (
          <div className="border-b border-border px-3 py-3">
            <EmptyState
              title="Aucun code pour le moment"
              description="Les codes apparaîtront ici dès qu'une ligne de balance leur sera assignée."
            />
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="border-b border-border px-4 py-5">
            <p className="text-sm text-muted-foreground">
              Aucun code ne correspond à cette recherche ou à ces filtres.
            </p>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 pt-1"
              onClick={() => {
                setSearch("");
                setPosteFilter("all");
                setAccountFilter("all");
                table.setPageIndex(0);
              }}
            >
              Effacer la recherche et les filtres
            </Button>
          </div>
        ) : (
          <div className="min-w-0">
            <div data-tour="affectat-rows-desktop" className="hidden border-y border-border/80 lg:block">
              <Table className="table-fixed ledger-table-density">
                <TableHeader className="[&_tr]:bg-transparent [&_tr]:hover:bg-transparent [&_th]:h-8 [&_th]:px-3 [&_th]:text-[0.65rem] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead scope="col" className="w-[12%] pl-4">
                      Code
                    </TableHead>
                    <TableHead scope="col" className="w-[29%]">
                      Libellé
                    </TableHead>
                    <TableHead scope="col" className="w-[37%]">
                      Poste (Bilan/CPC)
                    </TableHead>
                    <TableHead scope="col" className="w-[16%] text-right">
                      Comptes rattachés
                    </TableHead>
                    <TableHead scope="col" className="w-[6%] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map(({ original: code }) => (
                    <TableRow
                      key={code.code}
                      className="group bg-transparent hover:bg-secondary/45 [&>td]:align-middle"
                    >
                      <TableCell className="pl-4 font-mono text-xs font-bold text-foreground">
                        {code.code}
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        {renderLabel(code)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        {renderPoste(code)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {countFor(code.code)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {renderActions(code)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <OperationalLedgerFooter
                table={table}
                itemLabel={filteredCodes.length === 1 ? "code" : "codes"}
              />
            </div>
            <div data-tour="affectat-rows-mobile" className="lg:hidden">
              {table.getRowModel().rows.map(({ original: code }) => {
                const count = countFor(code.code);
                return (
                  <article
                    key={code.code}
                    aria-label={"Code AFFECTAT " + code.code}
                    className="min-w-0 border-b border-border/70 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {code.code}
                      </span>
                      {renderActions(code)}
                    </div>
                    <div className="mt-1 min-w-0">{renderLabel(code)}</div>
                    <div className="mt-1.5 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Poste
                      </span>
                      {renderPoste(code)}
                    </div>
                    <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                      {count} compte{count === 1 ? "" : "s"} global
                      {count === 1 ? "" : "aux"} rattaché
                      {count === 1 ? "" : "s"}
                    </p>
                  </article>
                );
              })}
              <OperationalMobilePagination
                table={table}
                itemLabel={filteredCodes.length === 1 ? "code" : "codes"}
                touchTargets
              />
            </div>
          </div>
        )}
      </LedgerWorkSurface>
      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(o) => !o && setRenaming(null)}
      >
        <DialogContent className="max-w-sm" aria-busy={renamingPending}>
          <DialogHeader>
            <DialogTitle>Renommer « {renaming?.code} »</DialogTitle>
            <DialogDescription>
              {merging
                ? `Fusion globale du cabinet avec « ${normalizedNewCode} » : les lignes de balance et les associations compte → code, y compris les dérogations société, utiliseront le code cible. Son libellé et son poste sont conservés; les états financiers des sociétés concernées suivront ce poste.`
                : "Le renommage s’applique à tout le cabinet : lignes de balance, associations de comptes globales et dérogations société utiliseront le nouveau code. Le libellé et le poste actuels sont conservés."}
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
            <Button
              variant="outline"
              disabled={renamingPending}
              onClick={() => setRenaming(null)}
            >
              Annuler
            </Button>
            <Button
              variant="ledger"
              disabled={
                !normalizedNewCode ||
                unchangedCode ||
                renamingPending ||
                (renaming
                  ? saveStatus[renaming.code]?.state === "saving"
                  : false)
              }
              onClick={submitRename}
            >
              {renamingPending ? "En cours…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(posteToConfirm)}
        onOpenChange={(open) => !open && setPosteToConfirm(null)}
        title={`Modifier le poste global du code ${posteToConfirm?.code.code ?? ""} ?`}
        description={
          <>
            Ce changement s’applique au référentiel de tout le cabinet. Les
            états financiers des sociétés qui utilisent ce code présenteront
            désormais ses lignes{" "}
            {posteToConfirm?.nextPoste ? (
              <>
                dans le poste{" "}
                <span className="font-medium text-foreground">
                  {posteLabel(posteToConfirm.nextPoste)}
                </span>
                .
              </>
            ) : (
              "comme non affectées tant qu’aucun poste ne sera choisi."
            )}
          </>
        }
        confirmLabel="Changer le poste"
        destructive={false}
        onConfirm={confirmPosteChange}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Retirer ce code du référentiel ?"
        description={
          <>
            Le code{" "}
            <span className="font-medium text-foreground">
              {toDelete?.code}
            </span>{" "}
            sera retiré du référentiel global du cabinet. Les lignes de balance
            et leurs codes bruts ne seront pas modifiés, mais sans ce poste
            global leurs montants apparaîtront comme non affectés dans les états
            financiers des sociétés concernées. Le code peut réapparaître lors
            d’une nouvelle affectation.
          </>
        }
        confirmLabel="Retirer"
        onConfirm={async () => {
          if (toDelete) {
            await removeCode(toDelete.code);
            toast.success("Code retiré du référentiel");
          }
        }}
      />
    </div>
  );
}
