import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Extraction locale et gratuite (aucune API externe) :
 *  1. Si le PDF contient du texte (généré numériquement) -> lecture directe (pdf-parse).
 *  2. Sinon (PDF/image scanné) -> rasterisation (poppler) + OCR (tesseract.js).
 * Puis extraction de champs par heuristiques (regex) selon le type de document.
 */
export async function extractDocument(dataUrl, type) {
  const { buffer, mime } = decodeDataUrl(dataUrl);

  let texte = "";
  let source = "texte";

  if (mime === "application/pdf") {
    texte = await tryPdfText(buffer);
    if (texte.trim().length < 30) {
      source = "ocr";
      texte = await ocrPdf(buffer);
    }
  } else if (mime.startsWith("image/")) {
    source = "ocr";
    texte = await ocrImage(buffer);
  } else {
    throw new Error("Type de fichier non pris en charge (PDF ou image attendu)");
  }

  return { source, texte, champs: parseFields(texte, type) };
}

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("Fichier invalide");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

async function tryPdfText(buffer) {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const { text } = await pdfParse(buffer);
    return text || "";
  } catch (err) {
    console.error("[ocr] pdf-parse a échoué", err.message);
    return "";
  }
}

/** Rasterise les 2 premières pages du PDF (poppler) puis OCR chaque page. */
async function ocrPdf(buffer) {
  const dir = await mkdtemp(join(tmpdir(), "stock-ocr-"));
  try {
    const pdfPath = join(dir, "doc.pdf");
    await writeFile(pdfPath, buffer);
    await execFileAsync("pdftoppm", [
      "-png", "-r", "200", "-f", "1", "-l", "2",
      pdfPath, join(dir, "page"),
    ]);
    const files = (await readdir(dir))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();
    let texte = "";
    for (const f of files) {
      texte += "\n" + (await ocrImage(await readFile(join(dir, f))));
    }
    return texte;
  } catch (err) {
    console.error("[ocr] rasterisation/OCR PDF impossible", err.message);
    return "";
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

/**
 * Facture en tableau (DÉSIGNATION | QUANTITÉ | PRIX UNITAIRE | TOTAL…) :
 * repère la ligne d'en-tête puis la première ligne de données qui suit
 * (désignation = texte avant le 1er nombre, puis quantité / prix unitaire / montant).
 */
function parseTableRow(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const headerIdx = lines.findIndex(
    (l) =>
      /d[ée]signation|article|produit|description/i.test(l) &&
      /qu?an?tit[ée]|qty/i.test(l),
  );
  if (headerIdx === -1) return null;

  const numRe = new RegExp(NUM_CELL, "g");
  for (let i = headerIdx + 1; i < Math.min(lines.length, headerIdx + 8); i++) {
    const line = lines[i];
    if (/^(total|sous[\s-]?total|tva|remise)\b/i.test(line)) break;
    const nums = line.match(numRe);
    if (!nums || nums.length < 2) continue;
    const firstNumAt = line.search(/-?\d/);
    const nom = line.slice(0, firstNumAt).trim().replace(/[\s.:\-]+$/, "");
    if (!nom) continue;
    return {
      nom,
      quantite: nums[0],
      prixUnitaire: nums[1],
      montant: nums[nums.length - 1],
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

  const montant = toNumber(
    firstMatch(t, [
      new RegExp(String.raw`total\s*ttc\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`montant\s*(?:total)?\s*ttc\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`total\s*ht\s*[:\s]\s*(${NUM})`, "i"),
      new RegExp(String.raw`montant\s*(?:total)?\s*[:\s]\s*(${NUM})`, "i"),
    ]) || table?.montant,
  );

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
      /d[ée]claration\s*(?:n[°o])?\s*[:\s]\s*([A-Z0-9\-\/]{3,})/i,
      /\bDAU\s*(?:n[°o])?\s*[:\s]\s*([A-Z0-9\-\/]{3,})/i,
    ]),
    date,
    regime: firstMatch(t, [/r[ée]gime\s*[:\s]\s*([^\n]{2,40})/i]),
    reference: firstMatch(t, [/r[ée]f[ée]rence\s*[:\s]\s*([^\n]{2,60})/i]),
    quantite,
  };
}
