import { CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Statut } from "@/types";

const STATUT_ICONE = {
  actif: { icone: CheckCircle2, libelle: "Actif", classe: "text-success" },
  en_attente: { icone: Clock, libelle: "En attente", classe: "text-warning" },
  inactif: { icone: PauseCircle, libelle: "Inactif", classe: "text-muted-foreground" },
} as const;

/** Statut d'un compte ou d'une société : icône colorée et nom, sur une ligne. */
export function StatutIcone({ statut }: { statut: Statut }) {
  const { icone: Icone, libelle, classe } = STATUT_ICONE[statut];
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold", statut === "inactif" ? "text-muted-foreground" : "text-foreground")}>
      <Icone className={cn("size-4 shrink-0", classe)} aria-hidden="true" />
      {libelle}
    </span>
  );
}
