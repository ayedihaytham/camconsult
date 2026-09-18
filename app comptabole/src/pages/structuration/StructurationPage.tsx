import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Copy,
  FolderTree,
  Network,
  Pencil,
  Plus,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { LedgerToolbar } from "@/components/ledger/LedgerToolbar";
import { LedgerSheet } from "@/components/ledger/LedgerSheet";
import { LedgerTable } from "@/components/ledger/LedgerTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import { LedgerRowMenu } from "@/components/ledger/LedgerRowMenu";
import { LedgerSegmented } from "@/components/ledger/LedgerSegmented";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
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
import { printTable } from "@/lib/print";
import { formatDate } from "@/lib/utils";
import { useData, useNoeuds, useSocietes } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { logJournal } from "@/store/journal";
import type { Noeud } from "@/types";
import { ArborescenceFormSheet, type ArboFormValues } from "./ArborescenceFormSheet";
import { FileTree } from "./FileTree";
import { OrganigrammeView } from "./OrganigrammeView";
import { FileUploadDialog, type NewFichier } from "./FileUploadDialog";
import { MoveNodeDialog } from "./MoveNodeDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";

const selectTriggerClass =
  "h-auto w-auto gap-1.5 rounded-none border-0 border-b border-border bg-transparent px-0 pb-1.5 text-sm shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground";

export function StructurationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const societeParam = searchParams.get("societe");
  const vueParam = searchParams.get("vue");
  const initialTab: "tableau" | "arbre" | "organigramme" =
    vueParam === "arbre" ? "arbre" : vueParam === "organigramme" ? "organigramme" : "tableau";

  const allNodes = useNoeuds();
  const societes = useSocietes();
  const { isAdmin, can, canSeeSociete } = usePermissions();
  const canCreate = isAdmin || can("deposerFichiers");
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
  const [tab, setTab] = useState<"tableau" | "arbre" | "organigramme">(initialTab);
  const [search, setSearch] = useState("");
  const [societeFilter, setSocieteFilter] = useState(societeParam ?? "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Noeud | null>(null);
  const [toDelete, setToDelete] = useState<Noeud | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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

  const filteredRoots = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const spanDays =
      dateFilter === "7"
        ? 7
        : dateFilter === "30"
          ? 30
          : dateFilter === "365"
            ? 365
            : null;
    return roots.filter((n) => {
      const matchQ =
        !q || [n.libelle, n.description].join(" ").toLowerCase().includes(q);
      const matchSoc =
        societeFilter === "all" ||
        (societeFilter === "none" ? n.societeId === null : n.societeId === societeFilter);
      const matchType = typeFilter === "all" || n.type === typeFilter;
      const matchDate =
        spanDays === null ||
        now - new Date(n.majLe).getTime() <= spanDays * 86400000;
      return matchQ && matchSoc && matchType && matchDate;
    });
  }, [roots, search, societeFilter, typeFilter, dateFilter]);

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
        ? filteredRoots.filter((n) => selectedIds.includes(n.id))
        : filteredRoots;
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
        ? filteredRoots.filter((n) => selectedIds.includes(n.id))
        : filteredRoots;
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
    setTab("arbre");
  }

  const columns: DataTableColumn<Noeud>[] = [
    {
      id: "libelle",
      header: "Libellé",
      sortable: true,
      sortAccessor: (n) => n.libelle.toLowerCase(),
      cell: (n) => (
        <div className="flex items-center gap-2.5">
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-semibold text-foreground">{n.libelle}</span>
        </div>
      ),
    },
    {
      id: "description",
      header: "Description",
      cell: (n) => (
        <span className="line-clamp-1 max-w-md text-sm text-muted-foreground">
          {n.description || "—"}
        </span>
      ),
    },
    {
      id: "societe",
      header: "Société",
      sortable: true,
      sortAccessor: (n) => getSocieteById(n.societeId)?.raisonSociale ?? "zzz",
      cell: (n) =>
        n.societeId ? (
          <span className="text-sm text-foreground">
            {getSocieteById(n.societeId)?.raisonSociale}
          </span>
        ) : (
          <span className="text-sm italic text-muted-foreground">
            Modèle générique
          </span>
        ),
    },
    {
      id: "contenu",
      header: "Contenu",
      cell: (n) => {
        const desc = descendantIds(n.id);
        const nbDossiers = desc.filter(
          (id) => nodes.find((x) => x.id === id)?.type === "dossier",
        ).length;
        const nbFichiers = desc.filter(
          (id) => nodes.find((x) => x.id === id)?.type === "fichier",
        ).length;
        return (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {nbDossiers} dossier{nbDossiers > 1 ? "s" : ""} · {nbFichiers}{" "}
            fichier{nbFichiers > 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      id: "maj",
      header: "Mise à jour",
      sortable: true,
      sortAccessor: (n) => n.majLe,
      cell: (n) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(n.majLe)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      headerClassName: "w-[1%]",
      cell: (n) => (
        <div onClick={(e) => e.stopPropagation()}>
          <LedgerRowMenu
            actions={[
              ...(canStructEdit
                ? [
                    { icon: Copy, label: "Dupliquer", onClick: () => duplicate(n) },
                    {
                      icon: Pencil,
                      label: "Modifier",
                      onClick: () => {
                        setEditing(n);
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
                      onClick: () => setToDelete(n),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  const activeSociete = societeParam ? getSocieteById(societeParam) : null;

  return (
    <div className="flex min-h-full flex-col">
      <LedgerPageHeader
        title="Structuration"
        description={
          activeSociete
            ? `Documents de ${activeSociete.raisonSociale}.`
            : isAdmin
              ? "Arborescence documentaire du cabinet, par société."
              : "Dossiers des sociétés auxquelles vous avez accès."
        }
        actions={
          canStructEdit ? (
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
          ) : undefined
        }
      />

      <LedgerSegmented
        value={tab}
        onChange={(v) => {
          setTab(v);
          const next = new URLSearchParams(searchParams);
          if (v === "tableau") next.delete("vue");
          else next.set("vue", v);
          setSearchParams(next, { replace: true });
        }}
        options={[
          { value: "tableau", label: "Tableau" },
          { value: "arbre", label: "Arborescence" },
          { value: "organigramme", label: "Organigramme" },
        ]}
      />

      {tab === "tableau" && (
        <div className="mt-4 flex flex-1 flex-col">
          <LedgerToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Rechercher un dossier, une description…"
            onExport={handleExport}
            onPrint={handlePrint}
            selectedCount={selectedIds.length}
            onDeleteSelected={
              canDelete ? () => setBulkDeleteOpen(true) : undefined
            }
            onClearSelection={() => setSelectedIds([])}
            filters={
              <>
                <Select
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
                </Select>
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
          />

          <LedgerSheet className="flex-1">
            <LedgerTable
              columns={columns}
              data={filteredRoots}
              getRowId={(n) => n.id}
              enableSelection
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              onRowClick={openFolder}
              initialSort={{ columnId: "libelle", direction: "asc" }}
              emptyState={
                <EmptyState
                  icon={FolderTree}
                  title="Aucune arborescence"
                  description="Créez une première arborescence documentaire pour une société."
                />
              }
            />
          </LedgerSheet>
        </div>
      )}

      {tab === "arbre" && (
        <div className="mt-4">
          {/* Vue arborescence : widget d'explorateur non couvert par les
              maquettes Ledger (drag & drop, aperçu, réparentage) — laissé
              intact pour ne pas improviser un design non validé. */}
          <FileTree
            nodes={nodes}
            currentId={currentFolder}
            canCreate={canCreate}
            canEdit={canStructEdit}
            canDelete={canDelete}
            onNavigate={setCurrentFolder}
            onAddFolder={(parentId) => setSubfolderParent(parentId ?? null)}
            onAddFile={(parentId) => setUploadParent(parentId)}
            onRename={(n) => {
              setEditing(n);
              setFormOpen(true);
            }}
            onMove={(n) => setMoveNode(n)}
            onPreview={(n) => setPreviewNode(n)}
            onReparent={handleMove}
            onDelete={(n) => setToDelete(n)}
          />
        </div>
      )}

      {tab === "organigramme" && (
        <div className="mt-4">
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
            />
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
