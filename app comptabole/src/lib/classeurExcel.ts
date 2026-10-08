import type { FusionVerticale } from "@/lib/banqueClasseur";

export interface FeuilleExcel {
  nom: string;
  rows: unknown[][];
  fusions: FusionVerticale[];
}

/** Lit toutes les feuilles d'un classeur Excel : cellules depuis A1 (dates en objets Date) et fusions verticales de cellules
 * (la valeur d'une cellule fusionnée n'est que dans sa première ligne, d'où la liste des fusions). */
export async function lireClasseurExcel(file: File): Promise<FeuilleExcel[]> {
  const XLSX = await import("xlsx");
  const classeur = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  return classeur.SheetNames.map((nom) => {
    const ws = classeur.Sheets[nom];
    const ref = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
    const rows = ref
      ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: ref.e }) })
      : [];
    const fusions: FusionVerticale[] = (ws["!merges"] ?? [])
      .filter((m) => m.s.c === m.e.c && m.e.r > m.s.r)
      .map((m) => ({ ligne1: m.s.r, ligne2: m.e.r, colonne: m.s.c }));
    return { nom, rows, fusions };
  });
}
