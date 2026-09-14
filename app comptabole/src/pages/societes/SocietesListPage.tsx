import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  Copy,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  Eye,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerToolbar } from "@/components/ledger/LedgerToolbar";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutDot } from "@/components/ledger/StatusDot";
import { ThemeBadge } from "@/components/common/badges";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
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
import { cn } from "@/lib/utils";
import { useData, useSocietes, nextSocieteCode } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import type { Societe } from "@/types";
import {
  SocieteFormSheet,
  type SocieteFormValues,
} from "./SocieteFormSheet";
import { SocieteViewSheet } from "./SocieteViewSheet";

// Classes écrites en toutes lettres (le scanner JIT Tailwind ne détecte pas
// les noms de classe construits par interpolation).
const AVATAR_COLORS = [
  "bg-chart-1/10 text-chart-1",
  "bg-chart-2/10 text-chart-2",
  "bg-chart-3/10 text-chart-3",
  "bg-chart-4/10 text-chart-4",
  "bg-chart-5/10 text-chart-5",
];
/** Couleur stable par société (dérivée de l'id, pas aléatoire à chaque
 * rendu) — simple repère visuel, jamais le seul indice d'information. */
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const THEME_OPTIONS = [
  "PME",
  "Grande entreprise",
  "Association",
  "Profession libérale",
  "Auto-entrepreneur",
];

// Filtres Select : même primitive (Radix, accessible) que le reste de l'app,
// réhabillée en pilule pour rester dans l'esprit de la nouvelle direction
// visuelle — pas de fork.
const selectTriggerClass =
  "h-auto w-auto gap-1.5 rounded-full border border-transparent bg-secondary/70 px-3.5 py-2 text-sm shadow-none transition-colors hover:bg-secondary focus:ring-0 data-[placeholder]:text-muted-foreground";

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

  const columns: DataTableColumn<Societe>[] = [
    {
      id: "raisonSociale",
      header: "Raison sociale",
      sortable: true,
      sortAccessor: (s) => s.raisonSociale.toLowerCase(),
      cell: (s) => (
        <div className="flex min-w-[200px] items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
              avatarColor(s.id),
            )}
            aria-hidden
          >
            {s.raisonSociale.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{s.raisonSociale}</p>
            <p className="truncate text-xs text-muted-foreground">{s.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "rne",
      header: "RNE",
      sortable: true,
      sortAccessor: (s) => s.rne,
      headerClassName: "hidden lg:table-cell",
      className: "hidden lg:table-cell",
      cell: (s) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {s.rne}
        </span>
      ),
    },
    {
      id: "tva",
      header: "TVA",
      headerClassName: "hidden xl:table-cell",
      className: "hidden xl:table-cell",
      cell: (s) => (
        <span className="font-mono text-xs text-muted-foreground">{s.tva}</span>
      ),
    },
    {
      id: "theme",
      header: "Thème",
      sortable: true,
      sortAccessor: (s) => s.theme,
      cell: (s) => <ThemeBadge theme={s.theme} />,
    },
    {
      id: "code",
      header: "Code",
      sortable: true,
      sortAccessor: (s) => s.code,
      cell: (s) => (
        <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
          {s.code}
        </span>
      ),
    },
    {
      id: "employes",
      header: "Employés",
      sortable: true,
      sortAccessor: (s) => employeCount.get(s.id) ?? 0,
      cell: (s) => {
        const n = employeCount.get(s.id) ?? 0;
        return (
          <span className="text-sm text-muted-foreground">
            {n === 0 ? "—" : `${n} employé${n > 1 ? "s" : ""}`}
          </span>
        );
      },
    },
    {
      id: "statut",
      header: "Statut",
      sortable: true,
      sortAccessor: (s) => s.statut,
      cell: (s) => <StatutDot statut={s.statut} pill />,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      headerClassName: "w-[1%]",
      cell: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <LedgerRowMenu
            actions={[
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
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <LedgerPageHeader
        title="Liste des sociétés"
        description={
          isAdmin
            ? "Gérez les sociétés clientes du cabinet."
            : "Sociétés auxquelles vous avez accès."
        }
        actions={
          canEdit ? (
            <Button
              variant="ledger"
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

      <LedgerToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher une société, un RNE, un code…"
        onExport={handleExport}
        onPrint={handlePrint}
        selectedCount={selectedIds.length}
        onDeleteSelected={
          canDelete ? () => setBulkDeleteOpen(true) : undefined
        }
        onClearSelection={() => setSelectedIds([])}
        filters={
          <>
            <Select value={themeFilter} onValueChange={setThemeFilter}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Thème" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les thèmes</SelectItem>
                {THEME_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="inactif">Inactif</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <LedgerSheet>
        <LedgerTable
          columns={columns}
          data={filtered}
          getRowId={(s) => s.id}
          enableSelection
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onRowClick={openView}
          initialSort={{ columnId: "raisonSociale", direction: "asc" }}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={
                  canEdit
                    ? "Aucune société enregistrée"
                    : "Aucune société accessible"
                }
                description={
                  canEdit
                    ? "Ajoutez votre première société cliente pour commencer."
                    : "Aucune société ne vous a été assignée."
                }
                action={
                  canEdit ? (
                    <Button
                      variant="ledger"
                      size="sm"
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
            ) : (
              <EmptyState
                title="Aucun résultat"
                description="Aucune société ne correspond à votre recherche ou à vos filtres."
              />
            )
          }
        />
      </LedgerSheet>
      <p className="mt-2.5 text-xs text-muted-foreground">
        Clic sur une ligne pour <Eye className="mb-0.5 inline h-3 w-3" /> voir
        la fiche société. Le menu « ⋯ » regroupe les autres actions.
      </p>

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
