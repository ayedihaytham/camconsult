import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  File as FileIcon,
  FileText,
  History,
  Paperclip,
  Plus,
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
import { COLLECTE_ETATS, COLLECTE_STATUT_LABELS, TAB_BY_KEY, etatDeTableau, ordonnerTableaux } from "@/lib/collecte/tabs";
import { checklistRows } from "@/lib/collecte/checklist";
import { computeManques } from "@/lib/collecte/manques";
import { aggregateRecapStatut, sectionRecapStatut } from "@/lib/collecte/recap";
import { SECTION_STATUT_LABELS, sectionOuverte, sectionStatut } from "@/lib/collecte/sections";
import {
  downloadCollecteSectionPdf,
  exportCollecteSectionXlsx,
  exportCollecteXlsx,
  printCollecteSection,
} from "@/lib/collecte/exportXlsx";
import { downloadDataUrl } from "@/lib/file";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import type { CollecteJournalEntry, CollecteStatut, SectionStatut } from "@/types";
import { CollecteGrid, type CollecteGridHandle } from "./CollecteGrid";
import { CollecteChecklist } from "./CollecteChecklist";
import { CollecteNextStep } from "./CollecteNextStep";
import { CollecteFormDrawer } from "./CollecteFormDrawer";
import { RecapTab } from "./RecapTab";
import { OngletNotes } from "./OngletNotes";
import { SectionCircuit } from "./SectionCircuit";
import { lignesSouchePourEtat } from "@/lib/collecte/souche";
import { TableauxNonDemandes } from "./TableauxNonDemandes";
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
  const gridRef = useRef<CollecteGridHandle>(null);
  const transmittedBeforeRecapRef = useRef(false);
  const [dirtyTableau, setDirtyTableau] = useState(false);
  const [incomplet, setIncomplet] = useState<{ next: string; message: string; manque: boolean } | null>(null);
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
  // Un seul bouton client : « Transmettre au cabinet » (soumet aussi le récap).
  const canSubmit = !isAdmin && !archivee && (sectionsOuvertes || clientRecap);

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
  const tableauKeys = ordonnerTableaux(collecte.onglets);
  // Un tableau archivé quitte les onglets de travail et se retrouve dans l'onglet « Archives ».
  const archives = tableauKeys.filter((k) => sectionStatut(collecte, k) === "archive");
  const actifs = tableauKeys.filter((k) => !archives.includes(k));
  // Barre d'onglets : un seul onglet par état (chèques, virements, traites), qui s'ouvre sur ses tableaux ; les autres tableaux restent des onglets.
  const entreesNav: { etat?: ReturnType<typeof etatDeTableau>; keys: string[] }[] = [];
  // Le cabinet voit toujours les trois états : les tableaux pas encore demandés s'y ajoutent depuis le menu de l'état.
  if (canManageCollaborateurs && !archivee) for (const etat of COLLECTE_ETATS) entreesNav.push({ etat, keys: [] });
  for (const k of actifs) {
    const etat = etatDeTableau(k);
    const existante = etat && entreesNav.find((e) => e.etat?.key === etat.key);
    if (existante) existante.keys.push(k);
    else entreesNav.push({ etat, keys: [k] });
  }
  const codeSociete = societes.find((so) => so.id === collecte.societeId)?.code ?? "";
  const boutonBandeau =
    "min-h-10 gap-2 border-primary-foreground/30 bg-transparent px-4 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground";

  function requestTab(next: string, forcer = false) {
    if (next === tab) return;
    // Un bordereau dont les chèques n'atteignent pas le montant annoncé : on prévient avant de passer à autre chose.
    const grille = gridRef.current;
    // Seul le client est interrompu : le cabinet quitte et enregistre librement, et signale ce qui reste à compléter par le Récap.
    if (!forcer && isClient && grille && !grille.isComplete()) {
      setIncomplet({ next, message: grille.incompleteMessage(), manque: grille.ecart().manque });
      return;
    }
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
        className="overflow-hidden rounded-2xl bg-primary px-5 pt-5 text-primary-foreground shadow-sm lg:px-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-xl border border-primary-foreground/25 bg-primary-foreground/10 text-lg font-bold"
            >
              {monogram}
            </span>
            <div className="min-w-0">
              <h1 className="font-serif text-3xl font-medium leading-tight tracking-tight">{socNom}</h1>
              <p className="mt-1 text-sm text-primary-foreground/70">
                {[codeSociete, collecte.periode.trim(), "Collecte de pièces"].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canSubmit && (
              <Button
                variant="outline"
                className={boutonBandeau}
                disabled={recapRestant > 0}
                title={recapRestant > 0 ? `Encore ${recapRestant} case(s) à compléter avant de transmettre` : undefined}
                onClick={async () => {
                  if (recapRestant > 0) return;
                  if (collecte.statut === "brouillon" || collecte.statut === "a_corriger") requestTab("__confirm_transmis__");
                  else if (clientRecap) {
                    await submitRecap(id);
                    toast.success("Récap transmis au cabinet");
                  }
                }}
              >
                <Send className="h-4 w-4" /> Transmettre au cabinet
              </Button>
            )}
            {canManageCollaborateurs && collecte.statut === "transmis" && (
              <>
                <Button variant="outline" className={boutonBandeau} onClick={() => requestTab("__confirm_valide__")}>
                  <CheckCircle2 className="h-4 w-4" /> Tout valider
                </Button>
                <Button variant="outline" className={boutonBandeau} onClick={() => requestTab("__confirm_a_corriger__")}>
                  Tout renvoyer
                </Button>
              </>
            )}
            {canManageCollaborateurs && validee && (
              <>
                <Button variant="outline" className={boutonBandeau} onClick={() => requestTab("__confirm_archive__")}>
                  Archiver la collecte
                </Button>
                <Button variant="outline" className={boutonBandeau} onClick={() => requestTab("__confirm_a_corriger__")}>
                  <RotateCcw className="h-4 w-4 text-accent" /> Rouvrir la collecte
                </Button>
              </>
            )}
            {canManageCollaborateurs && archivee && (
              <Button variant="outline" className={boutonBandeau} onClick={() => requestTab("__confirm_reopen__")}>
                <RotateCcw className="h-4 w-4 text-accent" /> Désarchiver
              </Button>
            )}
          </div>
        </div>
        <div className="relative mt-4 flex min-h-12 flex-wrap items-center gap-x-6 gap-y-2 border-t border-primary-foreground/20 py-3 text-sm before:absolute before:-top-px before:left-0 before:h-px before:w-1/4 before:bg-accent">
          <span className="inline-flex items-center gap-2 font-semibold">
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full",
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
          <span className="inline-flex items-center gap-3">
            <span>
              <strong className="tabular-nums">{recus}</strong> / {rows.length}{" "}
              <span className="text-primary-foreground/75">pièces reçues</span>
            </span>
            <span
              role="progressbar"
              aria-label="Pièces reçues"
              aria-valuemin={0}
              aria-valuemax={rows.length}
              aria-valuenow={recus}
              className="h-1.5 w-44 overflow-hidden rounded-full bg-primary-foreground/20"
            >
              <span className="block h-full rounded-full bg-accent" style={{ width: `${rows.length ? Math.round((recus / rows.length) * 100) : 0}%` }} />
            </span>
          </span>
          {collecte.echeance && (
            <span className={cn("text-primary-foreground/80", enRetard && "font-semibold text-warning")}>
              Échéance {formatDate(collecte.echeance)}
              {enRetard ? " · dépassée" : ""}
            </span>
          )}
          <span className="text-primary-foreground/75">
            {validee
              ? "Validée : verrouillée pour le client"
              : archivee
                ? "Archivée : lecture seule"
                : collecte.statut === "a_corriger"
                  ? "À corriger : complétez les pièces puis transmettez"
                  : collecte.statut === "transmis"
                    ? "Transmise au cabinet pour examen"
                    : "Préparez les tableaux et pièces avant transmission"}
          </span>
        </div>
      </header>
      <CollecteNextStep
        collecte={collecte}
        isClient={isClient}
        isCabinet={isAdmin || isStaff}
        recapPending={currentRecap === "envoye"}
        onNavigate={requestTab}
      />
      {(clientRecap || (canManageRecap && currentRecap === "envoye")) && (
        <div
          className={cn(
            "mt-3 flex min-h-10 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            clientRecap ? "border-warning/25 bg-warning/5 text-foreground" : "border-border bg-card text-muted-foreground",
          )}
        >
          {clientRecap
            ? `Complétez les cases demandées et enregistrez chaque tableau avant transmission. ${recapRestant > 0 ? `${recapRestant} case(s) restantes.` : "Vous pouvez transmettre."}`
            : "Récap en attente du client."}
        </div>
      )}
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
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 py-1 text-xs text-muted-foreground">
        <span>Travail sur le dossier · {socNom}</span>

        <div data-tour="collecte-tools" className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="min-h-9 gap-1.5 bg-card"
            onClick={() => {
              void exportCollecteXlsx(collecte, socNom).catch(() => toast.error("Export impossible"));
            }}
          >
            <Download className="h-4 w-4" />
            Tout en Excel
          </Button>

          {isAdmin && !archivee && liveManques.length > 0 && (
            <Button variant={preview ? "ledger" : "outline"} size="sm" className="min-h-9 gap-1.5 bg-card" onClick={() => requestTab("__preview__")}>
              <Eye className="h-4 w-4" />
              {preview ? "Quitter l'aperçu" : "Aperçu client"}
            </Button>
          )}

          {canManageCollaborateurs && (
            <Button variant="outline" size="sm" className="min-h-9 gap-1.5 bg-card" onClick={() => setEditOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Modifier la collecte
            </Button>
          )}

          {canManageCollaborateurs && enAttente && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 gap-1.5 bg-card"
              disabled={relancing}
              onClick={() => {
                setRelancing(true);
                void relanceNow(id)
                  .then(() => {
                    toast.success("Relance envoyée au client");
                  })
                  .catch(() => {})
                  .finally(() => {
                    setRelancing(false);
                  });
              }}
            >
              <BellRing className="h-4 w-4" />
              {relancing ? "Envoi…" : "Relancer maintenant"}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={requestTab}>
        <div className="flex min-w-0 flex-col border border-border bg-card">
          {/* Onglets de feuille, comme dans Excel : on choisit la section en bas, le tableau s'affiche au-dessus. */}
          <BarreFeuilles tab={tab}>
            <nav
              data-tour="collecte-navigation-desktop"
              aria-label="Sections du dossier"
              className="flex w-max min-w-full items-center gap-x-1 px-2 py-2"
            >
              <FeuilleTab active={tab === "checklist"} onClick={() => requestTab("checklist")} label="Checklist" />
              <FeuilleTab
                active={tab === "recap"}
                onClick={() => requestTab("recap")}
                label="Récap"
                dot={currentRecap !== "none" ? (currentRecap === "repondu" ? "success" : "warning") : undefined}
              />
              <FeuilleTab
                active={tab === "documents"}
                onClick={() => requestTab("documents")}
                label="Documents"
                badge={collecte.fichiers.length || undefined}
              />
              {tableauKeys.length > 0 && <span aria-hidden="true" className="mx-1 h-5 w-px self-center bg-border" />}
              {entreesNav.map((entree) =>
                entree.etat ? (
                  <FeuilleMenu
                    key={entree.etat.key}
                    etat={entree.etat}
                    tableaux={entree.keys}
                    absents={canManageCollaborateurs && !archivee ? entree.etat.tableaux.filter((k) => !collecte.onglets.includes(k)) : []}
                    onAjouter={async (k) => {
                      await update(id, { onglets: ordonnerTableaux([...collecte.onglets, k]) });
                      toast.success(`« ${TAB_BY_KEY[k]?.label ?? k} » ajouté à la collecte`);
                    }}
                    tab={tab}
                    onSelect={requestTab}
                    statut={(k) => sectionStatut(collecte, k)}
                    manques={(k) => (showFlagsFor(k) ? manqueCount.get(k) : undefined)}
                    recu={(k) => rows.find((r) => r.onglet === k)?.recu ?? false}
                  />
                ) : (
                  <FeuilleTab
                    key={entree.keys[0]}
                    active={tab === entree.keys[0]}
                    onClick={() => requestTab(entree.keys[0])}
                    label={TAB_BY_KEY[entree.keys[0]]?.label ?? entree.keys[0]}
                    badge={showFlagsFor(entree.keys[0]) ? manqueCount.get(entree.keys[0]) : undefined}
                    recu={rows.find((r) => r.onglet === entree.keys[0])?.recu}
                    dot={DOT_SECTION[sectionStatut(collecte, entree.keys[0])]}
                    dotTitle={SECTION_STATUT_LABELS[sectionStatut(collecte, entree.keys[0])]}
                  />
                ),
              )}
              {archives.length > 0 && (
                <FeuilleMenu
                  etat={{ code: "ARCH", label: "Archives" }}
                  tableaux={archives}
                  absents={[]}
                  onAjouter={async () => {}}
                  tab={tab}
                  onSelect={requestTab}
                  statut={(k) => sectionStatut(collecte, k)}
                  manques={() => undefined}
                  recu={(k) => rows.find((r) => r.onglet === k)?.recu ?? false}
                />
              )}
              {(isAdmin || isStaff) && (
                <>
                  <span aria-hidden="true" className="mx-1 h-5 w-px self-center bg-border" />
                  <FeuilleTab active={tab === "historique"} onClick={() => requestTab("historique")} label="Historique" />
                </>
              )}
            </nav>
          </BarreFeuilles>
          <div data-tour="collecte-content" className="min-w-0 bg-card">
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
          </div>

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

      <Dialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open && !savingDraft) setPendingTab(null);
        }}
      >
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-xl p-4 sm:p-6"
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
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              disabled={savingDraft}
              onClick={() => setPendingTab(null)}
            >
              Rester
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              disabled={savingDraft}
              onClick={() => {
                gridRef.current?.discard();
                leaveAfterDraft();
              }}
            >
              Quitter sans enregistrer
            </Button>
            <Button
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
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
        destructive={incomplet?.manque ?? true}
        title={incomplet?.manque === false ? "Montants à vérifier" : "Répartition incomplète"}
        description={
          <>
            <span className="block">{incomplet?.message}.</span>
            <span className="mt-2 block">
              {incomplet?.manque === false
                ? "Le total des chèques dépasse le montant du bordereau : une faute de frappe ? Vous pouvez corriger, ou continuer et enregistrer tel quel."
                : "Complétez les lignes jusqu'à atteindre le montant avant de passer à une autre action."}
            </span>
          </>
        }
        confirmLabel="Continuer quand même"
        cancelLabel={incomplet?.manque === false ? "Vérifier" : "Compléter"}
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

/** Barre d'onglets sur une seule ligne : elle défile horizontalement quand il y a plus d'onglets que de place,
 * avec des flèches, et ramène toujours l'onglet actif dans la zone visible. */
function BarreFeuilles({ tab, children }: { tab: string; children: ReactNode }) {
  const defilement = useRef<HTMLDivElement>(null);
  const [fleches, setFleches] = useState({ gauche: false, droite: false });

  const mesurer = useCallback(() => {
    const el = defilement.current;
    if (!el) return;
    setFleches({ gauche: el.scrollLeft > 1, droite: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    mesurer();
    const el = defilement.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    if (el.firstElementChild) observateur.observe(el.firstElementChild);
    return () => observateur.disconnect();
  }, [mesurer]);

  // L'onglet choisi (ou ouvert depuis la checklist) doit rester visible.
  useEffect(() => {
    defilement.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
  }, [tab]);

  const defiler = (sens: -1 | 1) => {
    const el = defilement.current;
    el?.scrollBy?.({ left: sens * el.clientWidth * 0.6, behavior: "smooth" });
  };

  const fleche = "flex h-10 w-8 shrink-0 items-center justify-center bg-muted/70 text-muted-foreground hover:bg-card hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
  return (
    <div data-tour="collecte-navigation-mobile" className="flex min-w-0 items-center border-b border-border bg-muted/70">
      {fleches.gauche && (
        <button type="button" aria-label="Onglets précédents" className={`${fleche} border-r border-border`} onClick={() => defiler(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div ref={defilement} onScroll={mesurer} className="min-w-0 flex-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {fleches.droite && (
        <button type="button" aria-label="Onglets suivants" className={`${fleche} border-l border-border`} onClick={() => defiler(1)}>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Onglet de feuille, comme en bas d'un classeur Excel : la section active est « posée » sur le contenu,
 * les tableaux déjà reçus sont teintés en vert. */
/** Onglet d'un état (chèques, virements, traites) : s'ouvre sur ses tableaux, au choix, pour garder une barre courte et sans défilement. */
function FeuilleMenu({
  etat,
  tableaux,
  absents,
  onAjouter,
  tab,
  onSelect,
  statut,
  manques,
  recu,
}: {
  etat: { code: string; label: string };
  tableaux: string[];
  /** Tableaux de l'état pas encore demandés dans cette collecte (le cabinet peut les ajouter). */
  absents: string[];
  onAjouter: (key: string) => Promise<void>;
  tab: string;
  onSelect: (key: string) => void;
  statut: (key: string) => SectionStatut;
  manques: (key: string) => number | undefined;
  recu: (key: string) => boolean;
}) {
  const actif = tableaux.includes(tab);
  const statuts = tableaux.map(statut);
  const dot = statuts.length === 0
    ? undefined
    : statuts.every((x) => x === "archive")
    ? DOT_SECTION.archive
    : statuts.includes("a_corriger")
    ? DOT_SECTION.a_corriger
    : statuts.includes("transmis")
      ? DOT_SECTION.transmis
      : statuts.every((x) => x === "valide" || x === "archive")
        ? DOT_SECTION.valide
        : undefined;
  const nbManques = tableaux.reduce((n, k) => n + (manques(k) ?? 0), 0);
  const tousRecus = tableaux.length > 0 && tableaux.every(recu);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-current={actif ? "page" : undefined}
          aria-haspopup="menu"
          title={`${etat.label} : choisir un tableau`}
          className={cn(
            "relative flex min-h-10 max-w-[22rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            actif
              ? "border-border bg-card font-semibold text-primary shadow-sm"
              : tousRecus
                ? "border-success/30 bg-success/15 text-success hover:bg-success/25"
                : "border-border/70 bg-secondary/70 text-muted-foreground hover:bg-card hover:text-primary",
          )}
        >
          <span className="rounded bg-accent/15 px-1 py-0.5 text-[10px] font-bold tracking-wide text-accent-foreground">{etat.code}</span>
          <span className="truncate">{etat.label}</span>
          {actif && <span className="truncate font-normal text-muted-foreground">· {TAB_BY_KEY[tab]?.label}</span>}
          {dot && (
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot === "success" ? "bg-success" : dot === "destructive" ? "bg-destructive" : dot === "muted" ? "bg-muted-foreground/60" : "bg-warning")}
            />
          )}
          {nbManques > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-warning/20 px-1 text-[10px] font-semibold text-warning">
              {nbManques}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="min-w-[16rem]">
        <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{etat.label}</p>
        {tableaux.map((k) => {
          const st = statut(k);
          const n = manques(k);
          return (
            <DropdownMenuItem key={k} onSelect={() => onSelect(k)} className={cn(tab === k && "bg-secondary font-semibold")}>
              <span className="min-w-0 flex-1 truncate">{TAB_BY_KEY[k]?.label ?? k}</span>
              {recu(k) && <CheckCircle2 className="text-success" aria-label="Pièce reçue" />}
              {DOT_SECTION[st] && (
                <span
                  title={SECTION_STATUT_LABELS[st]}
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_SECTION[st] === "success" ? "bg-success" : DOT_SECTION[st] === "destructive" ? "bg-destructive" : DOT_SECTION[st] === "muted" ? "bg-muted-foreground/60" : "bg-warning")}
                />
              )}
              {n !== undefined && n > 0 && (
                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-warning/20 px-1 text-[10px] font-semibold text-warning">{n}</span>
              )}
            </DropdownMenuItem>
          );
        })}
        {absents.length > 0 && (
          <>
            <p className="mt-1 border-t border-border px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {tableaux.length === 0 ? "Pas encore demandés" : "À ajouter à la collecte"}
            </p>
            {absents.map((k) => (
              <DropdownMenuItem key={k} onSelect={() => void onAjouter(k).catch(() => {})} className="text-muted-foreground">
                <Plus aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{TAB_BY_KEY[k]?.label ?? k}</span>
                <span className="text-[11px]">Ajouter</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Pastille de la feuille d'un tableau selon son statut dans le circuit (rien tant qu'il est à remplir). */
const DOT_SECTION: Record<string, "success" | "warning" | "destructive" | "muted" | undefined> = {
  brouillon: undefined,
  transmis: "warning",
  a_corriger: "destructive",
  valide: "success",
  archive: "muted",
};

function FeuilleTab({
  active,
  onClick,
  label,
  badge,
  dot,
  dotTitle,
  recu,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  dot?: "success" | "warning" | "destructive" | "muted";
  /** Libellé du statut du tableau, en info-bulle de la pastille. */
  dotTitle?: string;
  /** Tableau reçu (vert) ; absent pour les sections qui ne sont pas des tableaux. */
  recu?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={recu ? `${label} — reçu` : label}
      className={cn(
        "relative flex min-h-10 max-w-[14rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-border bg-card font-semibold text-primary shadow-sm"
          : recu
            ? "border-success/30 bg-success/15 text-success hover:bg-success/25"
            : "border-border/70 bg-secondary/70 text-muted-foreground hover:bg-card hover:text-primary",
      )}
    >
      <span className="truncate">{label}</span>
      {dot && (
        <span
          title={dotTitle}
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot === "success" ? "bg-success" : dot === "destructive" ? "bg-destructive" : dot === "muted" ? "bg-muted-foreground/60" : "bg-warning")}
        />
      )}
      {badge !== undefined && (
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-warning/20 px-1 text-[10px] font-semibold text-warning">
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
