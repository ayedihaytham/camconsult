import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/** Nombre maximal de fichiers acceptés par dépôt : au-delà, la conversion locale devient pénible pour le navigateur. */
export const MAX_FICHIERS = 20;

interface Props {
  /** Valeur de l'attribut `accept` de l'entrée fichier. */
  accept: string;
  /** Extensions acceptées (minuscules, sans point) : filtre aussi les fichiers glissés. */
  extensions: string[];
  occupe: boolean;
  libelleOccupe: string;
  /** Texte affiché à la fin de la phrase, ex. « .xlsx / .xls ». */
  types: string;
  onFiles: (fichiers: File[]) => void;
}

/** Zone de dépôt commune aux deux conversions : clic ou glisser-déposer, plusieurs fichiers, tri par extension. */
export function ZoneDepot({ accept, extensions, occupe, libelleOccupe, types, onFiles }: Props) {
  const [survol, setSurvol] = useState(false);

  function recevoir(liste: File[]) {
    if (liste.length === 0) return;
    const valides = liste.filter((f) => extensions.includes(f.name.split(".").pop()?.toLowerCase() ?? ""));
    const ignores = liste.length - valides.length;
    if (ignores > 0) toast.error(`${ignores} fichier${ignores > 1 ? "s" : ""} ignoré${ignores > 1 ? "s" : ""} : format non accepté (${types})`);
    if (valides.length > MAX_FICHIERS) toast.error(`${MAX_FICHIERS} fichiers au maximum à la fois : les ${valides.length - MAX_FICHIERS} derniers sont ignorés`);
    const retenus = valides.slice(0, MAX_FICHIERS);
    if (retenus.length > 0) onFiles(retenus);
  }

  return (
    <label
      data-tour="conversions-upload"
      onDragOver={(e) => {
        e.preventDefault();
        if (!occupe) setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        if (!occupe) recevoir(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input bg-secondary/20 px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-ring hover:border-accent hover:bg-accent/10",
        survol && "border-accent bg-accent/10",
        occupe && "cursor-wait opacity-70",
      )}
    >
      <Upload className="h-7 w-7 text-accent" aria-hidden="true" />
      <p className="text-sm font-semibold text-primary">
        {occupe ? libelleOccupe : <>Glissez vos fichiers ici ou cliquez pour les choisir <span className="underline underline-offset-2">{types}</span></>}
      </p>
      <p className="text-xs text-muted-foreground">Jusqu'à {MAX_FICHIERS} fichiers · la conversion démarre tout de suite</p>
      <input
        type="file"
        accept={accept}
        multiple
        disabled={occupe}
        className="sr-only"
        onChange={(e) => {
          const liste = Array.from(e.target.files ?? []);
          e.target.value = "";
          recevoir(liste);
        }}
      />
    </label>
  );
}
