import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Download,
  FolderTree,
  Layers,
  MoreHorizontal,
  Network,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerToolbar } from "@/components/ledger/LedgerToolbar";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportRows, type ExportFormat } from "@/lib/export";
import { provisionnerArborescenceSociete } from "@/lib/classement";
import { printTable } from "@/lib/print";
import { cn, formatDate } from "@/lib/utils";
import { useData, useNoeuds, useSocietes } from "@/store/data";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { useSocieteActiveStore } from "@/store/societeActive";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import type { Noeud } from "@/types";
import { ArborescenceFormSheet, type ArboFormValues } from "./ArborescenceFormSheet";
import { FileTree } from "./FileTree";
import { OrganigrammeView } from "./OrganigrammeView";
import { VueGenerale } from "./VueGenerale";
import { FileUploadDialog, type NewFichier } from "./FileUploadDialog";
import { MoveNodeDialog } from "./MoveNodeDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";

const selectTriggerClass =
  "h-auto w-auto gap-1.5 rounded-none border-0 border-b border-border bg-transparent px-0 pb-1.5 text-sm shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

export function StructurationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const societeParam = searchParams.get("societe");
  const vueParam = searchParams.get("vue");
  // Organigramme (détail par mois), Documents (arbre et liste réunis) et Vue générale. Les anciennes adresses ?vue=arbre / tableau mènent à Documents.
  type Onglet = "organigramme" | "documents" | "generale";
  const initialTab: Onglet =
    vueParam === "documents" || vueParam === "arbre" || vueParam === "tableau" ? "documents" : vueParam === "generale" ? "generale" : "organigramme";

  const allNodes = useNoeuds();
  const societes = useSocietes();
  const { isAdmin, can, canSeeSociete, poste } = usePermissions();
  // Le responsable de société a une présentation plus simple : une seule société, donc ni filtre société ni filtre date.
  const estClient = poste === "societe_employe";
  const canCreate = isAdmin || can("deposerFichiers");
  // Un compte qui n'a qu'une société n'a rien à filtrer par société.
  const filtreSocieteUtile = isAdmin || societes.filter((s) => canSeeSociete(s.id)).length > 1;
  const canStructEdit = isAdmin || can("modifierSocietes");
  const canDelete = isAdmin || can("supprimer");

  const nodes = useMemo(
    () => allNodes.filter((n) => canSeeSociete(n.societeId)),
    [allNodes, canSeeSociete],
  );

  const addNoeud = useData((s) => s.addNoeud);
  const updateNoeud = useData((s) => s.updateNoeud);
  const duplicateArborescence = useData((s) => s.duplicateArborescence);
  const deleteNoeudsCascade = useData((s) => s.deleteNoeudsCascade);
  const getSocieteById = (id: string | null | undefined) =>
    societes.find((s) => s.id === id) ?? null;
  const [tab, setTab] = useState<Onglet>(initialTab);
  const [search, setSearch] = useState("");
  const [societeFilter, setSocieteFilter] = useState(societeParam ?? "all");

  // Société active (barre du haut) <-> filtre de la page (?societe=). À l'ouverture,
  // une adresse ?societe= valide devient la société active ; ensuite c'est la barre
  // du haut qui commande le filtre.
  const societeActiveId = useSocieteActive()?.id ?? null;
  const definirSocieteActive = useSocieteActiveStore((s) => s.setSocieteId);
  const premierPassage = useRef(true);
  const activePrecedente = useRef<string | null>(null);
  useEffect(() => {
    if (premierPassage.current) {
      premierPassage.current = false;
      if (societeParam && societeParam !== societeActiveId && societes.some((s) => s.id === societeParam)) {
        definirSocieteActive(societeParam);
        return;
      }
    }
    if (societeActiveId) {
      if (societeParam !== societeActiveId) {
        const next = new URLSearchParams(searchParams);
        next.set("societe", societeActiveId);
        setSearchParams(next, { replace: true });
      }
      setSocieteFilter(societeActiveId);
    } else if (activePrecedente.current) {
      const next = new URLSearchParams(searchParams);
      next.delete("societe");
      setSearchParams(next, { replace: true });
      setSocieteFilter("all");
    }
    activePrecedente.current = societeActiveId;
    // Seul un changement de société active relance la synchronisation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [societeActiveId]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Noeud | null>(null);
  const [toDelete, setToDelete] = useState<Noeud | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [provisionConfirmOpen, setProvisionConfirmOpen] = useState(false);
  const [provisionAnnee, setProvisionAnnee] = useState(
    String(new Date().getFullYear()),
  );
  const [provisioning, setProvisioning] = useState(false);

  // Vue arborescence
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [subfolderParent, setSubfolderParent] = useState<string | null | undefined>(
    undefined,
  );
  const [subfolderName, setSubfolderName] = useState("");
  const [uploadParent, setUploadParent] = useState<string | null>(null);
  const [moveNode, setMoveNode] = useState<Noeud | null>(null);
  const [previewNode, setPreviewNode] = useState<Noeud | null>(null);

  const roots = useMemo(() => nodes.filter((n) => n.parentId === null), [nodes]);

  // Société choisie : l'arbre et la liste ne montrent que ses dossiers.
  const scopedNodes = useMemo(
    () =>
      societeFilter === "all"
        ? nodes
        : nodes.filter((n) => (societeFilter === "none" ? n.societeId === null : n.societeId === societeFilter)),
    [nodes, societeFilter],
  );

  // Ce que la liste affiche : le contenu du dossier ouvert, ou, dès qu'on cherche ou filtre, les résultats dans toute l'arborescence.
  const filtreActif = search.trim() !== "" || typeFilter !== "all" || dateFilter !== "all";
  const listed = useMemo(() => {
    if (!filtreActif) return scopedNodes.filter((n) => n.parentId === currentFolder);
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const spanDays = dateFilter === "7" ? 7 : dateFilter === "30" ? 30 : dateFilter === "365" ? 365 : null;
    return scopedNodes.filter((n) => {
      const matchQ = !q || [n.libelle, n.description].join(" ").toLowerCase().includes(q);
      const matchType = typeFilter === "all" || n.type === typeFilter;
      const matchDate = spanDays === null || now - new Date(n.majLe).getTime() <= spanDays * 86400000;
      return matchQ && matchType && matchDate;
    });
  }, [scopedNodes, filtreActif, currentFolder, search, typeFilter, dateFilter]);

  // Le dossier ouvert disparaît du périmètre quand on change de société : retour à la racine.
  useEffect(() => {
    if (currentFolder && !scopedNodes.some((n) => n.id === currentFolder)) setCurrentFolder(null);
  }, [scopedNodes, currentFolder]);

  function descendantIds(id: string): string[] {
    const direct = nodes.filter((n) => n.parentId === id);
    return direct.flatMap((d) => [d.id, ...descendantIds(d.id)]);
  }

  function handleFormSubmit(values: ArboFormValues) {
    const societeId = values.societeId === "none" ? null : values.societeId;
    if (editing) {
      updateNoeud(editing.id, {
        libelle: values.libelle,
        description: values.description ?? "",
        societeId,
      });
      logJournal(
        "modification",
        editing.type === "fichier" ? "fichier" : "dossier",
        values.libelle,
      );
      toast.success("Arborescence modifiée");
    } else {
      addNoeud({
        libelle: values.libelle,
        description: values.description ?? "",
        type: "dossier",
        societeId,
        parentId: null,
      });
      logJournal("creation", "dossier", values.libelle);
      toast.success("Arborescence créée", { description: values.libelle });
    }
    setEditing(null);
  }

  function duplicate(n: Noeud) {
    duplicateArborescence(n.id);
    logJournal("duplication", "dossier", n.libelle);
    toast.success("Arborescence dupliquée");
  }

  /** Pour chaque société : <société> › Comptabilité générale [année] › ses
   * dossiers standard (achat/vente/banque/caisse/CNSS/Divers/DMI/juridique)
   * — idempotent, donc rejouable plus tard pour une nouvelle société (ou une
   * année différente) sans risque de doublon. */
  async function handleProvisionAll(annee: number) {
    setProvisioning(true);
    let societesTraitees = 0;
    let dossiersCrees = 0;
    try {
      // On relit l'état le plus frais à chaque tour (pas l'instantané
      // `allNodes` du dernier rendu), pour que chaque passage voie les
      // dossiers déjà créés par les précédents.
      for (const societe of societes) {
        const crees = await provisionnerArborescenceSociete({
          noeuds: useData.getState().noeuds,
          addNoeud,
          updateNoeud,
          societeId: societe.id,
          societeLibelle: societe.raisonSociale,
          annee,
        });
        if (crees > 0) {
          societesTraitees++;
          dossiersCrees += crees;
        }
      }
      logJournal(
        "creation",
        "dossier",
        `Arborescence standard ${annee} instanciée pour ${societesTraitees} société(s)`,
      );
      toast.success(
        societesTraitees > 0
          ? `${societesTraitees} société(s) mise(s) à jour — ${dossiersCrees} dossier(s) créé(s)`
          : "Rien à faire — toutes les sociétés ont déjà leur arborescence",
      );
    } catch {
      toast.error("Impossible de terminer l'instanciation pour toutes les sociétés.");
    } finally {
      setProvisioning(false);
      setProvisionConfirmOpen(false);
    }
  }

  function confirmDelete() {
    if (!toDelete) return;
    const ids = [toDelete.id, ...descendantIds(toDelete.id)];
    deleteNoeudsCascade([toDelete.id]);
    logJournal(
      "suppression",
      toDelete.type === "fichier" ? "fichier" : "dossier",
      toDelete.libelle,
    );
    setSelectedIds((s) => s.filter((id) => !ids.includes(id)));
    toast.success("Élément supprimé", { description: toDelete.libelle });
    setToDelete(null);
  }

  function confirmBulkDelete() {
    deleteNoeudsCascade(selectedIds);
    logJournal(
      "suppression",
      "dossier",
      `${selectedIds.length} arborescences`,
    );
    toast.success(`${selectedIds.length} arborescences supprimées`);
    setSelectedIds([]);
  }

  function createSubfolder() {
    if (!subfolderName.trim()) return;
    const parent = subfolderParent === undefined ? null : subfolderParent;
    const parentNode = parent ? nodes.find((n) => n.id === parent) : null;
    addNoeud({
      libelle: subfolderName.trim(),
      description: "",
      type: "dossier",
      societeId: parentNode?.societeId ?? null,
      parentId: parent,
    });
    logJournal("creation", "dossier", subfolderName.trim());
    toast.success("Dossier créé", { description: subfolderName.trim() });
    setSubfolderName("");
    setSubfolderParent(undefined);
  }

  function handleUpload(fichiers: NewFichier[]) {
    if (!uploadParent) return;
    const parentNode = nodes.find((n) => n.id === uploadParent);
    fichiers.forEach((f) =>
      addNoeud({
        libelle: f.libelle,
        description: f.description,
        type: "fichier",
        societeId: parentNode?.societeId ?? null,
        parentId: uploadParent,
        format: f.format || undefined,
        taille: f.taille,
        dataUrl: f.dataUrl,
      }),
    );
    logJournal(
      "creation",
      "fichier",
      fichiers.length > 1
        ? `${fichiers.length} fichiers dans « ${parentNode?.libelle ?? ""} »`
        : (fichiers[0]?.libelle ?? "fichier"),
    );
    toast.success(
      fichiers.length > 1
        ? `${fichiers.length} fichiers ajoutés`
        : "Fichier ajouté",
      { description: fichiers[0]?.libelle },
    );
    setUploadParent(null);
  }

  function handleMove(nodeId: string, targetParentId: string | null) {
    const n = nodes.find((x) => x.id === nodeId);
    const target = targetParentId
      ? nodes.find((x) => x.id === targetParentId)
      : null;
    updateNoeud(nodeId, {
      parentId: targetParentId,
      societeId: target ? target.societeId : (n?.societeId ?? null),
    });
    logJournal(
      "modification",
      n?.type === "fichier" ? "fichier" : "dossier",
      `Déplacement de « ${n?.libelle ?? ""} » vers « ${target?.libelle ?? "Racine"} »`,
    );
    toast.success("Élément déplacé");
    setMoveNode(null);
  }

  function handleExport(format: ExportFormat) {
    const source =
      selectedIds.length > 0
        ? listed.filter((n) => selectedIds.includes(n.id))
        : listed;
    exportRows(
      "structuration",
      source,
      [
        { header: "Libellé", value: (n) => n.libelle },
        { header: "Description", value: (n) => n.description },
        {
          header: "Société",
          value: (n) =>
            getSocieteById(n.societeId)?.raisonSociale ?? "Modèle générique",
        },
        { header: "Type", value: (n) => n.type },
        { header: "Dernière mise à jour", value: (n) => n.majLe },
      ],
      format,
    );
    toast.success(`Export ${format.toUpperCase()} généré`);
  }

  function handlePrint() {
    const source =
      selectedIds.length > 0
        ? listed.filter((n) => selectedIds.includes(n.id))
        : listed;
    printTable({
      title: "Structuration documentaire",
      subtitle: activeSociete
        ? `Société : ${activeSociete.raisonSociale}`
        : undefined,
      columns: [
        { header: "Libellé", value: (n) => n.libelle },
        { header: "Description", value: (n) => n.description },
        {
          header: "Société",
          value: (n) =>
            getSocieteById(n.societeId)?.raisonSociale ?? "Modèle générique",
        },
        {
          header: "Sous-dossiers",
          align: "right",
          value: (n) =>
            descendantIds(n.id).filter(
              (id) => nodes.find((x) => x.id === id)?.type === "dossier",
            ).length,
        },
        {
          header: "Fichiers",
          align: "right",
          value: (n) =>
            descendantIds(n.id).filter(
              (id) => nodes.find((x) => x.id === id)?.type === "fichier",
            ).length,
        },
        { header: "Mise à jour", value: (n) => formatDate(n.majLe) },
      ],
      rows: source,
    });
  }

  function openFolder(n: Noeud) {
    setCurrentFolder(n.id);
    setTab("documents");
  }

  const activeSociete = societeParam ? getSocieteById(societeParam) : null;

  // Les deux boutons de structure, dans la barre de l'organigramme et de la vue générale.
  const actionsStructure =
    canStructEdit || isAdmin ? (
      <>
        {isAdmin && (
          <Button variant="outline" disabled={provisioning} onClick={() => setProvisionConfirmOpen(true)}>
            <Layers className="h-4 w-4" />
            {provisioning ? "Instanciation…" : "Instancier pour toutes les sociétés"}
          </Button>
        )}
        {canStructEdit && (
          <Button
            variant="ledger"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Ajouter une arborescence
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <LedgerPageHeader
        title="Structuration"
        description={
          activeSociete
            ? `Documents de ${activeSociete.raisonSociale}.`
            : isAdmin
              ? "Arborescence documentaire du cabinet, par société."
              : "Dossiers des sociétés auxquelles vous avez accès."
        }
      />

      <Dialog
        open={provisionConfirmOpen}
        onOpenChange={(o) => {
          setProvisionConfirmOpen(o);
          if (o) setProvisionAnnee(String(new Date().getFullYear()));
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instancier l'arborescence standard</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Crée, dans le dossier de chaque société, un dossier « Comptabilité
            générale {provisionAnnee || "…"} » avec les dossiers standard
            (achat, vente, banque, caisse, CNSS, Divers, DMI, juridique) :
            société › Comptabilité générale {provisionAnnee || "…"} › achat…
            Retrouve un dossier déjà créé à la main plutôt que d'en recréer un
            en double ; rien n'est touché pour les sociétés déjà provisionnées
            cette année-là.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="provision-annee">Année</Label>
            <Input
              id="provision-annee"
              type="number"
              autoFocus
              value={provisionAnnee}
              onChange={(e) => setProvisionAnnee(e.target.value)}
              placeholder={String(new Date().getFullYear())}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProvisionConfirmOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="ledger"
              disabled={!provisionAnnee.trim() || provisioning}
              onClick={() => handleProvisionAll(Number(provisionAnnee))}
            >
              {provisioning ? "Instanciation…" : "Instancier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div data-tour="structuration-lenses"><LedgerSegmented
        value={tab}
        onChange={(v) => {
          setTab(v);
          const next = new URLSearchParams(searchParams);
          if (v === "organigramme") next.delete("vue");
          else next.set("vue", v);
          setSearchParams(next, { replace: true });
        }}
        options={[
          { value: "organigramme", label: "Organigramme" },
          { value: "documents", label: "Documents" },
          { value: "generale", label: "Vue générale" },
        ]}
      /></div>

      {tab === "documents" && (
        <div data-tour="structuration-content" className="mt-3 flex flex-1 flex-col gap-3">
          {!estClient && <div data-tour="structuration-search"><LedgerToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Rechercher un dossier ou un fichier…"
            onExport={handleExport}
            onPrint={handlePrint}
            selectedCount={selectedIds.length}
            onDeleteSelected={
              canDelete ? () => setBulkDeleteOpen(true) : undefined
            }
            onClearSelection={() => setSelectedIds([])}
            filters={
              <>
                {filtreSocieteUtile && <Select
                  value={societeFilter}
                  onValueChange={(v) => {
                    setSocieteFilter(v);
                    const next = new URLSearchParams(searchParams);
                    if (v === "all") next.delete("societe");
                    else next.set("societe", v);
                    setSearchParams(next, { replace: true });
                  }}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Société" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les sociétés</SelectItem>
                    <SelectItem value="none">Modèles génériques</SelectItem>
                    {societes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.raisonSociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>}
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous types</SelectItem>
                    <SelectItem value="dossier">Dossier</SelectItem>
                    <SelectItem value="fichier">Fichier</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes dates</SelectItem>
                    <SelectItem value="7">7 derniers jours</SelectItem>
                    <SelectItem value="30">30 derniers jours</SelectItem>
                    <SelectItem value="365">Cette année</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          /></div>}

          {nodes.length === 0 ? (
            <LedgerSheet className="flex-1">
              <EmptyState
                icon={FolderTree}
                title="Aucune arborescence"
                description={
                  isAdmin || canCreate
                    ? "Créez une première arborescence documentaire pour une société."
                    : "Le cabinet n'a pas encore préparé l'arborescence documentaire de votre société. Elle apparaîtra ici dès qu'elle sera créée."
                }
              />
            </LedgerSheet>
          ) : (
            <FileTree
              nodes={scopedNodes}
              items={listed}
              resultats={filtreActif}
              currentId={currentFolder}
              canCreate={canCreate}
              canEdit={canStructEdit}
              canDelete={canDelete}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              afficherSociete={filtreSocieteUtile}
              variante={estClient ? "client" : "cabinet"}
              barre={
                estClient ? (
                  <div data-tour="structuration-search" className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                    <div className="relative min-w-[12rem] max-w-[460px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un dossier ou un fichier"
                        aria-label="Rechercher un dossier ou un fichier"
                        className="h-10 bg-muted/40 pl-9"
                      />
                    </div>
                    <div role="group" aria-label="Type d'élément" className="flex items-center gap-1">
                      {([
                        ["all", "Tout"],
                        ["dossier", "Dossiers"],
                        ["fichier", "Fichiers"],
                      ] as const).map(([valeur, libelle]) => (
                        <button
                          key={valeur}
                          type="button"
                          aria-pressed={typeFilter === valeur}
                          onClick={() => setTypeFilter(valeur)}
                          className={cn(
                            "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                            typeFilter === valeur
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          {libelle}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Plus d'actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                          <Download className="h-4 w-4" />
                          Exporter la liste
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handlePrint}>
                          <Printer className="h-4 w-4" />
                          Imprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : undefined
              }
              onNavigate={(id) => {
                setCurrentFolder(id);
                // Ouvrir un dossier depuis les résultats quitte la recherche, pour en voir le contenu.
                setSearch("");
                setTypeFilter("all");
                setDateFilter("all");
              }}
              onAddFolder={(parentId) => setSubfolderParent(parentId ?? null)}
              onAddFile={(parentId) => setUploadParent(parentId)}
              onDuplicate={duplicate}
              onRename={(n) => {
                setEditing(n);
                setFormOpen(true);
              }}
              onMove={(n) => setMoveNode(n)}
              onPreview={(n) => setPreviewNode(n)}
              onReparent={handleMove}
              onDelete={(n) => setToDelete(n)}
            />
          )}
        </div>
      )}

      {tab === "organigramme" && (
        <div data-tour="structuration-content" className="mt-3">
          {roots.length === 0 ? (
            <LedgerSheet>
              <EmptyState
                icon={Network}
                title="Aucun organigramme"
                description="Créez une première arborescence documentaire pour voir son organigramme."
              />
            </LedgerSheet>
          ) : (
            <OrganigrammeView
              nodes={nodes}
              roots={roots}
              getSocieteById={getSocieteById}
              onOpenNode={openFolder}
              actions={actionsStructure}
            />
          )}
        </div>
      )}

      {tab === "generale" && (
        <div data-tour="structuration-content" className="mt-3">
          {roots.length === 0 ? (
            <LedgerSheet>
              <EmptyState
                icon={Network}
                title="Aucune arborescence"
                description="Créez une première arborescence documentaire pour en voir la vue générale."
              />
            </LedgerSheet>
          ) : (
            <VueGenerale nodes={nodes} roots={roots} getSocieteById={getSocieteById} onOpenNode={openFolder} actions={actionsStructure} />
          )}
        </div>
      )}

      <ArborescenceFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        noeud={editing}
        defaultSocieteId={societeParam}
        onSubmit={handleFormSubmit}
      />

      <FileUploadDialog
        open={uploadParent !== null}
        onOpenChange={(o) => !o && setUploadParent(null)}
        destinationLabel={
          nodes.find((n) => n.id === uploadParent)?.libelle ?? "Dossier"
        }
        onSubmit={handleUpload}
      />

      <MoveNodeDialog
        open={moveNode !== null}
        onOpenChange={(o) => !o && setMoveNode(null)}
        node={moveNode}
        nodes={nodes}
        onMove={handleMove}
      />

      <FilePreviewDialog
        open={previewNode !== null}
        onOpenChange={(o) => !o && setPreviewNode(null)}
        node={previewNode}
      />

      {/* Dialog nouveau sous-dossier */}
      <Dialog
        open={subfolderParent !== undefined}
        onOpenChange={(o) => {
          if (!o) {
            setSubfolderParent(undefined);
            setSubfolderName("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="subfolder">Nom du dossier</Label>
            <Input
              id="subfolder"
              autoFocus
              value={subfolderName}
              onChange={(e) => setSubfolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createSubfolder();
              }}
              placeholder="Ex. Factures 2026"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubfolderParent(undefined);
                setSubfolderName("");
              }}
            >
              Annuler
            </Button>
            <Button
              variant="ledger"
              disabled={!subfolderName.trim()}
              onClick={createSubfolder}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Supprimer cet élément ?"
        description={
          <>
            <span className="font-medium text-foreground">
              {toDelete?.libelle}
            </span>{" "}
            et tout son contenu seront définitivement supprimés.
          </>
        }
        confirmLabel="Supprimer définitivement"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Supprimer ${selectedIds.length} arborescences ?`}
        description="Les arborescences sélectionnées et tout leur contenu seront définitivement supprimés."
        confirmLabel="Tout supprimer"
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
