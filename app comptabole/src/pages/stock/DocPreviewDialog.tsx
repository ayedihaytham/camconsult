import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisionneuseDocument } from "./VisionneuseDocument";

/** Aperçu en grand d'un document (PDF/image) attaché à un mouvement de stock, avec zoom. */
export function DocPreviewDialog({
  open,
  onOpenChange,
  title,
  dataUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  dataUrl: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[1400px] flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {!dataUrl ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun document.
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <VisionneuseDocument dataUrl={dataUrl} titre={title} className="h-[78vh]" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
