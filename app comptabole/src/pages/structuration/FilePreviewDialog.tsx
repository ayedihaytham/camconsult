import { Download, FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const dataUrl = node?.dataUrl;
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{node?.libelle}</DialogTitle>
          {node?.description && (
            <DialogDescription>{node.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto rounded-md border border-border bg-muted/30">
          {!dataUrl ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
              <FileWarning className="h-7 w-7" />
              Contenu non conservé (fichier &gt; 2 Mo). Aperçu indisponible.
            </div>
          ) : isImage ? (
            <img
              src={dataUrl}
              alt={node?.libelle}
              className="mx-auto max-h-[68vh] object-contain"
            />
          ) : isPdf ? (
            <iframe
              title={node?.libelle}
              src={dataUrl}
              className="h-[68vh] w-full"
            />
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

        <DialogFooter>
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
