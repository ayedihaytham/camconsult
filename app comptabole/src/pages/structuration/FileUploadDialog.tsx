import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, File as FileIcon, FileArchive, LoaderCircle, Trash2, UploadCloud, X } from "lucide-react";
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
import { estZip, lireZip, nomDossierZip } from "@/lib/archiveZip";

export interface NewFichier {
  libelle: string;
  description: string;
  format: string;
  taille: string;
  dataUrl?: string;
  /** Dossiers à créer (ou retrouver) sous la destination pour ranger ce fichier : celui d'une archive .zip décompressée. */
  dossiers?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Libellé du dossier de destination (pour l'affichage). */
  destinationLabel: string;
  /** Fichiers déjà choisis à l'ouverture (déposés sur un tiroir de la vue générale). */
  initialFiles?: File[];
  /** Peut être asynchrone : la fenêtre reste ouverte (bouton occupé) jusqu'à la réponse, et ne se ferme que si le résultat n'est pas `false`.
   * `suivi` permet d'annoncer l'avancement de chaque fichier (en cours, envoyé, refusé). */
  onSubmit: (fichiers: NewFichier[], suivi?: SuiviEnvoi) => void | boolean | Promise<void | boolean>;
}

export type EtatEnvoi = "attente" | "cours" | "ok" | "erreur";
export type SuiviEnvoi = (index: number, etat: EtatEnvoi) => void;

/** Avancement affiché pendant l'import : lecture des fichiers (décompression des .zip), puis envoi de chacun. */
interface Avancement {
  phase: "lecture" | "envoi";
  lus: number;
  aLire: number;
  courant: string;
  elements: { nom: string; etat: EtatEnvoi }[];
}

export function FileUploadDialog({
  open,
  onOpenChange,
  destinationLabel,
  initialFiles,
  onSubmit,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avancement, setAvancement] = useState<Avancement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (initialFiles && initialFiles.length > 0) setFiles(initialFiles);
      return;
    }
    setFiles([]);
    setDescription("");
    setDragOver(false);
    setBusy(false);
    setAvancement(null);
    // initialFiles ne compte qu'à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  // Coller (Ctrl+V) : les fichiers copiés dans l'explorateur, ou une capture d'écran, s'ajoutent à la liste tant que la fenêtre est ouverte.
  useEffect(() => {
    if (!open) return;
    const surColler = (e: ClipboardEvent) => {
      const colles = Array.from(e.clipboardData?.files ?? []);
      if (colles.length === 0) return; // du texte : le collage normal (description) continue
      e.preventDefault();
      setFiles((prev) => [...prev, ...colles]);
    };
    document.addEventListener("paste", surColler);
    return () => document.removeEventListener("paste", surColler);
  }, [open]);

  async function handleSubmit() {
    if (files.length === 0) return;
    setBusy(true);
    setAvancement({ phase: "lecture", lus: 0, aLire: files.length, courant: files[0]?.name ?? "", elements: [] });
    let skippedContent = 0;
    const result: NewFichier[] = [];
    const lire = async (blob: Blob, nom: string, dossiers?: string[]) => {
      let dataUrl: string | undefined;
      if (blob.size <= MAX_INLINE_FILE_BYTES) {
        try {
          dataUrl = await readFileAsDataUrl(blob);
        } catch {
          dataUrl = undefined;
        }
      } else {
        skippedContent++;
      }
      result.push({ libelle: nom, description, format: fileExtension(nom), taille: formatFileSize(blob.size), dataUrl, ...(dossiers ? { dossiers } : {}) });
    };
    let lus = 0;
    const marquerLu = (suivant: string) => {
      lus++;
      setAvancement((a) => (a ? { ...a, lus, courant: suivant } : a));
    };
    for (const [rang, f] of files.entries()) {
      const suivant = files[rang + 1]?.name ?? "";
      if (!estZip(f.name)) {
        await lire(f, f.name);
        marquerLu(suivant);
        continue;
      }
      // Une archive .zip n'est pas envoyée telle quelle : son contenu est décompressé dans un dossier du même nom.
      try {
        const racine = nomDossierZip(f.name);
        const entrees = await lireZip(f);
        if (entrees.length === 0) toast.warning(`« ${f.name} » ne contient aucun fichier.`);
        for (const e of entrees) await lire(e.blob, e.nom, [racine, ...e.dossiers]);
        marquerLu(suivant);
      } catch (err) {
        toast.error(`« ${f.name} » : ${err instanceof Error ? err.message : "lecture impossible."}`);
        setBusy(false);
        setAvancement(null);
        return;
      }
    }
    if (result.length === 0) {
      setBusy(false);
      setAvancement(null);
      return;
    }
    setAvancement({ phase: "envoi", lus: 0, aLire: result.length, courant: "", elements: result.map((r) => ({ nom: r.libelle, etat: "attente" as EtatEnvoi })) });
    const suivi: SuiviEnvoi = (index, etat) =>
      setAvancement((a) => {
        if (!a) return a;
        const elements = a.elements.map((e, i) => (i === index ? { ...e, etat } : e));
        return { ...a, elements, lus: elements.filter((e) => e.etat === "ok" || e.etat === "erreur").length, courant: etat === "cours" ? elements[index]?.nom ?? "" : a.courant };
      });
    let accepte: void | boolean = true;
    try {
      accepte = await onSubmit(result, suivi);
    } catch {
      accepte = false;
    }
    if (accepte !== false && skippedContent > 0) {
      toast.warning(
        `${skippedContent} fichier(s) > 2 Mo : enregistrés sans contenu (référence seule).`,
      );
    }
    setBusy(false);
    setAvancement(null);
    if (accepte !== false) onOpenChange(false);
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

        <div className="min-w-0 space-y-4">
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
              Glissez ou collez (Ctrl+V) des fichiers ici, ou{" "}
              <span className="font-semibold text-foreground underline underline-offset-2">parcourez</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Le contenu des fichiers &le; 2 Mo est conservé (téléchargeable). Une archive .zip est décompressée dans un dossier du même nom.
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = ""; // permet de rechoisir le même fichier
              }}
            />
          </div>

          {avancement && (
            <div className="min-w-0 space-y-2.5 rounded-lg border border-primary/10 bg-[#F7F9FC] p-3" role="status" aria-live="polite">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-primary">
                  {avancement.phase === "lecture" ? "Lecture des fichiers…" : "Envoi en cours…"}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {avancement.lus} / {avancement.aLire} {avancement.phase === "lecture" ? "lus" : "envoyés"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuemin={0} aria-valuemax={avancement.aLire} aria-valuenow={avancement.lus}>
                <div className="h-full rounded-full bg-[#C9A96A] transition-[width] duration-300" style={{ width: `${avancement.aLire === 0 ? 0 : Math.round((avancement.lus / avancement.aLire) * 100)}%` }} />
              </div>
              {avancement.phase === "lecture" && avancement.courant && <p className="truncate text-xs text-muted-foreground">Suivant : {avancement.courant}</p>}
              {avancement.phase === "envoi" && (
                <ul className="max-h-44 space-y-0.5 overflow-y-auto">
                  {avancement.elements.map((e, i) => (
                    <li key={`${e.nom}-${i}`} className="flex min-w-0 items-center gap-2 px-1 py-1 text-sm">
                      {e.etat === "ok" ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Envoyé" /> : e.etat === "erreur" ? <AlertCircle className="size-4 shrink-0 text-destructive" aria-label="Refusé" /> : e.etat === "cours" ? <LoaderCircle className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-label="En cours" /> : <span className="size-4 shrink-0 rounded-full border border-primary/20" aria-label="En attente" />}
                      <span className={cn("min-w-0 flex-1 truncate", e.etat === "attente" && "text-muted-foreground", e.etat === "erreur" && "text-destructive")} title={e.nom}>{e.nom}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{e.etat === "ok" ? "Envoyé" : e.etat === "erreur" ? "Refusé" : e.etat === "cours" ? "En cours" : "En attente"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!avancement && files.length > 0 && (
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{files.length} fichier{files.length > 1 ? "s" : ""} à ajouter</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setFiles([])}
                  className="inline-flex items-center gap-1 font-medium hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Tout retirer
                </button>
              </div>
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                  >
                    {estZip(f.name) ? (
                      <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" title={f.name}>{f.name}</span>
                      {estZip(f.name) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          Décompressée dans le dossier « {nomDossierZip(f.name)} »
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      {formatFileSize(f.size)}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Retirer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
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
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="ledger"
            disabled={files.length === 0 || busy}
            onClick={handleSubmit}
          >
            {busy
              ? avancement?.phase === "envoi" ? `Envoi ${avancement.lus} / ${avancement.aLire}…` : "Lecture…"
              : `Ajouter ${files.length || ""} fichier${files.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
