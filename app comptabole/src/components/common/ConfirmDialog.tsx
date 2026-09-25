import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runConfirmation } from "@/lib/confirmation";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** Texte que l'utilisateur doit ressaisir pour confirmer (double confirmation). */
  confirmPhrase?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState(false);
  const needsPhrase = Boolean(confirmPhrase);
  const canConfirm = !needsPhrase || typed.trim() === confirmPhrase;

  function handleOpenChange(next: boolean) {
    if (pendingRef.current) return;
    if (!next) setTyped("");
    setError(false);
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    await runConfirmation(onConfirm, pendingRef, {
      setPending,
      setError,
      close: () => handleOpenChange(false),
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        aria-busy={pending}
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            {destructive && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <div className="space-y-1.5">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {needsPhrase && (
          <div className="space-y-2">
            <Label htmlFor="confirm-phrase">
              Saisissez{" "}
              <span className="font-semibold text-foreground">
                {confirmPhrase}
              </span>{" "}
              pour confirmer
            </Label>
            <Input
              id="confirm-phrase"
              value={typed}
              disabled={pending}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmPhrase}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            L’opération a échoué. Vérifiez les données puis réessayez.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!canConfirm || pending}
            onClick={handleConfirm}
          >
            {pending ? "En cours…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
