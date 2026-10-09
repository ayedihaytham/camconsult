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

/** Nombre maximal de lignes créées d'un coup à partir d'une plage de numéros (une souche compte rarement plus de 100 chèques). */
export const PLAGE_MAX = 500;

export type Plage = { ok: true; numeros: string[] } | { ok: false; erreur: string };

/** Numéros de « début » à « fin » inclus : « 4001 » à « 4005 » donne 4001…4005. Les zéros de tête sont gardés (« 0098 » à « 0101 »)
 * et un préfixe commun reste devant (« CH12 » à « CH14 »). */
export function plageNumeros(debut: string, fin: string, max = PLAGE_MAX): Plage {
  const d = debut.trim();
  const f = fin.trim();
  if (!d || !f) return { ok: false, erreur: "Indiquez le premier et le dernier numéro." };
  const md = /^(.*?)(\d+)$/.exec(d);
  const mf = /^(.*?)(\d+)$/.exec(f);
  if (!md || !mf) return { ok: false, erreur: "Les numéros doivent se terminer par des chiffres." };
  if (md[1] !== mf[1]) return { ok: false, erreur: "Les deux numéros doivent avoir le même début." };
  const a = BigInt(md[2]);
  const b = BigInt(mf[2]);
  if (b < a) return { ok: false, erreur: "Le dernier numéro doit être supérieur ou égal au premier." };
  if (b - a + 1n > BigInt(max)) return { ok: false, erreur: `Au plus ${max} numéros à la fois.` };
  const largeur = md[2].startsWith("0") ? md[2].length : 0;
  const numeros: string[] = [];
  for (let n = a; n <= b; n++) numeros.push(md[1] + String(n).padStart(largeur, "0"));
  return { ok: true, numeros };
}
