import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Filter,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Eye,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutDot } from "@/components/ledger/StatusDot";
import { FilterChip } from "@/components/ledger/FilterChip";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableViewOptions } from "@/components/data-table/DataTableViewOptions";
import { useDataTable } from "@/components/data-table/useDataTable";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { STATUT_LABELS } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
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
import { avatarColor, cn, formatRelative, sinceLabel } from "@/lib/utils";
import { THEME_OPTIONS } from "@/lib/societeTheme";
import {
  useData,
  useSocietes,
  useSocieteEmployes,
  useTaches,
  nextSocieteCode,
} from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import { employeNomComplet } from "@/data/employes";
import type { Societe, SocieteTheme, Statut } from "@/types";
import { SocieteFormSheet, type SocieteFormValues } from "./SocieteFormSheet";
import { SocieteViewSheet } from "./SocieteViewSheet";

/** Panneau de l'accordéon inline (voir LedgerTable `renderExpanded`) —
 * composant à part entière (et non une fonction inline appelée pour chaque
 * ligne dépliée) car il a besoin de ses propres hooks de données ; les
 * appeler directement dans le rendu de LedgerTable violerait les règles des
 * hooks (nombre d'appels variable selon les lignes ouvertes). */
function SocieteExpandedPanel({
  societe,
  onOpenFull,
}: {
  societe: Societe;
  onOpenFull: () => void;
}) {
  const contacts = useSocieteEmployes(societe.id);
  const allTaches = useTaches();
  const tachesOuvertes = useMemo(
    () =>
      allTaches
        .filter((t) => t.societeId === societe.id && t.statut !== "termine")
        .sort((a, b) => a.creeLe.localeCompare(b.creeLe)),
    [allTaches, societe.id],
  );

  return (
    <div className="grid gap-3 border-t border-border/70 px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
      <div className="min-w-0">
        <p className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
          Contacts clés
        </p>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun contact enregistré.
          </p>
        ) : (
          <ul className="space-y-1">
            {contacts.slice(0, 3).map((c) => (
              <li key={c.id} className="truncate text-sm text-foreground">
                {employeNomComplet(c)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0">
        <p className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
          Tâches en cours
        </p>
        {tachesOuvertes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune tâche en attente.
          </p>
        ) : (
          <>
            <p className="text-sm text-foreground">
              {tachesOuvertes.length} tâche
              {tachesOuvertes.length > 1 ? "s" : ""} en attente
            </p>
            <p className="truncate text-xs text-muted-foreground">
              La plus ancienne : « {tachesOuvertes[0].titre} » —{" "}
              {formatRelative(tachesOuvertes[0].creeLe)}
            </p>
          </>
        )}
      </div>
      <div className="flex items-start">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onOpenFull}
        >
          <Eye className="h-3.5 w-3.5" />
          Fiche complète
        </Button>
      </div>
    </div>
  );
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
  onExport,
  onPrint,
}: {
  onExport: (format: ExportFormat) => void;
  onPrint: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="shadow-none">
          <span className="hidden sm:inline">Actions</span>
          <MoreHorizontal className="size-4 sm:hidden" />
          <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
          <span className="sr-only sm:hidden">Actions de la liste</span>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SocietesListPage() {
  const navigate = useNavigate();
  const allRows = useSocietes();
  const { isAdmin, can, canSeeSociete } = usePermissions();
  const rows = useMemo(
    () => allRows.filter((s) => canSeeSociete(s.id)),
    [allRows, canSeeSociete],
  );
  const canEdit = isAdmin || can("modifierSocietes");
  const canDelete = isAdmin || can("supprimer");

  const addSociete = useData((s) => s.addSociete);
  const updateSociete = useData((s) => s.updateSociete);
  const duplicateSociete = useData((s) => s.duplicateSociete);
  const deleteSocietes = useData((s) => s.deleteSocietes);
  const employes = useData((s) => s.employes);
  const isDataLoading = useData((s) => !s.hydrated);
  const employeCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employes) {
      if (e.role === "societe_employe" && e.societeId)
        m.set(e.societeId, (m.get(e.societeId) ?? 0) + 1);
    }
    return m;
  }, [employes]);
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Societe | null>(null);
  const [viewing, setViewing] = useState<Societe | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [toDelete, setToDelete] = useState<Societe | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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
      id: "details",
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => {
        const expanded = expandedIds.includes(row.original.id);
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 shadow-none"
            aria-label={
              expanded ? "Masquer les détails" : "Afficher les détails"
            }
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpandedIds((ids) =>
                expanded
                  ? ids.filter((id) => id !== row.original.id)
                  : [...ids, row.original.id],
              );
            }}
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </Button>
        );
      },
      meta: {
        headerClassName: "w-9 px-1",
        cellClassName: "w-9 px-1",
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
        const n = employeCount.get(s.id) ?? 0;
        return (
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                avatarColor(s.id),
              )}
              aria-hidden
            >
              {s.raisonSociale.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-[15px] text-foreground">
                {s.raisonSociale}
              </p>
              <p className="truncate text-[11px] leading-[13px] text-muted-foreground">
                {n === 0 ? "Aucun employé" : `${n} employé${n > 1 ? "s" : ""}`}{" "}
                · {sinceLabel(s.creeLe, "Client depuis")}
              </p>
              <p className="truncate text-[11px] leading-[13px] text-muted-foreground/75">
                {s.rne || "—"} · {s.tva || "—"} · {s.theme}
              </p>
            </div>
          </div>
        );
      },
      meta: { label: "Société", headerClassName: "w-[55%]" },
    },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => (
        <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
          {row.original.code}
        </span>
      ),
      meta: { label: "Code", headerClassName: "w-28" },
    },
    {
      accessorKey: "statut",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Statut" />
      ),
      cell: ({ row }) => (
        <StatutDot
          statut={row.original.statut}
          pill
          pulse={row.original.statut === "actif"}
        />
      ),
      meta: { label: "Statut", headerClassName: "w-32" },
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
            className="flex items-center justify-end gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Actions rapides : masquées par défaut, révélées au survol de la
              ligne ET au focus clavier (group-focus-within) — jamais
              seulement au survol, pour rester utilisables sans souris. */}
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => openView(s)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                aria-label={`Voir ${s.raisonSociale}`}
                title="Voir"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(s);
                    setFormOpen(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  aria-label={`Modifier ${s.raisonSociale}`}
                  title="Modifier"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <LedgerRowMenu actions={societeMenuActions(s)} />
          </div>
        );
      },
      meta: {
        headerClassName: "w-24",
        cellClassName: "w-24",
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
        "flex min-w-0 flex-1 flex-col",
        canEdit && !isMobileSelectionActive && "pb-20 lg:pb-0",
      )}
    >
      <header className="mb-2 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-6 tracking-tight text-primary">
            Sociétés
          </h1>
          <p className="mt-0.5 text-sm leading-4 text-muted-foreground">
            {isAdmin
              ? "Gestion des clients du cabinet"
              : "Sociétés auxquelles vous avez accès"}
          </p>
        </div>
        {canEdit && (
          <Button
            type="button"
            className="hidden shrink-0 lg:inline-flex"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Ajouter une société
          </Button>
        )}
      </header>

      {selectedIds.length > 0 ? (
        <div className="mb-3 hidden items-center justify-between gap-4 border-y border-primary/20 bg-primary px-3 py-2 text-primary-foreground lg:flex">
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
      ) : (
        <div className="mb-2 hidden min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y border-border/80 py-1 lg:flex">
          <div className="flex min-w-0 flex-1 basis-full items-center gap-2 xl:basis-auto">
            <div className="relative min-w-0 flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une société, RNE ou code"
                aria-label="Rechercher une société"
                className="h-9 bg-card pl-9 shadow-none"
              />
            </div>
            <SocietesFilterMenu
              onSetTheme={setThemeFilter}
              onSetStatut={setStatutFilter}
            />
          </div>
          <div className="ml-auto flex w-full min-w-0 items-center justify-end gap-1 xl:w-auto">
            <DataTablePagination
              table={table}
              itemLabel="sociétés"
              variant="count"
              className="mr-1 whitespace-nowrap"
            />
            <DataTablePagination
              table={table}
              itemLabel="sociétés"
              variant="controls"
            />
            <SocietesUtilityMenu
              onExport={handleExport}
              onPrint={handlePrint}
            />
            <DataTableViewOptions table={table} />
          </div>
        </div>
      )}

      {filterChips && <div className="mb-3 hidden lg:block">{filterChips}</div>}

      {!isMobileSelectionActive && (
        <div className="mb-3 min-w-0 space-y-2 lg:hidden">
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
                onExport={handleExport}
                onPrint={handlePrint}
              />
            </div>
          </div>
          {filterChips}
        </div>
      )}

      {isMobileSelectionActive && (
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3 lg:hidden">
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

      <DataTable
        className="[&>div:last-child]:space-y-0"
        desktopDensity="compact"
        table={table}
        emptyMessage={emptyMessage}
        isLoading={isDataLoading}
        onRowClick={(row) => openView(row.original)}
        isRowExpanded={(row) => expandedIds.includes(row.original.id)}
        renderSubComponent={(row) => (
          <SocieteExpandedPanel
            societe={row.original}
            onOpenFull={() => openView(row.original)}
          />
        )}
        mobileRow={(row) => {
          const s = row.original;
          const n = employeCount.get(s.id) ?? 0;
          const selected = selectedIds.includes(s.id);
          return (
            <article
              data-state={selected ? "selected" : undefined}
              className="min-w-0 border-b border-border/80 px-1 py-3 data-[state=selected]:bg-primary/[0.03]"
            >
              <div className="flex min-w-0 items-start gap-2">
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
                    className="mt-1 shrink-0"
                  />
                )}
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
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {s.code} · {s.theme}
                  </p>
                </div>
                {!isMobileSelectionActive && (
                  <div className="shrink-0">
                    <LedgerRowMenu actions={societeMenuActions(s)} />
                  </div>
                )}
              </div>
              <div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate">
                  {n === 0
                    ? "Aucun employé"
                    : `${n} employé${n > 1 ? "s" : ""}`}
                </span>
                <StatutDot
                  statut={s.statut}
                  pill
                  pulse={s.statut === "actif"}
                />
              </div>
            </article>
          );
        }}
        mobileFooter={
          <DataTablePagination
            table={table}
            itemLabel="sociétés"
            variant="mobile"
          />
        }
      />

      {canEdit && !isMobileSelectionActive && (
        <Button
          type="button"
          aria-label="Ajouter une société"
          className="fixed bottom-4 right-4 z-30 h-10 rounded-lg px-4 shadow-pop lg:hidden"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
        </Button>
      )}

      {isMobileSelectionActive && selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t border-primary/20 bg-card px-3 py-2 shadow-pop lg:hidden">
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
