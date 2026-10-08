import type { StockMouvement } from "@/types";

/** Numéro de facture comparable : sans espaces, tirets ni casse (« 2023-001 » et « 2023 001 » sont le même). */
export const cleNumero = (n: string) =>
  n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

interface Element {
  id: string;
  numero: string;
  /** Tiers qui a émis la facture : deux fournisseurs peuvent numéroter pareil sans qu'il y ait doublon. */
  tiers?: string;
}

const cle = (e: Element) => {
  const n = cleNumero(e.numero);
  if (!n) return "";
  const t = cleNumero(e.tiers ?? "");
  return t ? `${t}|${n}` : n;
};

/** Pour chaque élément dont le numéro est utilisé par au moins un autre : les ids des autres. */
export function doublonsFactures(elements: Element[]): Map<string, string[]> {
  const groupes = new Map<string, string[]>();
  for (const e of elements) {
    const k = cle(e);
    if (k) groupes.set(k, [...(groupes.get(k) ?? []), e.id]);
  }
  const doublons = new Map<string, string[]>();
  for (const ids of groupes.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) doublons.set(id, ids.filter((x) => x !== id));
  }
  return doublons;
}

type Cote = Pick<StockMouvement, "id" | "venteNumFacture" | "achatNumFacture" | "fournisseur">;

/** Doublons du stock : un n° de facture de vente utilisé deux fois, ou un n° d'achat répété pour le même fournisseur. */
export function doublonsStock(mouvements: Cote[]) {
  return {
    vente: doublonsFactures(mouvements.map((m) => ({ id: m.id, numero: m.venteNumFacture }))),
    achat: doublonsFactures(mouvements.map((m) => ({ id: m.id, numero: m.achatNumFacture, tiers: m.fournisseur }))),
  };
}

export interface DoublonResume {
  type: "vente" | "achat";
  numero: string;
  /** Rangs (à partir de 1) des mouvements concernés, dans l'ordre du tableau. */
  rangs: number[];
}

/** Un résumé par numéro en doublon, pour l'alerte au-dessus du tableau. */
export function resumeDoublons(mouvements: (Cote & { id: string })[]): DoublonResume[] {
  const { vente, achat } = doublonsStock(mouvements);
  const resume: DoublonResume[] = [];
  const vus = new Set<string>();
  mouvements.forEach((m, i) => {
    for (const [type, map, numero] of [
      ["vente", vente, m.venteNumFacture],
      ["achat", achat, m.achatNumFacture],
    ] as const) {
      if (!map.has(m.id)) continue;
      const k = `${type}|${cleNumero(numero)}|${type === "achat" ? cleNumero(m.fournisseur) : ""}`;
      if (vus.has(k)) continue;
      vus.add(k);
      const rangs = [i, ...(map.get(m.id) ?? []).map((id) => mouvements.findIndex((x) => x.id === id))].sort((a, b) => a - b).map((r) => r + 1);
      resume.push({ type, numero: numero.trim(), rangs });
    }
  });
  return resume;
}

/** Mouvements (autres que `exceptId`) qui utilisent déjà ce numéro de facture. */
export function mouvementsAvecNumero(
  mouvements: Cote[],
  cote: "vente" | "achat",
  numero: string,
  tiers: string,
  exceptId: string | null,
): Cote[] {
  const n = cleNumero(numero);
  if (!n) return [];
  return mouvements.filter((m) => {
    if (m.id === exceptId) return false;
    if (cote === "vente") return cleNumero(m.venteNumFacture) === n;
    const t = cleNumero(tiers);
    const tm = cleNumero(m.fournisseur);
    return cleNumero(m.achatNumFacture) === n && (!t || !tm || t === tm);
  });
}
