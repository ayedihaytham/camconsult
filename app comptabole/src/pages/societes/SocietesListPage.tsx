import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  Download,
  Filter,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Printer,
  Search,
  Settings2,
  Trash2,
  Eye,
} from "lucide-react";
import type { ColumnDef, Table as TanstackTable } from "@tanstack/react-table";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { StatutDot } from "@/components/ledger/StatusDot";
import { FilterChip } from "@/components/ledger/FilterChip";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { useDataTable } from "@/components/data-table/useDataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { STATUT_LABELS } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRows, type ExportFormat } from "@/lib/export";
import { printTable } from "@/lib/print";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS } from "@/lib/societeTheme";
import {
  useData,
  useSocietes,
  useTaches,
  nextSocieteCode,
} from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import type { Societe, SocieteTheme, Statut } from "@/types";
import { SocieteFormSheet, type SocieteFormValues } from "./SocieteFormSheet";
import { SocieteViewSheet } from "./SocieteViewSheet";

const MONOGRAM_TONES = [
  "border-primary/15 bg-primary/[0.07] text-primary",
  "border-border bg-secondary text-primary/80",
  "border-accent/35 bg-accent/10 text-primary",
] as const;

function societeInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function monogramTone(seed: string) {
  const index = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return MONOGRAM_TONES[index % MONOGRAM_TONES.length];
}

function BulkActionsMenu({
  inverse = false,
  onExport,
  onSetTheme,
  onSetInactive,
}: {
  inverse?: boolean;
  onExport?: () => void;
  onSetTheme: (theme: SocieteTheme) => void;
  onSetInactive: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={inverse ? "ghost" : "outline"}
          size="sm"
          className={cn(
            "shadow-none",
            inverse &&
              "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
          )}
        >
          Actions
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExport && (
          <DropdownMenuItem onClick={onExport}>
            Exporter la sélection
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Modifier le type de structure
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEME_OPTIONS.map((theme) => (
              <DropdownMenuItem key={theme} onClick={() => onSetTheme(theme)}>
                {theme}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onSetInactive}>
          Marquer inactif
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SocietesFilterMenu({
  onSetStatut,
  onSetTheme,
}: {
  onSetStatut: (statut: Statut) => void;
  onSetTheme: (theme: SocieteTheme) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shadow-none"
        >
          <Filter className="size-3.5" />
          Filtrer
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Type de structure</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEME_OPTIONS.map((theme) => (
              <DropdownMenuItem key={theme} onClick={() => onSetTheme(theme)}>
                {theme}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Statut</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {(Object.keys(STATUT_LABELS) as Statut[]).map((statut) => (
              <DropdownMenuItem
                key={statut}
                onClick={() => onSetStatut(statut)}
              >
                {STATUT_LABELS[statut]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SocietesUtilityMenu({
  table,
  onExport,
  onPrint,
}: {
  table: TanstackTable<Societe>;
  onExport: (format: ExportFormat) => void;
  onPrint: () => void;
}) {
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide() && column.accessorFn);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="shadow-none">
          <Settings2 className="hidden size-3.5 sm:block" />
          <span className="hidden sm:inline">Outils</span>
          <MoreHorizontal className="size-4 sm:hidden" />
          <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
          <span className="sr-only sm:hidden">Outils de la liste</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="size-4" />
            Exporter
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onExport("csv")}>
              CSV (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("xlsx")}>
              Excel (.xlsx)
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPrint}>
          <Printer className="size-4" />
          Imprimer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Settings2 className="size-4" />
            Colonnes
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {hideableColumns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(visible) => column.toggleVisibility(visible)}
              >
                {column.columnDef.meta?.label ?? column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SocietesListPage() {
  const navigate = useNavigate();
  const allRows = useSocietes();
  const { isAdmin, isCollaborateur, can, canSeeSociete } = usePermissions();
  const rows = useMemo(
    () => allRows.filter((s) => canSeeSociete(s.id)),
    [allRows, canSeeSociete],
  );
  const registerSummary = useMemo(
    () => ({
      total: rows.length,
      actif: rows.filter((societe) => societe.statut === "actif").length,
      enAttente: rows.filter((societe) => societe.statut === "en_attente")
        .length,
      inactif: rows.filter((societe) => societe.statut === "inactif").length,
    }),
    [rows],
  );
  const canEdit = isAdmin || can("modifierSocietes");
  const canDelete = isAdmin || can("supprimer");

  const addSociete = useData((s) => s.addSociete);
  const updateSociete = useData((s) => s.updateSociete);
  const duplicateSociete = useData((s) => s.duplicateSociete);
  const deleteSocietes = useData((s) => s.deleteSocietes);
  const employes = useData((s) => s.employes);
  const taches = useTaches();
  const isDataLoading = useData((s) => !s.hydrated);
  const contactCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employes) {
      if (e.role === "societe_employe" && e.societeId)
        m.set(e.societeId, (m.get(e.societeId) ?? 0) + 1);
    }
    return m;
  }, [employes]);
  const openTaskCount = useMemo(() => {
    const counts = new Map<string, number>();
    if (!isCollaborateur) return counts;
    for (const task of taches) {
      if (task.statut !== "termine") {
        counts.set(task.societeId, (counts.get(task.societeId) ?? 0) + 1);
      }
    }
    return counts;
  }, [isCollaborateur, taches]);
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Societe | null>(null);
  const [viewing, setViewing] = useState<Societe | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [toDelete, setToDelete] = useState<Societe | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  function startCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      const matchQ =
        !q ||
        [s.raisonSociale, s.rne, s.tva, s.code, s.email]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchTheme = themeFilter === "all" || s.theme === themeFilter;
      const matchStatut = statutFilter === "all" || s.statut === statutFilter;
      return matchQ && matchTheme && matchStatut;
    });
  }, [rows, search, themeFilter, statutFilter]);

  const nextCode = useMemo(() => nextSocieteCode(allRows), [allRows]);

  useEffect(() => {
    const accessibleIds = new Set(rows.map((societe) => societe.id));
    setSelectedIds((current) => {
      const next = current.filter((id) => accessibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [rows]);

  function clearSelection() {
    setSelectedIds([]);
    setMobileSelectionMode(false);
  }

  async function handleSubmit(values: SocieteFormValues) {
    if (editing) {
      await updateSociete(editing.id, values);
      logJournal("modification", "societe", values.raisonSociale);
      toast.success("Société modifiée", { description: values.raisonSociale });
    } else {
      await addSociete(values);
      logJournal("creation", "societe", values.raisonSociale);
      toast.success("Société créée", { description: values.raisonSociale });
    }
  }

  function duplicate(s: Societe) {
    duplicateSociete(s.id, nextCode);
    logJournal("duplication", "societe", s.raisonSociale);
    toast.success("Société dupliquée", { description: s.raisonSociale });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteSocietes([toDelete.id]);
    logJournal("suppression", "societe", toDelete.raisonSociale);
    setSelectedIds((ids) => ids.filter((id) => id !== toDelete.id));
    toast.success("Société supprimée", { description: toDelete.raisonSociale });
    setToDelete(null);
  }

  async function confirmBulkDelete() {
    const count = selectedIds.length;
    const noms = rows
      .filter((s) => selectedIds.includes(s.id))
      .map((s) => s.raisonSociale);
    await deleteSocietes(selectedIds);
    logJournal(
      "suppression",
      "societe",
      `${selectedIds.length} sociétés : ${noms.join(", ")}`,
    );
    toast.success(`${count} sociétés supprimées`);
    clearSelection();
  }

  async function bulkSetTheme(theme: SocieteTheme) {
    const ids = selectedIds;
    await Promise.all(ids.map((id) => updateSociete(id, { theme })));
    logJournal(
      "modification",
      "societe",
      `${ids.length} sociétés — type de structure « ${theme} »`,
    );
    toast.success(
      `Type de structure « ${theme} » appliqué à ${ids.length} société${ids.length > 1 ? "s" : ""}`,
    );
    clearSelection();
  }

  async function bulkSetInactive() {
    const ids = selectedIds;
    await Promise.all(
      ids.map((id) => updateSociete(id, { statut: "inactif" })),
    );
    logJournal(
      "modification",
      "societe",
      `${ids.length} sociétés marquées inactives`,
    );
    toast.success(
      `${ids.length} société${ids.length > 1 ? "s" : ""} marquée${ids.length > 1 ? "s" : ""} inactive${ids.length > 1 ? "s" : ""}`,
    );
    clearSelection();
  }

  function handleExport(format: ExportFormat) {
    const source =
      selectedIds.length > 0
        ? filtered.filter((s) => selectedIds.includes(s.id))
        : filtered;
    exportRows(
      "societes",
      source,
      [
        { header: "Raison sociale", value: (s) => s.raisonSociale },
        { header: "RNE", value: (s) => s.rne },
        { header: "TVA", value: (s) => s.tva },
        { header: "Type de structure", value: (s) => s.theme },
        { header: "Code", value: (s) => s.code },
        { header: "Statut", value: (s) => s.statut },
        { header: "Téléphone", value: (s) => s.telephone },
        { header: "Email", value: (s) => s.email },
        { header: "Adresse", value: (s) => s.adresse },
      ],
      format,
    );
    toast.success(`Export ${format.toUpperCase()} généré`);
  }

  function handlePrint() {
    const source =
      selectedIds.length > 0
        ? filtered.filter((s) => selectedIds.includes(s.id))
        : filtered;
    printTable({
      title: "Liste des sociétés",
      subtitle:
        [
          themeFilter !== "all" && `Type de structure : ${themeFilter}`,
          statutFilter !== "all" && `Statut : ${statutFilter}`,
          search && `Recherche : « ${search} »`,
        ]
          .filter(Boolean)
          .join(" — ") || undefined,
      columns: [
        { header: "Raison sociale", value: (s) => s.raisonSociale },
        { header: "RNE", value: (s) => s.rne },
        { header: "TVA", value: (s) => s.tva },
        { header: "Type de structure", value: (s) => s.theme },
        { header: "Code", value: (s) => s.code },
        { header: "Statut", value: (s) => s.statut },
        { header: "Téléphone", value: (s) => s.telephone },
        { header: "Email", value: (s) => s.email },
      ],
      rows: source,
    });
  }

  function openView(s: Societe) {
    setViewing(s);
    setViewOpen(true);
  }

  function societeMenuActions(s: Societe) {
    return [
      {
        icon: Eye,
        label: "Voir la fiche",
        onClick: () => openView(s),
      },
      {
        icon: FolderOpen,
        label: "Mes dossiers",
        onClick: () => navigate(`/structuration?societe=${s.id}`),
      },
      ...(canEdit
        ? [
            { icon: Copy, label: "Dupliquer", onClick: () => duplicate(s) },
            {
              icon: Pencil,
              label: "Modifier",
              onClick: () => {
                setEditing(s);
                setFormOpen(true);
              },
            },
          ]
        : []),
      ...(canDelete
        ? [
            {
              icon: Trash2,
              label: "Supprimer",
              destructive: true,
              onClick: () => setToDelete(s),
            },
          ]
        : []),
    ];
  }

  const columns: ColumnDef<Societe>[] = [
    {
      id: "selection",
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => {
        const pageIds = table.getRowModel().rows.map((row) => row.original.id);
        const allSelected =
          pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
        const someSelected = pageIds.some((id) => selectedIds.includes(id));
        return (
          <Checkbox
            checked={
              allSelected ? true : someSelected ? "indeterminate" : false
            }
            onCheckedChange={() =>
              setSelectedIds(
                allSelected
                  ? selectedIds.filter((id) => !pageIds.includes(id))
                  : [...new Set([...selectedIds, ...pageIds])],
              )
            }
            aria-label="Sélectionner la page"
          />
        );
      },
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.includes(row.original.id)}
          onCheckedChange={() =>
            setSelectedIds((ids) =>
              ids.includes(row.original.id)
                ? ids.filter((id) => id !== row.original.id)
                : [...ids, row.original.id],
            )
          }
          onClick={(event) => event.stopPropagation()}
          aria-label={`Sélectionner ${row.original.raisonSociale}`}
        />
      ),
      meta: {
        headerClassName: "w-10",
        cellClassName: "w-10",
      },
    },
    {
      id: "raisonSociale",
      accessorFn: (societe) => societe.raisonSociale.toLowerCase(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Société" />
      ),
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "societes-ledger-monogram flex size-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tracking-wide",
                monogramTone(s.id),
              )}
              aria-hidden
            >
              {societeInitials(s.raisonSociale)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-4 text-foreground">
                {s.raisonSociale}
              </p>
              <p className="societes-ledger-meta truncate text-[11px] leading-4 text-muted-foreground">
                {s.theme} · {s.rne || "RNE non renseigné"}
              </p>
            </div>
          </div>
        );
      },
      meta: { label: "Société", headerClassName: "w-[38%]" },
    },
    {
      id: "contactCle",
      accessorFn: (societe) => contactCount.get(societe.id) ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Contact clé" />
      ),
      cell: ({ row }) => {
        const count = contactCount.get(row.original.id) ?? 0;
        if (count === 0) {
          return <span className="text-xs text-muted-foreground/70">—</span>;
        }

        return (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              Contact clé non désigné
            </p>
            <p className="societes-ledger-meta truncate text-[11px] text-muted-foreground">
              {count} contact{count > 1 ? "s" : ""} enregistré{count > 1 ? "s" : ""}
            </p>
          </div>
        );
      },
      meta: { label: "Contact clé", headerClassName: "w-[22%]" },
    },
    {
      id: "tachesOuvertes",
      accessorFn: (societe) => openTaskCount.get(societe.id) ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tâches en cours" />
      ),
      cell: ({ row }) => {
        if (!isCollaborateur) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const count = openTaskCount.get(row.original.id) ?? 0;
        return (
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {count}
          </span>
        );
      },
      meta: { label: "Tâches en cours", headerClassName: "w-32" },
    },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {row.original.code}
        </span>
      ),
      meta: { label: "Code", headerClassName: "w-24" },
    },
    {
      accessorKey: "statut",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Statut" />
      ),
      cell: ({ row }) => <StatutDot statut={row.original.statut} />,
      meta: { label: "Statut", headerClassName: "w-28" },
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div
            className="flex items-center justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <LedgerRowMenu actions={societeMenuActions(s)} />
          </div>
        );
      },
      meta: {
        headerClassName: "w-10",
        cellClassName: "w-10",
      },
    },
  ];

  const table = useDataTable({
    columns,
    data: filtered,
    getRowId: (societe) => societe.id,
    initialSorting: [{ id: "raisonSociale", desc: false }],
    resetKey: `${search}\u0000${themeFilter}\u0000${statutFilter}`,
  });
  const currentPageIds = table.getRowModel().rows.map((row) => row.original.id);
  const isCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedIds.includes(id));
  const isCurrentPagePartlySelected = currentPageIds.some((id) =>
    selectedIds.includes(id),
  );

  const emptyMessage =
    rows.length === 0
      ? canEdit
        ? "Aucune société enregistrée."
        : "Aucune société accessible."
      : "Aucune société ne correspond à votre recherche ou à vos filtres.";

  const hasActiveFilters = themeFilter !== "all" || statutFilter !== "all";
  const isMobileSelectionActive = mobileSelectionMode || selectedIds.length > 0;

  const filterChips = hasActiveFilters ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {themeFilter !== "all" && (
        <FilterChip
          label={`Type de structure : ${themeFilter}`}
          onRemove={() => setThemeFilter("all")}
        />
      )}
      {statutFilter !== "all" && (
        <FilterChip
          label={`Statut : ${STATUT_LABELS[statutFilter as Statut]}`}
          onRemove={() => setStatutFilter("all")}
        />
      )}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "societes-ledger-page flex min-w-0 flex-1 flex-col",
        canEdit && !isMobileSelectionActive && "pb-20 lg:pb-0",
      )}
    >
      <SignatureLedgerBanner
        className="mb-0 sm:mb-2"
        eyebrow="Clients & travail · Client Ledger"
        title="Sociétés"
        description={isAdmin
          ? "Registre des clients du cabinet"
          : "Registre des sociétés auxquelles vous avez accès"}
        metrics={[
          { label: "Sociétés", value: registerSummary.total },
          { label: "Actives", value: registerSummary.actif, tone: "success" },
          { label: "En attente", value: registerSummary.enAttente },
          { label: "Inactive", value: registerSummary.inactif },
        ]}
        action={canEdit ? { label: "Ajouter une société", onClick: startCreate } : undefined}
      />

      {selectedIds.length === 0 && (
        <div className="societes-ledger-toolbar mb-1 hidden min-w-0 items-center gap-2 border-y border-border/80 bg-secondary/45 px-2 py-1 lg:flex">
          <div className="relative min-w-0 max-w-2xl flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une société, RNE ou code"
              aria-label="Rechercher une société"
              className="h-8 bg-background pl-9 shadow-none"
            />
          </div>
          <SocietesFilterMenu
            onSetTheme={setThemeFilter}
            onSetStatut={setStatutFilter}
          />
          <div className="ml-auto">
            <SocietesUtilityMenu
              table={table}
              onExport={handleExport}
              onPrint={handlePrint}
            />
          </div>
        </div>
      )}

      {filterChips && selectedIds.length === 0 && (
        <div className="mb-2 hidden lg:block">{filterChips}</div>
      )}

      {!isMobileSelectionActive && (
        <div className="mb-0 min-w-0 space-y-2 bg-card px-3 py-2 sm:mb-3 sm:bg-transparent sm:px-0 sm:py-0 lg:hidden">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une société"
              aria-label="Rechercher une société"
              className="h-10 w-full bg-card pl-9 shadow-none"
            />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <SocietesFilterMenu
              onSetTheme={setThemeFilter}
              onSetStatut={setStatutFilter}
            />
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shadow-none"
                onClick={() => setMobileSelectionMode(true)}
              >
                Sélectionner
              </Button>
              <SocietesUtilityMenu
                table={table}
                onExport={handleExport}
                onPrint={handlePrint}
              />
            </div>
          </div>
          {filterChips}
        </div>
      )}

      {isMobileSelectionActive && (
        <div className="mb-0 flex min-w-0 items-center justify-between gap-3 bg-card px-3 py-2 sm:mb-2 sm:bg-transparent sm:px-0 sm:py-0 lg:hidden">
          <span className="truncate text-xs font-semibold text-foreground">
            {selectedIds.length} sélectionnée{selectedIds.length > 1 ? "s" : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 shadow-none"
            onClick={clearSelection}
          >
            Annuler
          </Button>
        </div>
      )}

      <div className="societes-ledger-register-heading flex min-w-0 items-center justify-between gap-3 border-b border-border/80 bg-card px-3 py-1 sm:bg-transparent sm:px-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <Checkbox
            checked={
              isCurrentPageSelected
                ? true
                : isCurrentPagePartlySelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={() =>
              setSelectedIds(
                isCurrentPageSelected
                  ? selectedIds.filter((id) => !currentPageIds.includes(id))
                  : [...new Set([...selectedIds, ...currentPageIds])],
              )
            }
            aria-label="Sélectionner la page"
            className="hidden lg:flex"
          />
          <div className="min-w-0">
            <h2>
              <DataTableColumnHeader
                column={table.getColumn("raisonSociale")!}
                title="Registre client"
                className="h-7 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
              />
            </h2>
          </div>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <DataTablePagination
            table={table}
            itemLabel="sociétés"
            variant="count"
          />
          <DataTablePagination
            table={table}
            itemLabel="sociétés"
            variant="controls"
          />
        </div>
        <DataTablePagination
          table={table}
          itemLabel="sociétés"
          variant="mobile"
          className="min-w-0 flex-1 justify-end border-0 p-0 lg:hidden"
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="hidden items-center justify-between gap-4 bg-primary px-3 py-2 text-primary-foreground lg:flex">
          <span className="text-sm font-semibold">
            {selectedIds.length} société{selectedIds.length > 1 ? "s" : ""}{" "}
            sélectionnée{selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => handleExport("xlsx")}
            >
              Exporter
            </Button>
            {canEdit && (
              <BulkActionsMenu
                inverse
                onSetTheme={(theme) => void bulkSetTheme(theme)}
                onSetInactive={() => void bulkSetInactive()}
              />
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-destructive/25 hover:text-primary-foreground"
                onClick={() => setBulkDeleteOpen(true)}
              >
                Supprimer
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={clearSelection}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      <DataTable
        className="societes-ledger-table bg-card sm:bg-transparent [&>div:last-child]:space-y-0"
        desktopDensity="compact"
        desktopVariant="register"
        table={table}
        emptyMessage={emptyMessage}
        isLoading={isDataLoading}
        getRowClassName={(row) =>
          selectedIds.includes(row.original.id)
            ? "bg-accent/[0.09] hover:bg-accent/[0.12] [&>td:first-child]:border-l [&>td:first-child]:border-accent"
            : undefined
        }
        onRowClick={(row) => openView(row.original)}
        mobileRow={(row) => {
          const s = row.original;
          const contacts = contactCount.get(s.id) ?? 0;
          const tasks = openTaskCount.get(s.id) ?? 0;
          const selected = selectedIds.includes(s.id);
          return (
            <article
              data-state={selected ? "selected" : undefined}
              className="relative min-w-0 border-b border-border/80 px-3 py-3 sm:px-1 data-[state=selected]:bg-accent/[0.09] data-[state=selected]:before:absolute data-[state=selected]:before:inset-y-2 data-[state=selected]:before:left-0 data-[state=selected]:before:w-px data-[state=selected]:before:bg-accent"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {isMobileSelectionActive && (
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() =>
                      setSelectedIds((ids) =>
                        selected
                          ? ids.filter((id) => id !== s.id)
                          : [...ids, s.id],
                      )
                    }
                    aria-label={`Sélectionner ${s.raisonSociale}`}
                    className="shrink-0"
                  />
                )}
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold tracking-wide",
                    monogramTone(s.id),
                  )}
                  aria-hidden
                >
                  {societeInitials(s.raisonSociale)}
                </span>
                <div className="min-w-0 flex-1">
                  {isMobileSelectionActive ? (
                    <p className="break-words text-sm font-semibold text-foreground">
                      {s.raisonSociale}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openView(s)}
                      className="block max-w-full break-words text-left text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s.raisonSociale}
                    </button>
                  )}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {s.theme} · {s.code} · {s.rne || "RNE non renseigné"}
                  </p>
                </div>
                {!isMobileSelectionActive && (
                  <div className="shrink-0">
                    <LedgerRowMenu actions={societeMenuActions(s)} />
                  </div>
                )}
              </div>
              <div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
                <div
                  className={cn(
                    "flex min-w-0 items-center gap-2",
                    isMobileSelectionActive ? "pl-[66px]" : "pl-[42px]",
                  )}
                >
                  <span className="truncate">
                    {contacts === 0 ? "Aucun contact" : "Contact clé non désigné"}
                  </span>
                  {isCollaborateur && (
                    <span className="shrink-0 tabular-nums">
                      {tasks} tâche{tasks === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <StatutDot statut={s.statut} />
              </div>
            </article>
          );
        }}
      />

      {canEdit && !isMobileSelectionActive && (
        <OperationalFab label="Ajouter une société" onClick={startCreate} />
      )}

      {isMobileSelectionActive && selectedIds.length > 0 && (
        <div className="mobile-selection-bar fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t border-primary/20 bg-card px-3 py-2 shadow-pop lg:hidden">
          <span className="min-w-0 truncate text-xs font-semibold text-foreground">
            {selectedIds.length} sélectionnée{selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {canEdit && (
              <BulkActionsMenu
                onExport={() => handleExport("xlsx")}
                onSetTheme={(theme) => void bulkSetTheme(theme)}
                onSetInactive={() => void bulkSetInactive()}
              />
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                Supprimer
              </Button>
            )}
          </div>
        </div>
      )}

      <SocieteFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        societe={editing}
        nextCode={nextCode}
        onSubmit={handleSubmit}
      />

      <SocieteViewSheet
        open={viewOpen}
        onOpenChange={setViewOpen}
        societe={viewing}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cette société ?"
        description={
          <>
            La société{" "}
            <span className="font-medium text-foreground">
              {toDelete?.raisonSociale}
            </span>{" "}
            et ses accès seront définitivement supprimés. Cette action est
            irréversible.
          </>
        }
        confirmPhrase={toDelete?.code}
        confirmLabel="Supprimer définitivement"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Supprimer ${selectedIds.length} sociétés ?`}
        description="Toutes les sociétés sélectionnées et leurs accès seront définitivement supprimés."
        confirmPhrase={`SUPPRIMER ${selectedIds.length}`}
        confirmLabel="Supprimer définitivement"
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
