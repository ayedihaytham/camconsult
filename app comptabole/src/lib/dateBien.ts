/** Date d'acquisition d'une cellule importée -> « AAAA-MM-JJ » (date de calendrier, sans heure), ou « » si illisible ou inexistante.
 * Une vraie date de classeur est lue avec les accesseurs LOCAUX : `toISOString()` convertirait en UTC et donnerait la veille dans un
 * fuseau à l'est de UTC comme la Tunisie. */
const pad = (n: number) => String(n).padStart(2, "0");

function valide(annee: number, mois: number, jour: number): string {
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return "";
  return `${String(annee).padStart(4, "0")}-${pad(mois)}-${pad(jour)}`;
}

export function dateCalendrier(cell: unknown): string {
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return "";
    return valide(cell.getFullYear(), cell.getMonth() + 1, cell.getDate());
  }
  const s = String(cell ?? "").trim();
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (fr) return valide(fr[3].length === 2 ? 2000 + Number(fr[3]) : Number(fr[3]), Number(fr[2]), Number(fr[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return valide(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return "";
}
