import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  Download,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Printer,
  Settings2,
  Trash2,
  Eye,
  Building2,
} from "lucide-react";
import type { ColumnDef, Table as TanstackTable } from "@tanstack/react-table";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { OperationalFab } from "@/components/ledger/OperationalFab";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import { StatutDot } from "@/components/ledger/StatusDot";
import { LedgerSearchFilter } from "@/components/ledger/LedgerSearchFilter";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerPage,
  OperationalLedgerFooter,
  OperationalLedgerToolbar,
  OperationalMobileHeader,
  OperationalMobilePagination,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { useDataTable } from "@/components/data-table/useDataTable";
import { useOperationalPageSize } from "@/components/data-table/useOperationalPageSize";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { STATUT_LABELS } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { THEME_OPTIONS } from "@/lib/societeTheme";
import { provisionnerArborescenceSociete } from "@/lib/classement";
import {
  useData,
  useNoeuds,
  useSocietes,
  useTaches,
  nextSocieteCode,
} from "@/store/data";
import { useCollectes } from "@/store/collectes";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import { periodeMois } from "@/lib/collecte/periodes";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import type { Collecte, Societe, SocieteTheme, Statut } from "@/types";
import { SocieteFormSheet, type SocieteFormValues } from "./SocieteFormSheet";
import { SocieteViewSheet } from "./SocieteViewSheet";

const MONOGRAM_TONES = [
  "border-primary/15 bg-primary/[0.07] text-primary",
  "border-border bg-secondary text-primary/80",
  "border-accent/35 bg-accent/10 text-primary",
] as const;

function societeInitials(name: string) {
  const order = name.trim().match(/^\d{1,3}/);
  if (order) return order[0];
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
  onExport,
  onSetTheme,
  onSetInactive,
}: {
  onExport?: () => void;
  onSetTheme: (theme: SocieteTheme) => void;
  onSetInactive: () => void;
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

function SocietesFilterControls({
  themeFilter,
  statutFilter,
  onSetStatut,
  onSetTheme,
}: {
  themeFilter: string;
  statutFilter: string;
  onSetStatut: (statut: Statut) => void;
  onSetTheme: (theme: SocieteTheme) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Type de structure</p>
        <Select value={themeFilter} onValueChange={(value) => onSetTheme(value as SocieteTheme)}>
          <SelectTrigger aria-label="Filtrer par type de structure">
            <SelectValue placeholder="Type de structure" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {THEME_OPTIONS.map((theme) => (
              <SelectItem key={theme} value={theme}>{theme}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Statut</p>
        <Select value={statutFilter} onValueChange={onSetStatut}>
          <SelectTrigger aria-label="Filtrer par statut">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {(Object.keys(STATUT_LABELS) as Statut[]).map((statut) => (
              <SelectItem key={statut} value={statut}>{STATUT_LABELS[statut]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
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
  const addNoeud = useData((s) => s.addNoeud);
  const updateNoeud = useData((s) => s.updateNoeud);
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
  const voitTaches = isAdmin || isCollaborateur;
  const noeuds = useNoeuds();
  const collectes = useCollectes((state) => state.list);
  const fetchCollectes = useCollectes((state) => state.fetchList);
  // Une seule lecture de la liste des collectes (toutes sociétés) pour les chiffres et la fiche : pas de requête par société.
  useEffect(() => {
    if (voitTaches) void fetchCollectes().catch(() => undefined);
  }, [voitTaches, fetchCollectes]);
  const openTaskCount = useMemo(() => {
    const counts = new Map<string, number>();
    if (!voitTaches) return counts;
    for (const task of taches) {
      if (task.statut !== "termine") {
        counts.set(task.societeId, (counts.get(task.societeId) ?? 0) + 1);
      }
    }
    return counts;
  }, [voitTaches, taches]);
  const dossiersParSociete = useMemo(() => {
    const map = new Map<string, number>();
    for (const noeud of noeuds) {
      if (noeud.type === "dossier" && noeud.societeId) map.set(noeud.societeId, (map.get(noeud.societeId) ?? 0) + 1);
    }
    return map;
  }, [noeuds]);
  // Contact affiché : le responsable de la société (sinon un délégué), avec le nombre de délégués.
  const contactPrincipal = useMemo(() => {
    const map = new Map<string, { nom: string; role: "Responsable" | "Délégué"; delegues: number }>();
    for (const e of employes) {
      if (e.role !== "societe_employe" || !e.societeId) continue;
      const actuel = map.get(e.societeId);
      if (!e.delegue) {
        map.set(e.societeId, { nom: `${e.prenom} ${e.nom}`, role: "Responsable", delegues: actuel?.delegues ?? 0 });
      } else if (!actuel) {
        map.set(e.societeId, { nom: `${e.prenom} ${e.nom}`, role: "Délégué", delegues: 0 });
      } else {
        actuel.delegues += 1;
      }
    }
    return map;
  }, [employes]);
  // Collecte du mois en cours, par société (statuts réels : brouillon, transmise, à corriger, validée).
  const moisCourant = periodeMois(new Date());
  const collecteDuMois = useMemo(() => {
    const map = new Map<string, Collecte>();
    for (const collecte of collectes) {
      if (collecte.statut === "archive" || collecte.periode.trim().toLowerCase() !== moisCourant.toLowerCase()) continue;
      if (!map.has(collecte.societeId)) map.set(collecte.societeId, collecte);
    }
    return map;
  }, [collectes, moisCourant]);
  const moisNom = moisCourant.split(" ")[0].toLowerCase();
  const libelleCollecte = `Collecte ${/^[aeiouhéèêàâîôû]/i.test(moisNom) ? "d'" : "de "}${moisNom}`;
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
      const creee = await addSociete(values);
      logJournal("creation", "societe", values.raisonSociale);
      toast.success("Société créée", { description: values.raisonSociale });
      // Son arborescence documentaire standard se prépare en arrière-plan : la création de la société n'attend pas, et un compte
      // qui ne peut pas déposer de fichiers ne reçoit aucune erreur.
      if (isAdmin || can("deposerFichiers")) {
        void provisionnerArborescenceSociete({
          noeuds: useData.getState().noeuds,
          addNoeud,
          updateNoeud,
          societeId: creee.id,
          societeLibelle: creee.raisonSociale,
        }).catch(() => undefined);
      }
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
              <p className="societes-ledger-name truncate text-[13px] font-semibold leading-4 text-foreground">
                {s.raisonSociale}
              </p>
              <p className="societes-ledger-meta truncate text-[11px] leading-4 text-muted-foreground">
                {s.theme} · {s.rne || "RNE non renseigné"}
              </p>
            </div>
          </div>
        );
      },
      meta: { label: "Société", headerClassName: "w-[30%]" },
    },
    {
      id: "contactCle",
      accessorFn: (societe) => contactPrincipal.get(societe.id)?.nom.toLowerCase() ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Contact" />
      ),
      cell: ({ row }) => {
        const contact = contactPrincipal.get(row.original.id);
        if (!contact) {
          return <span className="text-xs text-muted-foreground">Aucun contact</span>;
        }
        return (
          <div className="min-w-0">
            <p className="societes-ledger-contact truncate text-[13px] font-medium text-foreground">{contact.nom}</p>
            <p className="societes-ledger-meta truncate text-[11px] text-muted-foreground">
              {contact.role}
              {contact.delegues > 0 && ` · ${contact.delegues} délégué${contact.delegues > 1 ? "s" : ""}`}
            </p>
          </div>
        );
      },
      meta: { label: "Contact", headerClassName: "w-[17%]" },
    },
    {
      id: "collecteMois",
      accessorFn: (societe) => collecteDuMois.get(societe.id)?.statut ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={libelleCollecte} />
      ),
      cell: ({ row }) => {
        if (!voitTaches) return <span className="text-xs text-muted-foreground">—</span>;
        const collecte = collecteDuMois.get(row.original.id);
        if (!collecte) return <span className="text-xs text-muted-foreground">Aucune collecte</span>;
        const style: Record<string, string> = {
          brouillon: "border border-border bg-muted/60 text-muted-foreground",
          transmis: "bg-primary/10 text-primary",
          a_corriger: "bg-destructive/10 text-destructive",
          valide: "bg-success/10 text-success",
        };
        const libelle: Record<string, string> = { transmis: "Transmise", valide: "Validée" };
        return (
          <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-bold", style[collecte.statut])}>
            {libelle[collecte.statut] ?? COLLECTE_STATUT_LABELS[collecte.statut]}
          </span>
        );
      },
      meta: { label: libelleCollecte, headerClassName: "w-[15%]" },
    },
    {
      id: "tachesOuvertes",
      accessorFn: (societe) => openTaskCount.get(societe.id) ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tâches" />
      ),
      cell: ({ row }) => {
        if (!voitTaches) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const count = openTaskCount.get(row.original.id) ?? 0;
        return (
          <span className={cn("text-[13px] font-bold tabular-nums", count === 0 ? "font-normal text-muted-foreground/50" : "text-primary")}>
            {count}
          </span>
        );
      },
      meta: { label: "Tâches en cours", headerClassName: "w-20 text-right", cellClassName: "text-right" },
    },
    {
      id: "dossiers",
      accessorFn: (societe) => dossiersParSociete.get(societe.id) ?? 0,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Dossiers" />
      ),
      cell: ({ row }) => {
        const count = dossiersParSociete.get(row.original.id) ?? 0;
        return (
          <span className={cn("text-[13px] font-bold tabular-nums", count === 0 ? "font-normal text-muted-foreground/50" : "text-primary")}>
            {count}
          </span>
        );
      },
      meta: { label: "Dossiers", headerClassName: "w-24 text-right", cellClassName: "text-right" },
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
            <span className="mr-1 hidden items-center gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 lg:flex">
              <Button type="button" variant="outline" size="sm" className="h-7 border-accent bg-accent/15 px-2.5 text-xs shadow-none hover:bg-accent/30" onClick={() => openView(s)}>
                Fiche
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs shadow-none" onClick={() => navigate(`/structuration?societe=${s.id}`)}>
                Dossiers
              </Button>
            </span>
            <LedgerRowMenu actions={societeMenuActions(s)} />
          </div>
        );
      },
      meta: {
        headerClassName: "w-56",
        cellClassName: "w-56",
      },
    },
  ];

  const pageSize = useOperationalPageSize(10);
  const table = useDataTable({
    columns,
    data: filtered,
    getRowId: (societe) => societe.id,
    initialSorting: [{ id: "raisonSociale", desc: false }],
    pageSize,
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

  const activeFilterCount =
    (themeFilter !== "all" ? 1 : 0) + (statutFilter !== "all" ? 1 : 0);
  const isMobileSelectionActive = mobileSelectionMode || selectedIds.length > 0;

  const renderSearchFilter = (className?: string) => (
    <LedgerSearchFilter
      value={search}
      onValueChange={setSearch}
      placeholder="Rechercher une société, RNE ou code"
      searchLabel="Rechercher une société"
      filterLabel="Filtrer les sociétés"
      activeFilterCount={activeFilterCount}
      onReset={() => {
        setThemeFilter("all");
        setStatutFilter("all");
      }}
      className={className}
    >
      <SocietesFilterControls
        themeFilter={themeFilter}
        statutFilter={statutFilter}
        onSetTheme={setThemeFilter}
        onSetStatut={setStatutFilter}
      />
    </LedgerSearchFilter>
  );

  return (
    <OperationalLedgerPage
      className={cn(
        "societes-ledger-page flex-1",
        canEdit && !isMobileSelectionActive && "ledger-fab-clearance lg:pb-0",
        selectedIds.length > 0 && "ledger-selection-clearance lg:pb-0",
      )}
    >
      <SignatureLedgerBanner
        icon={Building2}
        className="operational-signature-banner mb-0"
        eyebrow="Clients & travail · Client Ledger"
        title="Sociétés"
        description={isAdmin
          ? "Registre des clients du cabinet"
          : "Registre des sociétés auxquelles vous avez accès"}
        metrics={[
          { label: "Sociétés", value: registerSummary.total, onSelect: () => setStatutFilter("all"), active: statutFilter === "all" },
          { label: "Actives", value: registerSummary.actif, tone: "success", onSelect: () => setStatutFilter("actif"), active: statutFilter === "actif" },
          { label: "En attente", value: registerSummary.enAttente, onSelect: () => setStatutFilter("en_attente"), active: statutFilter === "en_attente" },
          { label: registerSummary.inactif > 1 ? "Inactives" : "Inactive", value: registerSummary.inactif, onSelect: () => setStatutFilter("inactif"), active: statutFilter === "inactif" },
        ]}
        action={canEdit ? { label: "Ajouter une société", onClick: startCreate } : undefined}
      />

      <LedgerWorkSurface className="societes-ledger-surface">
      {selectedIds.length === 0 && (
        <OperationalLedgerToolbar
          label="Outils du registre des sociétés"
          search={renderSearchFilter("max-w-none")}
          resultCount={!isDataLoading ? `${filtered.length} société${filtered.length > 1 ? "s" : ""}` : undefined}
          tools={
            <SocietesUtilityMenu
              table={table}
              onExport={handleExport}
              onPrint={handlePrint}
            />
          }
        />
      )}

      {!isMobileSelectionActive && (
        <OperationalMobileUtility label="Recherche et filtres du registre des sociétés">
          {renderSearchFilter()}
        </OperationalMobileUtility>
      )}

      <div className="societes-ledger-register">
      <OperationalContentHeader className="societes-ledger-register-heading hidden lg:flex">
        <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
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
        <span className="text-xs text-muted-foreground">Sociétés accessibles</span>
      </OperationalContentHeader>

      <OperationalMobileHeader>
        <div className="min-w-0 flex-1">
          <h2>
            <DataTableColumnHeader
              column={table.getColumn("raisonSociale")!}
              title="Registre client"
              className="h-7 text-[11px] font-bold uppercase tracking-[0.12em] text-primary"
            />
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isMobileSelectionActive ? (
            <>
              <span className="max-w-24 truncate text-xs font-semibold text-foreground">
                {selectedIds.length} sélectionnée{selectedIds.length === 1 ? "" : "s"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shadow-none"
                onClick={clearSelection}
              >
                Annuler
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </OperationalMobileHeader>

      {selectedIds.length > 0 && (
        <div className="ledger-selection-strip hidden items-center justify-between gap-4 px-3 py-1.5 lg:flex">
          <span className="text-sm font-semibold">
            {selectedIds.length} société{selectedIds.length > 1 ? "s" : ""}{" "}
            sélectionnée{selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary hover:bg-primary/5 hover:text-primary"
              onClick={() => handleExport("xlsx")}
            >
              Exporter
            </Button>
            {canEdit && (
              <BulkActionsMenu
                onSetTheme={(theme) => void bulkSetTheme(theme)}
                onSetInactive={() => void bulkSetInactive()}
              />
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                Supprimer
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary hover:bg-primary/5 hover:text-primary"
              onClick={clearSelection}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      <DataTable
        className="ledger-work-table societes-ledger-table bg-transparent [&>div:last-child]:space-y-0"
        desktopDensity="ledger"
        desktopVariant="register"
        table={table}
        emptyMessage={emptyMessage}
        isLoading={isDataLoading}
        footer={<OperationalLedgerFooter table={table} itemLabel="sociétés" />}
        getRowClassName={(row) =>
          selectedIds.includes(row.original.id)
            ? "bg-accent/[0.10] hover:bg-accent/[0.14] [&>td:first-child]:border-l-2 [&>td:first-child]:border-accent"
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
                  {voitTaches && (
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
      {!isDataLoading && filtered.length > 0 && (
        <OperationalMobilePagination table={table} itemLabel="sociétés" />
      )}
      </div>
      </LedgerWorkSurface>

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
    </OperationalLedgerPage>
  );
}
