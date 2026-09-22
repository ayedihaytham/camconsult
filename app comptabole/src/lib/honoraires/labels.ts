import type { HonoraireType } from "@/types";

/**
 * Libellé suggéré à partir du type + nature + période — reproduit le
 * format déjà utilisé par le cabinet (« AP 01-2025 », « IS 2025 »,
 * « avril 2026 ») sans forcer une saisie rigide : c'est une suggestion,
 * jamais un champ calculé verrouillé (voir HonorairesSocietePage — libellé
 * reste éditable après coup).
 */
export function suggestLibelle(
  type: HonoraireType,
  nature: string,
  periode: string,
): string {
  const n = nature.trim();
  const p = periode.trim();
  switch (type) {
    case "acompte1":
      return p ? `AP 01-${p}` : "AP 01";
    case "acompte2":
      return p ? `AP 02-${p}` : "AP 02";
    case "acompte3":
      return p ? `AP 03-${p}` : "AP 03";
    case "annuelle":
      return [n || "IS", p].filter(Boolean).join(" ");
    case "trimestrielle":
      return [n || "Déclaration", p].filter(Boolean).join(" ");
    case "mensuelle":
    case "autre":
    default:
      return [n, p].filter(Boolean).join(" ") || p || n;
  }
}
