import { XMLParser } from "fast-xml-parser";

/**
 * Lit le bloc <RefTtnVal> que TTN ajoute au message validé : référence TTN (I-88), date de validation (ddMMyyHHmm) et QR officiel
 * (PNG en base64). Aucune valeur n'est inventée : un champ absent ou invalide reste null.
 */

const analyseur = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, trimValues: true });
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_QR_OCTETS = 200_000;

/** « ddMMyyHHmm » (heure de Tunis, UTC+1 sans changement d'heure) → date ISO, ou null. */
export function dateTtn(valeur) {
  const m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(valeur ?? "").trim());
  if (!m) return null;
  const [, jj, mm, aa, hh, mi] = m.map(Number);
  if (mm < 1 || mm > 12 || jj < 1 || jj > 31 || hh > 23 || mi > 59) return null;
  const d = new Date(Date.UTC(2000 + aa, mm - 1, jj, hh - 1, mi));
  return Number.isNaN(d.getTime()) || d.getUTCMonth() !== mm - 1 ? null : d.toISOString();
}

/** QR en base64 : accepté seulement si c'est bien un PNG de taille raisonnable. */
export function qrValide(base64) {
  const compact = String(base64 ?? "").replace(/\s+/g, "");
  if (!compact || !/^[A-Za-z0-9+/]+=*$/.test(compact) || compact.length > (MAX_QR_OCTETS * 4) / 3 + 8) return null;
  const octets = Buffer.from(compact, "base64");
  if (octets.length < PNG.length + 8 || octets.length > MAX_QR_OCTETS || !octets.subarray(0, PNG.length).equals(PNG)) return null;
  return compact;
}

const texte = (v) => (v === undefined || v === null || typeof v === "object" ? "" : String(v).trim());

export function lireRefTtn(xml) {
  if (!xml) return null;
  let doc;
  try {
    doc = analyseur.parse(String(xml));
  } catch {
    return null;
  }
  const bloc = doc?.TEIF?.RefTtnVal;
  if (!bloc || typeof bloc !== "object") return null;
  const ref = texte(bloc.ReferenceTTN);
  if (!ref) return null;
  const date = bloc.ReferenceDate;
  return {
    ref: ref.slice(0, 100),
    dateIso: dateTtn(typeof date === "object" ? date.DateText : date),
    qrPng: qrValide(bloc.ReferenceCEV),
  };
}
