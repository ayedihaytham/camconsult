import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Briefcase,
  Building2,
  Copy,
  FolderOpen,
  GripVertical,
  HeartHandshake,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Eye,
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
import { ThemeBadge } from "@/components/common/badges";
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
import { cn, formatRelative } from "@/lib/utils";
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

const THEME_OPTIONS: SocieteTheme[] = [
  "PME",
  "Grande entreprise",
  "Association",
  "Profession libérale",
  "Auto-entrepreneur",
];

// Mêmes teintes que ThemeBadge (badges.tsx) — cohérence entre le tableau,
// les puces de filtre et la vue Cartes.
const THEME_ACCENT: Record<SocieteTheme, string> = {
  PME: "bg-chart-1/10 text-chart-1",
  "Grande entreprise": "bg-chart-2/10 text-chart-2",
  Association: "bg-warning/12 text-warning",
  "Profession libérale": "bg-chart-4/10 text-chart-4",
  "Auto-entrepreneur": "bg-chart-5/12 text-chart-5",
};

/** Pictogramme par thème — un repère instantané dans la vue Cartes, en plus
 * du nom (jamais la seule information : voir DESIGN-SYSTEM.md). */
const THEME_ICON: Record<SocieteTheme, LucideIcon> = {
  PME: Building2,
  "Grande entreprise": Landmark,
  Association: HeartHandshake,
  "Profession libérale": Briefcase,
  "Auto-entrepreneur": UserRound,
};

const STATUT_LABELS: Record<Statut, string> = {
  actif: "Actif",
  inactif: "Inactif",
  en_attente: "En attente",
};

/** Depuis quand la société est cliente — donnée réelle (creeLe), jamais une
 * estimation ; sert de repère de fidélité dans la vue Cartes. */
function clientSince(creeLe: string): string {
  const start = new Date(creeLe);
  if (Number.isNaN(start.getTime())) return "";
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (months < 1) return "Client depuis ce mois-ci";
  if (months < 12) return `Client depuis ${months} mois`;
  const years = Math.floor(months / 12);
  return `Client depuis ${years} an${years > 1 ? "s" : ""}`;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Retirer le filtre ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

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
    <div className="grid gap-4 border-t border-border/70 px-6 py-4 sm:grid-cols-[1fr_1fr_auto]">
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
  const [vue, setVue] = useState<"tableau" | "cartes">("tableau");
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
      cell: (s) => <StatutDot statut={s.statut} pill pulse={s.statut === "actif"} />,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      headerClassName: "w-[1%]",
      fixed: true,
      cell: (s) => (
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
      ),
    },
  ];

  return (
    <div className={cn(vue === "tableau" && selectedIds.length > 0 && "pb-16")}>
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
        filters={
          <div className="flex flex-wrap items-center gap-1.5">
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
                  <DropdownMenuSubTrigger>Thème</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-2xl">
                    {THEME_OPTIONS.map((t) => (
                      <DropdownMenuItem key={t} onClick={() => setThemeFilter(t)}>
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
        primaryAction={
          <div
            role="tablist"
            aria-label="Vue"
            className="inline-flex items-center gap-0.5 rounded-full bg-secondary/70 p-0.5 text-xs"
          >
            {(["tableau", "cartes"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vue === v}
                onClick={() => setVue(v)}
                className={cn(
                  "rounded-full px-3 py-1.5 font-semibold transition-colors",
                  vue === v
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "tableau" ? "Tableau" : "Cartes"}
              </button>
            ))}
          </div>
        }
      />

      {vue === "tableau" ? (
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
            enableColumnReorder
            enableColumnResize
            enableDensityToggle
            expandedIds={expandedIds}
            onExpandedIdsChange={setExpandedIds}
            renderExpanded={(s) => (
              <SocieteExpandedPanel societe={s} onOpenFull={() => openView(s)} />
            )}
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
      ) : filtered.length === 0 ? (
        <LedgerSheet>
          {rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={canEdit ? "Aucune société enregistrée" : "Aucune société accessible"}
              description={
                canEdit
                  ? "Ajoutez votre première société cliente pour commencer."
                  : "Aucune société ne vous a été assignée."
              }
            />
          ) : (
            <EmptyState
              title="Aucun résultat"
              description="Aucune société ne correspond à votre recherche ou à vos filtres."
            />
          )}
        </LedgerSheet>
      ) : (
        <LedgerSheet className="p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => {
              const ThemeIcon = THEME_ICON[s.theme];
              const n = employeCount.get(s.id) ?? 0;
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openView(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openView(s);
                    }
                  }}
                  className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        THEME_ACCENT[s.theme],
                      )}
                      aria-hidden
                    >
                      <ThemeIcon className="h-5 w-5" />
                    </span>
                    <StatutDot statut={s.statut} pill pulse={s.statut === "actif"} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {s.raisonSociale}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.code} · {s.theme}
                    </p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
                    <span>
                      {n === 0 ? "Aucun employé" : `${n} employé${n > 1 ? "s" : ""}`}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{clientSince(s.creeLe)}</span>
                  </div>
                  <div
                    className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LedgerRowMenu actions={societeMenuActions(s)} />
                  </div>
                </div>
              );
            })}
          </div>
        </LedgerSheet>
      )}

      <p className="mt-2.5 text-xs text-muted-foreground">
        {vue === "tableau" ? (
          <>
            Clic sur une ligne pour <Eye className="mb-0.5 inline h-3 w-3" /> voir
            la fiche société, ou sur le chevron pour un aperçu rapide sans
            quitter la page. Le menu « ⋯ » regroupe les autres actions —
            glissez l'icône <GripVertical className="mb-0.5 inline h-3 w-3" />{" "}
            d'un en-tête pour réordonner les colonnes, ou son bord droit pour
            la redimensionner.
          </>
        ) : (
          <>
            Clic sur une carte pour <Eye className="mb-0.5 inline h-3 w-3" /> voir
            la fiche société. Le menu « ⋯ » regroupe les autres actions.
          </>
        )}
      </p>

      {vue === "tableau" && selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
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
