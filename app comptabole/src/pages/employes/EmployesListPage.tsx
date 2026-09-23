import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calculator,
  Copy,
  Eye,
  GraduationCap,
  GripVertical,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerToolbar } from "@/components/ledger/LedgerToolbar";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { StatutDot } from "@/components/ledger/StatusDot";
import { FilterChip } from "@/components/ledger/FilterChip";
import { STATUT_LABELS } from "@/components/common/badges";
import { PasswordCell } from "@/components/common/PasswordCell";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
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
import { avatarColor, cn, initials, sinceLabel } from "@/lib/utils";
import { employeNomComplet } from "@/data/employes";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import {
  useData,
  useCollaborateurs,
  useSocietes,
  defaultPermissions,
  PERMISSION_LABELS,
} from "@/store/data";
import type { Employe, EmployeType, PermissionKey, Statut } from "@/types";
import { EmployeFormSheet, type EmployeFormValues } from "./EmployeFormSheet";
import { EmployeAccesSheet } from "./EmployeAccesSheet";
import { EmployeViewSheet } from "./EmployeViewSheet";

const TYPES: EmployeType[] = [
  "Comptable",
  "Assistant",
  "Stagiaire",
  "Gestionnaire de paie",
];

// Même logique de wayfinding par couleur que Sociétés (barre pleine hauteur
// + fond teinté) — chart-1..5 = catégorie, jamais un statut (voir
// DESIGN-SYSTEM.md §1bis/§5). Le texte du type reste toujours non coloré.
const TYPE_ACCENT: Record<EmployeType, string> = {
  Comptable: "bg-chart-1/10 text-chart-1",
  Assistant: "bg-chart-4/10 text-chart-4",
  Stagiaire: "bg-warning/12 text-warning",
  "Gestionnaire de paie": "bg-chart-2/10 text-chart-2",
};
const TYPE_BAR: Record<EmployeType, string> = {
  Comptable: "bg-chart-1",
  Assistant: "bg-chart-4",
  Stagiaire: "bg-warning",
  "Gestionnaire de paie": "bg-chart-2",
};
const TYPE_ICON: Record<EmployeType, LucideIcon> = {
  Comptable: Calculator,
  Assistant: UserRound,
  Stagiaire: GraduationCap,
  "Gestionnaire de paie": Wallet,
};

/** Panneau de l'accordéon inline (voir LedgerTable `renderExpanded`) —
 * composant à part entière car les droits/sociétés assignées ont besoin
 * d'accéder à `societes` (via prop plutôt qu'un hook, ici pas de store
 * dédié nécessaire). */
function EmployeExpandedPanel({
  employe,
  societes,
  onOpenFull,
}: {
  employe: Employe;
  societes: ReturnType<typeof useSocietes>;
  onOpenFull: () => void;
}) {
  const societesNoms = employe.societesAssignees
    .map((id) => societes.find((s) => s.id === id)?.raisonSociale)
    .filter((n): n is string => Boolean(n));
  const droitsActifs = (Object.keys(PERMISSION_LABELS) as PermissionKey[]).filter(
    (k) => employe.permissions?.[k],
  );

  return (
    <div className="grid gap-3 border-t border-border/70 px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
      <div className="min-w-0">
        <p className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
          Sociétés assignées
        </p>
        {societesNoms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune société assignée.</p>
        ) : (
          <ul className="space-y-1">
            {societesNoms.slice(0, 3).map((nom) => (
              <li key={nom} className="truncate text-sm text-foreground">
                {nom}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0">
        <p className="mb-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
          Droits actifs
        </p>
        {droitsActifs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun droit accordé.</p>
        ) : (
          <p className="text-sm text-foreground">
            {droitsActifs.map((k) => PERMISSION_LABELS[k]).join(" · ")}
          </p>
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

export function EmployesListPage() {
  const { isAdmin } = usePermissions();
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
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

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
    setSelectedIds([]);
  }

  function bulkSetType(type: EmployeType) {
    const ids = selectedIds;
    ids.forEach((id) => updateEmploye(id, { type }));
    logJournal("modification", "employe", `${ids.length} collaborateurs — type « ${type} »`);
    toast.success(
      `Type « ${type} » appliqué à ${ids.length} collaborateur${ids.length > 1 ? "s" : ""}`,
    );
    setSelectedIds([]);
  }

  function bulkSetInactive() {
    const ids = selectedIds;
    ids.forEach((id) => updateEmploye(id, { statut: "inactif" }));
    logJournal("modification", "employe", `${ids.length} collaborateurs marqués inactifs`);
    toast.success(
      `${ids.length} collaborateur${ids.length > 1 ? "s" : ""} marqué${ids.length > 1 ? "s" : ""} inactif${ids.length > 1 ? "s" : ""}`,
    );
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

  function employeMenuActions(e: Employe) {
    return [
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

  const columns: DataTableColumn<Employe>[] = [
    {
      id: "nom",
      header: "Collaborateur",
      sortable: true,
      sortAccessor: (e) => e.nom.toLowerCase(),
      // Cellule "riche" pleine hauteur (même traitement que Sociétés) :
      // avatar XL + barre de couleur par type + 2 lignes de repères, plutôt
      // que d'étaler Type / Sociétés assignées / Droits sur des colonnes
      // fines séparées (droits déplacés dans l'accordéon inline).
      className: "relative p-0",
      cell: (e) => (
        <div className="flex min-w-[240px] items-center gap-3 py-3 pl-4 pr-2">
          <span className={cn("absolute inset-y-0 left-0 w-1", TYPE_BAR[e.type])} aria-hidden />
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
              avatarColor(e.id),
            )}
            aria-hidden
          >
            {initials(employeNomComplet(e))}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[0.95rem] font-bold text-foreground">
              {employeNomComplet(e)}
              {e.role === "responsable_collaborateurs" && (
                <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-accent-foreground">
                  Chef d'équipe
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {e.type} ·{" "}
              {e.role === "responsable_collaborateurs"
                ? "Toutes les sociétés"
                : e.societesAssignees.length === 0
                  ? "Aucune société"
                  : `${e.societesAssignees.length} société${e.societesAssignees.length > 1 ? "s" : ""}`}
            </p>
            <p className="truncate text-xs text-muted-foreground/75">{e.email}</p>
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
      id: "statut",
      header: "Statut",
      sortable: true,
      sortAccessor: (e) => e.statut,
      cell: (e) => <StatutDot statut={e.statut} pill pulse={e.statut === "actif"} />,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      headerClassName: "w-[1%]",
      fixed: true,
      cell: (e) => (
        <div
          className="flex items-center justify-end gap-0.5"
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => openView(e)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label={`Voir ${employeNomComplet(e)}`}
              title="Voir"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(e);
                setFormOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label={`Modifier ${employeNomComplet(e)}`}
              title="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <LedgerRowMenu actions={employeMenuActions(e)} />
        </div>
      ),
    },
  ];

  return (
    <div className={cn("flex flex-1 flex-col", selectedIds.length > 0 && "md:pb-16")}>
      <LedgerPageHeader
        title="Collaborateurs"
        description="Équipe interne du cabinet : comptes, rôles et périmètre d'accès."
      />

      <LedgerToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher un collaborateur, un identifiant…"
        onExport={handleExport}
        onPrint={handlePrint}
        primaryAction={
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
        filters={
          <div className="flex flex-wrap items-center gap-1.5">
            {typeFilter !== "all" && (
              <FilterChip label={`Type : ${typeFilter}`} onRemove={() => setTypeFilter("all")} />
            )}
            {statutFilter !== "all" && (
              <FilterChip
                label={`Statut : ${STATUT_LABELS[statutFilter as Statut]}`}
                onRemove={() => setStatutFilter("all")}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Filtre
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-2xl">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Type</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-2xl">
                    {TYPES.map((t) => (
                      <DropdownMenuItem key={t} onClick={() => setTypeFilter(t)}>
                        {t}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Statut</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-2xl">
                    {(Object.keys(STATUT_LABELS) as Statut[]).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => setStatutFilter(s)}>
                        {STATUT_LABELS[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Tableau sur PC/tablette, Cartes sur mobile — purement responsive,
          jamais un choix laissé à l'utilisateur (voir SocietesListPage,
          même traitement). */}
      <div className="hidden md:flex md:flex-1 md:flex-col">
        <LedgerSheet className="flex-1">
          <LedgerTable
            columns={columns}
            data={filtered}
            getRowId={(e) => e.id}
            enableSelection
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            onRowClick={openView}
            initialSort={{ columnId: "nom", direction: "asc" }}
            enableColumnReorder
            enableColumnResize
            expandedIds={expandedIds}
            onExpandedIdsChange={setExpandedIds}
            renderExpanded={(e) => (
              <EmployeExpandedPanel
                employe={e}
                societes={societes}
                onOpenFull={() => openView(e)}
              />
            )}
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
      </div>

      <div className="md:hidden">
        {filtered.length === 0 ? (
          <LedgerSheet>
            {rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun collaborateur"
                description="Créez le premier compte collaborateur du cabinet."
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description="Aucun collaborateur ne correspond à votre recherche ou à vos filtres."
              />
            )}
          </LedgerSheet>
        ) : (
          <LedgerSheet className="p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((e) => {
                const TypeIcon = TYPE_ICON[e.type];
                return (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openView(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        openView(e);
                      }
                    }}
                    className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          TYPE_ACCENT[e.type],
                        )}
                        aria-hidden
                      >
                        <TypeIcon className="h-5 w-5" />
                      </span>
                      <StatutDot statut={e.statut} pill pulse={e.statut === "actif"} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {employeNomComplet(e)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.identifiant} · {e.type}
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
                      <span>
                        {e.societesAssignees.length === 0
                          ? "Aucune société"
                          : `${e.societesAssignees.length} société${e.societesAssignees.length > 1 ? "s" : ""}`}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{sinceLabel(e.creeLe, "Depuis")}</span>
                    </div>
                    <div
                      className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <LedgerRowMenu actions={employeMenuActions(e)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </LedgerSheet>
        )}
      </div>

      <p className="mt-2.5 hidden text-xs text-muted-foreground md:block">
        Clic sur une ligne pour <Eye className="mb-0.5 inline h-3 w-3" /> voir
        la fiche collaborateur, ou sur le chevron pour un aperçu rapide
        sans quitter la page. Le menu « ⋯ » regroupe les autres actions —
        glissez l'icône <GripVertical className="mb-0.5 inline h-3 w-3" />{" "}
        d'un en-tête pour réordonner les colonnes, ou son bord droit pour
        la redimensionner.
      </p>
      <p className="mt-2.5 text-xs text-muted-foreground md:hidden">
        Touchez une carte pour <Eye className="mb-0.5 inline h-3 w-3" /> voir
        la fiche collaborateur. Le menu « ⋯ » regroupe les autres actions.
      </p>

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 hidden justify-center px-4 md:flex">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground shadow-pop animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="px-2 font-semibold">
              {selectedIds.length} collaborateur{selectedIds.length > 1 ? "s" : ""}{" "}
              sélectionné{selectedIds.length > 1 ? "s" : ""}
            </span>
            <span className="mx-1 h-4 w-px bg-primary-foreground/20" aria-hidden />
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              className="rounded-full px-3 py-1.5 font-medium transition-colors hover:bg-primary-foreground/10"
            >
              Exporter
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 font-medium transition-colors hover:bg-primary-foreground/10"
                >
                  Assigner un type
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="rounded-2xl">
                {TYPES.map((t) => (
                  <DropdownMenuItem key={t} onClick={() => bulkSetType(t)}>
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={bulkSetInactive}
              className="rounded-full px-3 py-1.5 font-medium transition-colors hover:bg-primary-foreground/10"
            >
              Marquer inactif
            </button>
            {isAdmin && (
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

      <EmployeFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
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
