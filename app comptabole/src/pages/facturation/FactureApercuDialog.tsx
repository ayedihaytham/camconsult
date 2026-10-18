import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PARAMETRES_APERCU, chargerLogo, construireFacturePdf } from "@/lib/facturePdf";
import type { Facture, FactureCabinet } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Facture à montrer (brouillon du formulaire ou facture existante). */
  facture: Facture | null;
  cabinet: FactureCabinet | null;
}

/**
 * Aperçu de la facture telle qu'elle sera imprimée (même PDF que le téléchargement), avec le mot « APERÇU » en filigrane :
 * un aperçu ne doit jamais passer pour la vraie facture. Reconstruit à chaque ouverture, donc toujours à jour du formulaire.
 */
export function FactureApercuDialog({ open, onOpenChange, facture, cabinet }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!open || !facture) return;
    let annule = false;
    let courante: string | null = null;
    setUrl(null);
    setErreur(false);
    (async () => {
      try {
        const doc = await construireFacturePdf(facture, cabinet, { logo: await chargerLogo(window.location.origin), filigrane: "Aperçu" });
        courante = URL.createObjectURL(doc.output("blob"));
        if (annule) URL.revokeObjectURL(courante);
        else setUrl(courante);
      } catch {
        if (!annule) setErreur(true);
      }
    })();
    return () => {
      annule = true;
      if (courante) URL.revokeObjectURL(courante);
    };
  }, [open, facture, cabinet]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* La fenêtre épouse la page : une feuille A4 (rapport 1 : 1,414) occupe la hauteur disponible, sans bandes vides de chaque côté. */}
      <DialogContent
        className="flex h-[96vh] max-w-none flex-col gap-0 rounded-2xl border-accent/30 p-0"
        style={{ width: "min(96vw, calc((96vh - 9.5rem) / 1.4142 + 3rem))" }}
      >
        <DialogHeader className="shrink-0 border-b border-accent/30 px-6 pb-3 pt-5">
          <DialogTitle className="font-serif text-2xl font-medium text-primary">Aperçu de la facture {facture?.numero}</DialogTitle>
          <DialogDescription>Rendu fidèle du PDF, page entière. Le filigrane « Aperçu » n'apparaît pas sur la facture générée.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted px-6 py-3">
          {erreur ? (
            <p className="py-10 text-center text-sm text-destructive" role="alert">
              L'aperçu n'a pas pu être préparé.
            </p>
          ) : url ? (
            <iframe src={`${url}${PARAMETRES_APERCU}`} title="Aperçu de la facture" className="h-full w-full rounded-lg border border-accent/30 bg-card" />
          ) : (
            <p className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Préparation de l'aperçu…
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-accent/30 px-6 py-2.5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
