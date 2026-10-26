import type { PdfTextItem } from "@/lib/pdfToTables";

/** Mot reconnu par l'OCR : position en pixels de l'image de la page (origine en haut à gauche). */
export interface MotOcr {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Sous ce niveau de confiance (0 à 100), un mot est presque toujours du bruit (tache, trait, ombre) : il est écarté. */
export const CONFIANCE_MINIMALE = 30;
/** Résolution de lecture : 2,5 pixels par point du PDF (≈ 180 ppp), un bon compromis entre précision et durée. */
export const ECHELLE_OCR = 2.5;

/** Mots de l'OCR → morceaux de texte positionnés comme ceux d'un PDF (points, origine en bas à gauche) : tout le reste de la conversion s'applique tel quel. */
export function motsVersItems(mots: MotOcr[], echelle: number, hauteurPage: number): PdfTextItem[] {
  return mots
    .filter((mot) => mot.text.trim().length > 0 && mot.confidence >= CONFIANCE_MINIMALE)
    .map((mot) => ({
      str: mot.text.trim(),
      x: mot.bbox.x0 / echelle,
      y: hauteurPage - mot.bbox.y1 / echelle,
      w: (mot.bbox.x1 - mot.bbox.x0) / echelle,
      h: (mot.bbox.y1 - mot.bbox.y0) / echelle,
    }));
}

/** Mots d'un résultat de reconnaissance, qu'ils soient à plat (`words`) ou imbriqués (blocs > paragraphes > lignes > mots). */
export function motsDeResultat(data: unknown): MotOcr[] {
  const resultat = data as { words?: MotOcr[]; blocks?: { paragraphs?: { lines?: { words?: MotOcr[] }[] }[] }[] | null };
  if (Array.isArray(resultat?.words) && resultat.words.length) return resultat.words;
  const mots: MotOcr[] = [];
  for (const bloc of resultat?.blocks ?? []) for (const paragraphe of bloc.paragraphs ?? []) for (const ligne of paragraphe.lines ?? []) mots.push(...(ligne.words ?? []));
  return mots;
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

/** Lit un PDF scanné par reconnaissance de caractères, dans le navigateur : chaque page est dessinée puis lue ; le résultat a la forme d'un PDF avec texte. */
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
      const { data } = await lecteur.recognize(canevas, {}, { blocks: true });
      pages.push(motsVersItems(motsDeResultat(data), ECHELLE_OCR, vue.height / ECHELLE_OCR));
      canevas.width = 0;
      canevas.height = 0;
    }
  } finally {
    await lecteur.terminate();
    await doc.destroy();
  }
  return pages;
}
