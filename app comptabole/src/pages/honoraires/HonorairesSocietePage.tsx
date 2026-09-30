import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, FileText, Paperclip, Pencil, Receipt, Send, Trash2, Upload } from "lucide-react";
import { SignatureLedgerBanner } from "@/components/ledger/SignatureLedgerBanner";
import {
  LedgerWorkSurface,
  OperationalContentHeader,
  OperationalLedgerToolbar,
  OperationalMobileUtility,
} from "@/components/ledger/OperationalLedgerLayout";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { downloadDataUrl } from "@/lib/file";
import { buildEtatClientPdf } from "@/lib/honoraires/etatClientPdf";
import { cn } from "@/lib/utils";
import { useSocieteById } from "@/store/data";
import { useHonoraires, type HonoraireLigneInput } from "@/store/honoraires";
import { HONORAIRE_TYPE_LABELS, type HonoraireLigne } from "@/types";
import { HonoraireImportDialog } from "./HonoraireImportDialog";
import { HonoraireLigneFormSheet } from "./HonoraireLigneFormSheet";
import { HonoraireMessageDialog } from "./HonoraireMessageDialog";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function HonorairesSocietePage() {
  const { societeId = "" } = useParams();
  const societe = useSocieteById(societeId);
  // Le responsable de société consulte sa propre société en lecture seule
  // (télécharger les pièces jointes, rien d'autre) ; l'admin gère tout.
  const { isAdmin, isResponsableSociete, societeIds } = usePermissions();
  const readOnly = !isAdmin;

  const list = useHonoraires((s) => s.list);
  const loading = useHonoraires((s) => s.loading);
  const fetchList = useHonoraires((s) => s.fetchList);
  const clear = useHonoraires((s) => s.clear);
  const create = useHonoraires((s) => s.create);
  const update = useHonoraires((s) => s.update);
  const remove = useHonoraires((s) => s.remove);
  const fetchPiece = useHonoraires((s) => s.fetchPiece);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [editing, setEditing] = useState<HonoraireLigne | null>(null);
  const [toDelete, setToDelete] = useState<HonoraireLigne | null>(null);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    fetchList(societeId);
    return () => clear();
  }, [societeId, fetchList, clear]);

  const soldeActuel = list.length > 0 ? list[list.length - 1].solde : 0;
  const totalHonoraires = list.reduce((s, l) => s + l.honoraire, 0);
  const totalReglements = list.reduce((s, l) => s + l.reglement, 0);
  const avecSolde = list.filter((l) => l.solde > 0.01).length;

  const q = recherche.trim().toLowerCase();
  const visibles = !q
    ? list
    : list.filter((l) =>
        [HONORAIRE_TYPE_LABELS[l.type], l.libelle, l.cnss, l.numQuittance].some((v) => (v || "").toLowerCase().includes(q)),
      );

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const { doc, fileName } = await buildEtatClientPdf(list, societe?.raisonSociale ?? "Société");
      doc.save(fileName);
    } catch {
      toast.error("PDF impossible");
    } finally {
      setPdfBusy(false);
    }
  }

  async function openPiece(l: HonoraireLigne) {
    const { nom, dataUrl } = await fetchPiece(l.id);
    downloadDataUrl(dataUrl, nom || "piece");
  }

  // Attend la réponse du serveur : le message de succès n'apparaît (et le
  // formulaire ne se ferme) que si la ligne — pièce jointe comprise — est bien
  // enregistrée ; sinon l'erreur du store s'affiche et la saisie est conservée.
  async function handleSubmit(data: HonoraireLigneInput) {
    if (editing) {
      await update(editing.id, data);
      toast.success("Ligne modifiée");
    } else {
      await create(data);
      toast.success("Ligne ajoutée");
    }
  }

  // Un responsable ne consulte que SA société (le serveur refuse aussi le reste).
  if (isResponsableSociete && !(societeIds ?? []).includes(societeId)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <SignatureLedgerBanner
        icon={Receipt}
        className="mb-0 sm:mb-2"
        eyebrow="Comptabilité · Financial Ledger"
        title={societe?.raisonSociale ?? "Société"}
        description="Déclarations traitées, honoraires et règlements — le solde cumule les honoraires et montants déclarés, réduit par chaque règlement."
        metrics={[
          { label: "Déclarations", value: list.length },
          { label: "Avec solde dû", value: avecSolde, tone: avecSolde > 0 ? "warning" : "default" },
        ]}
        action={readOnly ? undefined : { label: "Nouvelle ligne", onClick: () => { setEditing(null); setFormOpen(true); } }}
      />

      <dl data-tour="honoraires-summary" className="mt-3 grid grid-cols-1 divide-y divide-border border-y border-border bg-muted/35 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Solde actuel</dt>
          <dd className={cn("font-mono text-sm font-semibold tabular-nums", soldeActuel > 0 ? "text-warning" : "text-foreground")}>
            {fmt(soldeActuel)} TND
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Total honoraires</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">{fmt(totalHonoraires)} TND</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">Total règlements reçus</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">{fmt(totalReglements)} TND</dd>
        </div>
      </dl>

      <LedgerWorkSurface className="mt-3">
        <OperationalLedgerToolbar
          label="Recherche de l'état client"
          search={
            <Input data-tour="honoraires-search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher (type, libellé, CNSS, quittance)…"
              className="h-9"
            />
          }
          tools={
            readOnly ? undefined : (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Importer
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Outils
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={downloadPdf} disabled={pdfBusy || list.length === 0}>
                      <FileText className="h-4 w-4" /> {pdfBusy ? "PDF…" : "Enregistrer PDF"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setMessageOpen(true)} disabled={list.length === 0}>
                      <Send className="h-4 w-4" /> Envoyer au responsable
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
          }
        />
        <OperationalMobileUtility label="Recherche de l'état client">
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (type, libellé, CNSS, quittance)…"
            className="h-9"
          />
        </OperationalMobileUtility>
        <OperationalContentHeader>
          <div className="flex min-w-0 items-baseline gap-3">
            <h2 className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-primary">Registre des déclarations</h2>
            <p className="hidden truncate text-[11px] text-muted-foreground md:block">Honoraires et règlements</p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            {visibles.length} ligne{visibles.length === 1 ? "" : "s"} visible{visibles.length === 1 ? "" : "s"}
          </span>
        </OperationalContentHeader>

        {visibles.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-5">
            <div className="flex items-start gap-3 text-sm">
              <Receipt className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">{loading ? "Chargement…" : list.length === 0 ? "Aucune ligne" : "Aucun résultat"}</p>
                <p className="text-muted-foreground">
                  {list.length > 0
                    ? "Aucune ligne ne correspond à ce filtre."
                    : readOnly
                      ? "Aucune déclaration enregistrée pour votre société pour le moment."
                      : "Ajoutez une déclaration traitée pour cette société (CNSS, acompte, IS, mensuelle…)."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div data-tour="honoraires-register" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>CNSS</TableHead>
                  <TableHead>N° Quittance</TableHead>
                  <TableHead className="text-right">Mt déclaration</TableHead>
                  <TableHead className="text-right">Honoraire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Règlt</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Pièce jointe</TableHead>
                  {!readOnly && <TableHead className="w-[1%]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">{HONORAIRE_TYPE_LABELS[l.type]}</TableCell>
                    <TableCell className="text-foreground">{l.libelle || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.cnss || "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.numQuittance || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(l.montantDeclaration)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(l.honoraire)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(l.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.reglement ? fmt(l.reglement) : "—"}</TableCell>
                    <TableCell className={cn("text-right font-bold tabular-nums", l.solde > 0 && "text-destructive")}>
                      {fmt(l.solde)}
                    </TableCell>
                    <TableCell>
                      {l.aPiece ? (
                        <button
                          title={`Télécharger : ${l.pieceNom}`}
                          onClick={() => openPiece(l)}
                          className="inline-flex max-w-[180px] items-center gap-1.5 text-xs text-accent underline-offset-2 hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{l.pieceNom || "Pièce jointe"}</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => {
                              setEditing(l);
                              setFormOpen(true);
                            }}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setToDelete(l)}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </LedgerWorkSurface>

      {!readOnly && (
        <>
          <HonoraireImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            societeId={societeId}
          />

          <HonoraireMessageDialog
            open={messageOpen}
            onOpenChange={setMessageOpen}
            societeId={societeId}
            societeNom={societe?.raisonSociale ?? "Société"}
            list={list}
          />

          <HonoraireLigneFormSheet
            open={formOpen}
            onOpenChange={(o) => {
              setFormOpen(o);
              if (!o) setEditing(null);
            }}
            societeId={societeId}
            ligne={editing}
            onSubmit={handleSubmit}
          />

          <ConfirmDialog
            open={Boolean(toDelete)}
            onOpenChange={(o) => !o && setToDelete(null)}
            title="Supprimer cette ligne ?"
            description="Cette ligne du compte honoraires sera définitivement supprimée."
            confirmLabel="Supprimer"
            onConfirm={() => {
              if (toDelete) remove(toDelete.id);
              setToDelete(null);
            }}
          />
        </>
      )}
    </div>
  );
}
