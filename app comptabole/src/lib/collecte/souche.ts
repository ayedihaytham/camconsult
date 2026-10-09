import type { CollecteFull } from "@/types";
import type { TabRow } from "./tabs";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Clé d'identité d'un chèque émis : son numéro, à défaut la date, le bénéficiaire et le montant. */
function cle(r: TabRow): string {
  const num = norm(r.num_cheque);
  return num ? `n:${num}` : `d:${norm(r.date)}|${norm(r.beneficiaire)}|${Number(r.montant) || 0}`;
}

/** Lignes de la souche de chèques (remplie par le client) qui ne sont pas encore dans l'état des chèques émis (tenu par le comptable) :
 * le comptable les reprend d'un clic, puis vérifie et complète. Même colonnes dans les deux tableaux. */
export function lignesSouchePourEtat(c: Pick<CollecteFull, "lignes">): TabRow[] {
  const deja = new Set(c.lignes.filter((l) => l.onglet === "etat_cheques_emis").map((l) => cle(l.data)));
  const reprises: TabRow[] = [];
  for (const l of [...c.lignes].filter((x) => x.onglet === "souche_cheques").sort((a, b) => a.ordre - b.ordre)) {
    const k = cle(l.data);
    if (deja.has(k)) continue;
    deja.add(k);
    reprises.push({ ...l.data });
  }
  return reprises;
}
