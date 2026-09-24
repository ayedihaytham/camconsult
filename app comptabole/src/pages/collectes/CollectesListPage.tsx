import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, MoreHorizontal, Trash2 } from "lucide-react";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import { StatusDot } from "@/components/ledger/StatusDot";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerFooter,
  OperationalLedgerToolbar,
  OperationalMobilePagination,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { useDataTable } from "@/components/data-table/useDataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocietes } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import { initials } from "@/lib/utils";
import { isOverdueCollection } from "@/lib/dashboard/dashboardData";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import {
  filterCollectes,
  formatCollecteDeadline,
  getCollecteStatusPresentation,
  getCollecteLensCounts,
  getCollecteNextAction,
  type CollecteDeadlineFilter,
  type CollecteLens,
} from "@/lib/collecte/collectionList";
import type { Collecte, CollecteStatut } from "@/types";
import { CollecteCreateDialog } from "./CollecteCreateDialog";

export function CollectesListPage() {
  const navigate = useNavigate();
  const { isAdmin, isCollaborateur: canCreate, poste } = usePermissions();
  const isSocieteEmploye = poste === "societe_employe";
  const societes = useSocietes();
  const list = useCollectes((s) => s.list);
  const loading = useCollectes((s) => s.loadingList);
  const fetchList = useCollectes((s) => s.fetchList);
  const create = useCollectes((s) => s.create);
  const remove = useCollectes((s) => s.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Collecte | null>(null);
  const [vue, setVue] = useState<CollecteLens>("actives");
  const [query, setQuery] = useState("");
  const [societeId, setSocieteId] = useState("all");
  const [periode, setPeriode] = useState("all");
  const [statut, setStatut] = useState<CollecteStatut | "all">("all");
  const [echeance, setEcheance] = useState<CollecteDeadlineFilter>("all");

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const societesById = useMemo(() => new Map(societes.map((societe) => [societe.id, societe.raisonSociale])), [societes]);
  const socNom = useCallback((id: string) => societesById.get(id) ?? "Société", [societesById]);
  const periodeLabel = (value: string) => value.trim() || "Période non renseignée";
  const counts = useMemo(() => getCollecteLensCounts(list), [list]);
  const collectionSummary = useMemo(() => {
    const now = new Date();
    return {
      enCours: list.filter((c) => c.statut === "brouillon" || c.statut === "transmis" || c.statut === "a_corriger").length,
      enRetard: list.filter((c) => isOverdueCollection(c, now)).length,
      aCorriger: list.filter((c) => c.statut === "a_corriger").length,
    };
  }, [list]);

  const shown = useMemo(() => list.filter((collecte) =>
    vue === "toutes" ? true : vue === "archivees" ? collecte.statut === "archive" : collecte.statut !== "archive",
  ), [list, vue]);
  const visibleSocietes = useMemo(() => [...new Set(shown.map((c) => c.societeId))]
    .map((id) => ({ id, name: socNom(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr")), [shown, socNom]);
  const periodes = useMemo(() => [...new Set(shown.map((c) => c.periode.trim()).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a, "fr")), [shown]);
  const filtered = useMemo(() => filterCollectes(list, {
    lens: vue,
    query,
    societeId: societeId === "all" ? "" : societeId,
    periode: periode === "all" ? "" : periode,
    statut,
    echeance,
  }, socNom, new Date()), [list, vue, query, societeId, periode, statut, echeance, socNom]);
  const activeFilterCount = Number(societeId !== "all") + Number(periode !== "all") + Number(statut !== "all") + Number(echeance !== "all");
  const resetFilters = () => {
    setSocieteId("all");
    setPeriode("all");
    setStatut("all");
    setEcheance("all");
  };
  const resetKey = [vue, query, societeId, periode, statut, echeance].join("|");

  const columns = useMemo<ColumnDef<Collecte, unknown>[]>(() => [
    {
      id: "societePeriode",
      accessorFn: (collecte) => `${socNom(collecte.societeId)} ${collecte.periode}`,
      header: "Société · période",
      cell: ({ row }) => <CollecteIdentity collecte={row.original} name={socNom(row.original.societeId)} />,
      meta: { label: "Société · période", headerClassName: "w-[31%]", cellClassName: "w-[31%]" },
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => <CollecteStatus statut={row.original.statut} />,
      meta: { label: "Statut", headerClassName: "w-[15%]", cellClassName: "w-[15%]" },
    },
    {
      id: "echeance",
      accessorFn: (collecte) => collecte.echeance ?? "",
      header: "Échéance",
      cell: ({ row }) => {
        return <CollecteDeadline collecte={row.original} />;
      },
      meta: { label: "Échéance", headerClassName: "w-[18%]", cellClassName: "w-[18%]" },
    },
    {
      id: "suivi",
      accessorFn: (collecte) => collecte.majLe,
      header: "Suivi",
      cell: ({ row }) => (
        <div className="min-w-0 text-[11px] leading-snug">
          <span className="block truncate font-semibold tabular-nums text-foreground/80">{formatTableauCount(row.original.onglets.length)}</span>
          <span className="block truncate text-muted-foreground">{formatCollecteUpdate(row.original.majLe)}</span>
        </div>
      ),
      meta: { label: "Suivi", headerClassName: "w-[17%]", cellClassName: "w-[17%]" },
    },
    {
      id: "etape",
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <Link
          to={`/collectes/${row.original.id}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-h-9 items-center gap-1 whitespace-nowrap text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {getCollecteNextAction(row.original.statut, { isAdmin, isSocieteEmploye })}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ),
      meta: { label: "Étape suivante", headerClassName: "w-[13%]", cellClassName: "w-[13%]" },
    },
    ...(isAdmin ? [{
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => <CollecteActions collecte={row.original} socNom={socNom} onDelete={setToDelete} onOpen={() => navigate(`/collectes/${row.original.id}`)} />,
      meta: { label: "Actions", headerClassName: "w-[6%]", cellClassName: "w-[6%]" },
    } satisfies ColumnDef<Collecte, unknown>] : []),
  ], [socNom, isAdmin, isSocieteEmploye, navigate]);

  const table = useDataTable({
    columns,
    data: filtered,
    getRowId: (collecte) => collecte.id,
    initialSorting: [{ id: "suivi", desc: true }],
    pageSize: 5,
    resetKey,
  });

  const filters = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <FilterSelect label="Société" value={societeId} onValueChange={setSocieteId}>
        <SelectItem value="all">Toutes les sociétés</SelectItem>
        {visibleSocietes.map((societe) => <SelectItem key={societe.id} value={societe.id}>{societe.name}</SelectItem>)}
      </FilterSelect>
      <FilterSelect label="Période" value={periode} onValueChange={setPeriode}>
        <SelectItem value="all">Toutes les périodes</SelectItem>
        {periodes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
      </FilterSelect>
      <FilterSelect label="Statut" value={statut} onValueChange={(value) => setStatut(value as CollecteStatut | "all")}>
        <SelectItem value="all">Tous les statuts</SelectItem>
        {(["brouillon", "transmis", "valide", "a_corriger"] as const).map((value) => <SelectItem key={value} value={value}>{COLLECTE_STATUT_LABELS[value]}</SelectItem>)}
      </FilterSelect>
      <FilterSelect label="Échéance" value={echeance} onValueChange={(value) => setEcheance(value as CollecteDeadlineFilter)}>
        <SelectItem value="all">Toutes les échéances</SelectItem>
        <SelectItem value="late">Date dépassée</SelectItem>
        <SelectItem value="today">Aujourd’hui</SelectItem>
        <SelectItem value="upcoming">À venir</SelectItem>
        <SelectItem value="none">Sans échéance</SelectItem>
      </FilterSelect>
    </div>
  );
  const search = (
    <LedgerSearchFilter
      value={query}
      onValueChange={setQuery}
      onClearSearch={() => setQuery("")}
      placeholder="Rechercher une société ou une période"
      searchLabel="Rechercher une société ou une période"
      filterLabel="Filtrer les collectes"
      activeFilterCount={activeFilterCount}
      onReset={resetFilters}
    >
      {filters}
    </LedgerSearchFilter>
  );
  const lensControl = (
    <LedgerSegmented
      ariaLabel="Vue des collectes"
      value={vue}
      onChange={setVue}
      options={[
        { value: "actives", label: `Actives (${counts.actives})` },
        { value: "archivees", label: `Archivées (${counts.archivees})` },
        { value: "toutes", label: `Toutes (${counts.toutes})` },
      ]}
    />
  );
  const emptyMessage = loading ? "Chargement…" : "Aucune collecte.";

  return (
    <div className={`flex min-w-0 flex-1 flex-col ${canCreate ? "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-0" : ""}`}>
      <SignatureLedgerBanner
        className="mb-0 sm:mb-2"
        variant="process"
        eyebrow="Clients & travail · Process Ledger"
        title="Collecte de pièces"
        description={canCreate ? "Classeurs confiés aux clients pour saisie et retour au cabinet." : "Classeurs à remplir et transmettre à votre cabinet."}
        metrics={[
          { label: "En cours", value: collectionSummary.enCours, loading },
          { label: "En retard", value: collectionSummary.enRetard, tone: "destructive", loading },
          { label: "À corriger", value: collectionSummary.aCorriger, tone: "warning", loading },
        ]}
        action={canCreate ? { label: "Nouvelle collecte", onClick: () => setCreateOpen(true) } : undefined}
      />

      <LedgerWorkSurface className="collectes-work-surface">
        <div className="collectes-lenses">{lensControl}</div>
        <OperationalLedgerToolbar
          label="Outils des collectes"
          search={search}
          tools={<CollecteTools table={table} />}
        />
        <OperationalMobileUtility label="Recherche et filtres des collectes">
          {search}
        </OperationalMobileUtility>
        <OperationalContentHeader>
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">Registre des collectes</h2>
            <p className="hidden truncate text-[11px] text-muted-foreground md:block">Suivi des transmissions et corrections</p>
          </div>
          {!loading && <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">{filtered.length} dossier{filtered.length === 1 ? "" : "s"} visible{filtered.length === 1 ? "" : "s"}</span>}
        </OperationalContentHeader>

        {!loading && filtered.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-5">
            <p className="text-sm text-muted-foreground">
              {query || activeFilterCount > 0
                ? "Aucune collecte ne correspond à ces critères."
                : list.length === 0
                  ? "Aucune collecte."
                  : vue === "archivees"
                    ? "Aucune collecte archivée."
                    : "Aucune collecte active."}
            </p>
            {(query || activeFilterCount > 0) && <Button type="button" variant="link" className="h-auto px-0 pt-1" onClick={() => { setQuery(""); resetFilters(); }}>Effacer la recherche et les filtres</Button>}
          </div>
        ) : (
          <DataTable
            className="collectes-ledger-table ledger-work-table min-w-0 [&>div:last-child]:space-y-0"
            desktopDensity="ledger"
            desktopVariant="register"
            table={table}
            isLoading={loading}
            emptyMessage={emptyMessage}
            onRowClick={(row) => navigate(`/collectes/${row.original.id}`)}
            getRowClassName={(row) => row.original.statut === "archive" ? "collectes-archived-row" : undefined}
            footer={<OperationalLedgerFooter table={table} itemLabel="collectes" />}
            mobileFooter={<OperationalMobilePagination table={table} itemLabel="collectes" />}
            mobileRow={(row) => <CollecteMobileRow collecte={row.original} socNom={socNom} isAdmin={isAdmin} isSocieteEmploye={isSocieteEmploye} onDelete={setToDelete} onOpen={() => navigate(`/collectes/${row.original.id}`)} />}
          />
        )}
      </LedgerWorkSurface>

      {canCreate && <OperationalFab label="Nouvelle collecte" onClick={() => setCreateOpen(true)} />}
      {canCreate && <CollecteCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={async (data) => {
        const collecte = await create(data);
        toast.success("Collecte créée", { description: `${socNom(collecte.societeId)} — ${periodeLabel(collecte.periode)}` });
        navigate(`/collectes/${collecte.id}`);
      }} />}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette collecte ?"
        description={<>La collecte <span className="font-medium text-foreground">{toDelete ? `${socNom(toDelete.societeId)} — ${periodeLabel(toDelete.periode)}` : ""}</span> et toutes les données saisies seront supprimées.</>}
        confirmLabel="Supprimer"
        onConfirm={() => { if (toDelete) remove(toDelete.id); setToDelete(null); }}
      />
    </div>
  );
}

function FilterSelect({ label, value, onValueChange, children }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = `collectes-filter-${label.toLocaleLowerCase("fr").replace(/\s+/g, "-")}`;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function CollecteTools({ table }: { table: ReturnType<typeof useDataTable<Collecte>> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-primary"
          aria-label="Outils des collectes"
        >
          Outils
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Affichage</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DataTableViewOptions table={table} placement="submenu" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollecteActions({ collecte, socNom, onDelete, onOpen }: {
  collecte: Collecte;
  socNom: (id: string) => string;
  onDelete: (collecte: Collecte) => void;
  onOpen: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="size-11 lg:size-8" aria-label={`Actions pour ${socNom(collecte.societeId)}, ${collecte.periode.trim() || "période non renseignée"}`} onClick={(event) => event.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}><ArrowRight /> Ouvrir la collecte</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(collecte)}><Trash2 /> Supprimer…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollecteIdentity({ collecte, name }: { collecte: Collecte; name: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-[5px] border border-border bg-secondary/60 text-[10px] font-extrabold text-primary">
        {initials(name)}
      </span>
      <span className="min-w-0">
        <Link
          to={`/collectes/${collecte.id}`}
          onClick={(event) => event.stopPropagation()}
          className={`block truncate text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${collecte.statut === "archive" ? "text-muted-foreground" : "text-primary"}`}
          title={name}
        >
          {name}
        </Link>
        <span className="block truncate text-[11px] text-muted-foreground">{collecte.periode.trim() || "Période non renseignée"}</span>
      </span>
    </div>
  );
}

function CollecteStatus({ statut }: { statut: CollecteStatut }) {
  const status = getCollecteStatusPresentation(statut);
  return (
    <StatusDot
      tone={status.tone}
      label={statut === "transmis" ? "Transmis" : status.label}
      className={`text-[11px] font-semibold ${statut === "archive" ? "text-muted-foreground" : "text-foreground/80"}`}
    />
  );
}

function formatCollecteUpdate(value: string) {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}),
  });
  return `Mis à jour le ${formatter.format(date)}`;
}

function formatTableauCount(count: number) {
  return `${count} tableau${count === 1 ? "" : "x"}`;
}

function CollecteDeadline({ collecte }: { collecte: Collecte }) {
  const now = new Date();
  const overdue = isOverdueCollection(collecte, now);
  const [date, state] = formatCollecteDeadline(collecte, now).split(" · ");
  return (
    <span className="flex min-w-0 flex-col gap-0.5 text-[11px] leading-snug tabular-nums">
      <span className="text-[10px] text-muted-foreground">Échéance</span>
      <span className={`font-semibold ${collecte.echeance ? "text-foreground/85" : "text-muted-foreground"}`}>{date}</span>
      {state && <span className={`text-[10px] ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{state === "Dépassée" ? "Date dépassée" : state}</span>}
    </span>
  );
}

function CollecteMobileRow({ collecte, socNom, isAdmin, isSocieteEmploye, onDelete, onOpen }: {
  collecte: Collecte;
  socNom: (id: string) => string;
  isAdmin: boolean;
  isSocieteEmploye: boolean;
  onDelete: (collecte: Collecte) => void;
  onOpen: () => void;
}) {
  return (
    <article className={`min-w-0 border-b border-border/80 px-3 py-2.5 ${collecte.statut === "archive" ? "bg-muted/20" : "bg-transparent"}`}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><CollecteIdentity collecte={collecte} name={socNom(collecte.societeId)} /></div>
        {isAdmin && <CollecteActions collecte={collecte} socNom={socNom} onDelete={onDelete} onOpen={onOpen} />}
      </div>
      <div className="mt-2.5 flex min-w-0 items-start justify-between gap-3">
        <div className="pt-1"><CollecteStatus statut={collecte.statut} /></div>
        <div className="shrink-0 text-right"><CollecteDeadline collecte={collecte} /></div>
      </div>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">{formatTableauCount(collecte.onglets.length)} · {formatCollecteUpdate(collecte.majLe)}</span>
        <Link to={`/collectes/${collecte.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {getCollecteNextAction(collecte.statut, { isAdmin, isSocieteEmploye })}<ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
