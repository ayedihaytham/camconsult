import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Download,
  Eye,
  File as FileIcon,
  History,
  Paperclip,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { StatusDot, CollecteStatusDot } from "@/components/ledger/StatusDot";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocietes } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import {
  COLLECTE_STATUT_LABELS,
  TAB_BY_KEY,
} from "@/lib/collecte/tabs";
import { checklistRows } from "@/lib/collecte/checklist";
import { computeManques } from "@/lib/collecte/manques";
import { exportCollecteXlsx } from "@/lib/collecte/exportXlsx";
import { downloadDataUrl } from "@/lib/file";
import { formatDate, formatRelative } from "@/lib/utils";
import type { CollecteJournalEntry, CollecteStatut } from "@/types";
import { CollecteGrid } from "./CollecteGrid";
import { CollecteCreateDialog } from "./CollecteCreateDialog";
import { RecapTab } from "./RecapTab";
import { OngletNotes } from "./OngletNotes";
import { FileUploadDialog, type NewFichier } from "../structuration/FileUploadDialog";
import { DocPreviewDialog } from "../stock/DocPreviewDialog";

export function CollecteEditorPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isAdmin, poste } = usePermissions();
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
  const sendRecap = useCollectes((s) => s.sendRecap);
  const relanceNow = useCollectes((s) => s.relanceNow);
  const uploadFichier = useCollectes((s) => s.uploadFichier);
  const deleteFichier = useCollectes((s) => s.deleteFichier);
  const fetchJournal = useCollectes((s) => s.fetchJournal);

  const [confirm, setConfirm] = useState<
    null | "transmis" | "valide" | "a_corriger" | "archive"
  >(null);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState("checklist");
  const [preview, setPreview] = useState(false); // admin : aperçu de la vue client
  const [fichiersOpen, setFichiersOpen] = useState(false);
  const [fichierToDelete, setFichierToDelete] = useState<string | null>(null);
  const [previewFichier, setPreviewFichier] = useState<{ title: string; dataUrl: string | null } | null>(null);
  const [relancing, setRelancing] = useState(false);
  const [journal, setJournal] = useState<CollecteJournalEntry[] | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);

  useEffect(() => {
    fetchOne(id);
    return () => clearCurrent();
  }, [id, fetchOne, clearCurrent]);

  useEffect(() => {
    if (tab !== "historique" || !id) return;
    setJournalLoading(true);
    fetchJournal(id)
      .then(setJournal)
      .finally(() => setJournalLoading(false));
  }, [tab, id, fetchJournal]);

  const currentRecap = collecte?.recapStatut;
  useEffect(() => {
    if (poste === "societe_employe" && currentRecap === "envoye") setTab("recap");
  }, [poste, currentRecap, id]);

  if (!collecte) {
    return (
      <EmptyState
        title={loading ? "Chargement…" : "Collecte introuvable"}
        description={loading ? "" : "Cette collecte n'existe pas ou a été supprimée."}
      />
    );
  }

  const socNom =
    societes.find((s) => s.id === collecte.societeId)?.raisonSociale ?? "Société";
  const archivee = collecte.statut === "archive";
  const validee = collecte.statut === "valide";
  const enAttente = collecte.statut === "brouillon" || collecte.statut === "a_corriger";
  const enRetard =
    enAttente && Boolean(collecte.echeance) && collecte.echeance! < new Date().toISOString().slice(0, 10);
  // Validée : le client de société passe en lecture seule (cabinet toujours modifiable).
  // Archivée : lecture seule pour TOUT LE MONDE, admin compris.
  const editable =
    !archivee &&
    (isAdmin ||
      poste === "collaborateur" ||
      (poste === "societe_employe" &&
        (collecte.statut === "brouillon" || collecte.statut === "a_corriger")));

  // Mode « complétion récap » côté client : le cabinet a ouvert la complétion.
  const clientRecap =
    poste === "societe_employe" && collecte.recapStatut === "envoye";
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
  const showFlags =
    !archivee && (isAdmin || collecte.recapStatut !== "none");

  const rows = checklistRows(collecte);
  const recus = rows.filter((r) => r.recu).length;

  async function applyStatut(s: CollecteStatut) {
    await setStatut(id, s);
    setConfirm(null);
    toast.success(
      s === "transmis"
        ? "Collecte transmise au cabinet"
        : s === "valide"
          ? "Collecte validée"
          : s === "archive"
            ? "Collecte archivée"
            : "Collecte rouverte (à corriger)",
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate("/collectes")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Toutes les collectes
      </button>

      <LedgerPageHeader
        title={`${socNom} — ${collecte.periode}`}
        description={`Collecte de pièces · ${recus}/${rows.length} tableau(x) reçu(s)`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <CollecteStatusDot statut={collecte.statut} />
            {collecte.echeance && (
              <StatusDot
                tone={enRetard ? "destructive" : "muted"}
                label={`Échéance ${formatDate(collecte.echeance)}${enRetard ? " — dépassée" : ""}`}
              />
            )}
            {isAdmin && enAttente && (
              <Button
                variant="outline"
                size="sm"
                disabled={relancing}
                onClick={async () => {
                  setRelancing(true);
                  try {
                    await relanceNow(id);
                    toast.success("Relance envoyée au client");
                  } finally {
                    setRelancing(false);
                  }
                }}
              >
                <BellRing className="h-4 w-4" />
                {relancing ? "Envoi…" : "Relancer maintenant"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCollecteXlsx(collecte, socNom).catch(() =>
                  toast.error("Export impossible"),
                )
              }
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            {canSubmit && (
              <Button
                variant="ledger"
                size="sm"
                onClick={async () => {
                  if (clientRecap) {
                    await submitRecap(id);
                    toast.success("Collecte transmise au cabinet");
                  } else {
                    setConfirm("transmis");
                  }
                }}
              >
                <Send className="h-4 w-4" />
                Transmettre au cabinet
              </Button>
            )}
            {isAdmin && collecte.recapStatut === "none" && liveManques.length > 0 && (
              <Button
                variant="ledger"
                size="sm"
                onClick={async () => {
                  await sendRecap(id, liveManques.length);
                  toast.success(
                    `Récap envoyé au client — ${liveManques.length} case(s) à compléter`,
                  );
                }}
              >
                <Send className="h-4 w-4" />
                Envoyer le récap au client ({liveManques.length})
              </Button>
            )}
            {isAdmin && collecte.recapStatut === "envoye" && (
              <StatusDot tone="warning" label="Récap en attente du client" />
            )}
            {isAdmin && !archivee && liveManques.length > 0 && (
              <Button
                variant={preview ? "ledger" : "outline"}
                size="sm"
                onClick={() => setPreview((p) => !p)}
              >
                {preview ? "Quitter l'aperçu" : "Aperçu client"}
              </Button>
            )}
            {isAdmin && (
              <>
                {!archivee && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Tableaux
                  </Button>
                )}
                {collecte.statut === "transmis" && (
                  <>
                    <Button
                      variant="ledger"
                      size="sm"
                      onClick={() => setConfirm("valide")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Valider
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirm("a_corriger")}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Renvoyer pour correction
                    </Button>
                  </>
                )}
                {validee && (
                  <>
                    <Button
                      variant="ledger"
                      size="sm"
                      onClick={() => setConfirm("archive")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Archiver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirm("a_corriger")}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Repasser en correction
                    </Button>
                  </>
                )}
                {archivee && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyStatut("valide")}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Désarchiver
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {clientRecap && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Le cabinet vous demande de <strong>compléter les cases marquées ?</strong>{" "}
          dans les onglets concernés, puis de cliquer{" "}
          <strong>« Transmettre au cabinet »</strong>. Le reste est verrouillé.
        </div>
      )}
      {validee && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            <strong>Collecte validée</strong> —{" "}
            {isAdmin || poste === "collaborateur"
              ? "le client ne peut plus la modifier. Vous pouvez encore ajuster, puis l'archiver."
              : "en lecture seule."}
          </span>
        </div>
      )}
      {archivee && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            <strong>Collecte archivée</strong> — lecture seule pour tous.
            {isAdmin && " Cliquez « Désarchiver » pour la rouvrir."}
          </span>
        </div>
      )}
      {preview && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-foreground">
          <strong>Aperçu client</strong> — voici ce que verra le client de la
          société : seules les cases <span className="font-semibold text-amber-700">?</span>{" "}
          sont modifiables, tout le reste est verrouillé (grisé).
        </div>
      )}
      {poste === "societe_employe" && collecte.recapStatut === "repondu" && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Récap renvoyé au cabinet. En attente de traitement.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="recap" className="gap-1.5">
              Récap
              {collecte.recapStatut !== "none" && (
                <span
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (collecte.recapStatut === "repondu"
                      ? "bg-emerald-500"
                      : "bg-amber-500")
                  }
                />
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              Documents
              {collecte.fichiers.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-foreground">
                  {collecte.fichiers.length}
                </span>
              )}
            </TabsTrigger>
            {collecte.onglets.map((key) => {
              const n = showFlags ? (manqueCount.get(key) ?? 0) : 0;
              return (
                <TabsTrigger key={key} value={key} className="gap-1.5">
                  {TAB_BY_KEY[key]?.label ?? key}
                  {n > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {n}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
            {(isAdmin || poste === "collaborateur") && (
              <TabsTrigger value="historique">Historique</TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="recap">
          <RecapTab
            collecte={collecte}
            isAdmin={isAdmin}
            isClient={poste === "societe_employe"}
            onNavigate={setTab}
          />
        </TabsContent>

        {/* ── Checklist ─────────────────────────── */}
        <TabsContent value="checklist">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-primary text-xs uppercase tracking-wide text-primary-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">
                    Pièce à transmettre
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    Onglet correspondant
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    Date de réception
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Total ({collecte.devise === "EUR" ? "€" : collecte.devise === "USD" ? "$" : collecte.devise})
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    Commentaire
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.onglet} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-foreground">{r.pieceLabel}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.tabLabel}
                    </td>
                    <td className="px-3 py-2">
                      <StatusDot
                        tone={r.recu ? "success" : "warning"}
                        label={r.statutLabel}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.dateReception ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {r.total == null
                        ? "—"
                        : r.total.toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className="h-8"
                        defaultValue={r.commentaire}
                        placeholder="—"
                        readOnly={!editable}
                        onBlur={(e) => {
                          if (e.target.value !== r.commentaire)
                            saveComment(id, r.onglet, e.target.value);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-medium">
                  <td className="px-3 py-2" colSpan={2}>
                    Nb de pièces reçues
                  </td>
                  <td className="px-3 py-2" colSpan={4}>
                    {recus} / {rows.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {!editable && poste === "societe_employe" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Collecte {COLLECTE_STATUT_LABELS[collecte.statut].toLowerCase()} —
              lecture seule. Le cabinet peut la renvoyer pour correction.
            </p>
          )}
        </TabsContent>

        {/* ── Documents (pièces jointes réelles) ─── */}
        <TabsContent value="documents">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Scans/PDF déposés pour cette collecte — en plus des tableaux chiffrés.
            </p>
            {editable && (
              <Button variant="outline" size="sm" onClick={() => setFichiersOpen(true)}>
                <UploadCloud className="h-4 w-4" />
                Ajouter des pièces
              </Button>
            )}
          </div>
          {collecte.fichiers.length === 0 ? (
            <EmptyState
              icon={Paperclip}
              title="Aucune pièce déposée"
              description="Ajoutez un scan ou un PDF en complément des tableaux chiffrés."
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {collecte.fichiers.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{f.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.taille || "—"} · déposé par {f.deposePar || "?"} ·{" "}
                      {formatRelative(f.creeLe)}
                    </p>
                  </div>
                  {f.dataUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewFichier({ title: f.nom, dataUrl: f.dataUrl! })}
                        className="shrink-0 text-muted-foreground hover:text-accent"
                        title="Aperçu"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDataUrl(f.dataUrl!, f.nom)}
                        className="shrink-0 text-muted-foreground hover:text-accent"
                        title="Télécharger"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setFichierToDelete(f.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="Supprimer"
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
            <TabsContent key={key} value={key}>
              {(() => {
                const hl = flaggedByTab.get(key);
                const whole = wholeTab.has(key);
                const hasManque = (hl && hl.size > 0) || whole;
                // Le client complète cet onglet s'il a au moins une case ? (ou tableau vide)
                const inRecap = clientRecap && hasManque;
                // Aperçu admin : rendu identique à la vue client, en lecture seule.
                if (preview) {
                  return (
                    <CollecteGrid
                      def={def}
                      lignes={collecte.lignes.filter((l) => l.onglet === key)}
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
                    def={def}
                    lignes={collecte.lignes.filter((l) => l.onglet === key)}
                    readOnly={clientRecap ? !inRecap : !editable}
                    recapClient={inRecap}
                    highlight={hl}
                    wholeEditable={inRecap && whole}
                    flagged={!inRecap && showFlags ? hl : undefined}
                    devise={collecte.devise}
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
                canWrite={isAdmin || poste === "societe_employe"}
              />
            </TabsContent>
          );
        })}

        {(isAdmin || poste === "collaborateur") && (
          <TabsContent value="historique">
            {journalLoading ? (
              <p className="px-1 py-4 text-sm text-muted-foreground">Chargement…</p>
            ) : !journal || journal.length === 0 ? (
              <EmptyState
                icon={History}
                title="Aucun historique"
                description="Les actions sur cette collecte apparaîtront ici."
              />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {journal.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-3 py-2.5">
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{entry.label}</p>
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
      </Tabs>

      {isAdmin && (
        <CollecteCreateDialog
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
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm === "a_corriger"}
        title={
          confirm === "transmis"
            ? "Transmettre la collecte au cabinet ?"
            : confirm === "valide"
              ? "Valider la collecte ?"
              : confirm === "archive"
                ? "Archiver la collecte ?"
                : "Renvoyer la collecte pour correction ?"
        }
        description={
          confirm === "transmis"
            ? "Vous ne pourrez plus la modifier tant que le cabinet ne l'a pas renvoyée."
            : confirm === "valide"
              ? "Le client de la société ne pourra plus la modifier. Vous (cabinet) pourrez encore l'ajuster, puis l'archiver."
              : confirm === "archive"
                ? "Elle sera figée en lecture seule pour tout le monde (vous compris) et rangée dans les archives. Vous pourrez la désarchiver si besoin."
                : "La collecte redevient modifiable (état « à corriger »)."
        }
        confirmLabel={
          confirm === "transmis"
            ? "Transmettre"
            : confirm === "valide"
              ? "Valider"
              : confirm === "archive"
                ? "Archiver"
                : "Renvoyer"
        }
        onConfirm={() => confirm && applyStatut(confirm)}
      />

      <FileUploadDialog
        open={fichiersOpen}
        onOpenChange={setFichiersOpen}
        destinationLabel={`${socNom} — ${collecte.periode}`}
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
