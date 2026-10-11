import { useMemo, useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { anneeDuLibelle } from "@/lib/structurationMois";
import type { Noeud, Societe } from "@/types";

export const COMMUN = "__commun__";

export interface GroupeSociete {
  cle: string;
  label: string;
  roots: Noeud[];
}

/** Société et année affichées par l'organigramme et la vue générale : une société à la fois (les arborescences sans société forment
 * l'entrée « Commun »), et l'année des dossiers « … 2026 » de cette société, la plus récente au départ. */
export function useGroupeAnnee(nodes: Noeud[], roots: Noeud[], getSocieteById: (id: string | null) => Societe | null) {
  const groupes = useMemo(() => {
    const map = new Map<string, GroupeSociete>();
    for (const r of roots) {
      const cle = r.societeId ?? COMMUN;
      const label = r.societeId ? (getSocieteById(r.societeId)?.raisonSociale ?? r.libelle) : "Commun (sans société)";
      const g = map.get(cle) ?? { cle, label, roots: [] };
      g.roots.push(r);
      map.set(cle, g);
    }
    return [...map.values()].sort((a, b) =>
      a.cle === COMMUN ? 1 : b.cle === COMMUN ? -1 : a.label.localeCompare(b.label, "fr"),
    );
  }, [roots, getSocieteById]);
  const [choix, setChoix] = useState<string | null>(null);
  const groupe = groupes.find((g) => g.cle === choix) ?? groupes[0];

  const annees = useMemo(() => {
    const trouvees = new Set<number>();
    for (const r of groupe?.roots ?? []) {
      for (const n of nodes) {
        const a = n.parentId === r.id ? anneeDuLibelle(n.libelle) : null;
        if (a !== null) trouvees.add(a);
      }
    }
    return [...trouvees].sort((a, b) => b - a);
  }, [groupe, nodes]);
  const [anneeChoix, setAnneeChoix] = useState<number | null>(null);
  const annee = annees.includes(anneeChoix ?? -1) ? anneeChoix : (annees[0] ?? null);

  return { groupes, groupe, setChoix, annees, annee, setAnneeChoix };
}

/** Barre « Société / Année » commune à l'organigramme et à la vue générale, avec des actions à droite. */
export function SelecteursSocieteAnnee({ groupes, groupe, onGroupe, annees, annee, onAnnee, droite }: {
  groupes: GroupeSociete[];
  groupe: GroupeSociete | undefined;
  onGroupe: (cle: string) => void;
  annees: number[];
  annee: number | null;
  onAnnee: (annee: number) => void;
  droite?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
      <span className="text-sm text-muted-foreground">Société</span>
      <Select value={groupe?.cle} onValueChange={onGroupe}>
        <SelectTrigger className="h-9 w-64" aria-label="Organigramme de la société">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupes.map((g) => (
            <SelectItem key={g.cle} value={g.cle}>
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {annees.length > 0 && (
        <>
          <span className="text-sm text-muted-foreground">Année</span>
          <Select value={String(annee)} onValueChange={(v) => onAnnee(Number(v))}>
            <SelectTrigger className="h-9 w-28" aria-label="Année de l'organigramme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {annees.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      {droite && <div className="ml-auto flex flex-wrap items-center gap-2">{droite}</div>}
    </div>
  );
}
