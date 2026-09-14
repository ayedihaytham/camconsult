import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Aperçu simple d'un document (PDF/image) attaché à un mouvement de stock. */
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
  const isImage = dataUrl?.startsWith("data:image/");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {!dataUrl ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun document.
          </p>
        ) : isImage ? (
          <img
            src={dataUrl}
            alt={title}
            className="mx-auto max-h-[70vh] rounded border border-border object-contain"
          />
        ) : (
          <iframe
            title={title}
            src={dataUrl}
            className="h-[70vh] w-full rounded border border-border bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
