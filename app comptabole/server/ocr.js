import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeAvailable, claudeExtractPage, champsByTypeFromClaude } from "./claudeExtract.js";
import {
  RuspinaReviewRequired,
  ruspinaApplies,
  ruspinaChampsPourType,
  ruspinaProcess,
  ruspinaVersPages,
} from "./ruspinaOcr.js";

/**
 * Extraction des pièces du module Gestion de stock (facture d'achat, facture
 * de vente, déclaration douanière). Trois moteurs, dans cet ordre :
 *
 *  1. le moteur RUSPINA (conteneur dédié, voir ruspinaOcr.js) pour les
 *     sociétés qu'il couvre ;
 *  2. Claude (API Anthropic, vision) si ANTHROPIC_API_KEY est configurée ;
 *  3. rien d'autre : sans moteur disponible, l'extraction échoue avec un
 *     message clair (`ExtractionUnavailableError`) au lieu de produire une
 *     lecture approximative. Il n'y a plus d'OCR ni de règles locales.
 *
 * Le résultat est toujours proposé à l'utilisateur pour confirmation avant
 * d'être appliqué (voir StockMouvementFormSheet).
 */

/** Aucun moteur d'extraction n'a pu lire le document. */
export class ExtractionUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExtractionUnavailableError";
    this.code = "EXTRACTION_UNAVAILABLE";
  }
}

const AUCUN_MOTEUR =
  "Aucun moteur d'extraction n'est configuré pour cette société. Renseignez la clé ANTHROPIC_API_KEY (ou activez le moteur RUSPINA), ou saisissez la pièce à la main.";

const execFileAsync = promisify(execFile);
const MAX_PAGES = 15;

function aiAvailable() {
  return claudeAvailable();
}

async function aiExtractPage(params) {
  try {
    return await claudeExtractPage(params);
  } catch (err) {
    console.error(`[ocr] Claude en échec : ${err.message}`);
    throw err;
  }
}

/** Log explicite du fournisseur réellement utilisé : sans lui, une clé absente
 * ou un appel en échec seraient indiscernables d'un import réussi. */
function logProvider() {
  console.log(aiAvailable() ? "[ocr] extraction via Claude" : "[ocr] aucun modèle de vision configuré");
}

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("Fichier invalide");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

const estPdf = (mime) => mime === "application/pdf";
const estPriseEnCharge = (mime) => estPdf(mime) || mime.startsWith("image/");

// ── Lecture des fichiers (aucun OCR : texte numérique d'un PDF et rendu image) ──

/** Texte par page d'un PDF numérique (pas de rendu image nécessaire). */
export async function tryPdfTextPages(buffer) {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const pages = [];
    await pdfParse(buffer, {
      max: MAX_PAGES,
      pagerender: async (pageData) => {
        const content = await pageData.getTextContent();
        const texte = content.items.map((it) => it.str).join(" ");
        pages.push(texte);
        return texte;
      },
    });
    return pages;
  } catch (err) {
    console.error("[ocr] lecture du texte du PDF impossible", err.message);
    return [];
  }
}

/** Rastérise chaque page du PDF (poppler) en PNG, jusqu'à MAX_PAGES. */
export async function rasterizeAllPages(buffer) {
  const dir = await mkdtemp(join(tmpdir(), "stock-pages-"));
  try {
    const pdfPath = join(dir, "doc.pdf");
    await writeFile(pdfPath, buffer);
    await execFileAsync("pdftoppm", [
      "-png", "-r", "200", "-f", "1", "-l", String(MAX_PAGES),
      pdfPath, join(dir, "page"),
    ]);
    const files = (await readdir(dir))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();
    const pages = [];
    for (let i = 0; i < files.length; i++) {
      pages.push({ index: i, png: await readFile(join(dir, files[i])) });
    }
    return pages;
  } catch (err) {
    console.error("[ocr] rasterisation PDF impossible", err.message);
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Rastérise UNE page à une résolution donnée (repasse haute résolution d'une
 * déclaration douanière dont le numéro n'a pas été lu à 200 DPI). */
async function rasterizeOnePage(buffer, pageNum, dpi) {
  const dir = await mkdtemp(join(tmpdir(), "stock-hi-"));
  try {
    const pdfPath = join(dir, "doc.pdf");
    await writeFile(pdfPath, buffer);
    await execFileAsync("pdftoppm", [
      "-png", "-r", String(dpi), "-f", String(pageNum), "-l", String(pageNum),
      pdfPath, join(dir, "page"),
    ]);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".png"));
    if (!files.length) return null;
    return await readFile(join(dir, files[0]));
  } catch (err) {
    console.error("[ocr] rastérisation haute résolution impossible", err.message);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Sépare un PDF de `nombre` pages en PDF d'une page (poppler `pdfseparate`), dans l'ordre. */
async function separerPages(buffer, nombre) {
  const dir = await mkdtemp(join(tmpdir(), "stock-split-"));
  try {
    const pdfPath = join(dir, "doc.pdf");
    await writeFile(pdfPath, buffer);
    await execFileAsync("pdfseparate", ["-f", "1", "-l", String(Math.min(nombre, MAX_PAGES)), pdfPath, join(dir, "p-%d.pdf")]);
    const files = (await readdir(dir))
      .filter((f) => /^p-\d+\.pdf$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const pages = [];
    for (const f of files) pages.push(await readFile(join(dir, f)));
    return pages;
  } catch (err) {
    console.error("[ocr] séparation des pages impossible", err.message);
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const toPngUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;

// ── Pièce seule ───────────────────────────────────────────────────────────

/** Fusionne les lectures des pages d'une même pièce : en-tête = première valeur
 * lue, lignes de produits = celles de toutes les pages. */
function fusionner(lectures) {
  const premier = (champ) => lectures.map((l) => l[champ]).find((v) => v) ?? null;
  return {
    type: lectures[0].type,
    confidence: lectures[0].confidence,
    date: premier("date"),
    numFacture: premier("numFacture"),
    partie: premier("partie"),
    devise: premier("devise"),
    numDeclaration: premier("numDeclaration"),
    regime: premier("regime"),
    tauxChange: premier("tauxChange"),
    valeurTnd: premier("valeurTnd"),
    ptfn: premier("ptfn"),
    exportateur: premier("exportateur"),
    importateur: premier("importateur"),
    lignes: lectures.flatMap((l) => l.lignes ?? []),
  };
}

/**
 * Import d'une seule pièce (« facture d'achat », « facture de vente » ou
 * « déclaration douanière ») : toutes les pages du fichier appartiennent au
 * même document.
 */
export async function extractDocument(dataUrl, type, raisonSociale) {
  const { buffer, mime } = decodeDataUrl(dataUrl);
  if (!estPriseEnCharge(mime)) {
    throw new Error("Type de fichier non pris en charge (PDF ou image attendu)");
  }

  if (ruspinaApplies(raisonSociale)) {
    try {
      const data = await ruspinaProcess(buffer, mime);
      const champs = ruspinaChampsPourType(data, type);
      if (champs) return { source: "ruspina", texte: "", champs };
      console.error(`[ocr] moteur RUSPINA : aucun groupe « ${type} » reconnu`);
    } catch (err) {
      logRuspinaEchec(err);
    }
  }

  if (!aiAvailable()) throw new ExtractionUnavailableError(AUCUN_MOTEUR);
  logProvider();

  let lectures;
  if (mime.startsWith("image/")) {
    lectures = [await aiExtractPage({ imageDataUrl: dataUrl, raisonSociale })];
  } else {
    const textPages = await tryPdfTextPages(buffer);
    if (textPages.some((t) => t.trim().length > 20)) {
      lectures = await Promise.all(
        textPages.filter((t) => t.trim().length >= 20).map((texte) => aiExtractPage({ texte, raisonSociale })),
      );
    } else {
      lectures = await Promise.all(
        (await rasterizeAllPages(buffer)).map(({ png }) => aiExtractPage({ imageDataUrl: toPngUrl(png), raisonSociale })),
      );
    }
  }
  if (lectures.length === 0) throw new Error("Aucune page lisible dans ce document");

  const champs = champsByTypeFromClaude(fusionner(lectures))[type];
  return { source: "ia", texte: "", champs };
}

// ── Document complet (plusieurs pièces) ───────────────────────────────────

function logRuspinaEchec(err) {
  if (err instanceof RuspinaReviewRequired) {
    console.error("[ocr] moteur RUSPINA : revue de routage demandée");
  } else {
    console.error(`[ocr] moteur RUSPINA indisponible : ${err.message}`);
  }
}

/**
 * Associe aux groupes du moteur RUSPINA l'image de la page physique
 * correspondante (aperçu et pièce jointe du mouvement). Le service répond par
 * groupe (producteur / RUSPINA / douane) sans numéro de page, et ignore
 * l'ordre des pages. On le requiert donc page par page : chaque page est
 * renvoyée seule au service (ses pages déjà lues sont en cache, la réponse est
 * rapide) et le groupe qu'il remplit dit de quelle pièce il s'agit.
 */
async function imagesPourPagesRuspina(preparation, buffer, mime, dataUrl, pages, data) {
  if (mime.startsWith("image/")) {
    return pages.length === 1 ? [dataUrl] : pages.map(() => null);
  }
  const rastered = await preparation;
  if (rastered.length === 0) return pages.map(() => null);

  // Rang (dans `pages`) de chaque groupe présent dans la réponse complète.
  const groupes = ["page1", "page2", "page3"].filter((g) => data[g]);
  const rangDuGroupe = new Map(groupes.map((g, rang) => [g, rang]));

  const parRang = new Map();
  const unePage = rastered.length > 1 ? await separerPages(buffer, rastered.length) : [];
  for (let physique = 0; physique < unePage.length && physique < rastered.length; physique++) {
    try {
      const seule = await ruspinaProcess(unePage[physique], "application/pdf");
      const remplis = groupes.filter((g) => seule[g]);
      if (remplis.length === 1 && !parRang.has(rangDuGroupe.get(remplis[0]))) {
        parRang.set(rangDuGroupe.get(remplis[0]), physique);
      }
    } catch (err) {
      console.error(`[ocr] page ${physique + 1} non identifiée seule : ${err.message}`);
    }
  }
  // Par élimination : un seul groupe et une seule page restent -> ils vont ensemble.
  const utilisees = new Set(parRang.values());
  const rangsRestants = pages.map((_, rang) => rang).filter((rang) => !parRang.has(rang));
  const pagesRestantes = rastered.map((_, physique) => physique).filter((physique) => !utilisees.has(physique));
  if (parRang.size > 0 && rangsRestants.length === 1 && pagesRestantes.length === 1) {
    parRang.set(rangsRestants[0], pagesRestantes[0]);
  }
  // Un PDF d'une seule page ne contient qu'une pièce : pas d'ambiguïté.
  if (rastered.length === 1 && pages.length === 1) parRang.set(0, 0);

  return pages.map((_, rang) => {
    const physique = parRang.get(rang);
    return physique === undefined ? null : toPngUrl(rastered[physique].png);
  });
}

async function extractPagesRuspina(buffer, mime, dataUrl) {
  // Rendu des pages pendant que le moteur lit le dossier.
  const preparation = estPdf(mime)
    ? rasterizeAllPages(buffer).catch(() => [])
    : Promise.resolve([]);
  const data = await ruspinaProcess(buffer, mime);
  const pages = ruspinaVersPages(data);
  if (pages.length === 0) throw new Error("aucun groupe de pages reconnu");
  const images = await imagesPourPagesRuspina(preparation, buffer, mime, dataUrl, pages, data);
  return pages.map((page, index) => ({ ...page, index, imageDataUrl: images[index] }));
}

const lectureVide = () => ({
  type: null,
  confidence: "faible",
  date: null,
  numFacture: null,
  partie: null,
  lignes: [],
  devise: null,
  numDeclaration: null,
  regime: null,
  tauxChange: null,
  valeurTnd: null,
  ptfn: null,
  exportateur: null,
  importateur: null,
});

/** Page lue par un modèle de vision, au format attendu par l'écran. */
function pageIA(index, imageDataUrl, lecture) {
  return {
    index,
    imageDataUrl,
    champsByType: champsByTypeFromClaude(lecture),
    type: lecture.type,
    confidence: lecture.confidence,
  };
}

/**
 * Import « document complet » : un fichier regroupant plusieurs pièces (ex.
 * facture d'achat + facture de vente + déclaration douanière scannées
 * ensemble). Chaque page est lue séparément (jamais concaténée, sinon les
 * champs des différentes pièces se mélangent) et son type est déterminé.
 */
export async function extractPages(dataUrl, raisonSociale) {
  const { buffer, mime } = decodeDataUrl(dataUrl);
  if (!estPriseEnCharge(mime)) {
    throw new Error("Type de fichier non pris en charge (PDF ou image attendu)");
  }

  if (ruspinaApplies(raisonSociale)) {
    try {
      return await extractPagesRuspina(buffer, mime, dataUrl);
    } catch (err) {
      logRuspinaEchec(err);
    }
  }

  if (!aiAvailable()) throw new ExtractionUnavailableError(AUCUN_MOTEUR);
  logProvider();

  if (mime.startsWith("image/")) {
    const lecture = await aiExtractPage({ imageDataUrl: dataUrl, raisonSociale });
    return [pageIA(0, dataUrl, lecture)];
  }

  // Les pages sont lues EN PARALLÈLE (un appel Claude par page) : la durée
  // d'un dossier est celle de la page la plus longue, pas la somme.
  const textPages = await tryPdfTextPages(buffer);
  if (textPages.some((t) => t.trim().length > 20)) {
    return Promise.all(
      textPages.map(async (texte, index) =>
        texte.trim().length < 20
          ? pageIA(index, null, lectureVide())
          : pageIA(index, null, await aiExtractPage({ texte, raisonSociale })),
      ),
    );
  }

  // PDF scanné : une image par page. Une page en échec (quota épuisé, panne…)
  // reste vide à compléter à la main ; les autres gardent leur résultat.
  const rastered = await rasterizeAllPages(buffer);
  if (rastered.length === 0) throw new Error("Aucune page lisible dans ce document");
  let premiereErreur = null;
  const pages = await Promise.all(
    rastered.map(async ({ index, png }) => {
      const imageDataUrl = toPngUrl(png);
      try {
        let lecture = await aiExtractPage({ imageDataUrl, raisonSociale });
        let image = imageDataUrl;
        // Déclaration douanière (grille serrée) dont le numéro n'est pas lu à
        // 200 DPI : une repasse à 400 DPI le retrouve souvent.
        if (lecture.type === "douane" && !lecture.numDeclaration) {
          const hiRes = await rasterizeOnePage(buffer, index + 1, 400);
          if (hiRes) {
            const hiResUrl = toPngUrl(hiRes);
            const retry = await aiExtractPage({ imageDataUrl: hiResUrl, raisonSociale });
            if (retry.numDeclaration) {
              lecture = retry;
              image = hiResUrl;
            }
          }
        }
        return pageIA(index, image, lecture);
      } catch (err) {
        premiereErreur ??= err;
        console.error(`[ocr] extraction en échec (page ${index + 1}) :`, err.message);
        return pageIA(index, imageDataUrl, lectureVide());
      }
    }),
  );
  // Aucune page lue : on le dit plutôt que d'afficher des pages vides.
  if (premiereErreur && pages.every((p) => !p.type)) throw premiereErreur;
  return pages;
}
