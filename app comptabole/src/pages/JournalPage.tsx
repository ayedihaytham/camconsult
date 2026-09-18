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
  type LucideIcon,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerToolbar } from "@/components/ledger/LedgerToolbar";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { StatusDot, type StatusTone } from "@/components/ledger/StatusDot";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
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

const selectTriggerClass =
  "h-auto w-auto gap-1.5 rounded-none border-0 border-b border-border bg-transparent px-0 pb-1.5 text-sm shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

export function JournalPage() {
  const entries = useJournal((s) => s.entries);
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

  return (
    <div className="flex min-h-full flex-col">
      <LedgerPageHeader
        title="Journal d'activité"
        description="Historique des actions sensibles (créations, modifications, suppressions, connexions)."
      />

      <LedgerToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher un utilisateur, un élément…"
        onExport={handleExport}
        onPrint={handlePrint}
        filters={
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className={selectTriggerClass}>
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
      />

      <LedgerSheet className="flex-1">
        {filtered.length === 0 ? (
          <EmptyState
            title="Journal vide"
            description="Aucune action enregistrée pour le moment."
          />
        ) : (
          <div>
            {filtered.map((e, i) => {
              const Icon = iconFor(e.entity);
              const meta = actionMetaFor(e.action);
              return (
                <div
                  key={e.id}
                  className={
                    "flex items-center gap-3 px-4 py-3 text-sm " +
                    (i === filtered.length - 1
                      ? ""
                      : (i + 1) % 5 === 0
                        ? "border-b-[1.5px] border-rule-strong"
                        : "border-b border-border")
                  }
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border text-muted-foreground">
                    {e.action === "connexion" ? (
                      <LogIn className="h-4 w-4" />
                    ) : e.action === "deconnexion" ? (
                      <LogOut className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">
                      <span className="font-semibold">{e.actor}</span>{" "}
                      <span className="text-muted-foreground">
                        · {e.label}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.at)} à {formatTime(e.at)}
                    </p>
                  </div>
                  <StatusDot tone={meta.tone} label={meta.label} />
                </div>
              );
            })}
          </div>
        )}
      </LedgerSheet>

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
