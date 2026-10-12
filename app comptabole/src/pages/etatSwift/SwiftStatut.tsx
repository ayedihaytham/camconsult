import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SwiftStatut } from "@/types";

const STATUTS = {
  a_justifier: { libelle: "À justifier", icone: AlertCircle, classe: "text-warning" },
  en_cours: { libelle: "En cours", icone: Clock, classe: "text-accent-foreground" },
  justifie: { libelle: "Justifié", icone: CheckCircle2, classe: "text-success" },
  ecart: { libelle: "Écart", icone: AlertTriangle, classe: "text-destructive" },
} as const;

/** Statut d'un virement SWIFT : icône colorée et nom, sur une ligne. */
export function SwiftStatutBadge({ statut }: { statut: SwiftStatut }) {
  const { libelle, icone: Icone, classe } = STATUTS[statut];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold", classe)}>
      <Icone className="size-4 shrink-0" aria-hidden="true" />
      {libelle}
    </span>
  );
}

export const SWIFT_BANDE: Record<SwiftStatut, string> = {
  a_justifier: "border-l-warning",
  en_cours: "border-l-accent",
  justifie: "border-l-success",
  ecart: "border-l-destructive",
};

/** Montant à 3 décimales, séparateurs français. */
export const montantSwift = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
