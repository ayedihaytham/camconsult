import type { PdfCell, PdfSheet } from "@/lib/pdfTables";

/** Un morceau de texte d'une page PDF avec sa position (origine en bas à gauche, en points). */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OptionsConversion {
  /** Convertit « 1 234,50 » ou « 3,2842 » en vrais nombres Excel (sinon tout reste du texte). */
  nombres?: boolean;
}

interface Cellule {
  x: number;
  w: number;
  h: number;
  texte: string;
}

/** Écart (en fraction de la hauteur du texte) au-delà duquel deux morceaux sont deux cellules. */
const SEUIL_CELLULE = 0.7;
/** Tolérance verticale (fraction de la hauteur) pour qu'un morceau appartienne à la même ligne. */
const TOLERANCE_LIGNE = 0.5;
/** Écart horizontal (points) sous lequel deux zones de texte forment la même colonne. */
const TOLERANCE_COLONNE = 2;

// ── Nombres ───────────────────────────────────────────────────────────────

/** Nombre contenu dans un texte, ou null si ce n'est pas un nombre sans ambiguïté.
 *
 *  Reconnu : « 1 234 567,89 », « 1.234.567,89 », « 1,234,567.89 », « 3,2842 », « 170778.400 »,
 *  « -12,5 », « (12,5) » (négatif). Un seul séparateur est lu comme une virgule décimale
 *  (les montants en dinars ont 3 décimales) ; plusieurs séparateurs identiques comme des milliers.
 *  Restent du texte : « 0123 » (zéro initial : code ou compte), plus de 15 chiffres, dates, mélanges. */
export function convertirNombre(texte: string): number | null {
  const brut = texte.trim().replace(/[  ]/g, " ");
  if (!brut) return null;
  const parentheses = /^\(.*\)$/.test(brut);
  let t = parentheses ? brut.slice(1, -1).trim() : brut;
  let negatif = parentheses;
  if (/^[-−–]/.test(t)) {
    negatif = true;
    t = t.slice(1).trim();
  }
  if (!/^\d[\d .,]*$/.test(t) || /[ .,]$/.test(t)) return null;

  let entier: string;
  let decimales = "";
  if (t.includes(" ")) {
    // Milliers séparés par des espaces : « 1 234 567,89 » (le dernier groupe n'a que 3 chiffres).
    const [partieEntiere, ...reste] = t.split(/[,.]/);
    if (reste.length > 1 || !/^\d{1,3}( \d{3})+$/.test(partieEntiere)) return null;
    entier = partieEntiere.replace(/ /g, "");
    decimales = reste[0] ?? "";
  } else {
    const points = (t.match(/\./g) ?? []).length;
    const virgules = (t.match(/,/g) ?? []).length;
    if (points && virgules) {
      const decimal = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ",";
      const milliers = decimal === "." ? "," : ".";
      const morceaux = t.split(decimal);
      if (morceaux.length !== 2 || !new RegExp(`^\\d{1,3}(\\${milliers}\\d{3})+$`).test(morceaux[0])) return null;
      entier = morceaux[0].split(milliers).join("");
      decimales = morceaux[1];
    } else if (points > 1 || virgules > 1) {
      const sep = points > 1 ? "." : ",";
      if (!new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(t)) return null;
      entier = t.split(sep).join("");
    } else if (points || virgules) {
      [entier, decimales] = t.split(points ? "." : ",");
    } else {
      entier = t;
    }
  }
  if (!/^\d+$/.test(entier) || (decimales !== "" && !/^\d+$/.test(decimales))) return null;
  if (entier.length > 1 && entier.startsWith("0")) return null;
  if ((entier + decimales).length > 15) return null;
  const valeur = Number(decimales ? `${entier}.${decimales}` : entier);
  return negatif ? -valeur : valeur;
}

// ── Reconstruction du tableau ─────────────────────────────────────────────

/** Regroupe les morceaux de texte en lignes visuelles, de haut en bas, chacune triée de gauche à droite. */
function grouperLignes(items: PdfTextItem[]): PdfTextItem[][] {
  const tries = items.filter((i) => i.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const lignes: { y: number; h: number; items: PdfTextItem[] }[] = [];
  for (const it of tries) {
    const h = it.h || 8;
    const derniere = lignes[lignes.length - 1];
    if (derniere && Math.abs(derniere.y - it.y) <= Math.max(1.5, TOLERANCE_LIGNE * Math.min(h, derniere.h))) {
      derniere.items.push(it);
    } else {
      lignes.push({ y: it.y, h, items: [it] });
    }
  }
  return lignes.map((l) => l.items.sort((a, b) => a.x - b.x));
}

/** Fusionne les morceaux voisins d'une ligne : un mot coupé en plusieurs morceaux reste une cellule,
 * un grand espace sépare deux cellules. */
function fusionnerCellules(ligne: PdfTextItem[]): Cellule[] {
  const cellules: Cellule[] = [];
  for (const it of ligne) {
    const h = it.h || 8;
    const derniere = cellules[cellules.length - 1];
    const ecart = derniere ? it.x - (derniere.x + derniere.w) : Infinity;
    if (derniere && ecart < SEUIL_CELLULE * Math.max(derniere.h, h)) {
      const espace = ecart > 0.12 * Math.max(derniere.h, h) && !derniere.texte.endsWith(" ") && !it.str.startsWith(" ");
      derniere.texte += (espace ? " " : "") + it.str;
      derniere.w = it.x + it.w - derniere.x;
      derniere.h = Math.max(derniere.h, h);
    } else {
      cellules.push({ x: it.x, w: it.w, h, texte: it.str });
    }
  }
  return cellules.map((c) => ({ ...c, texte: c.texte.replace(/\s+/g, " ").trim() })).filter((c) => c.texte !== "");
}

type Bande = { debut: number; fin: number };

/** Zones horizontales occupées par du texte, fusionnées quand l'écart qui les sépare est inférieur à `tolerance`. */
function fusionnerZones(lignes: Cellule[][], tolerance: number): Bande[] {
  const zones = lignes
    .flat()
    .map((c) => ({ debut: c.x, fin: c.x + c.w }))
    .sort((a, b) => a.debut - b.debut);
  const fusion: Bande[] = [];
  for (const z of zones) {
    const derniere = fusion[fusion.length - 1];
    if (derniere && z.debut <= derniere.fin + tolerance) derniere.fin = Math.max(derniere.fin, z.fin);
    else fusion.push({ ...z });
  }
  return fusion;
}

/** Deux cellules d'une même ligne tombent-elles dans la même colonne ? (colonnes trop larges) */
function aUnConflit(ligne: Cellule[], bandes: Bande[]): boolean {
  const index = ligne.map((c) => bandes.findIndex((b) => c.x + c.w / 2 >= b.debut && c.x + c.w / 2 <= b.fin));
  return new Set(index).size < index.length;
}

/** Colonnes d'un tableau : zones horizontales occupées par le texte, séparées par des vides.
 *
 *  - Seules les lignes qui ont à peu près autant de cellules que la plupart des lignes du tableau
 *    comptent : un titre, une ligne de pied de page (« Édité le… / Page 1 ») ne fusionnent pas des colonnes.
 *  - Les en-têtes sont souvent centrés alors que les montants sont alignés à droite : on part donc d'une
 *    tolérance large et on la réduit tant que deux cellules d'une même ligne se retrouvent dans la même colonne. */
function colonnes(lignes: Cellule[][]): Bande[] {
  const multi = lignes.filter((l) => l.length >= 2);
  if (multi.length === 0) return [];
  const frequences = new Map<number, number>();
  for (const l of multi) frequences.set(l.length, (frequences.get(l.length) ?? 0) + 1);
  const habituel = [...frequences.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const retenues = multi.filter((l) => l.length >= Math.ceil(habituel * 0.6));
  const cellules = retenues.flat();
  const hauteur = cellules.reduce((s, c) => s + c.h, 0) / cellules.length;

  for (const facteur of [1.8, 1.3, 0.9, 0.6, 0.35]) {
    const bandes = fusionnerZones(retenues, facteur * hauteur);
    if (!retenues.some((l) => aUnConflit(l, bandes))) return bandes;
  }
  return fusionnerZones(retenues, TOLERANCE_COLONNE);
}

/** Colonne d'une cellule : celle qu'elle recouvre le plus, sinon la plus proche. */
function indexColonne(c: Cellule, cols: Bande[]): number {
  let meilleur = 0;
  let recouvrement = -Infinity;
  cols.forEach((col, i) => {
    const r = Math.min(col.fin, c.x + c.w) - Math.max(col.debut, c.x);
    const score = r > 0 ? r : -Math.min(Math.abs(c.x - col.fin), Math.abs(c.x + c.w - col.debut));
    if (score > recouvrement) {
      recouvrement = score;
      meilleur = i;
    }
  });
  return meilleur;
}

/** Tableau (lignes de cellules) d'une page PDF à partir de la position de son texte. */
export function reconstruireTableau(items: PdfTextItem[], options: OptionsConversion = {}): PdfCell[][] {
  const lignes = grouperLignes(items).map(fusionnerCellules).filter((l) => l.length > 0);
  if (lignes.length === 0) return [];
  const cols = colonnes(lignes);
  const nb = Math.max(1, cols.length);

  // Page où texte et tableau se mélangent : toutes les zones se confondent en une seule colonne.
  // On garde alors chaque cellule séparée, dans l'ordre de la ligne, plutôt que de les coller.
  const sansColonnes = cols.length <= 1 && lignes.some((l) => l.length >= 2);
  const largeur = sansColonnes ? Math.max(...lignes.map((l) => l.length)) : nb;

  const grille: string[][] = lignes.map((cellules) => {
    const ligne = Array.from({ length: largeur }, () => "");
    cellules.forEach((c, rang) => {
      const i = sansColonnes ? rang : cols.length ? indexColonne(c, cols) : 0;
      ligne[i] = ligne[i] ? `${ligne[i]} ${c.texte}` : c.texte;
    });
    return ligne;
  });

  // Colonnes entièrement vides (zones créées par une cellule isolée) : supprimées.
  const utiles = Array.from({ length: largeur }, (_, i) => i).filter((i) => grille.some((l) => l[i] !== ""));
  return grille.map((l) =>
    utiles.map((i) => {
      if (!options.nombres) return l[i];
      const n = convertirNombre(l[i]);
      return n === null ? l[i] : n;
    }),
  );
}

const DATE = /^\d{1,2}[/.\-]\d{1,2}([/.\-]\d{2,4})?$/;
const ARABE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+/g;

/** Colonnes d'un relevé, reconnues par leur intitulé (le premier motif qui correspond l'emporte). */
const COLONNES = [
  { nom: "Date de valeur", re: /valeur|^date de$/i },
  { nom: "Date", re: /^date( op[ée]ration)?$/i },
  { nom: "Libellé de l'opération", re: /libell|d[ée]signation/i },
  { nom: "Débit", re: /d[ée]bit|retrait/i },
  { nom: "Crédit", re: /cr[ée]dit|versement/i },
  { nom: "Solde", re: /^solde$/i },
  { nom: "Référence", re: /^r[ée]f/i },
];
const DATE_COL = 1;
const LIBELLE_COL = 2;

interface Ancre {
  nom: string;
  centre: number;
}

const categorie = (texte: string) => COLONNES.findIndex((c) => c.re.test(texte.trim()));

/** Colonnes du relevé d'après la ligne d'en-tête (Date, Libellé, Date de valeur, Débit, Crédit…), qui peut
 * tenir sur deux lignes : on garde le centre de chaque intitulé, les valeurs étant alignées dessous. */
function trouverEnTete(lignes: Cellule[][]): { ancres: Ancre[]; fin: number } | null {
  const i = lignes.findIndex((l) => l.some((c) => COLONNES[LIBELLE_COL].re.test(c.texte)));
  if (i < 0) return null;
  const sommes = new Map<number, number[]>();
  let fin = i;
  for (let j = Math.max(0, i - 1); j <= Math.min(lignes.length - 1, i + 1); j++) {
    const cellules = lignes[j];
    if (cellules.some((c) => DATE.test(c.texte)) || !cellules.some((c) => categorie(c.texte) >= 0)) continue;
    fin = Math.max(fin, j);
    for (const c of cellules) {
      const k = categorie(c.texte);
      if (k >= 0) sommes.set(k, [...(sommes.get(k) ?? []), c.x + c.w / 2]);
    }
  }
  if (sommes.size < 3) return null;
  const ancres = [...sommes.entries()]
    .map(([k, xs]) => ({ nom: COLONNES[k].nom, centre: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => a.centre - b.centre);
  return { ancres, fin };
}

/** Lignes du tableau des mouvements d'un relevé : de l'en-tête des colonnes jusqu'à la dernière opération,
 * sur toutes les pages. Chaque morceau de texte est rangé dans la colonne dont l'intitulé est le plus proche.
 * Le texte arabe, les titres, adresses, pieds de page et en-têtes répétés sont écartés ; une ligne sans
 * date qui complète un libellé est rattachée à l'opération précédente. Renvoie null sans en-tête reconnu. */
export function extraireMouvements(pages: PdfTextItem[][]): string[][] | null {
  let ancres: Ancre[] | null = null;
  const lignes: string[][] = [];
  for (const items of pages) {
    const propres = items.map((it) => ({ ...it, str: it.str.replace(ARABE, " ") })).filter((it) => it.str.trim() !== "");
    const visuelles = grouperLignes(propres);
    const cellules = visuelles.map(fusionnerCellules);
    const entete = trouverEnTete(cellules);
    if (entete && !ancres) ancres = entete.ancres;
    if (!ancres) continue;
    const courantes = entete?.ancres ?? ancres;
    const dateIdx = courantes.findIndex((a) => a.nom === COLONNES[DATE_COL].nom);
    const libelleIdx = courantes.findIndex((a) => a.nom === COLONNES[LIBELLE_COL].nom);
    let derniereY: number | null = null; // ligne précédente du tableau : une suite de libellé doit la toucher
    for (let n = entete ? entete.fin + 1 : 0; n < cellules.length; n++) {
      const ligne = cellules[n];
      const y = visuelles[n][0].y;
      const h = Math.max(...ligne.map((c) => c.h));
      const r = courantes.map(() => "");
      for (const c of ligne) {
        const centre = c.x + c.w / 2;
        let k = 0;
        courantes.forEach((a, i) => {
          if (Math.abs(a.centre - centre) < Math.abs(courantes[k].centre - centre)) k = i;
        });
        r[k] = r[k] ? `${r[k]} ${c.texte}` : c.texte;
      }
      const daté = dateIdx >= 0 ? DATE.test(r[dateIdx]) : r.some((c) => DATE.test(c));
      if (daté) {
        lignes.push(r);
        derniereY = y;
      } else if (
        derniereY !== null && lignes.length && libelleIdx >= 0 && r[libelleIdx] && r.filter(Boolean).length === 1 &&
        r[libelleIdx].length <= 40 && derniereY - y <= 2.2 * h
      ) {
        lignes[lignes.length - 1][libelleIdx] += ` ${r[libelleIdx]}`;
        derniereY = y;
      } else {
        derniereY = null;
      }
    }
  }
  return ancres ? [ancres.map((a) => a.nom), ...lignes.map((l) => l.slice(0, ancres!.length))] : null;
}

/** Une feuille par page (les pages sans texte sont ignorées), ou toutes les pages dans une seule feuille.
 * Avec `tableauSeul`, seules les lignes du tableau des mouvements d'un relevé sont gardées (une feuille). */
export function feuillesDePdf(
  pages: PdfTextItem[][],
  options: OptionsConversion & { uneSeuleFeuille?: boolean; tableauSeul?: boolean } = {},
): PdfSheet[] {
  if (options.tableauSeul) {
    const mouvements = extraireMouvements(pages);
    if (mouvements) {
      const rows = options.nombres
        ? mouvements.map((l, i) => l.map((c) => (i === 0 ? c : (convertirNombre(c) ?? c))))
        : mouvements;
      return [{ name: "Mouvements", rows, headerRow: true }];
    }
  }
  const tableaux = pages.map((p) => reconstruireTableau(p, options));
  const feuilles = tableaux.map((rows, i) => ({ name: `Page ${i + 1}`, rows })).filter((f) => f.rows.length > 0);
  if (options.uneSeuleFeuille && feuilles.length > 1) {
    return [{ name: "Toutes les pages", rows: feuilles.flatMap((f) => f.rows) }];
  }
  return feuilles;
}

/** Vrai si le PDF contient un tableau de mouvements reconnaissable. */
export function aUnTableauDeMouvements(pages: PdfTextItem[][]): boolean {
  return extraireMouvements(pages) !== null;
}

/** Nombre de caractères lus dans l'ensemble des pages : 0 pour un PDF scanné (une image sans texte). */
export const nombreDeCaracteres = (pages: PdfTextItem[][]) =>
  pages.reduce((s, p) => s + p.reduce((t, i) => t + i.str.trim().length, 0), 0);

// ── Lecture d'un fichier PDF ──────────────────────────────────────────────

/** Sous-ensemble de pdfjs-dist utilisé ici (permet de le remplacer dans les tests). */
interface PdfJs {
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: unknown[] }>;
      }>;
      destroy?: () => Promise<void>;
    }>;
  };
}

/** Morceaux de texte de chaque page d'un PDF, avec leur position. */
export async function lireTextePdf(pdfjs: PdfJs, donnees: ArrayBuffer): Promise<PdfTextItem[][]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(donnees) }).promise;
  const pages: PdfTextItem[][] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const contenu = await page.getTextContent();
      pages.push(
        contenu.items
          .filter((i): i is { str: string; transform: number[]; width: number; height: number } => typeof (i as { str?: unknown }).str === "string")
          .map((i) => ({
            str: i.str,
            x: i.transform[4],
            y: i.transform[5],
            w: i.width,
            h: i.height || Math.abs(i.transform[3]) || 8,
          })),
      );
    }
  } finally {
    await doc.destroy?.();
  }
  return pages;
}

/** Lit un PDF dans le navigateur (le fichier n'est jamais envoyé au serveur). */
export async function lireFichierPdf(fichier: File): Promise<PdfTextItem[][]> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return lireTextePdf(pdfjs as unknown as PdfJs, await fichier.arrayBuffer());
}

// ── Classeur Excel ────────────────────────────────────────────────────────

/** Noms de feuilles valides pour Excel : 31 caractères au plus, sans \ / ? * [ ] :, uniques. */
export function nomsDeFeuilles(noms: string[]): string[] {
  const pris = new Set<string>();
  return noms.map((nom) => {
    const base = (nom.replace(/[\\/?*[\]:]/g, " ").trim() || "Feuille").slice(0, 31);
    let candidat = base;
    for (let i = 2; pris.has(candidat.toLowerCase()); i++) candidat = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
    pris.add(candidat.toLowerCase());
    return candidat;
  });
}

/** Classeur .xlsx (octets) : une feuille par tableau, largeur de colonne ajustée au contenu. */
export async function classeurExcel(feuilles: PdfSheet[]): Promise<Uint8Array<ArrayBuffer>> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const noms = nomsDeFeuilles(feuilles.map((f) => f.name));
  feuilles.forEach((f, i) => {
    // Une cellule vide n'est pas écrite (pas de texte vide parasite dans le classeur).
    const ws = XLSX.utils.aoa_to_sheet(f.rows.map((r) => r.map((c) => (c === "" ? null : c))));
    const nbCols = Math.max(0, ...f.rows.map((r) => r.length));
    ws["!cols"] = Array.from({ length: nbCols }, (_, c) => ({
      wch: Math.min(60, Math.max(8, ...f.rows.map((r) => String(r[c] ?? "").length + 2))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, noms[i]);
  });
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
