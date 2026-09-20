import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  FileText,
  FolderTree,
  KeyRound,
  Landmark,
  ListChecks,
  LogIn,
  LogOut,
  MessageSquare,
  Database,
  UserRound,
  Users,
  Activity,
  ChevronDown,
  Download,
  Printer,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { StatusDot, type StatusTone } from "@/components/ledger/StatusDot";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { DataTableToolbar } from "@/components/data-table/DataTableToolbar";
import { useDataTable } from "@/components/data-table/useDataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportRows, type ExportFormat } from "@/lib/export";
import { printTable } from "@/lib/print";
import { formatDate, formatTime } from "@/lib/utils";
import {
  useJournal,
  type JournalAction,
  type JournalEntity,
  type JournalEntry,
} from "@/store/journal";

const ENTITY_ICON: Record<JournalEntity, LucideIcon> = {
  societe: Building2,
  employe: Users,
  employe_societe: UserRound,
  tache: ListChecks,
  collecte: ClipboardList,
  bordereau: Landmark,
  stock: Boxes,
  balance: Calculator,
  dossier: FolderTree,
  fichier: FileText,
  message: MessageSquare,
  compte: KeyRound,
  donnees: Database,
};
const iconFor = (entity: string): LucideIcon =>
  ENTITY_ICON[entity as JournalEntity] ?? Activity;
const actionMetaFor = (action: string) =>
  ACTION_META[action as JournalAction] ?? {
    label: action,
    tone: "muted" as const,
  };

const ACTION_META: Record<JournalAction, { label: string; tone: StatusTone }> = {
  creation: { label: "Création", tone: "success" },
  modification: { label: "Modification", tone: "warning" },
  suppression: { label: "Suppression", tone: "destructive" },
  duplication: { label: "Duplication", tone: "primary" },
  connexion: { label: "Connexion", tone: "muted" },
  deconnexion: { label: "Déconnexion", tone: "muted" },
  reinitialisation: { label: "Réinitialisation", tone: "destructive" },
  import: { label: "Import", tone: "primary" },
  acces: { label: "Accès", tone: "warning" },
};

export function JournalPage() {
  const entries = useJournal((s) => s.entries);
  const loading = useJournal((s) => s.loading);
  const clear = useJournal((s) => s.clear);
  const fetchJournal = useJournal((s) => s.fetch);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [clearOpen, setClearOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchQ =
        !q ||
        [e.actor, e.label, e.entity, actionMetaFor(e.action).label]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchA = actionFilter === "all" || e.action === actionFilter;
      return matchQ && matchA;
    });
  }, [entries, search, actionFilter]);

  const exportColumns = [
    {
      header: "Date",
      value: (e: (typeof entries)[number]) =>
        `${formatDate(e.at)} ${formatTime(e.at)}`,
    },
    { header: "Utilisateur", value: (e: (typeof entries)[number]) => e.actor },
    {
      header: "Action",
      value: (e: (typeof entries)[number]) => actionMetaFor(e.action).label,
    },
    { header: "Type", value: (e: (typeof entries)[number]) => e.entity },
    { header: "Élément", value: (e: (typeof entries)[number]) => e.label },
  ];

  function handleExport(format: ExportFormat) {
    exportRows("journal", filtered, exportColumns, format);
    toast.success(`Export ${format.toUpperCase()} généré`);
  }

  function handlePrint() {
    printTable({
      title: "Journal d'activité",
      subtitle:
        actionFilter !== "all"
          ? `Action : ${actionMetaFor(actionFilter).label}`
          : undefined,
      columns: exportColumns,
      rows: filtered,
    });
  }

  const columns = useMemo<ColumnDef<JournalEntry>[]>(
    () => [
      {
        accessorKey: "at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm font-medium text-foreground">
              {formatDate(row.original.at)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(row.original.at)}
            </p>
          </div>
        ),
        meta: { label: "Date", headerClassName: "w-[8.5rem]" },
      },
      {
        accessorKey: "actor",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Utilisateur" />
        ),
        cell: ({ row }) => (
          <span className="block truncate font-medium text-foreground">
            {row.original.actor}
          </span>
        ),
        meta: { label: "Utilisateur", headerClassName: "w-[18%]" },
      },
      {
        accessorKey: "action",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Action" />
        ),
        cell: ({ row }) => {
          const meta = actionMetaFor(row.original.action);
          return <StatusDot tone={meta.tone} label={meta.label} />;
        },
        meta: { label: "Action", headerClassName: "w-[10rem]" },
      },
      {
        accessorKey: "label",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Élément" />
        ),
        cell: ({ row }) => {
          const Icon = iconFor(row.original.entity);
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {row.original.label}
                </p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {row.original.entity.replace("_", " ")}
                </p>
              </div>
            </div>
          );
        },
        meta: { label: "Élément" },
      },
    ],
    [],
  );

  const table = useDataTable({
    columns,
    data: filtered,
    getRowId: (entry) => entry.id,
    initialSorting: [{ id: "at", desc: true }],
    resetKey: `${search}\u0000${actionFilter}`,
  });

  const emptyMessage =
    entries.length === 0
      ? "Aucune action enregistrée pour le moment."
      : "Aucun résultat ne correspond aux filtres.";

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        title="Journal d'activité"
        description="Historique des actions sensibles (créations, modifications, suppressions, connexions)."
      />

      <DataTableToolbar
        table={table}
        ariaLabel="Outils du journal"
        showViewOptions
        leading={
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un utilisateur, un élément…"
                aria-label="Rechercher dans le journal"
                className="h-9 bg-card pl-9 shadow-none"
              />
            </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-full bg-card shadow-none sm:w-48">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              {Object.entries(ACTION_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        }
        trailing={
          <>
            <DataTablePagination table={table} itemLabel="actions" variant="metadata" />
            <DataTablePagination table={table} itemLabel="actions" variant="controls" />
          </>
        }
        primaryAction={
          entries.length > 0 ? (
            <Button
              variant="ledger-text"
              className="text-destructive hover:text-destructive"
              onClick={() => setClearOpen(true)}
            >
              Vider le journal
            </Button>
          ) : undefined
        }
      >
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
        <Button variant="outline" className="h-9 shadow-none" onClick={handlePrint}>
          <Printer className="size-4" />
          Imprimer
        </Button>
      </DataTableToolbar>

      <DataTable
        table={table}
        isLoading={loading}
        emptyMessage={emptyMessage}
        mobileRow={(row) => {
          const entry = row.original;
          const Icon =
            entry.action === "connexion"
              ? LogIn
              : entry.action === "deconnexion"
                ? LogOut
                : iconFor(entry.entity);
          const meta = actionMetaFor(entry.action);
          return (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {entry.actor}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {entry.label}
                  </p>
                </div>
                <StatusDot tone={meta.tone} label={meta.label} />
              </div>
              <p className="mt-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                {formatDate(entry.at)} à {formatTime(entry.at)}
              </p>
            </div>
          );
        }}
        mobileFooter={
          <DataTablePagination table={table} itemLabel="actions" variant="mobile" />
        }
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Vider le journal d'activité ?"
        description="Tout l'historique sera définitivement supprimé."
        confirmLabel="Vider"
        onConfirm={() => {
          clear();
          toast.success("Journal vidé");
        }}
      />
    </div>
  );
}
