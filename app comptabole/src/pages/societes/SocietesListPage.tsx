import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Eye,
  X,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutDot } from "@/components/ledger/StatusDot";
import { FilterChip } from "@/components/ledger/FilterChip";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRows, type ExportFormat } from "@/lib/export";
import { printTable } from "@/lib/print";
import { avatarColor, cn, formatRelative, sinceLabel } from "@/lib/utils";
import { THEME_ACCENT, THEME_BAR, THEME_ICON, THEME_OPTIONS } from "@/lib/societeTheme";
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
import {
  SocieteFormSheet,
  type SocieteFormValues,
} from "./SocieteFormSheet";
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
          <p className="text-sm text-muted-foreground">Aucun contact enregistré.</p>
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
          <p className="text-sm text-muted-foreground">Aucune tâche en attente.</p>
        ) : (
          <>
            <p className="text-sm text-foreground">
              {tachesOuvertes.length} tâche{tachesOuvertes.length > 1 ? "s" : ""} en
              attente
            </p>
            <p className="truncate text-xs text-muted-foreground">
              La plus ancienne : « {tachesOuvertes[0].titre} » —{" "}
              {formatRelative(tachesOuvertes[0].creeLe)}
            </p>
          </>
        )}
      </div>
      <div className="flex items-start">
        <Button variant="outline" size="sm" className="rounded-full" onClick={onOpenFull}>
          <Eye className="h-3.5 w-3.5" />
          Fiche complète
        </Button>
      </div>
    </div>
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

  function handleSubmit(values: SocieteFormValues) {
    if (editing) {
      updateSociete(editing.id, values);
      logJournal("modification", "societe", values.raisonSociale);
      toast.success("Société modifiée", { description: values.raisonSociale });
    } else {
      addSociete(values);
      logJournal("creation", "societe", values.raisonSociale);
      toast.success("Société créée", { description: values.raisonSociale });
    }
    setEditing(null);
  }

  function duplicate(s: Societe) {
    duplicateSociete(s.id, nextCode);
    logJournal("duplication", "societe", s.raisonSociale);
    toast.success("Société dupliquée", { description: s.raisonSociale });
  }

  function confirmDelete() {
    if (!toDelete) return;
    deleteSocietes([toDelete.id]);
    logJournal("suppression", "societe", toDelete.raisonSociale);
    setSelectedIds((ids) => ids.filter((id) => id !== toDelete.id));
    toast.success("Société supprimée", { description: toDelete.raisonSociale });
    setToDelete(null);
  }

  function confirmBulkDelete() {
    const noms = rows
      .filter((s) => selectedIds.includes(s.id))
      .map((s) => s.raisonSociale);
    deleteSocietes(selectedIds);
    logJournal(
      "suppression",
      "societe",
      `${selectedIds.length} sociétés : ${noms.join(", ")}`,
    );
    toast.success(`${selectedIds.length} sociétés supprimées`);
    setSelectedIds([]);
  }

  function bulkSetTheme(theme: SocieteTheme) {
    const ids = selectedIds;
    ids.forEach((id) => updateSociete(id, { theme }));
    logJournal(
      "modification",
      "societe",
      `${ids.length} sociétés — thème « ${theme} »`,
    );
    toast.success(
      `Thème « ${theme} » appliqué à ${ids.length} société${ids.length > 1 ? "s" : ""}`,
    );
    setSelectedIds([]);
  }

  function bulkSetInactive() {
    const ids = selectedIds;
    ids.forEach((id) => updateSociete(id, { statut: "inactif" }));
    logJournal("modification", "societe", `${ids.length} sociétés marquées inactives`);
    toast.success(
      `${ids.length} société${ids.length > 1 ? "s" : ""} marquée${ids.length > 1 ? "s" : ""} inactive${ids.length > 1 ? "s" : ""}`,
    );
    setSelectedIds([]);
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
        { header: "Thème", value: (s) => s.theme },
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
          themeFilter !== "all" && `Thème : ${themeFilter}`,
          statutFilter !== "all" && `Statut : ${statutFilter}`,
          search && `Recherche : « ${search} »`,
        ]
          .filter(Boolean)
          .join(" — ") || undefined,
      columns: [
        { header: "Raison sociale", value: (s) => s.raisonSociale },
        { header: "RNE", value: (s) => s.rne },
        { header: "TVA", value: (s) => s.tva },
        { header: "Thème", value: (s) => s.theme },
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
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
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
            aria-label={expanded ? "Masquer les détails" : "Afficher les détails"}
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
              className={cn("size-4 transition-transform", expanded && "rotate-90")}
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
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn("h-9 w-1 shrink-0 rounded-full", THEME_BAR[s.theme])}
              aria-hidden
            />
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                avatarColor(s.id),
              )}
              aria-hidden
            >
              {s.raisonSociale.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {s.raisonSociale}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {n === 0 ? "Aucun employé" : `${n} employé${n > 1 ? "s" : ""}`} ·{" "}
                {sinceLabel(s.creeLe, "Client depuis")}
              </p>
              <p className="truncate text-xs text-muted-foreground/75">
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

  return (
    <div className={cn("flex flex-1 flex-col", selectedIds.length > 0 && "md:pb-16")}>
      <LedgerPageHeader
        className="mb-3"
        title="Liste des sociétés"
        description={
          isAdmin
            ? "Gérez les sociétés clientes du cabinet."
            : "Sociétés auxquelles vous avez accès."
        }
      />

      <DataTableToolbar
        table={table}
        ariaLabel="Outils des sociétés"
        showViewOptions
        className="mb-3 sm:[&>div:last-child]:ml-auto"
        leading={
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap">
            <div className="relative min-w-0 w-full sm:w-64 sm:flex-none lg:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher société, RNE ou code…"
                aria-label="Rechercher une société"
                className="h-9 bg-card pl-9 shadow-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {themeFilter !== "all" && (
                <FilterChip
                  label={`Thème : ${themeFilter}`}
                  onRemove={() => setThemeFilter("all")}
                />
              )}
              {statutFilter !== "all" && (
                <FilterChip
                  label={`Statut : ${STATUT_LABELS[statutFilter as Statut]}`}
                  onRemove={() => setStatutFilter("all")}
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 border-dashed shadow-none">
                    <Plus className="size-3.5" />
                    Filtre
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Thème</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {THEME_OPTIONS.map((theme) => (
                        <DropdownMenuItem key={theme} onClick={() => setThemeFilter(theme)}>
                          {theme}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Statut</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {(Object.keys(STATUT_LABELS) as Statut[]).map((statut) => (
                        <DropdownMenuItem key={statut} onClick={() => setStatutFilter(statut)}>
                          {STATUT_LABELS[statut]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 shadow-none">
                    <Download className="size-4" />
                    Exporter
                    <ChevronDown className="size-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    Format CSV (.csv)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                    Format Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className="h-9 shadow-none"
                onClick={handlePrint}
              >
                <Printer className="size-4" />
                Imprimer
              </Button>
            </div>
          </div>
        }
        trailing={
          <>
            <DataTablePagination table={table} itemLabel="sociétés" variant="metadata" />
            <DataTablePagination table={table} itemLabel="sociétés" variant="controls" />
          </>
        }
        primaryAction={
          canEdit ? (
            <Button
              variant="ledger"
              className="h-9 whitespace-nowrap normal-case"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Ajouter une société
            </Button>
          ) : undefined
        }
      />

      <DataTable
        table={table}
        emptyMessage={emptyMessage}
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
          const ThemeIcon = THEME_ICON[s.theme];
          const n = employeCount.get(s.id) ?? 0;
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => openView(s)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openView(s);
                }
              }}
              className="group relative rounded-xl border border-border bg-card p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", THEME_ACCENT[s.theme])}>
                  <ThemeIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{s.raisonSociale}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.code} · {s.theme}</p>
                </div>
                <div onClick={(event) => event.stopPropagation()}>
                  <LedgerRowMenu actions={societeMenuActions(s)} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                <span>{n === 0 ? "Aucun employé" : `${n} employé${n > 1 ? "s" : ""}`}</span>
                <StatutDot statut={s.statut} pill pulse={s.statut === "actif"} />
              </div>
            </div>
          );
        }}
        mobileFooter={
          <DataTablePagination table={table} itemLabel="sociétés" variant="mobile" />
        }
      />

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 hidden justify-center px-4 md:flex">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground shadow-pop animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="px-2 font-semibold">
              {selectedIds.length} société{selectedIds.length > 1 ? "s" : ""}{" "}
              sélectionnée{selectedIds.length > 1 ? "s" : ""}
            </span>
            <span className="mx-1 h-4 w-px bg-primary-foreground/20" aria-hidden />
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              className="rounded-full px-3 py-1.5 font-medium transition-colors hover:bg-primary-foreground/10"
            >
              Exporter
            </button>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 font-medium transition-colors hover:bg-primary-foreground/10"
                  >
                    Assigner un thème
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="rounded-2xl">
                  {THEME_OPTIONS.map((t) => (
                    <DropdownMenuItem key={t} onClick={() => bulkSetTheme(t)}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={bulkSetInactive}
                className="rounded-full px-3 py-1.5 font-medium transition-colors hover:bg-primary-foreground/10"
              >
                Marquer inactif
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                className="rounded-full px-3 py-1.5 font-medium transition-colors hover:bg-destructive/25"
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              aria-label="Annuler la sélection"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/10"
            >
              <X className="h-4 w-4" />
            </button>
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
        confirmLabel="Tout supprimer"
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
