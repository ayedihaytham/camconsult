import type { PdfTextItem } from "@/lib/pdfToTables";

/** Mot reconnu par l'OCR : position en pixels de l'image de la page (origine en haut à gauche). */
export interface MotOcr {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Confiance minimale (0 à 100) d'un mot de trois signes ou plus : nulle, car l'OCR donne souvent 0 à des mots justes (voir motUtile). */
export const CONFIANCE_MINIMALE = 0;
/** Un signe isolé n'est gardé que s'il est lu avec une bonne confiance : c'est le plus souvent un reste de trait ou de bord de page. */
const CONFIANCE_SIGNE_ISOLE = 75;
/** Résolution de lecture : 3 pixels par point du PDF (≈ 216 ppp). Au-delà, la précision n'augmente plus et la durée si. */
export const ECHELLE_OCR = 3;
/** Un trait d'encre au moins aussi long (en part de la largeur de la page) est un filet de tableau ou un cadre, pas du texte. */
const LONGUEUR_FILET = 0.06;
const SEUIL_ENCRE = 150;

const aDuTexte = (texte: string) => /[\p{L}\p{N}]/u.test(texte);

/**
 * Prépare l'image d'une page avant la lecture : niveaux de gris, contraste étiré (photos pâles ou ombrées), puis effacement des filets
 * longs. Les traits d'un tableau collent aux chiffres et la lecture les prend pour des « | » ou fusionne les colonnes ; le texte, lui, reste intact.
 * Modifie `donnees` (RGBA) sur place.
 */
export function preparerPourOcr(donnees: Uint8ClampedArray, largeur: number, hauteur: number): void {
  const total = largeur * hauteur;
  const gris = new Uint8Array(total);
  const histogramme = new Uint32Array(256);
  for (let i = 0; i < total; i++) {
    const valeur = Math.round(0.299 * donnees[i * 4] + 0.587 * donnees[i * 4 + 1] + 0.114 * donnees[i * 4 + 2]);
    gris[i] = valeur;
    histogramme[valeur]++;
  }
  // Étirement entre les centiles 0,1 % et 95 % : le papier devient blanc, l'encre noire. Un bas plus sévère prendrait un bandeau gris (en-tête de tableau) pour de l'encre et l'effacerait.
  let cumul = 0;
  let bas = 0;
  let haut = 255;
  for (let v = 0; v < 256; v++) { cumul += histogramme[v]; if (cumul >= total * 0.001) { bas = v; break; } }
  cumul = 0;
  for (let v = 255; v >= 0; v--) { cumul += histogramme[v]; if (cumul >= total * 0.05) { haut = v; break; } }
  if (haut - bas >= 20) for (let i = 0; i < total; i++) gris[i] = Math.max(0, Math.min(255, Math.round(((gris[i] - bas) * 255) / (haut - bas))));

  // Filets : suites d'encre plus longues que LONGUEUR_FILET de la largeur, en ligne puis en colonne ; ils sont effacés avec 2 pixels de marge.
  const longueur = Math.max(20, Math.round(largeur * LONGUEUR_FILET));
  const effacer = new Uint8Array(total);
  for (let y = 0; y < hauteur; y++) {
    let debut = -1;
    for (let x = 0; x <= largeur; x++) {
      const encre = x < largeur && gris[y * largeur + x] < SEUIL_ENCRE;
      if (encre && debut < 0) debut = x;
      if (!encre && debut >= 0) {
        if (x - debut >= longueur) for (let k = Math.max(0, y - 2); k <= Math.min(hauteur - 1, y + 2); k++) effacer.fill(1, k * largeur + debut, k * largeur + x);
        debut = -1;
      }
    }
  }
  for (let x = 0; x < largeur; x++) {
    let debut = -1;
    for (let y = 0; y <= hauteur; y++) {
      const encre = y < hauteur && gris[y * largeur + x] < SEUIL_ENCRE;
      if (encre && debut < 0) debut = y;
      if (!encre && debut >= 0) {
        if (y - debut >= longueur) for (let k = Math.max(0, x - 2); k <= Math.min(largeur - 1, x + 2); k++) for (let j = debut; j < y; j++) effacer[j * largeur + k] = 1;
        debut = -1;
      }
    }
  }
  for (let i = 0; i < total; i++) {
    const valeur = effacer[i] ? 255 : gris[i];
    donnees[i * 4] = valeur;
    donnees[i * 4 + 1] = valeur;
    donnees[i * 4 + 2] = valeur;
    donnees[i * 4 + 3] = 255;
  }
}

/**
 * Un mot de trois signes ou plus est gardé même avec une confiance nulle : l'OCR donne 0 à des mots parfaitement lus quand un reste de filet les touche
 * (« ACHAT », « 304 » d'un montant), et le bruit (taches, traits) ne forme presque jamais de mots de plusieurs lettres ou chiffres.
 * Un mot de deux signes doit être lu avec une confiance d'au moins 30, un signe seul avec 30 (chiffre) ou 75 (lettre ou symbole).
 */
const motUtile = (mot: MotOcr) => {
  const texte = mot.text.trim();
  if (!aDuTexte(texte)) return false;
  if (texte.length >= 3) return mot.confidence >= CONFIANCE_MINIMALE;
  if (texte.length === 2) return mot.confidence >= 30;
  return /\d/.test(texte) ? mot.confidence >= 30 : mot.confidence >= CONFIANCE_SIGNE_ISOLE;
};
const mediane = (valeurs: number[]) => {
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
};

/**
 * Mots gardés d'une ligne. Un ou deux chiffres suivis d'un groupe de trois chiffres (le « 1 » de « 1 000,000 », le « 17 » de « 17 812,500 ») sont toujours gardés,
 * quelle que soit la confiance : sur certains appareils l'OCR donne une confiance basse à ce chiffre de tête, et le perdre change le montant de mille.
 */
function gardesDeLigne(ligne: MotOcr[]): MotOcr[] {
  const tries = [...ligne].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const gardes = tries.filter((mot, i) => {
    if (motUtile(mot)) return true;
    const suivant = tries[i + 1]?.text.trim() ?? "";
    return /^\d{1,2}$/.test(mot.text.trim()) && /^\d{3}(?:[,.]\d+)?$/.test(suivant) && (tries[i + 1].bbox.x0 - mot.bbox.x1) < (mot.bbox.y1 - mot.bbox.y0) * 1.5;
  });
  return gardes;
}

/**
 * Lignes lues par l'OCR → morceaux de texte positionnés comme ceux d'un PDF. Tous les mots d'une ligne prennent la même hauteur de base (la médiane) :
 * sans cela, un « p » ou un « g » descend plus bas que ses voisins et la reconstruction du tableau coupe une ligne en deux.
 */
export function lignesVersItems(lignes: MotOcr[][], echelle: number, hauteurPage: number): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  for (const ligne of lignes) {
    const mots = gardesDeLigne(ligne);
    if (!mots.length) continue;
    const y = mediane(mots.map((mot) => hauteurPage - mot.bbox.y1 / echelle));
    const h = mediane(mots.map((mot) => (mot.bbox.y1 - mot.bbox.y0) / echelle));
    for (const mot of mots) items.push({ str: mot.text.trim(), x: mot.bbox.x0 / echelle, y, w: (mot.bbox.x1 - mot.bbox.x0) / echelle, h });
  }
  return items;
}

/** Mots de l'OCR → morceaux de texte positionnés comme ceux d'un PDF (points, origine en bas à gauche) : tout le reste de la conversion s'applique tel quel. */
export function motsVersItems(mots: MotOcr[], echelle: number, hauteurPage: number): PdfTextItem[] {
  return mots
    .filter(motUtile)
    .map((mot) => ({
      str: mot.text.trim(),
      x: mot.bbox.x0 / echelle,
      y: hauteurPage - mot.bbox.y1 / echelle,
      w: (mot.bbox.x1 - mot.bbox.x0) / echelle,
      h: (mot.bbox.y1 - mot.bbox.y0) / echelle,
    }));
}

/** Mots d'un résultat de reconnaissance, qu'ils soient à plat (`words`) ou imbriqués dans les blocs. */
export function motsDeResultat(data: unknown): MotOcr[] {
  const resultat = data as { words?: MotOcr[]; blocks?: { paragraphs?: { lines?: { words?: MotOcr[] }[] }[] }[] | null };
  if (Array.isArray(resultat?.words) && resultat.words.length) return resultat.words;
  const mots: MotOcr[] = [];
  for (const bloc of resultat?.blocks ?? []) for (const paragraphe of bloc.paragraphs ?? []) for (const ligne of paragraphe.lines ?? []) mots.push(...(ligne.words ?? []));
  return mots;
}

/** Lignes d'un résultat de reconnaissance, chacune avec ses mots ; à défaut de structure, chaque mot est sa propre ligne. */
export function lignesDeResultat(data: unknown): MotOcr[][] {
  const resultat = data as { blocks?: { paragraphs?: { lines?: { words?: MotOcr[] }[] }[] }[] | null };
  const lignes: MotOcr[][] = [];
  for (const bloc of resultat?.blocks ?? []) for (const paragraphe of bloc.paragraphs ?? []) for (const ligne of paragraphe.lines ?? []) if (ligne.words?.length) lignes.push(ligne.words);
  return lignes.length ? lignes : motsDeResultat(data).map((mot) => [mot]);
}

const DATE_OPERATION = /^\d{2}[-/.]\d{2}[-/.]\d{4}$/;
const MONTANT_VALIDE = /(?<![\d,.])(?:\d{1,3}(?: \d{3})+|\d+)[,.]\d{2,3}(?!\d)/g;
/** Un « groupe de milliers » qui commence par un zéro (« 000,000 ») n'existe pas : le début du montant a été perdu. */
const MONTANT_TRONQUE = /(?<![\d,. ])0\d{2}[,.]\d{2,3}(?!\d)/;

/** Une rangée du tableau (une ligne de date et ce qui l'entoure) est-elle complète : au moins deux montants intacts et un libellé ? */
export function rangeeComplete(texte: string): boolean {
  if (MONTANT_TRONQUE.test(texte)) return false;
  const montants = texte.match(MONTANT_VALIDE)?.length ?? 0;
  const libelle = texte.replace(/\d{2}[-/.]\d{2}[-/.]\d{4}/g, " ").replace(MONTANT_VALIDE, " ");
  return montants >= 2 && (libelle.match(/\p{L}{3,}/gu)?.length ?? 0) >= 1;
}

/**
 * Bandes de la page à relire : les rangées d'un tableau de mouvements (une date en première colonne) auxquelles il manque un montant ou le libellé.
 * Cela ne s'applique que si la plupart des rangées de la page sont complètes (un relevé à colonnes Débit et Crédit) : sur un autre document, rien n'est relu.
 */
export function bandesASurveiller(mots: MotOcr[], largeur: number): { y0: number; y1: number }[] {
  const dates = mots.filter((m) => DATE_OPERATION.test(m.text.trim()) && m.bbox.x0 < largeur * 0.22);
  if (dates.length < 3) return [];
  const rangees = dates.map((d) => {
    const h = d.bbox.y1 - d.bbox.y0;
    const centre = (d.bbox.y0 + d.bbox.y1) / 2;
    const dansLaRangee = mots.filter((m) => Math.abs((m.bbox.y0 + m.bbox.y1) / 2 - centre) <= h * 0.9).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    return { y0: d.bbox.y0 - h * 0.9, y1: d.bbox.y1 + h * 0.9, complete: rangeeComplete(dansLaRangee.map((m) => m.text).join(" ")) };
  });
  if (rangees.filter((r) => r.complete).length < rangees.length * 0.5) return [];
  return rangees.filter((r) => !r.complete).map(({ y0, y1 }) => ({ y0, y1 }));
}

export interface ColonnesMontants {
  debit: number;
  credit: number;
  demi: number;
}

/** Centres (en points) des colonnes Débit et Crédit, d'après les intitulés lus sur la première page qui les porte ; null si le document n'a pas ces deux colonnes. */
export function colonnesMontants(pages: PdfTextItem[][]): ColonnesMontants | null {
  for (const items of pages) {
    const debit = items.find((i) => /^d[ée]bit$/i.test(i.str.trim()));
    const credit = items.find((i) => /^cr[ée]dit$/i.test(i.str.trim()));
    if (debit && credit) {
      const [cd, cc] = [debit.x + debit.w / 2, credit.x + credit.w / 2];
      return { debit: cd, credit: cc, demi: Math.abs(cc - cd) / 2 };
    }
  }
  return null;
}

const MONTANT_RELU = /^\d{1,3}(?: \d{3})*[,.]\d{2,3}$|^\d+[,.]\d{2,3}$/;

/** Montants relus dans une colonne : ils remplacent, sur leur rangée, ce que la première lecture avait mis dans cette colonne (un montant perdu ou abîmé). */
export function fusionnerMontantsRelus(items: PdfTextItem[], relus: PdfTextItem[], colonne: { x0: number; x1: number }): PdfTextItem[] {
  const dansLaColonne = (i: PdfTextItem) => i.x + i.w / 2 >= colonne.x0 && i.x + i.w / 2 <= colonne.x1;
  const rangeeDe = (i: PdfTextItem) => i.y + i.h / 2;
  const valides = relus.filter((r) => MONTANT_RELU.test(r.str));
  const restants = items.filter((i) => !(dansLaColonne(i) && valides.some((r) => Math.abs(rangeeDe(i) - rangeeDe(r)) <= 0.8 * Math.max(i.h, r.h))));
  return [...restants, ...valides];
}

export interface ProgressionOcr {
  page: number;
  pages: number;
}

/** Adresses des fichiers de l'OCR : tous servis par l'application elle-même (jamais depuis un site tiers), pour que le PDF ne quitte jamais l'appareil. */
const ADRESSES = () => ({
  workerPath: new URL("/ocr/worker.min.js", window.location.origin).href,
  corePath: new URL("/ocr/core", window.location.origin).href,
  langPath: new URL("/ocr/lang", window.location.origin).href,
});

/** Lit un PDF sans texte (scan, photo) par reconnaissance de caractères, dans le navigateur : chaque page est dessinée, préparée puis lue ; le résultat a la forme d'un PDF avec texte. */
export async function lirePdfParOcr(fichier: File, options: { onProgression?: (p: ProgressionOcr) => void; signal?: AbortSignal } = {}): Promise<PdfTextItem[][]> {
  const [pdfjs, worker, tesseract] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url"), import("tesseract.js")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise;
  const lecteur = await tesseract.createWorker("fra", 1, ADRESSES());
  const pages: PdfTextItem[][] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      if (options.signal?.aborted) throw new DOMException("Lecture annulée", "AbortError");
      options.onProgression?.({ page: n, pages: doc.numPages });
      const page = await doc.getPage(n);
      const vue = page.getViewport({ scale: ECHELLE_OCR });
      const canevas = document.createElement("canvas");
      canevas.width = Math.ceil(vue.width);
      canevas.height = Math.ceil(vue.height);
      const contexte = canevas.getContext("2d");
      if (!contexte) throw new Error("Dessin de la page impossible");
      await page.render({ canvasContext: contexte, viewport: vue }).promise;
      const image = contexte.getImageData(0, 0, canevas.width, canevas.height);
      preparerPourOcr(image.data, canevas.width, canevas.height);
      contexte.putImageData(image, 0, 0);
      const { data } = await lecteur.recognize(canevas, {}, { blocks: true });
      let lignes = lignesDeResultat(data);
      // Rangées de relevé incomplètes (montant ou libellé perdu) : la bande est relue seule, à plus grande échelle, et remplace la lecture d'origine si elle est complète.
      for (const bande of bandesASurveiller(lignes.flat(), canevas.width)) {
        const hauteurBande = Math.max(8, Math.round(bande.y1 - bande.y0));
        const y0 = Math.max(0, Math.round(bande.y0));
        const relue = document.createElement("canvas");
        relue.width = Math.round(canevas.width * 1.5);
        relue.height = Math.round(hauteurBande * 1.5);
        relue.getContext("2d")?.drawImage(canevas, 0, y0, canevas.width, hauteurBande, 0, 0, relue.width, relue.height);
        await lecteur.setParameters({ tessedit_pageseg_mode: "6" as never });
        const { data: donneesBande } = await lecteur.recognize(relue, {}, { blocks: true });
        await lecteur.setParameters({ tessedit_pageseg_mode: "3" as never });
        const lignesBande = lignesDeResultat(donneesBande).map((ligne) => ligne.map((mot) => ({ ...mot, bbox: { x0: mot.bbox.x0 / 1.5, x1: mot.bbox.x1 / 1.5, y0: mot.bbox.y0 / 1.5 + y0, y1: mot.bbox.y1 / 1.5 + y0 } })));
        if (!rangeeComplete(lignesBande.map((l) => l.map((m) => m.text).join(" ")).join(" "))) continue;
        lignes = [...lignes.filter((l) => { const centre = l.reduce((t, m) => t + (m.bbox.y0 + m.bbox.y1) / 2, 0) / l.length; return centre < bande.y0 || centre > bande.y1; }), ...lignesBande];
      }
      pages.push(lignesVersItems(lignes, ECHELLE_OCR, vue.height / ECHELLE_OCR));
      canevas.width = 0;
      canevas.height = 0;
    }
  } finally {
    await lecteur.terminate();
    await doc.destroy();
  }
  return pages;
}

/**
 * Relecture ciblée des colonnes Débit et Crédit d'un relevé : chaque colonne est découpée sur toute la hauteur du tableau et lue seule, avec pour seuls
 * caractères possibles les chiffres, l'espace et la virgule. C'est la lecture la plus fiable d'un montant ; elle sert quand les totaux du relevé ne tombent pas juste.
 */
export async function relireMontantsParColonnes(fichier: File, pages: PdfTextItem[][], options: { onProgression?: (p: ProgressionOcr) => void } = {}): Promise<PdfTextItem[][]> {
  const colonnes = colonnesMontants(pages);
  if (!colonnes) return pages;
  const [pdfjs, worker, tesseract] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url"), import("tesseract.js")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise;
  const lecteur = await tesseract.createWorker("fra", 1, ADRESSES());
  const resultat = pages.map((items) => [...items]);
  try {
    await lecteur.setParameters({ tessedit_pageseg_mode: "6" as never, tessedit_char_whitelist: "0123456789, " });
    for (let n = 1; n <= doc.numPages && n <= pages.length; n++) {
      options.onProgression?.({ page: n, pages: doc.numPages });
      const items = pages[n - 1];
      const entetes = items.filter((i) => /^(d[ée]bit|cr[ée]dit)$/i.test(i.str.trim()));
      const dates = items.filter((i) => /^\d{2}[-/.]\d{2}[-/.]\d{4}$/.test(i.str.trim()));
      if (!dates.length) continue;
      const page = await doc.getPage(n);
      const vue = page.getViewport({ scale: ECHELLE_OCR });
      const hauteurPage = vue.height / ECHELLE_OCR;
      const canevas = document.createElement("canvas");
      canevas.width = Math.ceil(vue.width);
      canevas.height = Math.ceil(vue.height);
      const contexte = canevas.getContext("2d");
      if (!contexte) continue;
      await page.render({ canvasContext: contexte, viewport: vue }).promise;
      const image = contexte.getImageData(0, 0, canevas.width, canevas.height);
      preparerPourOcr(image.data, canevas.width, canevas.height);
      contexte.putImageData(image, 0, 0);
      // Du bas de l'en-tête à la dernière opération de la page : ni le pied de page ni l'en-tête ne sont lus.
      const haut = entetes.length ? Math.max(...entetes.map((i) => i.y)) : Math.max(...dates.map((i) => i.y)) + 40;
      const derniere = dates.reduce((m, i) => (i.y < m.y ? i : m), dates[0]);
      const y0 = Math.max(0, Math.round((hauteurPage - haut) * ECHELLE_OCR + 4));
      const y1 = Math.min(canevas.height, Math.round((hauteurPage - (derniere.y - derniere.h * 2.2)) * ECHELLE_OCR));
      if (y1 - y0 < 20) continue;
      for (const centre of [colonnes.debit, colonnes.credit]) {
        const x0 = Math.max(0, Math.round((centre - colonnes.demi * 0.95) * ECHELLE_OCR));
        const x1 = Math.min(canevas.width, Math.round((centre + colonnes.demi * 0.95) * ECHELLE_OCR));
        const bande = document.createElement("canvas");
        bande.width = x1 - x0;
        bande.height = y1 - y0;
        bande.getContext("2d")?.drawImage(canevas, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
        const { data } = await lecteur.recognize(bande, {}, { blocks: true });
        const relus: PdfTextItem[] = lignesDeResultat(data).flatMap((ligne) => {
          const mots = ligne.filter((m) => m.text.trim());
          if (!mots.length) return [];
          const bx0 = Math.min(...mots.map((m) => m.bbox.x0));
          const bx1 = Math.max(...mots.map((m) => m.bbox.x1));
          const by0 = Math.min(...mots.map((m) => m.bbox.y0));
          const by1 = Math.max(...mots.map((m) => m.bbox.y1));
          return [{ str: mots.map((m) => m.text.trim()).join(" "), x: (x0 + bx0) / ECHELLE_OCR, y: hauteurPage - (y0 + by1) / ECHELLE_OCR, w: (bx1 - bx0) / ECHELLE_OCR, h: (by1 - by0) / ECHELLE_OCR }];
        });
        resultat[n - 1] = fusionnerMontantsRelus(resultat[n - 1], relus, { x0: x0 / ECHELLE_OCR, x1: x1 / ECHELLE_OCR });
        bande.width = 0;
        bande.height = 0;
      }
      canevas.width = 0;
      canevas.height = 0;
    }
  } finally {
    await lecteur.terminate();
    await doc.destroy();
  }
  return resultat;
}
