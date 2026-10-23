import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props<F extends string> {
  formats: { valeur: F; nom: string }[];
  valeur: F;
  onValeur: (valeur: F) => void;
  onTelecharger: () => void;
  disabled: boolean;
  title?: string;
}

/** Téléchargement groupé de tous les fichiers convertis, dans le format choisi (PDF, Excel ou texte). */
export function TelechargerTout<F extends string>({ formats, valeur, onValeur, onTelecharger, disabled, title }: Props<F>) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Format du téléchargement groupé"
        value={valeur}
        onChange={(e) => onValeur(e.target.value as F)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {formats.map((f) => (
          <option key={f.valeur} value={f.valeur}>
            {f.nom}
          </option>
        ))}
      </select>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onTelecharger} title={title}>
        <Download className="h-3.5 w-3.5" /> Tout télécharger
      </Button>
    </div>
  );
}
