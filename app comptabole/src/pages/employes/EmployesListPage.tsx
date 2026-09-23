import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  Filter,
  MoreHorizontal,
  Pencil,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { useDataTable } from "@/components/data-table/useDataTable";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { StatutDot } from "@/components/ledger/StatusDot";
import { FilterChip } from "@/components/ledger/FilterChip";
import { STATUT_LABELS } from "@/components/common/badges";
import type { RowAction } from "@/components/common/RowActions";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
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
import { cn, initials } from "@/lib/utils";
import { employeNomComplet } from "@/data/employes";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import {
  useData,
  useCollaborateurs,
  useSocietes,
  useTaches,
  defaultPermissions,
  PERMISSION_LABELS,
} from "@/store/data";
import type { Employe, EmployeType, PermissionKey, Statut } from "@/types";
import { EmployeFormSheet, type EmployeFormValues } from "./EmployeFormSheet";
import { EmployeAccesSheet } from "./EmployeAccesSheet";
import { EmployeViewSheet } from "./EmployeViewSheet";
import {
  allowedPermissionCount,
  assignmentPreview,
  openTasksByCollaborator,
  societyNameMap,
} from "./teamLedger";

const TYPES: EmployeType[] = [
  "Comptable",
  "Assistant",
  "Stagiaire",
  "Gestionnaire de paie",
];
const PERMISSION_TOTAL = Object.keys(PERMISSION_LABELS).length;

function TeamMonogram({ employe }: { employe: Employe }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/12 bg-primary/[0.06] text-[11px] font-bold tracking-wide text-primary"
      aria-hidden
    >
      {initials(employeNomComplet(employe))}
    </span>
  );
}

function BulkActions({
  disabled = false,
  onExport,
  onType,
  onInactive,
}: {
  disabled?: boolean;
  onExport: () => void;
  onType: (type: EmployeType) => void;
  onInactive: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
        >
          Actions <span aria-hidden>⌄</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExport}>
          Exporter la sélection
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Assigner un type</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TYPES.map((type) => (
              <DropdownMenuItem key={type} onClick={() => onType(type)}>
                {type}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onInactive}>
          Marquer inactif
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileCollaboratorRow({
  employe,
  assignedPreview,
  openTasks,
  selecting,
  selected,
  onSelect,
  onOpen,
  menuActions,
}: {
  employe: Employe;
  assignedPreview: string;
  openTasks: number;
  selecting: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  menuActions: RowAction[];
}) {
  const assigned = employe.societesAssignees.length;
  return (
    <article
      data-state={selected ? "selected" : undefined}
      className="relative min-w-0 border-b border-border/80 px-3 py-3 sm:px-1 data-[state=selected]:bg-[#C9A96A]/10 data-[state=selected]:before:absolute data-[state=selected]:before:inset-y-1 data-[state=selected]:before:left-0 data-[state=selected]:before:w-0.5 data-[state=selected]:before:bg-[#C9A96A]"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {selecting && (
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            aria-label={`Sélectionner ${employeNomComplet(employe)}`}
            className="mt-2 shrink-0"
          />
        )}
        <TeamMonogram employe={employe} />
        <div className="min-w-0 flex-1">
          {selecting ? (
            <p className="break-words text-sm font-semibold text-foreground">
              {employeNomComplet(employe)}
            </p>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="block max-w-full break-words text-left text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {employeNomComplet(employe)}
            </button>
          )}
          <p className="text-xs text-muted-foreground">{employe.type}</p>
          <p
            className="truncate text-[11px] text-muted-foreground"
            title={employe.email}
          >
            {employe.email}
          </p>
          {employe.doitChangerMotDePasse && (
            <span className="mt-0.5 inline-block rounded-full bg-warning/12 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              Doit changer son mot de passe
            </span>
          )}
        </div>
        {!selecting && (
          <div className="shrink-0">
            <LedgerRowMenu actions={menuActions} />
          </div>
        )}
      </div>
      <div
        className={cn(
          "mt-2 min-w-0 text-xs text-muted-foreground",
          selecting ? "pl-[66px]" : "pl-[46px]",
        )}
      >
        <p className="truncate" title={assignedPreview}>
          {assigned} société{assigned === 1 ? "" : "s"} · {openTasks} tâche
          {openTasks === 1 ? "" : "s"} ouverte{openTasks === 1 ? "" : "s"}
        </p>
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-[11px]">
            {allowedPermissionCount(employe)}/{PERMISSION_TOTAL} droits actifs
          </span>
          <StatutDot statut={employe.statut} />
        </div>
      </div>
    </article>
  );
}

export function EmployesListPage() {
  const { isAdmin } = usePermissions();
  const rows = useCollaborateurs();
  const societes = useSocietes();
  const taches = useTaches();
  const isDataLoading = useData((s) => !s.hydrated);
  const addEmploye = useData((s) => s.addEmploye);
  const updateEmploye = useData((s) => s.updateEmploye);
  const duplicateEmploye = useData((s) => s.duplicateEmploye);
  const deleteEmployes = useData((s) => s.deleteEmployes);
  const setEmployeAcces = useData((s) => s.setEmployeAcces);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileSelectionMode, setMobileSelectionMode] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employe | null>(null);
  const [accesOpen, setAccesOpen] = useState(false);
  const [accesTarget, setAccesTarget] = useState<Employe | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<Employe | null>(null);
  const [toDelete, setToDelete] = useState<Employe | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const societyNames = useMemo(() => societyNameMap(societes), [societes]);
  const openTaskCounts = useMemo(
    () => openTasksByCollaborator(taches),
    [taches],
  );
  const activeCount = useMemo(
    () => rows.filter((e) => e.statut === "actif").length,
    [rows],
  );
  const attributionCount = useMemo(
    () => rows.reduce((count, e) => count + e.societesAssignees.length, 0),
    [rows],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter(
      (e) =>
        (!query ||
          [e.prenom, e.nom, e.identifiant, e.email, e.type]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)) &&
        (typeFilter === "all" || e.type === typeFilter) &&
        (statutFilter === "all" || e.statut === statutFilter),
    );
  }, [rows, search, typeFilter, statutFilter]);

  useEffect(() => {
    const valid = new Set(rows.map((e) => e.id));
    setSelectedIds((ids) =>
      ids.every((id) => valid.has(id))
        ? ids
        : ids.filter((id) => valid.has(id)),
    );
  }, [rows]);

  function clearSelection() {
    setSelectedIds([]);
    setMobileSelectionMode(false);
  }
  function toggleSelected(id: string) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }
  function startCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openView(e: Employe) {
    setViewing(e);
    setViewOpen(true);
  }
  function handleSubmit(values: EmployeFormValues) {
    const nom = `${values.prenom} ${values.nom}`;
    if (editing) {
      updateEmploye(editing.id, values);
      logJournal("modification", "employe", nom);
      toast.success("Collaborateur modifié", { description: nom });
    } else {
      addEmploye({
        ...values,
        role: isAdmin ? values.role : "collaborateur",
        permissions: defaultPermissions(values.type),
      });
      logJournal("creation", "employe", nom);
      toast.success("Collaborateur créé", { description: nom });
    }
    setEditing(null);
  }
  function duplicate(e: Employe) {
    duplicateEmploye(e.id);
    logJournal("duplication", "employe", employeNomComplet(e));
    toast.success("Collaborateur dupliqué");
  }
  function confirmDelete() {
    if (!toDelete) return;
    deleteEmployes([toDelete.id]);
    logJournal("suppression", "employe", employeNomComplet(toDelete));
    setSelectedIds((ids) => ids.filter((id) => id !== toDelete.id));
    toast.success("Collaborateur supprimé", {
      description: employeNomComplet(toDelete),
    });
    setToDelete(null);
  }
  function confirmBulkDelete() {
    deleteEmployes(selectedIds);
    logJournal(
      "suppression",
      "employe",
      `${selectedIds.length} collaborateurs`,
    );
    toast.success(`${selectedIds.length} collaborateurs supprimés`);
    clearSelection();
  }
  function bulkSetType(type: EmployeType) {
    const ids = selectedIds;
    ids.forEach((id) => updateEmploye(id, { type }));
    logJournal(
      "modification",
      "employe",
      `${ids.length} collaborateurs — type « ${type} »`,
    );
    toast.success(
      `Type « ${type} » appliqué à ${ids.length} collaborateur${ids.length > 1 ? "s" : ""}`,
    );
    clearSelection();
  }
  function bulkSetInactive() {
    const ids = selectedIds;
    ids.forEach((id) => updateEmploye(id, { statut: "inactif" }));
    logJournal(
      "modification",
      "employe",
      `${ids.length} collaborateurs marqués inactifs`,
    );
    toast.success(
      `${ids.length} collaborateur${ids.length > 1 ? "s" : ""} marqué${ids.length > 1 ? "s" : ""} inactif${ids.length > 1 ? "s" : ""}`,
    );
    clearSelection();
  }
  function exportSource() {
    return selectedIds.length
      ? filtered.filter((e) => selectedIds.includes(e.id))
      : filtered;
  }
  function handleExport(format: ExportFormat) {
    exportRows(
      "employes",
      exportSource(),
      [
        { header: "Prénom", value: (e) => e.prenom },
        { header: "Nom", value: (e) => e.nom },
        { header: "Identifiant", value: (e) => e.identifiant },
        { header: "Type", value: (e) => e.type },
        { header: "Email", value: (e) => e.email },
        { header: "Statut", value: (e) => e.statut },
        {
          header: "Sociétés assignées",
          value: (e) =>
            e.societesAssignees
              .map((id) => societyNames.get(id) ?? id)
              .join(" | "),
        },
        {
          header: "Permissions",
          value: (e) =>
            (Object.keys(PERMISSION_LABELS) as PermissionKey[])
              .filter((key) => e.permissions?.[key])
              .map((key) => PERMISSION_LABELS[key])
              .join(" | "),
        },
      ],
      format,
    );
    toast.success(`Export ${format.toUpperCase()} généré`);
  }
  function handlePrint() {
    printTable({
      title: "Collaborateurs du cabinet",
      subtitle:
        [
          typeFilter !== "all" && `Type : ${typeFilter}`,
          statutFilter !== "all" && `Statut : ${statutFilter}`,
          search && `Recherche : « ${search} »`,
        ]
          .filter(Boolean)
          .join(" — ") || undefined,
      columns: [
        { header: "Prénom", value: (e) => e.prenom },
        { header: "Nom", value: (e) => e.nom },
        { header: "Identifiant", value: (e) => e.identifiant },
        { header: "Type", value: (e) => e.type },
        { header: "Email", value: (e) => e.email },
        { header: "Statut", value: (e) => e.statut },
        {
          header: "Sociétés",
          value: (e) => e.societesAssignees.length,
          align: "right",
        },
        {
          header: "Droits",
          value: (e) => `${allowedPermissionCount(e)}/${PERMISSION_TOTAL}`,
          align: "right",
        },
      ],
      rows: exportSource(),
    });
  }
  function employeMenuActions(e: Employe) {
    return [
      { icon: Eye, label: "Voir la fiche", onClick: () => openView(e) },
      {
        icon: ShieldCheck,
        label: "Accès",
        onClick: () => {
          setAccesTarget(e);
          setAccesOpen(true);
        },
      },
      { icon: Copy, label: "Dupliquer", onClick: () => duplicate(e) },
      {
        icon: Pencil,
        label: "Modifier",
        onClick: () => {
          setEditing(e);
          setFormOpen(true);
        },
      },
      // Suppression réservée à l'admin — irréversible (voir server/routes/
      // employes.js, seule route du routeur qui garde son propre requireAdmin).
      ...(isAdmin
        ? [
            {
              icon: Trash2,
              label: "Supprimer",
              destructive: true,
              onClick: () => setToDelete(e),
            },
          ]
        : []),
    ];
  }

  const columns: ColumnDef<Employe>[] = [
    {
      id: "selection",
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => {
        const pageIds = table.getRowModel().rows.map((row) => row.original.id);
        const all =
          pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
        const some = pageIds.some((id) => selectedIds.includes(id));
        return (
          <Checkbox
            checked={all ? true : some ? "indeterminate" : false}
            onCheckedChange={() =>
              setSelectedIds(
                all
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
          onCheckedChange={() => toggleSelected(row.original.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Sélectionner ${employeNomComplet(row.original)}`}
        />
      ),
      meta: { headerClassName: "w-10", cellClassName: "w-10" },
    },
    {
      id: "nom",
      accessorFn: (e) => `${e.nom} ${e.prenom}`.toLocaleLowerCase(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Collaborateur" />
      ),
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="flex min-w-0 items-center gap-2.5 py-1">
            <TeamMonogram employe={e} />
            <div className="min-w-0">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openView(e);
                }}
                className="block max-w-full truncate text-left text-[13px] font-semibold leading-4 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {employeNomComplet(e)}
              </button>
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                {e.type}
              </p>
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                {e.email}
              </p>
              {e.doitChangerMotDePasse && (
                <span className="mt-0.5 inline-block rounded-full bg-warning/12 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                  Doit changer son mot de passe
                </span>
              )}
            </div>
          </div>
        );
      },
      meta: { label: "Collaborateur", headerClassName: "w-[31%]" },
    },
    {
      id: "perimetre",
      accessorFn: (e) => e.societesAssignees.length,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Périmètre" />
      ),
      cell: ({ row }) => {
        const e = row.original;
        const count = e.societesAssignees.length;
        return (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {count} société{count === 1 ? "" : "s"}
            </p>
            <div
              className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground"
              title={assignmentPreview(e, societyNames)}
            >
              <span className="min-w-0 truncate">
                {e.societesAssignees
                  .slice(0, 2)
                  .map((id) => societyNames.get(id) ?? id)
                  .join(" · ") || "Aucune société assignée"}
              </span>
              {count > 2 && <span className="shrink-0">+{count - 2}</span>}
            </div>
          </div>
        );
      },
      meta: { label: "Périmètre", headerClassName: "w-[25%]" },
    },
    {
      id: "taches",
      accessorFn: (e) => openTaskCounts.get(e.id) ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tâches ouvertes" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {openTaskCounts.get(row.original.id) ?? 0}
        </span>
      ),
      meta: { label: "Tâches ouvertes", headerClassName: "w-[13%]" },
    },
    {
      id: "acces",
      accessorFn: allowedPermissionCount,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Accès" />
      ),
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-foreground">
          {allowedPermissionCount(row.original)}/{PERMISSION_TOTAL} droits
        </span>
      ),
      meta: { label: "Accès", headerClassName: "w-[13%]" },
    },
    {
      accessorKey: "statut",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Statut" />
      ),
      cell: ({ row }) => <StatutDot statut={row.original.statut} />,
      meta: { label: "Statut", headerClassName: "w-[11%]" },
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <div
          className="flex justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          <LedgerRowMenu actions={employeMenuActions(row.original)} />
        </div>
      ),
      meta: { headerClassName: "w-10", cellClassName: "w-10" },
    },
  ];
  const table = useDataTable({
    columns,
    data: filtered,
    getRowId: (e) => e.id,
    initialSorting: [{ id: "nom", desc: false }],
    pageSize: 8,
    resetKey: `${search}\u0000${typeFilter}\u0000${statutFilter}`,
  });
  const currentPageIds = table.getRowModel().rows.map((row) => row.original.id);
  const currentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) => selectedIds.includes(id));
  const partlySelected = currentPageIds.some((id) => selectedIds.includes(id));
  const mobileSelecting = mobileSelectionMode || selectedIds.length > 0;
  const emptyMessage =
    rows.length === 0
      ? "Aucun collaborateur enregistré. Ajoutez le premier compte collaborateur du cabinet."
      : "Aucun collaborateur ne correspond à votre recherche ou à vos filtres.";

  return (
    <div
      className={cn("min-w-0 flex-1 pb-20 lg:pb-4", mobileSelecting && "pb-24")}
    >
      <SignatureLedgerBanner
        titleId="team-ledger-title"
        eyebrow="Organisation · Team Ledger"
        title="Collaborateurs"
        description="Équipe du cabinet · comptes et périmètres d'accès"
        metrics={[
          {
            label: "Collaborateurs",
            value: rows.length,
            loading: isDataLoading,
          },
          {
            label: "Actifs",
            value: activeCount,
            tone: "success",
            loading: isDataLoading,
          },
          {
            label: "Attributions sociétés",
            value: attributionCount,
            loading: isDataLoading,
          },
        ]}
        action={{ label: "Ajouter un collaborateur", onClick: startCreate }}
      />

      {!mobileSelecting && (
        <div className="mt-0 flex min-w-0 items-center gap-2 bg-card px-3 py-2 sm:mt-3 sm:bg-transparent sm:px-0 sm:py-0 lg:mt-4">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un collaborateur, un identifiant…"
              aria-label="Rechercher un collaborateur"
              className="pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <Filter className="size-4" />
                <span className="hidden sm:inline">Filtrer</span>
                <span className="sr-only sm:hidden">Filtrer</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setTypeFilter("all");
                  setStatutFilter("all");
                }}
              >
                Tous les collaborateurs
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Type</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TYPES.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => setTypeFilter(type)}
                    >
                      {type}
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
                      onClick={() => setStatutFilter(statut)}
                    >
                      {STATUT_LABELS[statut]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden shrink-0 lg:inline-flex"
              >
                <MoreHorizontal className="size-4" />
                Outils
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Trier par</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {[
                    ["nom", "Collaborateur"],
                    ["perimetre", "Périmètre"],
                    ["taches", "Tâches ouvertes"],
                    ["acces", "Accès"],
                    ["statut", "Statut"],
                  ].map(([id, label]) => (
                    <DropdownMenuItem
                      key={id}
                      onClick={() => table.setSorting([{ id, desc: false }])}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Exporter CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                Exporter Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="size-4" />
                Imprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {!mobileSelecting && (typeFilter !== "all" || statutFilter !== "all") && (
        <div className="mt-0 flex flex-wrap gap-1.5 bg-card px-3 pb-2 sm:mt-2 sm:bg-transparent sm:px-0 sm:pb-0">
          {typeFilter !== "all" && (
            <FilterChip
              label={`Type : ${typeFilter}`}
              onRemove={() => setTypeFilter("all")}
            />
          )}
          {statutFilter !== "all" && (
            <FilterChip
              label={`Statut : ${STATUT_LABELS[statutFilter as Statut]}`}
              onRemove={() => setStatutFilter("all")}
            />
          )}
        </div>
      )}

      <div className="mt-0 flex min-w-0 items-center justify-between gap-2 border-b border-border/80 bg-card px-3 py-1 sm:mt-4 sm:bg-transparent sm:px-0 sm:pt-0">
        <div className="flex min-w-0 items-center gap-2">
          <Checkbox
            checked={
              currentPageSelected
                ? true
                : partlySelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={() =>
              setSelectedIds(
                currentPageSelected
                  ? selectedIds.filter((id) => !currentPageIds.includes(id))
                  : [...new Set([...selectedIds, ...currentPageIds])],
              )
            }
            aria-label="Sélectionner la page"
            className="hidden lg:flex"
          />
          <h2>
            <DataTableColumnHeader
              column={table.getColumn("nom")!}
              title="Registre équipe"
              className="h-7 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
            />
          </h2>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <DataTablePagination
            table={table}
            itemLabel="collaborateurs"
            variant="count"
          />
          {!isDataLoading &&
            filtered.length > 0 &&
            (table.getPageCount() <= 1 ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                1 / 1
              </span>
            ) : (
              <DataTablePagination table={table} variant="controls" />
            ))}
        </div>
        <div className="flex shrink-0 items-center gap-1 lg:hidden">
          {!mobileSelecting && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMobileSelectionMode(true)}
            >
              Sélectionner
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Outils"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Trier par</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {[
                    ["nom", "Collaborateur"],
                    ["perimetre", "Périmètre"],
                    ["taches", "Tâches ouvertes"],
                    ["acces", "Accès"],
                    ["statut", "Statut"],
                  ].map(([id, label]) => (
                    <DropdownMenuItem
                      key={id}
                      onClick={() => table.setSorting([{ id, desc: false }])}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Exporter CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                Exporter Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint}>
                Imprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="hidden items-center justify-between gap-3 bg-primary px-3 py-2 text-primary-foreground lg:flex">
          <span className="text-xs font-semibold">
            {selectedIds.length} collaborateur
            {selectedIds.length > 1 ? "s" : ""} sélectionné
            {selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <BulkActions
              onExport={() => handleExport("xlsx")}
              onType={bulkSetType}
              onInactive={bulkSetInactive}
            />
            {isAdmin && (
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
              className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              onClick={clearSelection}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
      {mobileSelecting && (
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card px-3 py-1 sm:bg-transparent sm:px-0 lg:hidden">
          <span className="text-xs font-semibold text-primary">
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            Annuler
          </Button>
        </div>
      )}

      <DataTable
        className="bg-card sm:bg-transparent [&>div:last-child]:space-y-0"
        desktopDensity="compact"
        desktopVariant="register"
        table={table}
        emptyMessage={emptyMessage}
        isLoading={isDataLoading}
        onRowClick={(row) => openView(row.original)}
        getRowClassName={(row) =>
          selectedIds.includes(row.original.id)
            ? "bg-[#C9A96A]/10 hover:bg-[#C9A96A]/15 [&>td:first-child]:border-l-2 [&>td:first-child]:border-[#C9A96A]"
            : undefined
        }
        mobileRow={(row) => {
          const e = row.original;
          return (
            <MobileCollaboratorRow
              employe={e}
              assignedPreview={assignmentPreview(e, societyNames)}
              openTasks={openTaskCounts.get(e.id) ?? 0}
              selecting={mobileSelecting}
              selected={selectedIds.includes(e.id)}
              onSelect={() => toggleSelected(e.id)}
              onOpen={() => openView(e)}
              menuActions={employeMenuActions(e)}
            />
          );
        }}
      />
      {!isDataLoading && filtered.length > 0 && (
        <div className="mt-0 bg-card px-3 pt-2 sm:mt-2 sm:bg-transparent sm:px-0 sm:pt-0 lg:hidden">
          <DataTablePagination
            table={table}
            itemLabel="collaborateurs"
            variant="mobile"
          />
          {table.getPageCount() <= 1 && (
            <p className="text-center text-[11px] tabular-nums text-muted-foreground">
              1 / 1
            </p>
          )}
        </div>
      )}

      {!mobileSelecting && (
        <OperationalFab
          label="Ajouter un collaborateur"
          onClick={startCreate}
        />
      )}
      {mobileSelecting && (
        <div className="mobile-selection-bar fixed inset-x-0 bottom-0 z-40 flex min-w-0 items-center justify-between gap-1 bg-primary px-3 py-2 text-primary-foreground shadow-lg lg:hidden">
          <span className="shrink-0 text-xs font-semibold">
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-0.5">
            <BulkActions
              disabled={selectedIds.length === 0}
              onExport={() => handleExport("xlsx")}
              onType={bulkSetType}
              onInactive={bulkSetInactive}
            />
            {isAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={() => setBulkDeleteOpen(true)}
                className="text-primary-foreground hover:bg-destructive/25 hover:text-primary-foreground"
              >
                Supprimer
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={clearSelection}
              aria-label="Annuler la sélection"
              className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <EmployeFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        employe={editing}
        canAssignRole={isAdmin}
        onSubmit={handleSubmit}
      />
      <EmployeAccesSheet
        open={accesOpen}
        onOpenChange={setAccesOpen}
        employe={accesTarget}
        onSave={(id, societesAssignees, permissions) => {
          setEmployeAcces(id, societesAssignees, permissions);
          const e = rows.find((entry) => entry.id === id);
          if (e)
            logJournal(
              "acces",
              "employe",
              `Droits mis à jour — ${employeNomComplet(e)}`,
            );
        }}
      />
      <EmployeViewSheet
        open={viewOpen}
        onOpenChange={setViewOpen}
        employe={viewing}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer ce collaborateur ?"
        description={
          <>
            Le compte de{" "}
            <span className="font-medium text-foreground">
              {toDelete ? employeNomComplet(toDelete) : ""}
            </span>{" "}
            sera définitivement supprimé et perdra tout accès au cabinet.
          </>
        }
        confirmLabel="Supprimer définitivement"
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Supprimer ${selectedIds.length} collaborateurs ?`}
        description="Tous les comptes sélectionnés seront définitivement supprimés."
        confirmLabel="Tout supprimer"
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
