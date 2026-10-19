import { useEffect, useState } from "react";
import { Download, FileWarning, Loader2 } from "lucide-react";
import { contenuNoeud, noeudADuContenu } from "@/lib/contenus";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PdfPages } from "@/components/common/PdfPages";
import { downloadDataUrl } from "@/lib/file";
import type { Noeud } from "@/types";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];
const TEXT_EXT = ["txt", "csv", "md", "json", "xml", "log"];

export function FilePreviewDialog({
  open,
  onOpenChange,
  node,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: Noeud | null;
}) {
  const ext = (node?.format ?? "").toLowerCase();
  // Contenu chargé à l'ouverture (plus présent dans les listes).
  const [dataUrl, setDataUrl] = useState<string | undefined>();
  const [chargement, setChargement] = useState(false);
  useEffect(() => {
    setDataUrl(undefined);
    if (!open || !node || !noeudADuContenu(node)) return;
    let annule = false;
    setChargement(true);
    contenuNoeud(node)
      .then((d) => !annule && setDataUrl(d))
      .catch(() => !annule && setDataUrl(undefined))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [open, node]);
  const isImage = IMAGE_EXT.includes(ext);
  const isPdf = ext === "pdf";
  const isText = TEXT_EXT.includes(ext);

  let textContent = "";
  if (isText && dataUrl) {
    try {
      const b64 = dataUrl.split(",")[1] ?? "";
      textContent = decodeURIComponent(escape(atob(b64)));
    } catch {
      textContent = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Plein écran : le document occupe toute la fenêtre (pas l'interface du lecteur PDF) ; « Télécharger » reste en bas. */}
      <DialogContent className="flex h-[96dvh] w-[96vw] max-w-none flex-col gap-3 rounded-xl p-4 sm:p-5">
        <DialogHeader className="shrink-0">
          <DialogTitle className="truncate pr-8">{node?.libelle}</DialogTitle>
          {node?.description && (
            <DialogDescription>{node.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/30">
          {chargement ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" />
              Chargement…
            </div>
          ) : !dataUrl ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
              <FileWarning className="h-7 w-7" />
              Contenu non conservé (fichier &gt; 2 Mo). Aperçu indisponible.
            </div>
          ) : isImage ? (
            <div className="flex h-full min-h-0 items-center justify-center p-3">
              <img src={dataUrl} alt={node?.libelle} className="max-h-full max-w-full object-contain" />
            </div>
          ) : isPdf ? (
            <PdfPages dataUrl={dataUrl} titre={node?.libelle ?? "Document"} />
          ) : isText ? (
            <pre className="whitespace-pre-wrap p-4 text-xs leading-relaxed text-foreground">
              {textContent || "(fichier vide)"}
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
              <FileWarning className="h-7 w-7" />
              Aperçu non pris en charge pour ce format ({ext || "inconnu"}).
              Téléchargez le fichier pour l'ouvrir.
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          {dataUrl && (
            <Button
              variant="ledger"
              onClick={() => downloadDataUrl(dataUrl, node!.libelle)}
            >
              <Download className="h-4 w-4" />
              Télécharger
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
