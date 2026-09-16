import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const MAX_PAGES = 15;

/**
 * Extraction locale et gratuite (aucune API externe) :
 *  1. Si le PDF contient du texte (généré numériquement) -> lecture directe (pdf-parse).
 *  2. Sinon (PDF/image scanné) -> rasterisation (poppler) + OCR (tesseract.js).
 * Puis extraction de champs par heuristiques (regex) selon le type de document.
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

  if (mime === "application/pdf") {
    const pages = await tryPdfTextPages(buffer);
    texte = pages.join("\n");
    if (texte.trim().length < 30) {
      source = "ocr";
      const rastered = await rasterizeAllPages(buffer);
      for (const { png } of rastered) {
        texte += "\n" + (await ocrImage(png));
      }
    }
  } else if (mime.startsWith("image/")) {
    source = "ocr";
    texte = await ocrImage(buffer);
  } else {
    throw new Error("Type de fichier non pris en charge (PDF ou image attendu)");
  }

  return { source, texte, champs: parseFields(texte, type) };
}

/**
 * Un PDF combiné (ex. facture d'achat + facture de vente + déclaration
 * douanière scannées ensemble) : chaque page est OCRisée séparément (jamais
 * concaténée, sinon les champs des différents documents se mélangent), puis
 * son type (achat/vente/douane) est deviné à partir du contenu — voir
 * `guessDocType`. Résultat toujours proposé à l'utilisateur pour
 * confirmation/correction avant application (voir StockMouvementFormSheet).
 */
export async function extractPages(dataUrl, raisonSociale) {
  const { buffer, mime } = decodeDataUrl(dataUrl);

  if (mime.startsWith("image/")) {
    const texte = await ocrImage(buffer);
    return [{ index: 0, imageDataUrl: dataUrl, texte, ...guessDocType(texte, raisonSociale) }];
  }
  if (mime !== "application/pdf") {
    throw new Error("Type de fichier non pris en charge (PDF ou image attendu)");
  }

  const textPages = await tryPdfTextPages(buffer);
  const hasText = textPages.some((t) => t.trim().length > 20);
  if (hasText) {
    return textPages.map((texte, index) => ({
      index,
      imageDataUrl: null,
      texte,
      ...guessDocType(texte, raisonSociale),
    }));
  }

  // PDF scanné : rasterise chaque page puis OCR individuel.
  const rastered = await rasterizeAllPages(buffer);
  const pages = [];
  for (const { index, png } of rastered) {
    const texte = await ocrImage(png);
    pages.push({
      index,
      imageDataUrl: `data:image/png;base64,${png.toString("base64")}`,
      texte,
      ...guessDocType(texte, raisonSociale),
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

/** Rasterise chaque page du PDF (poppler) en PNG, jusqu'à MAX_PAGES. */
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

async function ocrImage(buffer) {
  try {
    const worker = await getWorker();
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text || "";
  } catch (err) {
    console.error("[ocr] tesseract a échoué", err.message);
    return "";
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

/**
 * Facture en tableau (DÉSIGNATION | QUANTITÉ | PRIX UNITAIRE | TOTAL…) :
 * repère la ligne d'en-tête puis la première ligne de données qui suit.
 * Reconnaît aussi les en-têtes anglais (factures d'import/export) et
 * « discription », faute assez répandue sur ce type de document.
 * L'ordre des colonnes n'est pas toujours désignation-en-premier : une
 * facture d'export type « Quantity | Unit | Designation | Unit Price »
 * met la quantité avant — l'ordre réel est déduit de la ligne d'en-tête
 * elle-même plutôt que supposé fixe.
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
export function guessDocType(texte, raisonSociale) {
  const flat = normalizeFlat(texte);
  const douaneHits = DOUANE_KEYWORDS.filter((k) => flat.includes(normalizeFlat(k))).length;
  if (douaneHits >= 2) return { type: "douane", confidence: "haute" };

  const socWords = normalizeFlat(raisonSociale)
    .split(" ")
    .filter((w) => w.length > 2);
  if (socWords.length === 0) return { type: null, confidence: "faible" };

  const hitRatio = socWords.filter((w) => flat.includes(w)).length / socWords.length;
  if (hitRatio < 0.5) return { type: null, confidence: "faible" };

  const lines = texte.split("\n").map(normalizeFlat);
  const nameLineIdx = lines.findIndex((l) => {
    if (!l) return false;
    return socWords.filter((w) => l.includes(w)).length / socWords.length >= 0.5;
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

export function parseFields(text, type) {
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

  const table = parseTableRow(t);

  const quantite = toNumber(
    firstMatch(t, [
      new RegExp(String.raw`qu?an?tit[ée]\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`qty\s*[:\s]\s*(${NUM})`, "i"),
    ]) || table?.quantite,
  );

  const prixUnitaire = toNumber(
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
  // Filet de sécurité : un total à 0 quand quantité et prix unitaire sont
  // connus est presque toujours une erreur d'extraction (ex. séparateur de
  // milliers « 52 000,00 » mal découpé), jamais une vraie valeur — on le
  // recalcule alors plutôt que de faire remonter un zéro trompeur. Ne
  // s'applique jamais quand un montant non nul a été trouvé.
  if (!montant && quantite && prixUnitaire) {
    montant = Math.round(quantite * prixUnitaire * 100) / 100;
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
    ]),
    date,
    regime: firstMatch(t, [/r[ée]gime\s*[:\s]\s*([^\n]{2,40})/i]),
    reference: firstMatch(t, [/r[ée]f[ée]rence\s*[:\s]\s*([^\n]{2,60})/i]),
    quantite,
  };
}
