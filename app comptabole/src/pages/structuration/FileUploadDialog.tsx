import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { File as FileIcon, UploadCloud, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MAX_INLINE_FILE_BYTES,
  fileExtension,
  formatFileSize,
  readFileAsDataUrl,
} from "@/lib/file";

export interface NewFichier {
  libelle: string;
  description: string;
  format: string;
  taille: string;
  dataUrl?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Libellé du dossier de destination (pour l'affichage). */
  destinationLabel: string;
  onSubmit: (fichiers: NewFichier[]) => void;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  destinationLabel,
  onSubmit,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setDescription("");
      setDragOver(false);
      setBusy(false);
    }
  }, [open]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    setBusy(true);
    let skippedContent = 0;
    const result: NewFichier[] = [];
    for (const f of files) {
      let dataUrl: string | undefined;
      if (f.size <= MAX_INLINE_FILE_BYTES) {
        try {
          dataUrl = await readFileAsDataUrl(f);
        } catch {
          dataUrl = undefined;
        }
      } else {
        skippedContent++;
      }
      result.push({
        libelle: f.name,
        description,
        format: fileExtension(f.name),
        taille: formatFileSize(f.size),
        dataUrl,
      });
    }
    onSubmit(result);
    if (skippedContent > 0) {
      toast.warning(
        `${skippedContent} fichier(s) > 2 Mo : enregistrés sans contenu (référence seule).`,
      );
    }
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter des fichiers</DialogTitle>
          <DialogDescription>
            Destination :{" "}
            <span className="font-medium text-foreground">
              {destinationLabel}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
              dragOver
                ? "border-accent bg-accent/5"
                : "border-input hover:border-accent/50 hover:bg-secondary/40",
            )}
          >
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">
              Glissez des fichiers ici ou{" "}
              <span className="font-semibold text-foreground underline underline-offset-2">parcourez</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Le contenu des fichiers &le; 2 Mo est conservé (téléchargeable).
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatFileSize(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Retirer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="file-desc">Description (optionnelle)</Label>
            <Textarea
              id="file-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note appliquée à tous les fichiers ajoutés…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={files.length === 0 || busy}
            onClick={handleSubmit}
          >
            {busy
              ? "Import…"
              : `Ajouter ${files.length || ""} fichier${files.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
