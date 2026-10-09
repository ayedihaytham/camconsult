import type { CollecteFull } from "@/types";
import { TAB_BY_KEY, cellNumber, etatDeTableau, ordonnerTableaux } from "./tabs";

export interface ChecklistRow {
  onglet: string;
  /** Sigle de l'état qui regroupe ce tableau (CHQ, VRT, TR), absent pour les autres tableaux. */
  etat?: string;
  pieceLabel: string;
  tabLabel: string;
  recu: boolean;
  statutLabel: string;
  /** JJ/MM/AAAA ou null */
  dateReception: string | null;
  /** AAAA-MM-JJ de la date de suivi, pour un champ date. */
  dateSuivi: string | null;
  /** Tableau avec lignes : reçu d'office, total et date calculés (non modifiables à la main). */
  recuAuto: boolean;
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

function isoJour(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lignes calculées de l'onglet Checklist à partir de l'état de la collecte. */
export function checklistRows(c: CollecteFull): ChecklistRow[] {
  return ordonnerTableaux(c.onglets).filter((key) => !TAB_BY_KEY[key]?.cabinetSeul).map((key) => {
    const def = TAB_BY_KEY[key];
    const lignes = c.lignes
      .filter((l) => l.onglet === key)
      .sort((a, b) => a.ordre - b.ordre);
    const section = c.sections.find((s) => s.onglet === key);
    const recuAuto = lignes.length > 0;
    const recu = recuAuto || Boolean(section?.recuManuel);

    let total: number | null = recu && !recuAuto ? (section?.totalSaisi ?? null) : null;
    if (def && recuAuto) {
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
      etat: etatDeTableau(key)?.code,
      pieceLabel: def?.pieceLabel ?? key,
      tabLabel: def?.label ?? key,
      recu,
      statutLabel: recu ? "Reçu" : "En attente",
      dateReception: recu ? frDate(section?.dateSuivi ?? (recuAuto ? (c.transmisLe ?? c.majLe) : null)) : null,
      dateSuivi: recu ? (section?.dateSuivi ?? (recuAuto ? isoJour(c.transmisLe ?? c.majLe) : null)) : null,
      recuAuto,
      total,
      nbLignes: lignes.length,
      commentaire: section?.commentaire ?? "",
    };
  });
}
