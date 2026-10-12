import { useState } from "react";
import { CheckCircle2, Clock, Download, Eye, FilePlus2, FileQuestion, Send, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadDataUrl } from "@/lib/file";
import { cn, formatRelative } from "@/lib/utils";
import { FileUploadDialog, type NewFichier } from "../structuration/FileUploadDialog";
import type { CollecteFichier, CollecteFull, DemandePiece } from "@/types";

interface Props {
  collecte: CollecteFull;
  isClient: boolean;
  /** Cabinet : peut demander une pièce et retirer une demande. */
  peutDemander: boolean;
  /** Archivée : plus de réponse possible. */
  lectureSeule?: boolean;
  onDemander: (texte: string) => Promise<void>;
  onSupprimer: (demandeId: string) => Promise<void>;
  onFournir: (demandeId: string, fichiers: NewFichier[]) => Promise<void>;
  onPreview: (fichier: CollecteFichier) => void;
}

/** Pièces demandées au client par le cabinet : une note sans pièce jointe, puis le client répond en ajoutant le document. */
export function PiecesDemandees({ collecte, isClient, peutDemander, lectureSeule = false, onDemander, onSupprimer, onFournir, onPreview }: Props) {
  const demandes = collecte.demandesPieces ?? [];
  const [demandeOpen, setDemandeOpen] = useState(false);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [reponseA, setReponseA] = useState<DemandePiece | null>(null);

  async function envoyer() {
    if (!texte.trim()) return;
    setEnvoi(true);
    try {
      await onDemander(texte.trim());
      setTexte("");
      setDemandeOpen(false);
    } finally {
      setEnvoi(false);
    }
  }

  const enAttente = demandes.filter((d) => d.statut === "en_attente").length;

  return (
    <section aria-label="Pièces demandées" className="border-b border-border">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <FileQuestion className="size-4 text-accent" aria-hidden="true" />
        <h3 className="text-sm font-bold text-primary">Pièces demandées{isClient ? " par le cabinet" : " au client"}</h3>
        {enAttente > 0 && (
          <span className="rounded-full bg-warning/15 px-2 text-[11px] font-semibold text-warning">{enAttente} en attente</span>
        )}
        {peutDemander && !lectureSeule && (
          <Button type="button" variant="outline" size="sm" className="ml-auto h-8 gap-1.5 border-accent bg-accent/15 text-xs font-semibold hover:bg-accent/30" onClick={() => setDemandeOpen(true)}>
            <FilePlus2 className="size-3.5" aria-hidden="true" />
            Demander une pièce
          </Button>
        )}
      </div>

      {demandes.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          {isClient ? "Le cabinet ne vous a demandé aucune pièce pour le moment." : "Demandez au client un document : il reçoit une notification avec votre note et répond en l'ajoutant."}
        </p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {demandes.map((d) => {
            const fournie = d.statut === "fournie";
            const fichiers = (collecte.fichiers ?? []).filter((f) => f.demandeId === d.id);
            return (
              <li key={d.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", fournie ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                  {fournie ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Clock className="size-4" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line text-sm text-foreground">{d.texte}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Demandée par {d.demandePar || "le cabinet"} · {formatRelative(d.creeLe)}
                    {fournie && ` · fournie par ${d.fourniePar || "?"}`}
                  </p>
                  {fichiers.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {fichiers.map((f) => (
                        <li key={f.id} className="flex items-center gap-2 text-xs text-foreground">
                          <span className="min-w-0 truncate font-medium">{f.nom}</span>
                          {f.dataUrl && (
                            <>
                              <button type="button" onClick={() => onPreview(f)} className="text-muted-foreground hover:text-primary" aria-label={`Aperçu de ${f.nom}`}>
                                <Eye className="size-3.5" />
                              </button>
                              <button type="button" onClick={() => downloadDataUrl(f.dataUrl!, f.nom)} className="text-muted-foreground hover:text-primary" aria-label={`Télécharger ${f.nom}`}>
                                <Download className="size-3.5" />
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isClient && !lectureSeule && (
                    <Button type="button" size="sm" variant={fournie ? "outline" : "default"} className="h-8 gap-1.5 text-xs font-semibold" onClick={() => setReponseA(d)}>
                      <UploadCloud className="size-3.5" aria-hidden="true" />
                      {fournie ? "Ajouter un autre document" : "Ajouter le document"}
                    </Button>
                  )}
                  {peutDemander && !lectureSeule && (
                    <button type="button" onClick={() => void onSupprimer(d.id)} className="grid size-8 place-items-center text-muted-foreground hover:text-destructive" aria-label="Retirer cette demande">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={demandeOpen} onOpenChange={setDemandeOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Demander une pièce au client</DialogTitle>
            <DialogDescription>Décrivez le document attendu : le client est prévenu par une notification, lit votre note et répond en ajoutant le document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="demande-piece-texte">Pièce demandée</Label>
            <Textarea
              id="demande-piece-texte"
              rows={4}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ex. Relevé bancaire d'octobre 2026, ou la facture du fournisseur n° 2100001269"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDemandeOpen(false)}>
              Annuler
            </Button>
            <Button type="button" className="gap-2" disabled={!texte.trim() || envoi} onClick={() => void envoyer()}>
              <Send className="size-4" aria-hidden="true" />
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FileUploadDialog
        open={reponseA !== null}
        onOpenChange={(ouvert) => !ouvert && setReponseA(null)}
        destinationLabel={reponseA ? `Réponse à : ${reponseA.texte.slice(0, 60)}` : ""}
        onSubmit={async (fichiers) => {
          if (reponseA) await onFournir(reponseA.id, fichiers);
        }}
      />
    </section>
  );
}
