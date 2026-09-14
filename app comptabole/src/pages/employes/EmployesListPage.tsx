import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerToolbar } from "@/components/ledger/LedgerToolbar";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutDot } from "@/components/ledger/StatusDot";
import { PasswordCell } from "@/components/common/PasswordCell";
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
import { employeNomComplet } from "@/data/employes";
import { logJournal } from "@/store/journal";
import {
  useData,
  useCollaborateurs,
  useSocietes,
  defaultPermissions,
  PERMISSION_LABELS,
} from "@/store/data";
import type { Employe, EmployeType, PermissionKey } from "@/types";
import { EmployeFormSheet, type EmployeFormValues } from "./EmployeFormSheet";
import { EmployeAccesSheet } from "./EmployeAccesSheet";
import { EmployeViewSheet } from "./EmployeViewSheet";

const TYPES: EmployeType[] = [
  "Comptable",
  "Assistant",
  "Stagiaire",
  "Gestionnaire de paie",
];

const selectTriggerClass =
  "h-auto w-auto gap-1.5 rounded-none border-0 border-b border-border bg-transparent px-0 pb-1.5 text-sm shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

export function EmployesListPage() {
  const rows = useCollaborateurs();
  const societes = useSocietes();
  const addEmploye = useData((s) => s.addEmploye);
  const updateEmploye = useData((s) => s.updateEmploye);
  const duplicateEmploye = useData((s) => s.duplicateEmploye);
  const deleteEmployes = useData((s) => s.deleteEmployes);
  const setEmployeAcces = useData((s) => s.setEmployeAcces);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statutFilter, setStatutFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employe | null>(null);
  const [accesOpen, setAccesOpen] = useState(false);
  const [accesTarget, setAccesTarget] = useState<Employe | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<Employe | null>(null);
  const [toDelete, setToDelete] = useState<Employe | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((e) => {
      const matchQ =
        !q ||
        [e.prenom, e.nom, e.identifiant, e.email, e.type]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchType = typeFilter === "all" || e.type === typeFilter;
      const matchStatut = statutFilter === "all" || e.statut === statutFilter;
      return matchQ && matchType && matchStatut;
    });
  }, [rows, search, typeFilter, statutFilter]);

  function handleSubmit(values: EmployeFormValues) {
    const nom = `${values.prenom} ${values.nom}`;
    if (editing) {
      updateEmploye(editing.id, values);
      logJournal("modification", "employe", nom);
      toast.success("Collaborateur modifié", { description: nom });
    } else {
      addEmploye({
        ...values,
        role: "collaborateur",
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
    setSelectedIds([]);
  }

  function handleExport(format: ExportFormat) {
    const source =
      selectedIds.length > 0
        ? filtered.filter((e) => selectedIds.includes(e.id))
        : filtered;
    exportRows(
      "employes",
      source,
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
              .map(
                (id) =>
                  societes.find((s) => s.id === id)?.raisonSociale ?? id,
              )
              .join(" | "),
        },
        {
          header: "Permissions",
          value: (e) =>
            (Object.keys(PERMISSION_LABELS) as PermissionKey[])
              .filter((k) => e.permissions?.[k])
              .map((k) => PERMISSION_LABELS[k])
              .join(" | "),
        },
      ],
      format,
    );
    toast.success(`Export ${format.toUpperCase()} généré`);
  }

  function handlePrint() {
    const source =
      selectedIds.length > 0
        ? filtered.filter((e) => selectedIds.includes(e.id))
        : filtered;
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
          value: (e) =>
            e.permissions
              ? Object.values(e.permissions).filter(Boolean).length + "/5"
              : "0/5",
          align: "right",
        },
      ],
      rows: source,
    });
  }

  function openView(e: Employe) {
    setViewing(e);
    setViewOpen(true);
  }

  const columns: DataTableColumn<Employe>[] = [
    {
      id: "nom",
      header: "Collaborateur",
      sortable: true,
      sortAccessor: (e) => e.nom.toLowerCase(),
      cell: (e) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold text-foreground">
            {e.prenom[0]}
            {e.nom[0]}
          </span>
          <div>
            <p className="font-semibold text-foreground">
              {employeNomComplet(e)}
            </p>
            <p className="text-xs text-muted-foreground">{e.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "acces",
      header: "Identifiant / Mot de passe",
      sortable: true,
      sortAccessor: (e) => e.identifiant,
      cell: (e) => (
        <div className="space-y-0.5" onClick={(ev) => ev.stopPropagation()}>
          <div className="text-sm font-medium text-foreground">
            {e.identifiant}
          </div>
          <PasswordCell value={e.motDePasse} />
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortable: true,
      sortAccessor: (e) => e.type,
      // Catégoriel, pas de statut : pas de couleur — voir DESIGN-SYSTEM.md §5.
      cell: (e) => <span className="text-sm text-foreground">{e.type}</span>,
    },
    {
      id: "acces_perimetre",
      header: "Accès",
      cell: (e) => {
        const nbPerms = e.permissions
          ? Object.values(e.permissions).filter(Boolean).length
          : 0;
        return (
          <div className="whitespace-nowrap text-sm text-muted-foreground">
            <span>
              {e.societesAssignees.length} société
              {e.societesAssignees.length > 1 ? "s" : ""}
            </span>
            <span className="mx-1.5 text-border">·</span>
            <span>{nbPerms}/5 droits</span>
          </div>
        );
      },
    },
    {
      id: "statut",
      header: "Statut",
      sortable: true,
      sortAccessor: (e) => e.statut,
      cell: (e) => <StatutDot statut={e.statut} />,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      headerClassName: "w-[1%]",
      cell: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <LedgerRowMenu
            actions={[
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
              {
                icon: Trash2,
                label: "Supprimer",
                destructive: true,
                onClick: () => setToDelete(e),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <LedgerPageHeader
        title="Collaborateurs"
        description="Équipe interne du cabinet : comptes, rôles et périmètre d'accès."
        actions={
          <Button
            variant="ledger"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Ajouter un collaborateur
          </Button>
        }
      />

      <LedgerToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher un collaborateur, un identifiant…"
        onExport={handleExport}
        onPrint={handlePrint}
        selectedCount={selectedIds.length}
        onDeleteSelected={() => setBulkDeleteOpen(true)}
        onClearSelection={() => setSelectedIds([])}
        filters={
          <>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {TYPES.map((t) => (
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
          getRowId={(e) => e.id}
          enableSelection
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onRowClick={openView}
          initialSort={{ columnId: "nom", direction: "asc" }}
          emptyState={
            rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun collaborateur"
                description="Créez le premier compte collaborateur du cabinet."
                action={
                  <Button
                    variant="ledger"
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un collaborateur
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description="Aucun collaborateur ne correspond à votre recherche ou à vos filtres."
              />
            )
          }
        />
      </LedgerSheet>
      <p className="mt-2.5 text-xs text-muted-foreground">
        Clic sur une ligne pour <Eye className="mb-0.5 inline h-3 w-3" /> voir
        la fiche collaborateur. Le menu « ⋯ » regroupe les autres actions.
      </p>

      <EmployeFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        employe={editing}
        onSubmit={handleSubmit}
      />

      <EmployeAccesSheet
        open={accesOpen}
        onOpenChange={setAccesOpen}
        employe={accesTarget}
        onSave={(id, societesAssignees, permissions) => {
          setEmployeAcces(id, societesAssignees, permissions);
          const e = rows.find((x) => x.id === id);
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
        onOpenChange={(o) => !o && setToDelete(null)}
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
