import type { ReactNode } from "react";
import { AlertTriangle, Check, CircleSlash } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Grammaire commune des fenêtres de Facturation (Accès TTN, Signature électronique, Informations du cabinet) :
 * titre en serif, formulaire à gauche, carte d'état à droite, boutons en bas. Même présentation que « Nouvelle facture ».
 */

export const ETIQUETTE = "grid gap-1.5 text-xs font-semibold text-primary";
export const CHAMP = "h-10 rounded-lg border-input bg-card px-3 text-sm focus-visible:border-primary";
export const AIDE = "text-[11.5px] font-normal text-muted-foreground";

/** Section du formulaire : petit titre en capitales précédé d'un losange doré. */
export function Rubrique({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <span className="size-1.5 rotate-45 bg-accent" aria-hidden="true" />
        {titre}
      </h2>
      {children}
    </section>
  );
}

/** Carte de la colonne de droite. */
export function Carte({ titre, serif = true, children, className }: { titre: string; serif?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2.5 rounded-xl border border-accent/25 bg-card px-4 py-3.5", className)}>
      <h3 className={serif ? "font-serif text-[15px] font-bold text-primary" : "text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"}>{titre}</h3>
      {children}
    </section>
  );
}

export type TonPuce = "ok" | "alerte" | "erreur" | "neutre";

/** Puce d'état : terminé, à faire, en échec, neutre. */
export function Puce({ ton, children, className }: { ton: TonPuce; children: ReactNode; className?: string }) {
  const Icone = ton === "ok" ? Check : ton === "neutre" ? CircleSlash : AlertTriangle;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        ton === "ok" && "bg-success/12 text-success",
        ton === "alerte" && "bg-warning/15 text-warning",
        ton === "erreur" && "bg-destructive/10 text-destructive",
        ton === "neutre" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icone className="size-3.5" strokeWidth={ton === "ok" ? 3 : 2} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Ligne « libellé / valeur » d'une carte. */
export function Valeurs({ lignes }: { lignes: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
      {lignes.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words text-right font-medium text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titre: string;
  description: ReactNode;
  /** Élément à droite du titre (ex. badge d'environnement). */
  enTete?: ReactNode;
  /** Colonne principale (formulaire). */
  children: ReactNode;
  /** Carte(s) d'état de la colonne de droite. */
  aside?: ReactNode;
  /** Pied : boutons et message. */
  pied: ReactNode;
}

/** Fenêtre à deux colonnes (formulaire + cartes d'état), titre en serif, pied de boutons. */
export function FenetreFacturation({ open, onOpenChange, titre, description, enTete, children, aside, pied }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl border-accent/30 p-0">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-accent/30 px-6 pb-4 pt-6 sm:px-8">
          <div className="min-w-0 pr-8">
            <DialogTitle className="font-serif text-3xl font-medium text-primary">{titre}</DialogTitle>
            <DialogDescription className="mt-1 max-w-[62ch] text-sm text-muted-foreground">{description}</DialogDescription>
          </div>
          {enTete && <div className="mr-8">{enTete}</div>}
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto", aside && "lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:overflow-hidden")}>
          <div className="space-y-6 px-6 py-5 sm:px-8 lg:overflow-y-auto">{children}</div>
          {aside && <aside className="space-y-3.5 border-t border-accent/30 bg-background/60 px-6 py-5 sm:px-8 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-5">{aside}</aside>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-accent/30 px-6 py-4 sm:px-8">{pied}</div>
      </DialogContent>
    </Dialog>
  );
}
