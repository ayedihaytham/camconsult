import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFileSize, readFileAsDataUrl } from "@/lib/file";
import { buildEtatClientPdf, etatClientTotals } from "@/lib/honoraires/etatClientPdf";
import { useData } from "@/store/data";
import type { HonoraireLigne } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societeId: string;
  societeNom: string;
  list: HonoraireLigne[];
}

interface PdfPret {
  fileName: string;
  dataUrl: string;
  taille: number;
}

/** Envoie l'état client (PDF) par la messagerie au RESPONSABLE de la société
 * — jamais à un contact d'une autre société ni à un délégué. Le message est
 * prérempli mais rien ne part avant le clic sur « Envoyer ». */
export function HonoraireMessageDialog({ open, onOpenChange, societeId, societeNom, list }: Props) {
  const employes = useData((s) => s.employes);
  const addMessage = useData((s) => s.addMessage);

  const responsables = useMemo(
    () =>
      employes.filter(
        (e) =>
          e.role === "societe_employe" &&
          !e.delegue &&
          e.statut === "actif" &&
          e.societeId === societeId,
      ),
    [employes, societeId],
  );

  const [destinataireId, setDestinataireId] = useState("");
  const [texte, setTexte] = useState("");
  const [pdf, setPdf] = useState<PdfPret | null>(null);
  const [erreurPdf, setErreurPdf] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  // À l'ouverture : destinataire par défaut (le seul, ou vide s'il faut
  // choisir), message prérempli, et génération du PDF à joindre.
  useEffect(() => {
    if (!open) return;
    setDestinataireId(responsables.length === 1 ? responsables[0].id : "");
    const t = etatClientTotals(list);
    const date = new Date().toLocaleDateString("fr-FR");
    setTexte(
      `Bonjour,\n\nVeuillez trouver ci-joint l'état client de ${societeNom} au ${date}.\n` +
        `Solde actuel : ${t.solde.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND.\n\nCordialement,`,
    );
    setPdf(null);
    setErreurPdf(false);
    let annule = false;
    (async () => {
      try {
        const { doc, fileName } = await buildEtatClientPdf(list, societeNom);
        const blob = doc.output("blob");
        const dataUrl = await readFileAsDataUrl(new File([blob], fileName, { type: "application/pdf" }));
        if (!annule) setPdf({ fileName, dataUrl, taille: blob.size });
      } catch {
        if (!annule) setErreurPdf(true);
      }
    })();
    return () => {
      annule = true;
    };
    // `list`/`responsables` volontairement lus à l'ouverture seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function envoyer() {
    if (!pdf || !destinataireId) return;
    setEnvoi(true);
    try {
      await addMessage({
        conversationId: `conv-${destinataireId}`,
        auteurId: "me",
        contenu: texte.trim(),
        envoyeLe: new Date().toISOString(),
        statut: "envoye",
        pieceJointe: {
          libelle: pdf.fileName,
          dataUrl: pdf.dataUrl,
          mime: "application/pdf",
          tailleOctets: pdf.taille,
        },
      });
      const dest = responsables.find((r) => r.id === destinataireId);
      toast.success(`État client envoyé à ${dest ? `${dest.prenom} ${dest.nom}` : "la société"}`, {
        description: "Consultable dans la messagerie.",
      });
      onOpenChange(false);
    } catch {
      // addMessage affiche déjà l'erreur ; on garde la fenêtre ouverte.
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoyer à la messagerie</DialogTitle>
          <DialogDescription>
            Le PDF de l'état client est joint au message, envoyé au responsable de {societeNom}.
          </DialogDescription>
        </DialogHeader>

        {responsables.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            Cette société n'a aucun responsable actif. Ajoutez-en un depuis la fiche société
            (« Responsables et délégués ») pour pouvoir lui envoyer l'état client.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Destinataire</Label>
              {responsables.length === 1 ? (
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  {responsables[0].prenom} {responsables[0].nom}
                  <span className="text-muted-foreground"> — responsable de {societeNom}</span>
                </p>
              ) : (
                <Select value={destinataireId} onValueChange={setDestinataireId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir le responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {responsables.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.prenom} {r.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={6} value={texte} onChange={(e) => setTexte(e.target.value)} />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              {pdf ? (
                <>
                  <span className="min-w-0 flex-1 truncate font-medium">{pdf.fileName}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(pdf.taille)}</span>
                </>
              ) : erreurPdf ? (
                <span className="text-destructive">Impossible de générer le PDF.</span>
              ) : (
                <span className="text-muted-foreground">Génération du PDF…</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={envoi || !pdf || !destinataireId || responsables.length === 0}
            onClick={envoyer}
          >
            <Send className="h-4 w-4" />
            {envoi ? "Envoi…" : "Envoyer"}
          </Button>
        </DialogFooter>
        <p className="text-xs text-muted-foreground">
          Le message est prérempli mais rien n'est envoyé avant votre clic sur « Envoyer ».{" "}
          <Link to="/messagerie" className="underline underline-offset-2">Ouvrir la messagerie</Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
