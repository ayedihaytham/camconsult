import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeAvailable, claudeExtractPage, champsByTypeFromClaude, champsByTypeVide } from "./claudeExtract.js";
import { openrouterAvailable, openrouterExtractPage } from "./openrouterExtract.js";

/** Fournisseur d'extraction IA (image/texte -> champs) : OpenRouter (Gemini
 * 2.5 Flash) en priorité si configuré, sinon Claude, sinon aucun (repli sur
 * l'OCR local + heuristiques regex plus bas dans ce fichier). Un seul point
 * de choix pour les 4 emplacements de `extractPages` qui appelaient jusque-là
 * `claudeExtractPage` directement — même schéma de sortie des deux côtés
 * (voir openrouterExtract.js), donc `champsByTypeFromClaude`/`champsByTypeVide`
 * restent valables quel que soit le fournisseur retenu. */
function aiAvailable() {
  return openrouterAvailable() || claudeAvailable();
}
async function aiExtractPage(params) {
  if (openrouterAvailable()) return openrouterExtractPage(params);
  return claudeExtractPage(params);
}

/** Log explicite du fournisseur réellement utilisé — sans ça, un import qui
 * retombe silencieusement sur l'OCR local (ex. clé API absente ou appel en
 * échec) est indiscernable d'un import correctement traité par un modèle
 * IA, ce qui a rendu un vrai problème de configuration difficile à
 * diagnostiquer en usage réel. */
function logProvider() {
  if (openrouterAvailable()) console.log("[ocr] extraction via OpenRouter (Gemini 2.5 Flash)");
  else if (claudeAvailable()) console.log("[ocr] extraction via Claude (OPENROUTER_API_KEY absente)");
  else console.log("[ocr] extraction via OCR local + heuristiques (aucune clé IA configurée)");
}

const execFileAsync = promisify(execFile);

const MAX_PAGES = 15;

/**
 * Extraction locale et gratuite (aucune API externe) :
 *  1. Si le PDF contient du texte (généré numériquement) -> lecture directe (pdf-parse).
 *  2. Sinon (PDF/image scanné) -> rasterisation (poppler) + OCR (tesseract.js).
 * Puis extraction de champs par heuristiques (regex) selon le type de document.
 *
 * `extractPages` (import "document complet", ci-dessous) bascule sur un
 * fournisseur IA (OpenRouter/Gemini 2.5 Flash en priorité, sinon Claude)
 * quand une clé est configurée — voir `aiAvailable`/`aiExtractPage` plus
 * haut. Ce pipeline local (`extractDocument`, import "une section = un
 * document") reste inchangé et sert aussi de repli si aucune clé n'est
 * configurée.
 *
 * Utilisé par l'import "une section = un document" : toutes les pages du
 * fichier sont supposées appartenir au MÊME document (ex. une facture de
 * 2 pages) — leur texte est donc concaténé avant analyse. Pour un PDF
 * combinant plusieurs documents distincts (achat + vente + douane), voir
 * `extractPages` ci-dessous, qui traite chaque page séparément.
 */
export async function extractDocument(dataUrl, type) {
  const { buffer, mime } = decodeDataUrl(dataUrl);

  let texte = "";
  let source = "texte";
  let lines = [];

  if (mime === "application/pdf") {
    const pages = await tryPdfTextPages(buffer);
    texte = pages.join("\n");
    if (texte.trim().length < 30) {
      source = "ocr";
      const rastered = await rasterizeAllPages(buffer);
      for (const { png } of rastered) {
        const r = await ocrImage(png);
        texte += "\n" + r.text;
        lines = lines.concat(r.lines);
      }
    }
  } else if (mime.startsWith("image/")) {
    source = "ocr";
    const r = await ocrImage(buffer);
    texte = r.text;
    lines = r.lines;
  } else {
    throw new Error("Type de fichier non pris en charge (PDF ou image attendu)");
  }

  return { source, texte, champs: parseFields(texte, type, lines) };
}

/**
 * Un PDF combiné (ex. facture d'achat + facture de vente + déclaration
 * douanière scannées ensemble) : chaque page est OCRisée séparément (jamais
 * concaténée, sinon les champs des différents documents se mélangent), puis
 * son type (achat/vente/douane) est deviné à partir du contenu — voir
 * `guessDocType`. Résultat toujours proposé à l'utilisateur pour
 * confirmation/correction avant application (voir StockMouvementFormSheet).
 */
// Champs calculés à l'avance pour les 3 types possibles (achat/vente
// utilisent la même extraction de tableau, seul le libellé
// fournisseur/client change) — évite un aller-retour serveur quand
// l'utilisateur corrige le type deviné à l'écran (voir StockMouvementFormSheet).
function champsPourTousLesTypes(texte, lines) {
  return {
    achat: parseFields(texte, "achat", lines),
    vente: parseFields(texte, "vente", lines),
    douane: parseFields(texte, "douane", lines),
  };
}

export async function extractPages(dataUrl, raisonSociale) {
  const { buffer, mime } = decodeDataUrl(dataUrl);
  const useAI = aiAvailable();
  logProvider();

  if (mime.startsWith("image/")) {
    if (useAI) {
      const out = await aiExtractPage({ imageDataUrl: dataUrl, raisonSociale });
      return [
        {
          index: 0,
          imageDataUrl: dataUrl,
          champsByType: champsByTypeFromClaude(out),
          type: out.type,
          confidence: out.confidence,
        },
      ];
    }
    const { text: texte, lines } = await ocrImage(buffer);
    return [
      {
        index: 0,
        imageDataUrl: dataUrl,
        texte,
        champsByType: champsPourTousLesTypes(texte, lines),
        ...guessDocType(texte, raisonSociale),
      },
    ];
  }
  if (mime !== "application/pdf") {
    throw new Error("Type de fichier non pris en charge (PDF ou image attendu)");
  }

  const textPages = await tryPdfTextPages(buffer);
  const hasText = textPages.some((t) => t.trim().length > 20);
  if (hasText) {
    if (useAI) {
      const pages = [];
      for (let index = 0; index < textPages.length; index++) {
        const texte = textPages[index];
        if (texte.trim().length < 20) {
          pages.push({ index, imageDataUrl: null, champsByType: champsByTypeVide(), type: null, confidence: "faible" });
          continue;
        }
        const out = await aiExtractPage({ texte, raisonSociale });
        pages.push({ index, imageDataUrl: null, champsByType: champsByTypeFromClaude(out), type: out.type, confidence: out.confidence });
      }
      return pages;
    }
    return textPages.map((texte, index) => ({
      index,
      imageDataUrl: null,
      texte,
      champsByType: champsPourTousLesTypes(texte, []),
      ...guessDocType(texte, raisonSociale),
    }));
  }

  // PDF scanné : rasterise chaque page, puis un fournisseur IA (si une clé
  // API est configurée) ou OCR local (tesseract + heuristiques) en repli.
  const rastered = await rasterizeAllPages(buffer);
  const pages = [];
  for (const { index, png } of rastered) {
    const imageDataUrl = `data:image/png;base64,${png.toString("base64")}`;

    if (useAI) {
      let out = await aiExtractPage({ imageDataUrl, raisonSociale });
      let finalImage = imageDataUrl;
      // Même repasse haute résolution que l'ancien pipeline local pour la
      // page douane (grille serrée) — un fournisseur IA lit bien mieux
      // l'image que tesseract, mais une repasse à 400 DPI reste utile quand
      // le numéro de déclaration n'est toujours pas lisible à 200 DPI.
      if (out.type === "douane" && !out.numDeclaration) {
        const hiRes = await rasterizeOnePage(buffer, index + 1, 400);
        if (hiRes) {
          const hiResDataUrl = `data:image/png;base64,${hiRes.toString("base64")}`;
          const retry = await aiExtractPage({ imageDataUrl: hiResDataUrl, raisonSociale });
          if (retry.numDeclaration) {
            out = retry;
            finalImage = hiResDataUrl;
          }
        }
      }
      pages.push({
        index,
        imageDataUrl: finalImage,
        champsByType: champsByTypeFromClaude(out),
        type: out.type,
        confidence: out.confidence,
      });
      continue;
    }

    let imagePng = png;
    let { text: texte, lines } = await ocrImage(png);
    let guess = guessDocType(texte, raisonSociale);

    // Une déclaration douanière (grille serrée, bilingue) peut avoir son
    // n° de déclaration / sa date totalement absents du texte à 200 DPI —
    // vérifié en usage réel, pas une hypothèse — alors qu'ils sont
    // parfaitement lisibles à l'œil sur le scan. On retente une fois à
    // 400 DPI, seulement pour ce cas précis, pour ne pas ralentir les
    // factures normales qui, elles, passent très bien à résolution standard.
    if (guess.type === "douane") {
      const essai = parseFields(texte, "douane", lines);
      // numDeclaration est le signal fiable : une date "trouvée" ne veut
      // rien dire ici — le motif de repli est si permissif (n'importe quel
      // dd/mm/yyyy dans tout le texte) qu'il matche presque toujours
      // quelque chose, même complètement erroné (vérifié en usage réel :
      // "2083-01-02" au lieu de "2023-01-02"). Ne jamais s'y fier pour
      // décider si la repasse est utile.
      if (!essai.numDeclaration) {
        const hiRes = await rasterizeOnePage(buffer, index + 1, 400);
        if (hiRes) {
          const retry = await ocrImage(hiRes);
          if (retry.text.trim().length > texte.trim().length * 0.5) {
            imagePng = hiRes;
            texte = retry.text;
            lines = retry.lines;
            guess = guessDocType(texte, raisonSociale);
          }
        }
      }
    }

    pages.push({
      index,
      imageDataUrl: `data:image/png;base64,${imagePng.toString("base64")}`,
      texte,
      champsByType: champsPourTousLesTypes(texte, lines),
      ...guess,
    });
  }
  return pages;
}

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("Fichier invalide");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

/** Texte par page d'un PDF numérique (pas de rendu image nécessaire). */
async function tryPdfTextPages(buffer) {
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
    console.error("[ocr] pdf-parse a échoué", err.message);
    return [];
  }
}

/** Rasterise chaque page du PDF (poppler) en PNG, jusqu'à MAX_PAGES.
 * Testé à 300 DPI en usage réel : aucun gain sur les tableaux à police
 * fine (toujours illisibles), et une régression ailleurs (un mot bien lu à
 * 200 DPI mal lu à 300) — revenu à 200, qui n'est pas le facteur limitant
 * ici (voir parseTableRowByShape pour le vrai correctif). */
async function rasterizeAllPages(buffer) {
  const dir = await mkdtemp(join(tmpdir(), "stock-ocr-"));
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

/** Rastérise UNE page à une résolution donnée — utilisé pour retenter en
 * haute résolution une page où la première passe (200 DPI) n'a rien donné
 * (voir extractPages : cas des déclarations douanières, grille serrée avec
 * de petites cases que l'OCR peut ne pas lire du tout à résolution
 * standard, constaté en usage réel — jamais un simple guess). */
async function rasterizeOnePage(buffer, pageNum, dpi) {
  const dir = await mkdtemp(join(tmpdir(), "stock-ocr-hi-"));
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

let workerPromise = null;
/** Un seul worker Tesseract réutilisé (le charger est coûteux ~1-2 s). */
async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker }) =>
      createWorker("fra+eng"),
    );
  }
  return workerPromise;
}

/**
 * OCR d'une image : renvoie le texte à plat (utilisé pour toutes les
 * étiquettes — date, n° facture, fournisseur/client…) ET les lignes avec la
 * position (bbox) de chaque mot, pour reconstruire les vraies colonnes d'un
 * tableau plutôt que deviner sur l'ordre des nombres dans le texte à plat
 * (voir parseTableRowByPosition) — sans ça, un nombre présent DANS la
 * désignation (ex. « CEM I 42,5 N ») pouvait être confondu avec la quantité.
 */
async function ocrImage(buffer) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    const lines = (data.lines || []).map((l) => ({
      text: l.text || "",
      words: (l.words || []).map((w) => ({
        text: w.text || "",
        x0: w.bbox.x0,
        x1: w.bbox.x1,
      })),
    }));
    return { text: data.text || "", lines };
  } catch (err) {
    console.error("[ocr] tesseract a échoué", err.message);
    return { text: "", lines: [] };
  }
}

// ── Extraction de champs (heuristiques, best effort) ──────────────

function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return (m[1] ?? m[0]).trim();
  }
  return "";
}

function toIsoDate(raw) {
  const m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(raw || "");
  if (!m) return "";
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  d = d.padStart(2, "0");
  mo = mo.padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function toNumber(raw) {
  if (!raw) return "";
  const cleaned = String(raw)
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "") // points = séparateurs de milliers
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : "";
}

const WORD_ONES = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9,
};
const WORD_TEENS = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const WORD_TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** « Fifty-three thousand » -> 53000. Renvoie null au premier mot non
 * reconnu (mieux vaut ne rien extraire qu'extraire un nombre inventé). */
function wordsToNumber(phrase) {
  const words = phrase
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "and");
  if (words.length === 0) return null;
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w in WORD_ONES) current += WORD_ONES[w];
    else if (w in WORD_TEENS) current += WORD_TEENS[w];
    else if (w in WORD_TENS) current += WORD_TENS[w];
    else if (w === "hundred") current = (current || 1) * 100;
    else if (w === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
    } else if (w === "million") {
      total += (current || 1) * 1_000_000;
      current = 0;
    } else return null;
  }
  const result = total + current;
  return result > 0 ? result : null;
}

/** Montant écrit en toutes lettres (anglais) après « Total amount » /
 * « amounts to », jusqu'au mot de devise — courant sur les factures
 * internationales et souvent bien plus lisible pour l'OCR qu'un tableau
 * chiffré dense (voir parseFields). */
const MONTANT_LETTRES_RE =
  /(?:total\s*amount|amounts?\s*to)\s*[:\s]*\s*([a-z][a-z\s-]{3,60}?)\s*(?:eur|euros?|usd|dollars?|tnd|dinars?|gbp|pounds?)\b/i;

// Nombre « à la française » : 1 287,00 / 1287.00 / 189,00 / 3 — espace ou point
// en séparateur de milliers, virgule ou point en décimale.
// Utilisé après une étiquette (« Total TTC : 1 287,00 ») où le nombre est seul sur sa portion de ligne.
const NUM = String.raw`-?\d{1,3}(?:[ .]\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?`;
// Nombre « cellule de tableau » : plusieurs valeurs se suivent séparées par un
// espace (colonnes) -> pas de regroupement par espace, sinon « 3 189,00 » (qté
// « 3 » + PU « 189,00 ») serait lu comme un seul nombre « 3189,00 ».
const NUM_CELL = String.raw`-?\d+(?:[.,]\d+)?`;

const DESC_HEADER_RE = /d[ée]signation|d[ei]s?cription|article|produit/i;
const QTY_HEADER_RE = /qu?an?tit[ée]|qty|quantity/i;
const PRICE_HEADER_RE = /prix|price|p\.?u\.?\b/i;
const TOTAL_HEADER_RE = /total|montant/i;

/**
 * Facture en tableau, PAR POSITION RÉELLE des mots (bbox OCR) plutôt qu'en
 * devinant sur l'ordre des nombres dans le texte à plat : repère la ligne
 * d'en-tête, la position (x) du mot qui porte chaque étiquette de colonne
 * (désignation/quantité/prix/total), puis range chaque mot d'une ligne de
 * donnée dans la colonne dont il est le plus proche. Un nombre présent DANS
 * la désignation (ex. « CEM I 42,5 N », un HS code, une taille de sac) ne
 * peut plus être confondu avec la quantité ou le prix : il tombe dans la
 * colonne désignation, pas dans une colonne numérique, parce que sa
 * position x l'y place réellement sur le document.
 * `lines` vient de l'OCR (voir ocrImage) ; absent pour un PDF texte natif
 * (pas de bbox) — on retombe alors sur `parseTableRow` (texte à plat).
 */
function parseTableRowByPosition(lines) {
  if (!lines || lines.length === 0) return null;
  const headerIdx = lines.findIndex(
    (l) => DESC_HEADER_RE.test(l.text) && QTY_HEADER_RE.test(l.text),
  );
  if (headerIdx === -1) return null;

  const headerWords = lines[headerIdx].words;
  const ROLE_PATTERNS = {
    desc: DESC_HEADER_RE,
    qty: QTY_HEADER_RE,
    price: PRICE_HEADER_RE,
    total: TOTAL_HEADER_RE,
  };
  const anchors = [];
  for (const [role, re] of Object.entries(ROLE_PATTERNS)) {
    const w = headerWords.find((w) => re.test(w.text));
    if (w) anchors.push({ role, x0: w.x0 });
  }
  // Pas assez de colonnes repérées pour que ça vaille le coup (ex. bbox
  // absente) : on laisse la place au filet de sécurité texte-à-plat.
  if (anchors.length < 2) return null;
  anchors.sort((a, b) => a.x0 - b.x0);

  // Borne de chaque colonne = à mi-chemin entre son ancre et celle du
  // voisin — un mot est rangé dans la colonne dont il est le plus proche.
  const bounds = anchors.map((a, i) => ({
    role: a.role,
    from: i === 0 ? -Infinity : (anchors[i - 1].x0 + a.x0) / 2,
    to: i === anchors.length - 1 ? Infinity : (a.x0 + anchors[i + 1].x0) / 2,
  }));
  const columnFor = (x0) => bounds.find((b) => x0 >= b.from && x0 < b.to)?.role ?? null;

  const numRe = new RegExp(NUM_CELL, "g");
  for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 8); i++) {
    const line = lines[i];
    if (/^(total|sous[\s-]?total|tva|remise)\b/i.test(line.text)) break;
    if (!line.words?.length) continue;

    const cells = { desc: [], qty: [], price: [], total: [] };
    for (const w of line.words) {
      const role = columnFor(w.x0);
      if (role) cells[role].push(w.text);
    }
    const nom = cells.desc.join(" ").trim();
    const qtyNum = cells.qty.join(" ").match(numRe)?.[0];
    if (!nom && !qtyNum) continue;
    if (!qtyNum) continue;

    return {
      nom,
      quantite: qtyNum,
      prixUnitaire: cells.price.join(" ").match(numRe)?.[0],
      montant: cells.total.join(" ").match(numRe)?.[0],
    };
  }
  return null;
}

/**
 * Filet de sécurité quand la position des mots n'est pas disponible (PDF
 * texte natif) : repère la ligne d'en-tête puis la première ligne de
 * données qui suit, en devinant sur l'ordre des nombres dans le texte à
 * plat. Reconnaît les en-têtes anglais et « discription », faute assez
 * répandue sur ce type de document. L'ordre des colonnes n'est pas
 * toujours désignation-en-premier : une facture d'export type
 * « Quantity | Unit | Designation | Unit Price » met la quantité avant —
 * déduit de la ligne d'en-tête elle-même plutôt que supposé fixe.
 */
function parseTableRow(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const headerIdx = lines.findIndex(
    (l) => DESC_HEADER_RE.test(l) && QTY_HEADER_RE.test(l),
  );
  if (headerIdx === -1) return null;

  const header = lines[headerIdx];
  const qtyFirst = header.search(QTY_HEADER_RE) < header.search(DESC_HEADER_RE);

  const numRe = new RegExp(NUM_CELL, "g");
  for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 8); i++) {
    const line = lines[i];
    if (/^(total|sous[\s-]?total|tva|remise)\b/i.test(line)) break;
    const nums = [...line.matchAll(numRe)];
    if (nums.length < 2) continue;

    if (qtyFirst) {
      // La ligne démarre directement par la quantité (pas de texte avant) :
      // désignation = ce qui reste entre la quantité et les 2 derniers
      // nombres (prix unitaire / total), une fois les nombres retirés.
      if (line.search(/-?\d/) !== 0) continue;
      const tailStart = nums.length >= 3 ? nums[nums.length - 2].index : nums[0].index + nums[0][0].length;
      const nom = line
        .slice(nums[0].index + nums[0][0].length, tailStart)
        .replace(numRe, "")
        .replace(/[€$]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return {
        nom,
        quantite: nums[0][0],
        prixUnitaire: nums[nums.length - 2]?.[0] ?? nums[0][0],
        montant: nums[nums.length - 1][0],
      };
    }

    const firstNumAt = line.search(/-?\d/);
    const nom = line.slice(0, firstNumAt).trim().replace(/[\s.:\-]+$/, "");
    if (!nom) continue;
    return {
      nom,
      quantite: nums[0][0],
      prixUnitaire: nums[1][0],
      montant: nums[nums.length - 1][0],
    };
  }
  return null;
}

// Doit démarrer par un nombre (la quantité), finir par 1 ou 2 nombres (prix
// unitaire et/ou total, devise optionnelle) — le texte entre les deux, aussi
// truffé de ses propres nombres soit-il (grade, code HS, taille de sac),
// est pris en bloc comme désignation puisqu'il ne colle pas à lui seul au
// bout de la ligne. Ancré aux deux extrémités : moins de faux positifs
// qu'il n'y paraît (une ligne d'adresse ou d'IBAN ne finit jamais par un
// nombre isolé en bout de ligne).
const SHAPE_ROW_RE =
  /^(-?\d+(?:[.,]\d+)?)\s+([A-Za-z].+?)\s+(-?\d+(?:[.,]\d+)?)(?:\s*[€$]?\s*(-?\d+(?:[.,]\d+)?))?\s*[€$]?$/;

/**
 * Dernier recours quand aucun en-tête de tableau n'est reconnaissable — cas
 * constaté en usage réel : l'OCR peut rendre un en-tête de tableau (police
 * fine, bordures serrées) totalement illisible alors que la ligne de
 * donnée juste en dessous reste, elle, largement lisible. Plutôt que de
 * renoncer faute d'en-tête pour s'ancrer, on cherche directement dans tout
 * le document une ligne qui a la FORME d'une ligne de produit.
 */
function parseTableRowByShape(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (/^(total|sous[\s-]?total|tva|remise)\b/i.test(line)) continue;
    const m = SHAPE_ROW_RE.exec(line);
    if (!m) continue;
    const [, qty, nom, num3, num4] = m;
    return {
      nom: nom.trim(),
      quantite: qty,
      prixUnitaire: num4 !== undefined ? num3 : "",
      montant: num4 !== undefined ? num4 : num3,
    };
  }
  return null;
}

const NAME_STOPWORDS =
  /^(adresse|siret|siren|tva|t[ée]l[ée]?phone|e?-?mail|facture|devis|date|[ée]mise?|[ée]mis|montant|total|d[ûu]|devise|quantit[ée]|d[ée]signation|description|payable|factur(?:er|é|e)|vendu|swift|bic|iban|banque|compte|r[ée]f[ée]rence|num[ée]ro|www\.|https?:)/i;

/**
 * Cherche une ligne qui EST l'étiquette elle-même (ex. « Facturer à : » seule
 * sur sa ligne, le nom étant sur la ligne suivante — mise en page courante
 * des factures « en blocs » type Canva). Renvoie la 1re ligne suivante qui
 * ressemble à une valeur (pas vide, pas une autre étiquette technique).
 */
function valueAfterLabelLine(text, labelRe) {
  const lines = text.split("\n").map((l) => l.trim());
  const idx = lines.findIndex((l) => labelRe.test(l));
  if (idx === -1) return "";
  for (let i = idx + 1; i < Math.min(lines.length, idx + 4); i++) {
    const l = lines[i];
    if (!l) continue;
    if (NAME_STOPWORDS.test(l)) continue;
    return l;
  }
  return "";
}

/**
 * Dernier recours pour deviner un nom d'entreprise (fournisseur/client) quand
 * aucune étiquette explicite n'existe dans le document : prend la première
 * ligne « qui ressemble à un nom » en excluant les lignes déjà attribuées
 * (ex. le bloc « Destinataire ») et les lignes techniques (adresse, SIRET…).
 */
function guessCompanyName(text, exclude = []) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);
  for (const l of lines) {
    if (l.length < 2 || l.length > 60) continue;
    if (NAME_STOPWORDS.test(l)) continue;
    if (/^destinataire$|^client$|^fournisseur$/i.test(l)) continue;
    if (/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(l)) continue; // ligne de date, pas un nom
    if (exclude.some((ex) => ex && l.toLowerCase() === ex.toLowerCase())) continue;
    if (!/[a-zàâäéèêëïîôöùûüç]/i.test(l)) continue; // au moins une lettre
    return l;
  }
  return "";
}

// ── Devine le type d'une page (achat / vente / douane) ────────────

function normalizeFlat(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const DOUANE_KEYWORDS = [
  "DECLARATION EN DETAIL",
  "EXPORTATEUR",
  "IMPORTATEUR",
  "DECLARANT",
  "BUREAU DE DOUANE",
  "REGIME DOUANIER",
  "TRADENET",
  "DOUANES",
  "D A E",
];

const CLIENT_LABELS = /CLIENT|DESTINATAIRE|FACTURE A|FACTURER A|CONSIGNEE|VENDU A/;
const INVOICE_NUM_LABEL = /INVOICE N|FACTURE N|N FACTURE|N INVOICE/;

/**
 * Best-effort, jamais appliqué sans confirmation côté écran : repère
 * d'abord un formulaire douanier (vocabulaire très spécifique, fiable), puis
 * — pour une facture — situe le nom de la société du cabinet dans le texte
 * par rapport à deux repères structurels d'une facture :
 *  1. Une étiquette « Client »/« Destinataire » juste avant le nom => la
 *     société achète (achat) — signal le plus fiable.
 *  2. Sinon, position par rapport au numéro de facture (repère quasi
 *     universel) : le nom AVANT ce numéro => bloc émetteur => vente ; le nom
 *     APRÈS => bloc destinataire => achat. Plus fiable qu'un simple compte
 *     de lignes, la longueur de l'en-tête variant énormément d'un document
 *     à l'autre.
 * Confiance renvoyée pour que l'écran mette en avant les cas incertains.
 */
/** Vrai si `word` apparaît comme MOT entier dans `flatText` (déjà normalisé,
 * espaces = séparateurs) — jamais une simple sous-chaîne. Sans ça, une
 * société courte comme « CAM » « matchait » à tort dans « CAMSCANNER »
 * (le filigrane que l'appli CamScanner appose sur chaque page numérisée),
 * faussant la détection sur toutes les pages d'un coup — bug réel
 * constaté en usage, pas juste théorique. */
function hasWord(flatText, word) {
  return new Set(flatText.split(" ")).has(word);
}

export function guessDocType(texte, raisonSociale) {
  const flat = normalizeFlat(texte);
  const douaneHits = DOUANE_KEYWORDS.filter((k) => flat.includes(normalizeFlat(k))).length;
  if (douaneHits >= 2) return { type: "douane", confidence: "haute" };

  const socWords = normalizeFlat(raisonSociale)
    .split(" ")
    .filter((w) => w.length > 2);
  if (socWords.length === 0) return { type: null, confidence: "faible" };

  const hitRatio = socWords.filter((w) => hasWord(flat, w)).length / socWords.length;
  if (hitRatio < 0.5) return { type: null, confidence: "faible" };

  const lines = texte.split("\n").map(normalizeFlat);
  const nameLineIdx = lines.findIndex((l) => {
    if (!l) return false;
    return socWords.filter((w) => hasWord(l, w)).length / socWords.length >= 0.5;
  });
  if (nameLineIdx === -1) return { type: null, confidence: "faible" };

  const before = lines.slice(Math.max(0, nameLineIdx - 3), nameLineIdx).join(" ");
  if (CLIENT_LABELS.test(before)) return { type: "achat", confidence: "moyenne" };

  const invoiceLineIdx = lines.findIndex((l) => INVOICE_NUM_LABEL.test(l));
  if (invoiceLineIdx !== -1) {
    return nameLineIdx > invoiceLineIdx
      ? { type: "achat", confidence: "moyenne" }
      : { type: "vente", confidence: "moyenne" };
  }

  // Dernier recours, sans repère structurel fiable.
  return nameLineIdx <= 6
    ? { type: "vente", confidence: "faible" }
    : { type: "achat", confidence: "faible" };
}

export function parseFields(text, type, lines = []) {
  const t = text.replace(/\r/g, "");

  const date = toIsoDate(
    firstMatch(t, [
      /date\s+de\s+facture\s*[:\s]\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      /date\s*(?:de\s+facturation)?\s*[:\s]\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/,
    ]),
  );

  const numFacture = firstMatch(t, [
    // « Facture N° 1407 » — le plus fiable, jamais suivi d'une date.
    // Lookahead qui exige au moins un chiffre dans la valeur capturée :
    // évite qu'un simple titre « FACTURE » en haut de page ne « traverse »
    // le saut de ligne et capture le mot « Facture » de la ligne suivante
    // comme si c'était le numéro (cas des templates avec titre + libellé
    // séparés, ex. « FACTURE \n Facture N° 1407 »).
    /facture\s*(?:n[°o]\.?)?\s*[:\s]\s*(?!\d{1,2}[\/\-.]\d{1,2}[\/\-.])(?=[A-Z0-9\-\/]*\d)([A-Z0-9][A-Z0-9\-\/]{1,})/i,
    /invoice\s*(?:n[°o]|number)?\s*[:\s]\s*(?!\d{1,2}[\/\-.]\d{1,2}[\/\-.])(?=[A-Z0-9\-\/]*\d)([A-Z0-9][A-Z0-9\-\/]{1,})/i,
  ]);

  // Par position réelle des mots (fiable) d'abord, texte-à-plat en filet de
  // sécurité seulement (PDF texte natif, ou bbox indisponible).
  const table =
    parseTableRowByPosition(lines) ?? parseTableRow(t) ?? parseTableRowByShape(t);

  const quantite = toNumber(
    firstMatch(t, [
      new RegExp(String.raw`qu?an?tit[ée]\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`qty\s*[:\s]\s*(${NUM})`, "i"),
    ]) || table?.quantite,
  );

  let prixUnitaire = toNumber(
    firstMatch(t, [
      new RegExp(String.raw`p\.?u\.?\s*(?:ht)?\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`prix\s*unitaire\s*[:\s]\s*(${NUM})`, "i"),
    ]) || table?.prixUnitaire,
  );

  const devise = firstMatch(t, [/\b(EUR|USD|TND|GBP)\b/]) || "EUR";

  let montant = toNumber(
    firstMatch(t, [
      new RegExp(String.raw`total\s*ttc\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`montant\s*(?:total)?\s*ttc\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`total\s*ht\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`montant\s*(?:total)?\s*[:\s]\s*(${NUM})`, "i"),
    ]) || table?.montant,
  );
  // Filets de sécurité : quantité × prix unitaire = montant est presque
  // toujours vrai sur une ligne de facture — si l'un des trois manque alors
  // que les deux autres sont connus, on le déduit plutôt que de remonter un
  // zéro trompeur (ex. total à séparateur de milliers mal découpé, ou
  // colonne prix unitaire absente de ce document).
  if (!montant && quantite && prixUnitaire) {
    montant = Math.round(quantite * prixUnitaire * 100) / 100;
  }
  // Dernier recours : le montant en toutes lettres (« Fifty-two thousand
  // EUROS », « TOTAL AMOUNT: FIFTY-THREE THOUSAND EURO ») — courant sur les
  // factures internationales, et l'OCR le lit souvent bien mieux qu'un
  // tableau chiffré dense (police fine, bordures) qui peut ressortir
  // totalement illisible.
  if (!montant) {
    const lettres = firstMatch(t, [MONTANT_LETTRES_RE]);
    if (lettres) montant = wordsToNumber(lettres) || 0;
  }
  if (!prixUnitaire && quantite && montant) {
    prixUnitaire = Math.round((montant / quantite) * 100) / 100;
  }

  // priorité à la ligne de tableau (fiable) — sinon étiquette libre
  // (« Désignation : X » sur une seule ligne, hors tableau).
  const nature =
    table?.nom ||
    firstMatch(t, [
      /d[ée]signation\s*[:\s]\s*([^\n]{3,60})/i,
      /marchandise\s*[:\s]\s*([^\n]{3,60})/i,
      /article\s*[:\s]\s*([^\n]{3,60})/i,
    ]) ||
    "";

  if (type === "achat") {
    const fournisseur =
      firstMatch(t, [
        /fournisseur\s*[:\s]\s*([^\n]{2,60})/i,
        /vendeur\s*[:\s]\s*([^\n]{2,60})/i,
        /exp[ée]diteur\s*[:\s]\s*([^\n]{2,60})/i,
        /[ée]metteur\s*[:\s]\s*([^\n]{2,60})/i,
        /payable\s*[àa]\s*[:\s]\s*([^\n]{2,60})/i,
      ]) ||
      valueAfterLabelLine(t, /^payable\s*[àa]\s*:?$/i) ||
      guessCompanyName(t);
    return {
      date,
      numFacture,
      fournisseur,
      natureMarchandise: nature,
      quantite,
      prixUnitaire,
      montantDevise: montant,
      devise,
    };
  }

  if (type === "vente") {
    const client =
      firstMatch(t, [
        /client\s*[:\s]\s*([^\n]{2,60})/i,
        /destinataire\s*[:\s]\s*([^\n]{2,60})/i,
        /vendu\s*[àa]\s*[:\s]\s*([^\n]{2,60})/i,
        /factur(?:er|é|e)\s*[àa]\s*[:\s]\s*([^\n]{2,60})/i,
      ]) ||
      valueAfterLabelLine(t, /^factur(?:er|é|e)\s*[àa]\s*:?$/i) ||
      guessCompanyName(t);
    return {
      date,
      numFacture,
      client,
      natureMarchandise: nature,
      quantite,
      prixUnitaire,
      montantDevise: montant,
      devise,
    };
  }

  // douane
  return {
    numDeclaration: firstMatch(t, [
      /d[ée]claration\s*(?:n[°o]|num[ée]ro)?\s*[:\s]\s*([A-Z0-9\-\/]{3,})/i,
      /\b(?:DAU|DAE)\s*(?:n[°o]|num[ée]ro)?\s*[:\s]\s*([A-Z0-9\-\/]{3,})/i,
      // Un repli "nombre isolé à 6 chiffres" a été testé et retiré : sur ce
      // formulaire, plusieurs valeurs sans rapport (poids, montants en
      // devise) ont aussi 6 chiffres — vérifié en usage réel, ça a confondu
      // une valeur douanière (170718.400) avec le numéro de déclaration.
      // Mieux vaut laisser vide que remonter un numéro plausible mais faux.
    ]),
    date,
    regime: firstMatch(t, [/r[ée]gime\s*[:\s]\s*([^\n]{2,40})/i]),
    reference: firstMatch(t, [/r[ée]f[ée]rence\s*[:\s]\s*([^\n]{2,60})/i]),
    quantite,
  };
}
