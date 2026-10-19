import type { PdfCell } from "@/lib/pdfTables";

export interface TableauDetecte {
  /** Titre lu juste au-dessus du tableau, sinon « Tableau n ». */
  nom: string;
  /** La première ligne est l'en-tête des colonnes. */
  rows: PdfCell[][];
  /** Lignes du document d'origine (indices à partir de 0) : de la première à la dernière du tableau. */
  debut: number;
  fin: number;
}

interface Options {
  /** Cases remplies minimum pour qu'une ligne compte comme une ligne de tableau (une ligne d'une seule case est un titre ou une note). */
  minColonnes?: number;
  /** Lignes minimum (en-tête compris) : en dessous, ce n'est pas un tableau. */
  minLignes?: number;
}

const remplie = (c: PdfCell | null | undefined) => c !== "" && c != null && String(c).trim() !== "";

/**
 * Repère les tableaux d'une feuille ou d'une page : des lignes qui se suivent avec plusieurs cases remplies. Ce qui les entoure
 * (titre, adresse, mentions, signatures, lignes isolées) n'en fait pas partie ; une ligne blanche sépare deux tableaux, et une seule
 * ligne isolée au milieu d'un tableau (un intitulé de section) ne le coupe pas. Les colonnes entièrement vides sont retirées.
 */
export function detecterTableaux(rows: PdfCell[][], { minColonnes = 2, minLignes = 2 }: Options = {}): TableauDetecte[] {
  const nombre = rows.map((r) => r.filter(remplie).length);
  const estLigne = (i: number) => nombre[i] >= minColonnes;
  const blocs: { debut: number; fin: number }[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!estLigne(i)) {
      i++;
      continue;
    }
    let fin = i;
    for (let j = i + 1; j < rows.length; j++) {
      if (estLigne(j)) fin = j;
      // une seule ligne isolée (non vide) entre deux lignes de tableau : intitulé de section, le tableau continue
      else if (nombre[j] > 0 && j + 1 < rows.length && estLigne(j + 1)) continue;
      else break;
    }
    blocs.push({ debut: i, fin });
    i = fin + 1;
  }

  const sortie: TableauDetecte[] = [];
  for (const b of blocs) {
    const lignes = rows.slice(b.debut, b.fin + 1);
    if (lignes.filter((_, k) => nombre[b.debut + k] >= minColonnes).length < minLignes) continue;
    const largeur = Math.max(...lignes.map((r) => r.length));
    const gardees = Array.from({ length: largeur }, (_, c) => c).filter((c) => lignes.some((r) => remplie(r[c])));
    const titre = b.debut > 0 && nombre[b.debut - 1] === 1 ? String(rows[b.debut - 1].find(remplie) ?? "").trim() : "";
    sortie.push({
      nom: titre.length > 0 && titre.length <= 60 ? titre : `Tableau ${sortie.length + 1}`,
      rows: lignes.map((r) => gardees.map((c) => r[c] ?? "")),
      debut: b.debut,
      fin: b.fin,
    });
  }
  return sortie;
}
