import type { CollecteFull } from "@/types";
import { TAB_BY_KEY, cellNumber } from "./tabs";

export interface ChecklistRow {
  onglet: string;
  pieceLabel: string;
  tabLabel: string;
  recu: boolean;
  statutLabel: string;
  /** JJ/MM/AAAA ou null */
  dateReception: string | null;
  total: number | null;
  nbLignes: number;
  commentaire: string;
}

function frDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR");
}

/** Lignes calculées de l'onglet Checklist à partir de l'état de la collecte. */
export function checklistRows(c: CollecteFull): ChecklistRow[] {
  return c.onglets.map((key) => {
    const def = TAB_BY_KEY[key];
    const lignes = c.lignes
      .filter((l) => l.onglet === key)
      .sort((a, b) => a.ordre - b.ordre);
    const section = c.sections.find((s) => s.onglet === key);
    const recu = lignes.length > 0;

    let total: number | null = null;
    if (def && recu) {
      const data = lignes.map((l) => l.data);
      const derived = def.derive ? def.derive(data) : data;
      if (def.checklistTotal) {
        total = def.checklistTotal(derived);
      } else if (def.totalKey) {
        total = derived.reduce(
          (sum, r) => sum + cellNumber(r[def.totalKey as string]),
          0,
        );
      }
    }

    return {
      onglet: key,
      pieceLabel: def?.pieceLabel ?? key,
      tabLabel: def?.label ?? key,
      recu,
      statutLabel: recu ? "Reçu" : "En attente",
      dateReception: recu ? frDate(c.transmisLe ?? c.majLe) : null,
      total,
      nbLignes: lignes.length,
      commentaire: section?.commentaire ?? "",
    };
  });
}
