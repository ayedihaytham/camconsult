import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  File as FileIcon,
  FileText,
  History,
  Paperclip,
  Printer,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocietes } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import { COLLECTE_STATUT_LABELS, TAB_BY_KEY } from "@/lib/collecte/tabs";
import { checklistRows } from "@/lib/collecte/checklist";
import { computeManques } from "@/lib/collecte/manques";
import { aggregateRecapStatut, sectionRecapStatut } from "@/lib/collecte/recap";
import {
  downloadCollecteSectionPdf,
  exportCollecteSectionXlsx,
  exportCollecteXlsx,
  printCollecteSection,
} from "@/lib/collecte/exportXlsx";
import { downloadDataUrl } from "@/lib/file";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import type { CollecteJournalEntry, CollecteStatut } from "@/types";
import { CollecteGrid, type CollecteGridHandle } from "./CollecteGrid";
import { CollecteChecklist } from "./CollecteChecklist";
import { CollecteFormDrawer } from "./CollecteFormDrawer";
import { RecapTab } from "./RecapTab";
import { OngletNotes } from "./OngletNotes";
import {
  FileUploadDialog,
  type NewFichier,
} from "../structuration/FileUploadDialog";
import { DocPreviewDialog } from "../stock/DocPreviewDialog";

export function CollecteEditorPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isAdmin, poste, isCollaborateur: isStaff } = usePermissions();
  const societes = useSocietes();

  const collecte = useCollectes((s) => s.current);
  const loading = useCollectes((s) => s.loadingOne);
  const fetchOne = useCollectes((s) => s.fetchOne);
  const clearCurrent = useCollectes((s) => s.clearCurrent);
  const update = useCollectes((s) => s.update);
  const setStatut = useCollectes((s) => s.setStatut);
  const saveLignes = useCollectes((s) => s.saveLignes);
  const saveComment = useCollectes((s) => s.saveComment);
  const submitRecap = useCollectes((s) => s.submitRecap);
  const relanceNow = useCollectes((s) => s.relanceNow);
  const uploadFichier = useCollectes((s) => s.uploadFichier);
  const deleteFichier = useCollectes((s) => s.deleteFichier);
  const fetchJournal = useCollectes((s) => s.fetchJournal);

  const [confirm, setConfirm] = useState<
    null | "transmis" | "valide" | "a_corriger" | "archive" | "reopen"
  >(null);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState("checklist");
  const gridRef = useRef<CollecteGridHandle>(null);
  const transmittedBeforeRecapRef = useRef(false);
  const [dirtyTableau, setDirtyTableau] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const [preview, setPreview] = useState(false); // admin : aperçu de la vue client
  const [fichiersOpen, setFichiersOpen] = useState(false);
  const [fichierToDelete, setFichierToDelete] = useState<string | null>(null);
  const [previewFichier, setPreviewFichier] = useState<{
    title: string;
    dataUrl: string | null;
  } | null>(null);
  const [relancing, setRelancing] = useState(false);
  const [journal, setJournal] = useState<CollecteJournalEntry[] | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState(false);
  const [detailError, setDetailError] = useState(false);

  useEffect(() => {
    // fetchOne() re-lève l'erreur après le toast (voir fail() dans le
    // store) — utile quand l'appelant attend la promesse, mais ici l'échec
    // est déjà géré par l'état "Collecte introuvable" ci-dessous ; sans ce
    // .catch, une collecte manquante remonte comme rejet de promesse non
    // intercepté dans la console.
    setDetailError(false);
    fetchOne(id).catch(() => setDetailError(true));
    return () => clearCurrent();
  }, [id, fetchOne, clearCurrent]);

  useEffect(() => {
    if (tab !== "historique" || !id) return;
    setJournalLoading(true);
    setJournalError(false);
    fetchJournal(id)
      .then(setJournal)
      .catch(() => setJournalError(true))
      .finally(() => setJournalLoading(false));
  }, [tab, id, fetchJournal]);

  const currentRecap = collecte ? aggregateRecapStatut(collecte) : "none";
  useEffect(() => {
    if (poste === "societe_employe" && currentRecap === "envoye")
      requestTab("recap");
  }, [poste, currentRecap, id]);

  if (!collecte) {
    return (
      <EmptyState
        title={loading ? "Chargement…" : detailError ? "Chargement impossible" : "Collecte introuvable"}
        description={
          loading ? "" : detailError ? "Vérifiez votre connexion ou réessayez." : "Cette collecte n'existe pas ou a été supprimée."
        }
        action={!loading && <Button variant="outline" size="sm" onClick={() => { setDetailError(false); void fetchOne(id).catch(() => setDetailError(true)); }}>Réessayer</Button>}
      />
    );
  }

  const socNom =
    societes.find((s) => s.id === collecte.societeId)?.raisonSociale ??
    "Société";
  const archivee = collecte.statut === "archive";
  const validee = collecte.statut === "valide";
  const enAttente =
    collecte.statut === "brouillon" || collecte.statut === "a_corriger";
  const enRetard =
    enAttente &&
    Boolean(collecte.echeance) &&
    collecte.echeance! < new Date().toISOString().slice(0, 10);
  // Validée : le client de société passe en lecture seule (cabinet toujours modifiable).
  // Archivée : lecture seule pour TOUT LE MONDE, admin compris.
  const editable =
    !archivee &&
    (isAdmin ||
      isStaff ||
      (poste === "societe_employe" &&
        (collecte.statut === "brouillon" || collecte.statut === "a_corriger")));
  // Cabinet = admin ou collaborateur : peut envoyer/clore un récap par
  // tableau et écrire des notes — pas réservé à l'admin.
  const canManageRecap = isAdmin || isStaff;

  // Mode « complétion récap » côté client : au moins un tableau a été
  // envoyé par le cabinet (chaque tableau se déverrouille indépendamment
  // des autres — voir sectionRecapStatut plus bas, utilisé par tableau).
  const clientRecap = poste === "societe_employe" && currentRecap === "envoye";
  // Un seul bouton client : « Transmettre au cabinet » (soumet aussi le récap).
  const canSubmit =
    !isAdmin &&
    (collecte.statut === "brouillon" ||
      collecte.statut === "a_corriger" ||
      clientRecap);

  // Cases importantes vides détectées EN DIRECT, par onglet.
  const liveManques = computeManques(collecte);
  const flaggedByTab = new Map<string, Set<string>>();
  const wholeTab = new Set<string>();
  const manqueCount = new Map<string, number>();
  for (const m of liveManques) {
    manqueCount.set(m.onglet, (manqueCount.get(m.onglet) ?? 0) + 1);
    if (m.ordre == null || m.col == null) {
      wholeTab.add(m.onglet);
    } else {
      const s = flaggedByTab.get(m.onglet) ?? new Set<string>();
      s.add(`${m.ordre}:${m.col}`);
      flaggedByTab.set(m.onglet, s);
    }
  }
  // Par tableau, pas globalement : sinon dès qu'UN tableau est envoyé, les
  // badges "cases manquantes" s'allument pour TOUS les tableaux côté
  // client, y compris ceux jamais demandés — même bug que celui corrigé
  // dans RecapTab (visibleRows), ici pour le sidenav et le surlignage en
  // lecture seule dans chaque onglet.
  const showFlagsFor = (key: string) =>
    !archivee && (isAdmin || sectionRecapStatut(collecte, key) !== "none");
  // Le client ne peut renvoyer un récap au cabinet qu'une fois TOUTES les
  // cases « ? » des tableaux demandés remplies et enregistrées — le cabinet
  // ne reçoit jamais de récap à moitié complété à clôturer.
  const recapRestant = clientRecap
    ? liveManques.filter(
        (m) => sectionRecapStatut(collecte, m.onglet) === "envoye",
      ).length
    : 0;

  const rows = checklistRows(collecte);
  const recus = rows.filter((r) => r.recu).length;
  const monogram = socNom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("fr-FR");
  const tableauKeys = collecte.onglets;

  function requestTab(next: string) {
    if (next === tab) return;
    if (gridRef.current?.isDirty()) {
      setDraftError(false);
      setPendingTab(next);
      return;
    }
    setDirtyTableau(false);
    completeNavigation(next);
  }

  function completeNavigation(next: string) {
    if (next === "__back__") navigate("/collectes");
    else if (next === "__preview__") setPreview((value) => !value);
    else if (next === "__confirm_transmis__") setConfirm("transmis");
    else if (next === "__confirm_valide__") setConfirm("valide");
    else if (next === "__confirm_archive__") setConfirm("archive");
    else if (next === "__confirm_a_corriger__") setConfirm("a_corriger");
    else if (next === "__confirm_reopen__") setConfirm("reopen");
    else setTab(next);
  }

  function leaveAfterDraft() {
    setDirtyTableau(false);
    if (pendingTab) completeNavigation(pendingTab);
    setPendingTab(null);
  }

  async function saveDraftAndLeave() {
    setSavingDraft(true);
    setDraftError(false);
    try {
      const grid = gridRef.current;
      if (!grid) throw new Error("Tableau indisponible");
      await grid.save();
      leaveAfterDraft();
    } catch {
      setDraftError(true);
    } finally {
      setSavingDraft(false);
    }
  }

  async function applyStatut(s: CollecteStatut) {
    if (!transmittedBeforeRecapRef.current) {
      await setStatut(id, s);
      if (s === "transmis" && clientRecap) transmittedBeforeRecapRef.current = true;
    }
    // Une transmission peut coïncider avec un récap par tableau déjà en
    // attente (le cabinet en a envoyé un avant que le client n'ait jamais
    // transmis) — sans ce second appel, le bouton ne faisait QUE l'un des
    // deux selon `clientRecap`, obligeant à cliquer deux fois : une
    // première fois qui ne transmettait rien (juste le récap, avec un
    // message trompeur), puis une seconde pour la vraie transmission.
    if (s === "transmis" && clientRecap) {
      await submitRecap(id);
    }
    transmittedBeforeRecapRef.current = false;
    setConfirm(null);
    toast.success(
      s === "transmis"
        ? "Collecte transmise au cabinet"
        : s === "valide"
          ? confirm === "reopen"
            ? "Collecte désarchivée"
            : "Collecte validée"
          : s === "archive"
            ? "Collecte archivée"
            : "Collecte rouverte (à corriger)",
    );
  }

  return (
    <div>
      <header className="overflow-hidden rounded-t-md bg-primary px-4 pt-4 text-primary-foreground lg:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 text-xs font-bold"
          >
            {monogram}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight tracking-tight lg:text-xl">
              {socNom}
            </h1>
            <p className="mt-1 text-xs text-primary-foreground/75">
              {collecte.periode.trim()
                ? `${collecte.periode.trim()} · Collecte de pièces`
                : "Collecte de pièces"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/65">
                Statut
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    validee
                      ? "bg-success"
                      : collecte.statut === "a_corriger" || enRetard
                        ? "bg-destructive"
                        : archivee
                          ? "bg-primary-foreground/60"
                          : "bg-warning",
                  )}
                />
                {COLLECTE_STATUT_LABELS[collecte.statut]}
              </span>
            </div>
            {collecte.echeance && (
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/65">
                  Échéance
                </span>
                <span className="font-semibold">
                  {formatDate(collecte.echeance)}
                  {enRetard ? " · dépassée" : ""}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="relative mt-3 flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-primary-foreground/20 py-1.5 before:absolute before:-top-px before:left-0 before:h-px before:w-1/4 before:bg-accent">
          <span className="text-xs text-primary-foreground/75">
            {recus} / {rows.length} pièces reçues
          </span>
          {canSubmit && (
            <Button
              variant="outline"
              size="sm"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              disabled={recapRestant > 0}
              title={
                recapRestant > 0
                  ? `Encore ${recapRestant} case(s) à compléter avant de transmettre`
                  : undefined
              }
              onClick={async () => {
                if (recapRestant > 0) return;
                if (
                  collecte.statut === "brouillon" ||
                  collecte.statut === "a_corriger"
                )
                  requestTab("__confirm_transmis__");
                else if (clientRecap) {
                  await submitRecap(id);
                  toast.success("Récap transmis au cabinet");
                }
              }}
            >
              <Send className="h-4 w-4" /> Transmettre au cabinet
            </Button>
          )}
          {isAdmin && collecte.statut === "transmis" && (
            <Button
              variant="outline"
              size="sm"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => requestTab("__confirm_valide__")}
            >
              <CheckCircle2 className="h-4 w-4" /> Valider
            </Button>
          )}
          {isAdmin && validee && (
            <Button
              variant="outline"
              size="sm"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => requestTab("__confirm_archive__")}
            >
              Archiver la collecte
            </Button>
          )}
          {isAdmin && archivee && (
            <Button
              variant="outline"
              size="sm"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => requestTab("__confirm_reopen__")}
            >
              <RotateCcw className="h-4 w-4" /> Désarchiver
            </Button>
          )}
        </div>
      </header>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-2 border border-t-0 px-3 py-2 text-xs",
          clientRecap || collecte.statut === "a_corriger"
            ? "border-warning/25 bg-warning/5 text-foreground"
            : "border-border bg-card text-muted-foreground",
        )}
      >
        <span className="min-w-0 flex-1">
          {clientRecap
            ? `Complétez les cases demandées et enregistrez chaque tableau avant transmission. ${recapRestant > 0 ? `${recapRestant} case(s) restantes.` : "Vous pouvez transmettre."}`
            : validee
              ? "Le client ne peut plus modifier cette collecte. Le cabinet peut encore l'ajuster avant archivage."
              : archivee
                ? "Collecte archivée. L'administrateur peut la désarchiver pour reprendre le dossier."
                : collecte.statut === "a_corriger"
                  ? "Reprenez les pièces à compléter, enregistrez vos modifications, puis transmettez au cabinet."
                  : collecte.statut === "transmis"
                    ? "La collecte a été transmise au cabinet pour examen."
                    : "Préparez les tableaux et pièces avant transmission au cabinet."}
          {isAdmin && currentRecap === "envoye" && (
            <span className="ml-2 font-medium">
              Récap en attente du client.
            </span>
          )}
        </span>
        {isAdmin && (collecte.statut === "transmis" || validee) && (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => requestTab("__confirm_a_corriger__")}
          >
            {validee ? "Repasser en correction" : "Renvoyer pour correction"}
          </button>
        )}
      </div>
      {preview && (
        <p className="border-x border-b border-border bg-accent/5 px-3 py-2 text-xs text-foreground">
          Aperçu client — seules les cases « ? » demandées sont modifiables.
        </p>
      )}
      {poste === "societe_employe" && currentRecap === "repondu" && (
        <p className="border-x border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Récap renvoyé au cabinet. En attente de traitement.
        </p>
      )}
      <div className="flex min-h-10 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Travail sur le dossier · {socNom}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
            >
              Outils <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                void exportCollecteXlsx(collecte, socNom).catch(() =>
                  toast.error("Export impossible"),
                );
              }}
            >
              <Download className="h-4 w-4" /> Tout en Excel
            </DropdownMenuItem>
            {isAdmin && !archivee && liveManques.length > 0 && (
              <DropdownMenuItem onSelect={() => requestTab("__preview__")}>
                <Eye className="h-4 w-4" />{" "}
                {preview ? "Quitter l'aperçu" : "Aperçu client"}
              </DropdownMenuItem>
            )}
            {isAdmin && !archivee && (
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" /> Modifier Collection
              </DropdownMenuItem>
            )}
            {isAdmin && enAttente && (
              <DropdownMenuItem
                disabled={relancing}
                onSelect={() => {
                  setRelancing(true);
                  void relanceNow(id)
                    .then(() => toast.success("Relance envoyée au client"))
                    .catch(() => {})
                    .finally(() => setRelancing(false));
                }}
              >
                <BellRing className="h-4 w-4" />{" "}
                {relancing ? "Envoi…" : "Relancer maintenant"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={tab} onValueChange={requestTab}>
        <div className="grid min-w-0 border border-border bg-card lg:grid-cols-[210px_minmax(0,1fr)]">
          <nav
            aria-label="Sections du dossier"
            className="hidden border-r border-border bg-muted/20 lg:block"
          >
            <div className="py-3">
              <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Dossier
              </p>
              <NavItem
                active={tab === "checklist"}
                onClick={() => requestTab("checklist")}
                label="Checklist"
              />
              <NavItem
                active={tab === "recap"}
                onClick={() => requestTab("recap")}
                label="Récap"
                dot={
                  currentRecap !== "none"
                    ? currentRecap === "repondu"
                      ? "success"
                      : "warning"
                    : undefined
                }
              />
              <NavItem
                active={tab === "documents"}
                onClick={() => requestTab("documents")}
                label="Documents"
                badge={collecte.fichiers.length || undefined}
              />
            </div>
            {tableauKeys.length > 0 && (
              <div className="border-t border-border py-3">
                <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Tableaux demandés
                </p>
                {tableauKeys.map((key) => (
                  <NavItem
                    key={key}
                    active={tab === key}
                    onClick={() => requestTab(key)}
                    label={TAB_BY_KEY[key]?.label ?? key}
                    badge={showFlagsFor(key) ? manqueCount.get(key) : undefined}
                  />
                ))}
              </div>
            )}
            {(isAdmin || isStaff) && (
              <div className="border-t border-border py-3">
                <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Suivi
                </p>
                <NavItem
                  active={tab === "historique"}
                  onClick={() => requestTab("historique")}
                  label="Historique"
                />
              </div>
            )}
          </nav>
          <div className="border-b border-border bg-muted/20 p-2 lg:hidden">
            <Select value={tab} onValueChange={requestTab}>
              <SelectTrigger
                className="min-h-11 w-full bg-card"
                aria-label="Section active du dossier"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checklist">Checklist</SelectItem>
                <SelectItem value="recap">Récap</SelectItem>
                <SelectItem value="documents">
                  Documents
                  {collecte.fichiers.length
                    ? ` · ${collecte.fichiers.length}`
                    : ""}
                </SelectItem>
                {tableauKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {TAB_BY_KEY[key]?.label ?? key}
                  </SelectItem>
                ))}
                {(isAdmin || isStaff) && (
                  <SelectItem value="historique">Historique</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 bg-card">
            <TabsContent value="recap" className="m-0">
              <SectionHeader
                title="Récap"
                description="Demandes ciblées par tableau"
              />
              <div className="p-3 lg:p-4">
                <RecapTab
                  collecte={collecte}
                  canManageRecap={canManageRecap}
                  isClient={poste === "societe_employe"}
                  onNavigate={requestTab}
                />
              </div>
            </TabsContent>

            {/* ── Checklist ─────────────────────────── */}
            <TabsContent value="checklist" className="m-0">
              <SectionHeader
                title="Checklist"
                description="Pièces attendues par tableau"
                action={
                  <SectionExport
                    collecte={collecte}
                    section="checklist"
                    societeNom={socNom}
                  />
                }
              />
              <CollecteChecklist
                rows={rows}
                devise={collecte.devise}
                editable={editable}
                onSelectTab={requestTab}
                onSaveComment={(key, value) => saveComment(id, key, value)}
              />
              {!editable && poste === "societe_employe" && (
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  Collecte{" "}
                  {COLLECTE_STATUT_LABELS[collecte.statut].toLowerCase()} —
                  lecture seule. Le cabinet peut la renvoyer pour correction.
                </p>
              )}
            </TabsContent>

            {/* ── Documents (pièces jointes réelles) ─── */}
            <TabsContent value="documents" className="m-0">
              <SectionHeader
                title="Documents"
                description="Scans et PDF liés à cette collecte"
                action={
                  editable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFichiersOpen(true)}
                    >
                      <UploadCloud className="h-4 w-4" /> Ajouter des pièces
                    </Button>
                  )
                }
              />
              {collecte.fichiers.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Paperclip}
                    title="Aucune pièce déposée"
                    description="Ajoutez un scan ou un PDF en complément des tableaux chiffrés."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {collecte.fichiers.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {f.nom}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {f.taille || "—"} · déposé par {f.deposePar || "?"} ·{" "}
                          {formatRelative(f.creeLe)}
                        </p>
                      </div>
                      {f.dataUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewFichier({
                                title: f.nom,
                                dataUrl: f.dataUrl!,
                              })
                            }
                            className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Aperçu de ${f.nom}`}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadDataUrl(f.dataUrl!, f.nom)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Télécharger ${f.nom}`}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {editable && (
                        <button
                          type="button"
                          onClick={() => setFichierToDelete(f.id)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Supprimer ${f.nom}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* ── Onglets de saisie ─────────────────── */}
            {collecte.onglets.map((key) => {
              const def = TAB_BY_KEY[key];
              if (!def) return null;
              return (
                <TabsContent key={key} value={key} className="m-0">
                  <SectionHeader
                    title={def.label}
                    description="Tableau de saisie · chiffres et justificatifs"
                    action={
                      <SectionExport
                        collecte={collecte}
                        section={key}
                        societeNom={socNom}
                      />
                    }
                    dirty={tab === key && dirtyTableau}
                  />
                  <div className="space-y-4 p-3 lg:p-4">
                    {(() => {
                      const hl = flaggedByTab.get(key);
                      const whole = wholeTab.has(key);
                      const hasManque = (hl && hl.size > 0) || whole;
                      // Le client complète CE tableau s'il a été envoyé indépendamment
                      // des autres (voir RecapTab) ET a au moins une case ? (ou tableau vide).
                      const clientRecapForTab =
                        poste === "societe_employe" &&
                        sectionRecapStatut(collecte, key) === "envoye";
                      const inRecap = clientRecapForTab && hasManque;
                      // Aperçu admin : rendu identique à la vue client, en lecture seule.
                      if (preview) {
                        return (
                          <CollecteGrid
                            def={def}
                            lignes={collecte.lignes.filter(
                              (l) => l.onglet === key,
                            )}
                            readOnly
                            recapClient={hasManque}
                            highlight={hl}
                            devise={collecte.devise}
                            onSave={async () => {}}
                          />
                        );
                      }
                      return (
                        <CollecteGrid
                          ref={tab === key ? gridRef : undefined}
                          def={def}
                          lignes={collecte.lignes.filter(
                            (l) => l.onglet === key,
                          )}
                          readOnly={clientRecapForTab ? !inRecap : !editable}
                          recapClient={inRecap}
                          highlight={hl}
                          wholeEditable={inRecap && whole}
                          flagged={
                            !inRecap && showFlagsFor(key) ? hl : undefined
                          }
                          devise={collecte.devise}
                          onDirtyChange={setDirtyTableau}
                          onSave={async (lignes) => {
                            await saveLignes(id, key, lignes);
                            toast.success(`« ${def.label} » enregistré`);
                          }}
                        />
                      );
                    })()}
                    <OngletNotes
                      collecteId={id}
                      onglet={key}
                      notes={collecte.notes}
                      canWrite={canManageRecap || poste === "societe_employe"}
                    />
                  </div>
                </TabsContent>
              );
            })}

            {(isAdmin || isStaff) && (
              <TabsContent value="historique" className="m-0">
                <SectionHeader
                  title="Historique"
                  description="Actions enregistrées pour cette collecte"
                />
                {journalLoading ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    Chargement…
                  </p>
                ) : journalError ? (
                  <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-destructive">
                    <span>Historique indisponible.</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setJournalLoading(true);
                        setJournalError(false);
                        fetchJournal(id)
                          .then(setJournal)
                          .catch(() => setJournalError(true))
                          .finally(() => setJournalLoading(false));
                      }}
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : !journal || journal.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={History}
                      title="Aucun historique"
                      description="Les actions sur cette collecte apparaîtront ici."
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {journal.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-start gap-3 px-3 py-2.5"
                      >
                        <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            {entry.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.actor} · {formatRelative(entry.at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            )}
          </div>
        </div>
      </Tabs>

      {isAdmin && (
        <CollecteFormDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={{
            societeId: collecte.societeId,
            periode: collecte.periode,
            devise: collecte.devise,
            onglets: collecte.onglets,
            echeance: collecte.echeance,
            relanceCadenceJours: collecte.relanceCadenceJours,
          }}
          onCreate={async (data) => {
            await update(id, {
              periode: data.periode,
              devise: data.devise,
              onglets: data.onglets,
              echeance: data.echeance,
              relanceCadenceJours: data.relanceCadenceJours,
            });
            toast.success("Collecte mise à jour");
          }}
        />
      )}

      <Dialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open && !savingDraft) setPendingTab(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          onEscapeKeyDown={(event) => savingDraft && event.preventDefault()}
          onPointerDownOutside={(event) =>
            savingDraft && event.preventDefault()
          }
        >
          <DialogHeader>
            <DialogTitle>Modifications non enregistrées</DialogTitle>
            <DialogDescription>
              Enregistrez ce tableau avant de changer de section, ou quittez
              sans conserver vos modifications.
            </DialogDescription>
          </DialogHeader>
          {draftError && (
            <p role="alert" className="text-sm text-destructive">
              Enregistrement impossible. Vos modifications sont conservées ;
              réessayez.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={savingDraft}
              onClick={() => setPendingTab(null)}
            >
              Rester
            </Button>
            <Button
              variant="outline"
              disabled={savingDraft}
              onClick={() => {
                gridRef.current?.discard();
                leaveAfterDraft();
              }}
            >
              Quitter sans enregistrer
            </Button>
            <Button
              disabled={savingDraft}
              onClick={() => void saveDraftAndLeave()}
            >
              {savingDraft ? "Enregistrement…" : "Enregistrer et changer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => { if (!o) { transmittedBeforeRecapRef.current = false; setConfirm(null); } }}
        destructive={confirm === "a_corriger"}
        title={
          confirm === "reopen"
            ? "Désarchiver la collecte ?"
            : confirm === "transmis"
              ? "Transmettre la collecte au cabinet ?"
              : confirm === "valide"
                ? "Valider la collecte ?"
                : confirm === "archive"
                  ? "Archiver la collecte ?"
                  : "Renvoyer la collecte pour correction ?"
        }
        description={
          confirm === "reopen"
            ? "La collecte reviendra à l'état validé."
            : confirm === "transmis"
              ? "Vous ne pourrez plus la modifier tant que le cabinet ne l'a pas renvoyée."
              : confirm === "valide"
                ? "Le client de la société ne pourra plus la modifier. Vous (cabinet) pourrez encore l'ajuster, puis l'archiver."
          : confirm === "archive"
            ? "Elle sera rangée dans les archives. Vous pourrez la désarchiver si besoin."
                  : "La collecte redevient modifiable (état « à corriger »)."
        }
        confirmLabel={
          confirm === "reopen"
            ? "Désarchiver"
            : confirm === "transmis"
              ? "Transmettre"
              : confirm === "valide"
                ? "Valider"
                : confirm === "archive"
                  ? "Archiver"
                  : "Renvoyer"
        }
        onConfirm={() =>
          confirm
            ? applyStatut(confirm === "reopen" ? "valide" : confirm)
            : undefined
        }
      />

      <FileUploadDialog
        open={fichiersOpen}
        onOpenChange={setFichiersOpen}
        destinationLabel={
          collecte.periode.trim() ? `${socNom} — ${collecte.periode}` : socNom
        }
        onSubmit={async (fichiers: NewFichier[]) => {
          const skipped = fichiers.filter((f) => !f.dataUrl).length;
          for (const f of fichiers) {
            if (!f.dataUrl) continue;
            await uploadFichier(id, {
              nom: f.libelle,
              format: f.format,
              taille: f.taille,
              dataUrl: f.dataUrl,
            });
          }
          if (skipped > 0) {
            toast.warning(`${skipped} fichier(s) trop volumineux, ignoré(s).`);
          }
          toast.success("Pièce(s) ajoutée(s)");
        }}
      />

      <ConfirmDialog
        open={Boolean(fichierToDelete)}
        onOpenChange={(o) => !o && setFichierToDelete(null)}
        destructive
        title="Supprimer cette pièce ?"
        description="Le fichier sera définitivement supprimé."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (fichierToDelete) await deleteFichier(id, fichierToDelete);
          setFichierToDelete(null);
        }}
      />

      <DocPreviewDialog
        open={Boolean(previewFichier)}
        onOpenChange={(o) => !o && setPreviewFichier(null)}
        title={previewFichier?.title ?? ""}
        dataUrl={previewFichier?.dataUrl ?? null}
      />
    </div>
  );
}

/** Entrée du sidenav des sections de la collecte — remplace l'ancienne
 * barre d'onglets horizontale, illisible une fois qu'il y a plus d'une
 * dizaine de tableaux demandés. */
function NavItem({
  active,
  onClick,
  label,
  badge,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  dot?: "success" | "warning";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-9 w-full items-center justify-between gap-2 px-4 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active
          ? "bg-card font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-px before:bg-accent"
          : "text-muted-foreground hover:bg-secondary hover:text-primary",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{label}</span>
        {dot && (
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              dot === "success" ? "bg-success" : "bg-warning",
            )}
          />
        )}
      </span>
      {badge !== undefined && (
        <span
          className={cn(
            "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
            active
              ? "bg-secondary text-primary"
              : "bg-secondary text-muted-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function SectionHeader({
  title,
  description,
  action,
  dirty = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  dirty?: boolean;
}) {
  return (
    <div className="relative flex min-h-14 flex-wrap items-center gap-2 border-b border-border px-4 py-2 before:absolute before:inset-y-4 before:left-0 before:w-px before:bg-primary after:absolute after:bottom-0 after:left-0 after:h-px after:w-8 after:bg-accent">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-primary">{title}</h2>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
      {dirty && (
        <span role="status" className="text-xs font-medium text-warning">
          Modifications non enregistrées
        </span>
      )}
      {action}
    </div>
  );
}

/** Excel / PDF de CETTE section seulement, indépendamment des autres. */
function SectionExport({
  collecte,
  section,
  societeNom,
}: {
  collecte: Parameters<typeof printCollecteSection>[0];
  section: string;
  societeNom: string;
}) {
  const exportExcel = () =>
    exportCollecteSectionXlsx(collecte, section, societeNom).catch(() =>
      toast.error("Export impossible"),
    );
  const exportPdf = () =>
    downloadCollecteSectionPdf(collecte, section, societeNom).catch(() =>
      toast.error("PDF impossible"),
    );
  const print = () => printCollecteSection(collecte, section, societeNom);

  return (
    <div className="flex w-full justify-end lg:w-auto">
      <div className="hidden flex-wrap items-center justify-end gap-0.5 lg:flex">
        <Button variant="ghost" size="sm" onClick={exportExcel}>
          <Download className="h-4 w-4" />
          Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={exportPdf}>
          <FileText className="h-4 w-4" />
          PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={print}>
          <Printer className="h-4 w-4" />
          Imprimer
        </Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="min-h-10 lg:hidden">
            <Download className="h-4 w-4" />
            Exporter
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={exportExcel}>
            <Download className="h-4 w-4" /> Excel
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportPdf}>
            <FileText className="h-4 w-4" /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={print}>
            <Printer className="h-4 w-4" /> Imprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
