import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./chargement.css";

/** Brique de squelette (gris chaud, balayage or léger). Décorative : l'état est annoncé par `LegendeChargement` ou un texte `sr-only`. */
export function SqueletteOr({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("sk-or", className)} {...props} />;
}

/** Fine barre or sous la barre du haut : une mise à jour est en cours et les données déjà affichées restent lisibles. */
export function BarreChargement({ actif, libelle = "Mise à jour en cours" }: { actif: boolean; libelle?: string }) {
  if (!actif) return null;
  return (
    <div role="progressbar" aria-busy="true" aria-label={libelle} className="barre-chargement">
      <span />
    </div>
  );
}

/** Légende d'un squelette : annoncée aux lecteurs d'écran, avec un point doré qui bat. */
export function LegendeChargement({ children }: { children: string }) {
  return (
    <p role="status" className="sk-legende">
      <span className="sk-point" aria-hidden="true" />
      {children}
    </p>
  );
}

const LARGEURS = ["80%", "100%", "60%", "45%", "80%", "60%", "100%", "45%"];

interface SqueletteTableauProps {
  /** Modèle de colonnes CSS du vrai tableau, ex. « 84px 1fr 90px 110px ». */
  colonnes: string;
  lignes?: number;
  /** Colonnes (à partir de 0) dont le contenu est aligné à droite (montants). */
  droite?: number[];
}

/** Squelette d'un tableau : une ligne d'en-tête et quelques lignes, avec les mêmes colonnes que le tableau réel pour que rien ne saute à l'arrivée des données. */
export function SqueletteTableau({ colonnes, lignes = 6, droite = [] }: SqueletteTableauProps) {
  const nb = colonnes.trim().split(/\s+/).length;
  const style: CSSProperties = { gridTemplateColumns: colonnes };
  const cellule = (c: number, l: number, tete: boolean) => (
    <SqueletteOr key={c} className={cn(tete && "h-2.5", droite.includes(c) && "ml-auto")} style={{ width: tete ? "55%" : LARGEURS[(c * 3 + l * 5) % LARGEURS.length] }} />
  );
  return (
    <div className="sk-tableau" aria-hidden="true">
      <div className="sk-ligne sk-ligne--tete" style={style}>
        {Array.from({ length: nb }, (_, c) => cellule(c, 0, true))}
      </div>
      {Array.from({ length: lignes }, (_, l) => (
        <div key={l} className="sk-ligne" style={style}>
          {Array.from({ length: nb }, (_, c) => cellule(c, l + 1, false))}
        </div>
      ))}
    </div>
  );
}
