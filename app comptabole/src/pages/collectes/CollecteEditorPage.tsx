import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  MoreHorizontal,
  Paperclip,
  Printer,
  RotateCcw,
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocietes } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import { COLLECTE_STATUT_LABELS, TAB_BY_KEY, ordonnerTableaux } from "@/lib/collecte/tabs";
import { checklistRows } from "@/lib/collecte/checklist";
import { computeManques } from "@/lib/collecte/manques";
import { aggregateRecapStatut, sectionRecapStatut } from "@/lib/collecte/recap";
import { sectionOuverte, sectionStatut } from "@/lib/collecte/sections";
import {
  downloadCollecteSectionPdf,
  exportCollecteSectionXlsx,
  exportCollecteXlsx,
  printCollecteSection,
} from "@/lib/collecte/exportXlsx";
import { downloadDataUrl } from "@/lib/file";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import type { CollecteFull, CollecteJournalEntry, CollecteStatut } from "@/types";
import { CollecteGrid, type CollecteGridHandle } from "./CollecteGrid";
import { CollecteChecklist } from "./CollecteChecklist";
import { CollecteClientVerification } from "./CollecteClientVerification";
import { CollecteFormDrawer } from "./CollecteFormDrawer";
import { RecapTab } from "./RecapTab";
import { OngletNotes } from "./OngletNotes";
import { SectionCircuit } from "./SectionCircuit";
import { lignesSouchePourEtat } from "@/lib/collecte/souche";
import { TableauxNonDemandes } from "./TableauxNonDemandes";
import { CollecteWorkNavigation } from "./CollecteWorkNavigation";
import {
  FileUploadDialog,
  type NewFichier,
} from "../structuration/FileUploadDialog";
import { DocPreviewDialog } from "../stock/DocPreviewDialog";
import { fileExtension, formatFileSize, readFileAsDataUrl } from "@/lib/file";
import { alleger, estImageDataUrl } from "@/lib/image";

/** Taille maximale d'un fichier joint à une ligne de tableau (hors images, qui sont allégées). */
const MAX_PIECE_LIGNE = 8 * 1024 * 1024;

export function CollecteEditorPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isAdmin,
    poste,
    isCollaborateur: isStaff,
    canManageCollaborateurs,
  } = usePermissions();
  const societes = useSocietes();

  const collecte = useCollectes((s) => s.current);
  const loading = useCollectes((s) => s.loadingOne);
  const fetchOne = useCollectes((s) => s.fetchOne);
  const clearCurrent = useCollectes((s) => s.clearCurrent);
  const update = useCollectes((s) => s.update);
  const setStatut = useCollectes((s) => s.setStatut);
  const saveLignes = useCollectes((s) => s.saveLignes);
  const saveComment = useCollectes((s) => s.saveComment);
  const saveSuivi = useCollectes((s) => s.saveSuivi);
  const marquerRecu = useCollectes((s) => s.marquerRecu);
  const submitRecap = useCollectes((s) => s.submitRecap);
  const transmettreSection = useCollectes((s) => s.transmettreSection);
  const validerSection = useCollectes((s) => s.validerSection);
  const renvoyerSection = useCollectes((s) => s.renvoyerSection);
  const archiverSection = useCollectes((s) => s.archiverSection);
  const desarchiverSection = useCollectes((s) => s.desarchiverSection);
  const relanceNow = useCollectes((s) => s.relanceNow);
  const uploadFichier = useCollectes((s) => s.uploadFichier);
  const joindreFichier = useCollectes((s) => s.joindreFichier);
  const deleteFichier = useCollectes((s) => s.deleteFichier);
  const fetchJournal = useCollectes((s) => s.fetchJournal);

  const [confirm, setConfirm] = useState<
    null | "transmis" | "valide" | "a_corriger" | "archive" | "reopen"
  >(null);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState("checklist");
  const [focusTarget, setFocusTarget] = useState<{ table: string; ordre: number | null; col: string | null; revision: number } | undefined>();
  const focusRevision = useRef(0);
  const gridRef = useRef<CollecteGridHandle>(null);
  const transmittedBeforeRecapRef = useRef(false);
  const [dirtyTableau, setDirtyTableau] = useState(false);
  const [incomplet, setIncomplet] = useState<{ next: string; message: string } | null>(null);
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
  const initializedFor = useRef("");
  function focusTableCell(table: string, target: { ordre: number | null; col: string | null }) {
    focusRevision.current += 1;
    setFocusTarget({ table, ...target, revision: focusRevision.current });
  }
  useEffect(() => {
    if (!collecte || initializedFor.current === collecte.id) return;
    initializedFor.current = collecte.id;
    const requested = searchParams.get("tab");
    const validRequested = requested === "checklist" || requested === "recap" || requested === "documents" ||
      (requested === "verification" && !isAdmin) ||
      (requested === "historique" && (isAdmin || isStaff)) ||
      (requested ? collecte.onglets.includes(requested) : false);
    const ordered = ordonnerTableaux(collecte.onglets);
    const recapTarget = ordered.find((key) => sectionRecapStatut(collecte, key) === "envoye");
    const nextTarget = poste === "societe_employe"
      ? recapTarget ?? ordered.find((key) => !TAB_BY_KEY[key]?.cabinetSeul && sectionOuverte(sectionStatut(collecte, key)))
      : ordered.find((key) => sectionStatut(collecte, key) === "transmis") ?? ordered.find((key) => sectionStatut(collecte, key) === "a_corriger");
    const next = validRequested ? requested! : (poste === "societe_employe" ? recapTarget ?? nextTarget : nextTarget) ?? "checklist";
    setTab(next);
    if (!validRequested && poste === "societe_employe" && !["checklist", "recap", "documents", "verification", "historique"].includes(next)) {
      const manque = computeManques(collecte).find((item) => item.onglet === next);
      if (manque) focusTableCell(next, { ordre: manque.ordre, col: manque.col });
    }
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      updated.set("tab", next);
      return updated;
    }, { replace: true });
  }, [collecte?.id, searchParams, setSearchParams, isAdmin, isStaff, poste]);

  if (!collecte) {
    return (
      <EmptyState
        title={
          loading
            ? "Chargement…"
            : detailError
              ? "Chargement impossible"
              : "Collecte introuvable"
        }
        description={
          loading
            ? ""
            : detailError
              ? "Vérifiez votre connexion ou réessayez."
              : "Cette collecte n'existe pas ou a été supprimée."
        }
        action={
          !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailError(false);
                void fetchOne(id).catch(() => setDetailError(true));
              }}
            >
              Réessayer
            </Button>
          )
        }
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
  const isClient = poste === "societe_employe";
  // Chaque tableau a son circuit (à remplir -> transmis -> validé ou renvoyé) : le client modifie ceux qui sont encore ouverts.
  const sectionsOuvertes = collecte.onglets.some((k) => sectionOuverte(sectionStatut(collecte, k)));
  const editable = !archivee && (isAdmin || isStaff || (isClient && sectionsOuvertes));
  /** Tableau modifiable par cette session : jamais un tableau archivé ; le client seulement tant qu'il est ouvert. */
  const editableTab = (key: string) => {
    const st = sectionStatut(collecte, key);
    return !archivee && st !== "archive" && (isAdmin || isStaff || (isClient && sectionOuverte(st) && !TAB_BY_KEY[key]?.cabinetSeul));
  };
  // Cabinet = admin ou collaborateur : peut envoyer/clore un récap par
  // tableau et écrire des notes — pas réservé à l'admin.
  const canManageRecap = isAdmin || isStaff;

  // Mode « complétion récap » côté client : au moins un tableau a été
  // envoyé par le cabinet (chaque tableau se déverrouille indépendamment
  // des autres — voir sectionRecapStatut plus bas, utilisé par tableau).
  const clientRecap = poste === "societe_employe" && currentRecap === "envoye";
  // L'envoi final se fait depuis l'écran de vérification, après l'enregistrement du tableau.
  // Une réponse de récap reste distincte et garde son propre workflow.
  const canSubmit = !isAdmin && !archivee && (sectionsOuvertes || clientRecap);
  const canTransmitCollecte = canSubmit && (collecte.statut === "brouillon" || collecte.statut === "a_corriger");

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
    !archivee &&
    (canManageCollaborateurs || sectionRecapStatut(collecte, key) !== "none");
  // Le client ne peut renvoyer un récap au cabinet qu'une fois TOUTES les
  // cases « ? » des tableaux demandés remplies et enregistrées — le cabinet
  // ne reçoit jamais de récap à moitié complété à clôturer.
  // Un tableau encore ouvert (à remplir ou à corriger) se transfère même incomplet : seuls comptent les tableaux
  // déjà transmis pour lesquels le cabinet attend des cases précises.
  const recapRestant = clientRecap
    ? liveManques.filter(
        (m) =>
          sectionRecapStatut(collecte, m.onglet) === "envoye" &&
          !sectionOuverte(sectionStatut(collecte, m.onglet)),
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
  const codeSociete = societes.find((so) => so.id === collecte.societeId)?.code ?? "";
  const boutonBandeau = "min-h-9 gap-1.5 px-3";

  function requestTab(next: string, forcer = false, target?: { ordre: number | null; col: string | null }) {
    if (next === tab) return;
    if (savingDraft) return;
    // Un bordereau dont les chèques n'atteignent pas le montant annoncé : on prévient avant de passer à autre chose.
    const grille = gridRef.current;
    if (!forcer && grille && !grille.isComplete()) {
      setIncomplet({ next, message: grille.incompleteMessage() });
      return;
    }
    if (gridRef.current?.isDirty()) {
      setDraftError(false);
      void saveDraftAndLeave(next, target);
      return;
    }
    setDirtyTableau(false);
    completeNavigation(next, target);
  }

  function completeNavigation(next: string, target?: { ordre: number | null; col: string | null }) {
    if (next === "__back__") navigate("/collectes");
    else if (next === "__preview__") setPreview((value) => !value);
    else if (next === "__confirm_transmis__") setConfirm("transmis");
    else if (next === "__confirm_valide__") setConfirm("valide");
    else if (next === "__confirm_archive__") setConfirm("archive");
    else if (next === "__confirm_a_corriger__") setConfirm("a_corriger");
    else if (next === "__confirm_reopen__") setConfirm("reopen");
    else {
      if (target) focusTableCell(next, target);
      setTab(next);
      setSearchParams((params) => {
        const updated = new URLSearchParams(params);
        updated.set("tab", next);
        return updated;
      }, { replace: true });
    }
  }

  /** Avant de transférer un tableau : enregistre ce qui est en cours, puis dit ce qui manque encore (chaîne vide si complet). */
  async function preparerTransfert(key: string): Promise<string> {
    const grille = tab === key ? gridRef.current : null;
    if (grille?.isDirty()) await grille.save();
    const courant = useCollectes.getState().current;
    if (!courant) return "";
    const morceaux: string[] = [];
    const manques = computeManques(courant).filter((m) => m.onglet === key);
    if (!courant.lignes.some((l) => l.onglet === key)) morceaux.push("aucune ligne saisie");
    else if (manques.length > 0) morceaux.push(`${manques.length} case${manques.length > 1 ? "s" : ""} importante${manques.length > 1 ? "s" : ""} vide${manques.length > 1 ? "s" : ""}`);
    if (grille && !grille.isComplete()) morceaux.push(grille.incompleteMessage());
    return morceaux.join(" · ");
  }

  async function saveDraftAndLeave(next: string, target?: { ordre: number | null; col: string | null }) {
    setSavingDraft(true);
    setDraftError(false);
    try {
      const grid = gridRef.current;
      if (!grid) throw new Error("Tableau indisponible");
      await grid.save();
      setDirtyTableau(false);
      completeNavigation(next, target);
    } catch {
      setDraftError(true);
      toast.error("Brouillon non enregistré. Restez sur ce tableau et réessayez.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function saveAndVerifyTable() {
    const grille = gridRef.current;
    if (!grille) return;
    if (!grille.isComplete()) {
      setIncomplet({ next: "verification", message: grille.incompleteMessage() });
      return;
    }
    try {
      await grille.save();
      setDirtyTableau(false);
      completeNavigation("verification");
    } catch {
      toast.error("Enregistrement impossible. Corrigez le problème puis réessayez.");
    }
  }

  async function applyStatut(s: CollecteStatut) {
    if (!transmittedBeforeRecapRef.current) {
      await setStatut(id, s);
      if (s === "transmis" && clientRecap)
        transmittedBeforeRecapRef.current = true;
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
      <header
        data-tour="collecte-identity"
        className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-border pb-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/8 text-sm font-bold text-primary">
            {monogram}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-2xl font-medium leading-tight tracking-tight text-primary">{socNom}</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[codeSociete, collecte.periode.trim(), "Collecte de pièces"].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className={cn(
            "inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold",
            validee ? "bg-success/10 text-success" : collecte.statut === "a_corriger" || enRetard ? "bg-warning/15 text-warning-foreground" : archivee ? "bg-muted text-muted-foreground" : "bg-primary/8 text-primary",
          )}>
            <span aria-hidden className={cn("size-2 rounded-full", validee ? "bg-success" : collecte.statut === "a_corriger" || enRetard ? "bg-warning" : archivee ? "bg-muted-foreground/50" : "bg-primary")} />
            {COLLECTE_STATUT_LABELS[collecte.statut]}
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <strong className="font-semibold tabular-nums text-foreground">{recus}/{rows.length}</strong> pièces reçues
            <span role="progressbar" aria-label="Pièces reçues" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={recus} className="h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:w-28">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${rows.length ? Math.round((recus / rows.length) * 100) : 0}%` }} />
            </span>
          </span>
          {collecte.echeance && (
            <span className={cn("text-xs", enRetard ? "font-semibold text-warning-foreground" : "text-muted-foreground")}>
              Échéance {formatDate(collecte.echeance)}
              {enRetard ? " · dépassée" : ""}
            </span>
          )}
          {canManageCollaborateurs && collecte.statut === "transmis" && (
            <>
              <Button variant="outline" size="sm" className={boutonBandeau} onClick={() => requestTab("__confirm_valide__")}><CheckCircle2 className="size-4" /> Valider</Button>
              <Button variant="outline" size="sm" className={boutonBandeau} onClick={() => requestTab("__confirm_a_corriger__")}>Renvoyer</Button>
            </>
          )}
          {canManageCollaborateurs && validee && (
            <>
              <Button variant="outline" size="sm" className={boutonBandeau} onClick={() => requestTab("__confirm_archive__")}>Archiver</Button>
              <Button variant="outline" size="sm" className={boutonBandeau} onClick={() => requestTab("__confirm_a_corriger__")}><RotateCcw className="size-4" /> Rouvrir</Button>
            </>
          )}
          {canManageCollaborateurs && archivee && <Button variant="outline" size="sm" className={boutonBandeau} onClick={() => requestTab("__confirm_reopen__")}><RotateCcw className="size-4" /> Désarchiver</Button>}
        </div>
      </header>
      {(savingDraft || draftError) && (
        <p role={draftError ? "alert" : "status"} aria-live="polite" className={cn("mt-2 rounded-lg border px-3 py-2 text-xs", draftError ? "border-destructive/25 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary")}>
          {draftError ? "Le brouillon n’a pas été enregistré. Restez sur ce tableau et réessayez." : "Enregistrement du brouillon avant le changement de section…"}
        </p>
      )}
      {preview && (
        <p className="border-x border-b border-border bg-accent/5 px-3 py-2 text-xs text-foreground">
          Aperçu client — seules les cases « ? » demandées sont modifiables.
        </p>
      )}
      <div data-tour="collecte-tools" className="flex justify-end py-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-h-9 gap-1.5 bg-card"><MoreHorizontal className="size-4" /> Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Actions sur la collecte</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void exportCollecteXlsx(collecte, socNom).catch(() => toast.error("Export impossible"))}><Download className="mr-2 size-4" /> Tout en Excel</DropdownMenuItem>
            {isAdmin && !archivee && liveManques.length > 0 && <DropdownMenuItem onSelect={() => requestTab("__preview__")}><Eye className="mr-2 size-4" /> {preview ? "Quitter l'aperçu client" : "Aperçu client"}</DropdownMenuItem>}
            {canManageCollaborateurs && <DropdownMenuItem onSelect={() => setEditOpen(true)}><SlidersHorizontal className="mr-2 size-4" /> Modifier la collecte</DropdownMenuItem>}
            {canManageCollaborateurs && enAttente && <DropdownMenuItem disabled={relancing} onSelect={() => {
              setRelancing(true);
              void relanceNow(id).then(() => toast.success("Relance envoyée au client")).catch(() => {}).finally(() => setRelancing(false));
            }}><BellRing className="mr-2 size-4" /> {relancing ? "Envoi…" : "Relancer maintenant"}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={tab} onValueChange={requestTab}>
        <div className="mt-1 min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <CollecteWorkNavigation
            collecte={collecte}
            active={tab}
            isClient={isClient}
            canVerify={!isAdmin}
            canSeeHistory={isAdmin || isStaff}
            missingByTable={manqueCount}
            visibleMissing={showFlagsFor}
            recapCount={collecte.sections.filter((section) => section.recapStatut === "envoye").length}
            onSelect={requestTab}
          />
          <main data-tour="collecte-content" className="min-w-0">
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
                  onNavigate={(key, target) => requestTab(key, false, target)}
                />
              </div>
            </TabsContent>

            <TabsContent value="verification" className="m-0">
              <CollecteClientVerification
                collecte={collecte}
                rows={rows}
                canTransmit={canTransmitCollecte}
                canSubmitRecap={clientRecap && !archivee && !isAdmin}
                recapPending={clientRecap}
                recapRemaining={recapRestant}
                onTransmit={() => requestTab("__confirm_transmis__")}
                onSubmitRecap={() => {
                  void submitRecap(id).then(() => toast.success("Précisions transmises au cabinet")).catch(() => {});
                }}
                onOpenTable={(key) => requestTab(key)}
              />
            </TabsContent>

            {/* ── Checklist ─────────────────────────── */}
            <TabsContent value="checklist" className="m-0">
              <SectionHeader
                title="Checklist"
                description={
                  editable
                    ? "Cochez la pièce reçue puis saisissez le total : tout s'enregistre automatiquement."
                    : "Pièces attendues par tableau"
                }
              />
              <CollecteChecklist
                rows={rows}
                devise={collecte.devise}
                editable={editable}
                onSelectTab={requestTab}
                onSaveComment={(key, value) => saveComment(id, key, value)}
                onSaveSuivi={(key, patch) => saveSuivi(id, key, patch)}
                onMarkAll={(keys) => marquerRecu(id, keys, true)}
                exports={<SectionExport collecte={collecte} section="checklist" societeNom={socNom} />}
                notice={
                  !editable
                    ? archivee
                      ? "Collecte archivée : désarchivez-la pour modifier les pièces."
                      : `Collecte ${COLLECTE_STATUT_LABELS[collecte.statut].toLowerCase()} : le cabinet peut la renvoyer pour correction afin de modifier les pièces.`
                    : undefined
                }
              />
              {canManageCollaborateurs && !archivee && (
                <TableauxNonDemandes
                  demandes={collecte.onglets}
                  onAjouter={async (k) => {
                    await update(id, { onglets: ordonnerTableaux([...collecte.onglets, k]) });
                    toast.success(`« ${TAB_BY_KEY[k]?.label ?? k} » ajouté à la collecte`);
                  }}
                />
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
                <div className="flex items-start gap-3 px-4 py-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Paperclip className="size-4" aria-hidden="true" /></span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Aucun document déposé</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ajoutez un scan ou un PDF en complément des tableaux chiffrés.</p>
                  </div>
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
                    {!preview && !archivee && def.cabinetSeul && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">Tenu par le cabinet</span>
                        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                          {isClient
                            ? "Le comptable tient ce tableau : vous pouvez le consulter, pas le modifier."
                            : "Reprenez la souche de chèques remplie par le client, vérifiez-la et ajoutez le nécessaire. Le client ne voit ce tableau qu'en consultation."}
                        </p>
                        {!isClient && editableTab(key) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-9 gap-1.5"
                            onClick={() => {
                              const nouvelles = lignesSouchePourEtat(collecte);
                              if (nouvelles.length === 0) {
                                toast.info("Rien de nouveau à reprendre de la souche de chèques.");
                                return;
                              }
                              gridRef.current?.ajouterLignes(nouvelles);
                              toast.success(`${nouvelles.length} ligne${nouvelles.length > 1 ? "s" : ""} reprise${nouvelles.length > 1 ? "s" : ""} de la souche — pensez à enregistrer`);
                            }}
                          >
                            <Download className="h-4 w-4" />
                            Reprendre la souche de chèques
                          </Button>
                        )}
                      </div>
                    )}
                    {!preview && (!archivee || sectionStatut(collecte, key) === "archive") && !def.cabinetSeul && (
                      <SectionCircuit
                        label={def.label}
                        statut={sectionStatut(collecte, key)}
                        motifRenvoi={collecte.sections.find((x) => x.onglet === key)?.motifRenvoi ?? ""}
                        isClient={isClient}
                        canArchive={canManageCollaborateurs}
                        preparerTransfert={() => preparerTransfert(key)}
                        onTransmettre={async (incomplet) => {
                          await transmettreSection(id, key, incomplet);
                          toast.success(`« ${def.label} » transmis au cabinet`);
                        }}
                        onValider={async () => {
                          await validerSection(id, key);
                          toast.success(`« ${def.label} » validé`);
                        }}
                        onRenvoyer={async (motif) => {
                          await renvoyerSection(id, key, motif);
                          toast.success(`« ${def.label} » renvoyé au client`);
                        }}
                        onArchiver={async () => {
                          await archiverSection(id, key);
                          toast.success(`« ${def.label} » archivé`);
                        }}
                        onDesarchiver={async () => {
                          await desarchiverSection(id, key);
                          toast.success(`« ${def.label} » désarchivé`);
                        }}
                      />
                    )}
                    {!preview && collecte.fichiers.some((fichier) => !fichier.onglet || fichier.onglet === key) && (
                      <DocumentsDuTableau
                        fichiers={collecte.fichiers.filter((fichier) => !fichier.onglet || fichier.onglet === key)}
                        onPreview={(fichier) => setPreviewFichier({ title: fichier.nom, dataUrl: fichier.dataUrl ?? null })}
                      />
                    )}
                    {(() => {
                      const hl = flaggedByTab.get(key);
                      const whole = wholeTab.has(key);
                      const hasManque = (hl && hl.size > 0) || whole;
                      // Le client complète CE tableau s'il a été envoyé indépendamment
                      // des autres (voir RecapTab) ET a au moins une case ? (ou tableau vide).
                      // Un tableau ouvert (à remplir / à corriger) reste entièrement modifiable, lignes comprises : le mode
                      // « seulement les cases ? » ne vaut que pour un tableau déjà transmis que le cabinet fait compléter.
                      const clientRecapForTab =
                        poste === "societe_employe" &&
                        sectionRecapStatut(collecte, key) === "envoye" &&
                        !sectionOuverte(sectionStatut(collecte, key));
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
                          readOnly={clientRecapForTab ? !inRecap : !editableTab(key)}
                          ligneBordereauFigee={isClient}
                          sansSuppression={isClient}
                          recapClient={inRecap}
                          highlight={hl}
                          wholeEditable={inRecap && whole}
                          focusTarget={focusTarget?.table === key ? focusTarget : undefined}
                          saveAndContinue={isClient && (editableTab(key) || inRecap) ? saveAndVerifyTable : undefined}
                          flagged={
                            !inRecap && showFlagsFor(key) ? hl : undefined
                          }
                          devise={collecte.devise}
                          onJoindre={async (file) => {
                            const image = file.type.startsWith("image/");
                            if (!image && file.size > MAX_PIECE_LIGNE) {
                              toast.error("Fichier trop volumineux (8 Mo maximum).");
                              throw new Error("trop volumineux");
                            }
                            let dataUrl = await readFileAsDataUrl(file);
                            if (estImageDataUrl(dataUrl)) dataUrl = await alleger(dataUrl);
                            const cree = await joindreFichier(id, {
                              onglet: key,
                              nom: file.name,
                              format: fileExtension(file.name),
                              taille: formatFileSize(file.size),
                              dataUrl,
                            });
                            toast.success("Pièce jointe ajoutée");
                            return { id: cree.id, nom: cree.nom };
                          }}
                          onVoirPiece={(fichierId) => {
                            const f = collecte.fichiers.find((x) => x.id === fichierId);
                            if (f?.dataUrl) setPreviewFichier({ title: f.nom, dataUrl: f.dataUrl });
                            else toast.info("Cette pièce jointe n'est plus disponible.");
                          }}
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
          </main>
        </div>
      </Tabs>

      {canManageCollaborateurs && (
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

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) {
            transmittedBeforeRecapRef.current = false;
            setConfirm(null);
          }
        }}
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
        open={Boolean(incomplet)}
        onOpenChange={(o) => !o && setIncomplet(null)}
        destructive
        title="Répartition incomplète"
        description={
          <>
            <span className="block">{incomplet?.message}.</span>
            <span className="mt-2 block">Complétez les lignes jusqu'à atteindre le montant avant de passer à une autre action.</span>
          </>
        }
        confirmLabel="Continuer quand même"
        cancelLabel="Compléter"
        onConfirm={() => {
          const suite = incomplet?.next;
          setIncomplet(null);
          if (suite) requestTab(suite, true);
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

function DocumentsDuTableau({
  fichiers,
  onPreview,
}: {
  fichiers: CollecteFull["fichiers"];
  onPreview: (fichier: CollecteFull["fichiers"][number]) => void;
}) {
  return (
    <section aria-label="Pièces liées au tableau" className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <Paperclip className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-xs font-semibold text-foreground">Pièces liées à ce tableau</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">{fichiers.length}</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {fichiers.map((fichier) => (
          <li key={fichier.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="max-w-56 truncate text-xs font-medium" title={fichier.nom}>{fichier.nom}</span>
            {fichier.dataUrl && (
              <>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => onPreview(fichier)}>
                  Aperçu
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => downloadDataUrl(fichier.dataUrl!, fichier.nom)}>
                  Télécharger
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
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
