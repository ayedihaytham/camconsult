import Anthropic from "@anthropic-ai/sdk";
// zodOutputFormat (ci-dessous) construit son JSON schema via l'API zod/v4 en
// interne (zod 3.25+ l'expose en sous-chemin de compat) ; lui passer un
// schéma construit avec le zod v3 par défaut ("zod") plante avec "Cannot
// read properties of undefined (reading 'def')" — repéré en usage réel : dès
// que l'extraction passait par Claude, l'appel cassait.
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * Extraction par Claude (modèle de vision) : lit directement l'image de la page
 * (ou le texte, pour un PDF natif), classe et extrait en un seul appel, avec une
 * bonne tolérance aux documents denses/bilingues (déclarations douanières).
 * Sans clé (ANTHROPIC_API_KEY absente), `claudeAvailable()` renvoie false ; il
 * n'y a pas d'OCR local de repli (voir ocr.js : l'extraction est alors refusée
 * avec un message clair).
 */
/** Modèle Claude utilisé pour lire les pièces. Surchargeable sans toucher au code :
 * CLAUDE_EXTRACT_MODEL (ex. claude-sonnet-5-5, claude-haiku-4-5-20251001). */
export const CLAUDE_EXTRACT_MODEL = process.env.CLAUDE_EXTRACT_MODEL || "claude-sonnet-5-5";

export function claudeAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client = null;
function getClient() {
  // ANTHROPIC_BASE_URL (facultatif) : adresse d'un service compatible avec l'API
  // Anthropic. Vide ou absente = API officielle.
  if (!client) client = new Anthropic({ baseURL: process.env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com" });
  return client;
}

const LigneSchema = z.object({
  designation: z.string().nullable(),
  quantite: z.number().nullable(),
  prixUnitaire: z.number().nullable(),
  montantDevise: z.number().nullable(),
});

const ExtractionSchema = z.object({
  type: z.enum(["achat", "vente", "douane"]),
  confidence: z.enum(["haute", "moyenne", "faible"]),
  date: z.string().nullable(),
  numFacture: z.string().nullable(),
  partie: z.string().nullable(),
  // Les deux noms qui permettent de trancher achat / vente (voir corrigerTypeEtTiers).
  emetteur: z.string().nullable(),
  client: z.string().nullable(),
  // Une ligne par marchandise/quantité distincte du tableau — une facture
  // liste souvent plusieurs produits, jamais un seul champ par facture.
  lignes: z.array(LigneSchema).nullable(),
  devise: z.string().nullable(),
  numDeclaration: z.string().nullable(),
  typeDeclaration: z.string().nullable(),
  // Déclaration douanière uniquement (null pour une facture).
  tauxChange: z.number().nullable(),
  valeurTnd: z.number().nullable(),
  ptfn: z.number().nullable(),
  exportateur: z.string().nullable(),
  importateur: z.string().nullable(),
});

const SYSTEM_PROMPT = `You read ONE page of a stock file for a Tunisian accounting firm: a purchase invoice, a sales invoice, or a customs declaration (TTN / TradeNet). The page may mix French, English and Arabic, and may be dense, skewed or of average scan quality. Fill exactly the fields of the schema, nothing else.

## 1. Page type ("type") and confidence ("confidence")
Decide an invoice's type by WHO ISSUED it, never by the mere presence of a name on the page:
- The ISSUER (seller) is the company of the LETTERHEAD: logo, header address block ("Siège social", usine, tel/fax), the legal line in the footer (capital, RC, MF), the stamp and the signature ("Service commercial").
- The CUSTOMER (buyer) is the company in the "Client" / "Bill to" / "Facturé à" / "Adresse" block. A "Destinataire", "Consignee" or "Notify party" is only the delivery recipient, NOT the customer.
- "{{RAISON_SOCIALE}}" is our client company. Written names often differ a little (code prefix, legal form, extra words): match on the distinctive word (e.g. "RUSPINA IMPORT EXPORT" matches "RUSPINA").
- "achat" (purchase): the ISSUER is ANOTHER company and "{{RAISON_SOCIALE}}" is the CUSTOMER. Typical: the letterhead of a supplier (a factory, a trader) and "Client : RUSPINA ...".
- "vente" (sale): "{{RAISON_SOCIALE}}" is the ISSUER (its own letterhead, logo and stamp), and the customer is another company.
- A continuation page of an invoice (table, totals, delivery notes, payment details, no letterhead): decide from the issuer named in the footer legal line, the bank details or the stamp.
- "douane" (customs): a goods declaration (words: exportateur, importateur, déclarant, bureau de douane, DUM, TTN).
- "confidence": "haute" if the type is obvious, otherwise "moyenne" or "faible".

## 2. Invoice fields (achat or vente)
- "date": invoice date (YYYY-MM-DD), not the due date or delivery date. Dates are written DAY/MONTH/YEAR (02/01/2023 = 2 January 2023, never 1 February).
- "numFacture": the number printed in the invoice's own "Invoice N°" / "Facture N°" box (e.g. "6608000533"), without the label. Ignore cross-reference numbers: "As per invoice", "conform to the proforma invoice", purchase order, contract number.
- "emetteur": the full name of the company that ISSUED the document = the company of the LETTERHEAD (header logo and address block, legal footer, stamp). Copy it exactly as printed (e.g. "SOTACIB KAIROUAN").
- "client": the full name of the CUSTOMER = the company in the "Client" / "Bill to" / "Facturé à" block. Not the "Destinataire" / "Consignee". Copy it exactly as printed.
- "partie": the name of the OTHER company, never "{{RAISON_SOCIALE}}". For "achat" it is the ISSUER of the invoice (the company of the letterhead, e.g. the one whose logo and legal footer appear), NEVER the "Client" block and never the "Destinataire". For "vente" it is the CUSTOMER (the "Client" block).
- "devise": ISO currency code of the invoice (EUR, USD, TND…). Deduce it from the symbol (€, $, DT) if the code is not written.
- "lignes": ONE entry per distinct product row of the table, ALL products (not only the first). Read the table COLUMN BY COLUMN following the headers (Quantity / Unit / Designation / Unit price / Total, or Description of goods / Quantity / Unit price / Total price). Never mix columns: a quantity is not a price.
  - "designation": the product label. If it spans several lines in the same cell (product, packing, standard), join them into one text;
  - "quantite": the number in the Quantity column (e.g. 1000 for "1000 MT"), not a number of bags or packages quoted inside the designation;
  - "prixUnitaire": the Unit price column, in the invoice currency;
  - "montantDevise": the row amount (Total column), in the invoice currency.
  These are NEVER product rows: "HS CODE" lines, "conform to the proforma", "Total including all taxes", "Total", subtotals, VAT, stamp duty, shipping costs, amounts written in words.
  An empty or unreadable cell is null. If the quantity and the row total are readable but not the unit price, leave prixUnitaire null (do not compute it).
- For a customs declaration, "emetteur" and "client" are null. Customs fields (numDeclaration, typeDeclaration, tauxChange, valeurTnd, ptfn, exportateur, importateur): null for an invoice.

## 3. Customs declaration fields
The TTN form is a grid of numbered boxes: locate each value by the label of ITS box, not by its position.
- "numDeclaration": the "Numéro" of the "Déclaration" box (top right, next to its "Date"), e.g. 447898. Do not confuse it with the repertoire number, the "Titre CE" number, the liquidation number or handwritten margin notes.
- "date": the "Date" of that same "Déclaration" box (03-01-2023 = 3 January 2023 -> 2023-01-03).
- "typeDeclaration": the letter or code printed in the box "Type déclaration" (box 5, next to "Nbre total articles"), e.g. "E". Only that short value, nothing else. Do NOT read the "Régimes douaniers" box. Null if the box is empty.
- "tauxChange": box "Cours de conversion de la devise de facturation" (e.g. 3.2842000 -> 3.2842).
- "valeurTnd": "Valeur douane totale (en dinars)" (e.g. 170778.400 -> 170778.4), not the FOB value of a single item.
- "ptfn": the amount of the "PTFN" line next to "Devis" (e.g. 52000.000 -> 52000), in the invoicing currency.
- "exportateur": the FULL text of the "Exportateur" box, every printed line (company name, then the address lines below it), joined with ", ". Exclude only the "Code" number printed on the right. Do not stop after the first line.
- "importateur": the FULL text of the "Importateur" box, every printed line (company name, address, country), joined with ", ". Exclude only the "Code" number.
- "numFacture", "partie", "devise": null unless the declaration clearly states them; "lignes": null.

## 4. Strict rules
- NEVER invent a value. An unreadable or absent field is null: empty is better than wrong.
- Numbers use standard notation: decimal point, no thousands separator ("52 000,00 €" -> 52000, "1.234,50" -> 1234.5, "3,3412" -> 3.3412, "1 000.000" -> 1000, "53.00EUR" -> 53). A space is always a thousands separator. When a thousands separator is followed by another separator, the LAST separator is the decimal one ("1 000.000" = 1000, "170778.400" = 170778.4).
- Read EVERY decimal digit exactly as printed, including trailing zeros and the third decimal: Tunisian dinar amounts have 3 decimals (millimes), e.g. "170778.405" -> 170778.405, never "170778.4" or "170778.41". Never round, never drop a decimal, never recompute anything. Never multiply a value by 1000 because of zeros after the decimal point.
- Copy digits exactly as printed. Check each digit of long numbers (invoice, declaration numbers) twice.
- Invoice company names ("partie"): copy the full company name, without address or VAT number. (Exportateur / importateur on a customs declaration are the exception: copy the whole box.)
- Copy words letter by letter as printed, even when they look odd; "DE" and "DES" are common in Tunisian company names, never turn them into symbols.
- A page that is neither an invoice nor a declaration (cover sheet, appendix): most plausible type with "confidence": "faible" and every field null.`;

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

/** Nom de la société tel qu'il est écrit sur ses pièces : sans le code de classement
 * du cabinet qui précède souvent la raison sociale (« 01-RUSPINA » -> « RUSPINA »). */
export function nomSociete(raisonSociale) {
  const nom = String(raisonSociale || "").replace(/^\s*\d+\s*[-–.:]\s*/, "").trim();
  return nom || "(non précisée)";
}

// ── Achat ou vente : décidé par le code, pas par le modèle ────────────────
// Juger « suis-je l'acheteur ou le vendeur ? » est fragile pour un modèle économique.
// On lui demande seulement de lire deux noms (l'émetteur de l'en-tête, le client), et on
// les compare ici au nom de la société : sans interprétation, donc sans erreur de jugement.

const MOTS_GENERIQUES = new Set([
  "SARL", "SA", "SUARL", "STE", "SOCIETE", "SOC", "COMPANY", "CO", "LTD", "LLC", "GMBH", "INC",
  "GROUP", "GROUPE", "IMPORT", "EXPORT", "IMP", "EXP", "ET", "DE", "DES", "DU", "LA", "LE", "THE",
  "AND", "P", "C", "PC", "FOR", "OF", "TRADING", "SERVICES",
]);

/** Mots distinctifs d'un nom de société (sans accents, ni forme juridique ni mots génériques). */
export function motsDistinctifs(nom) {
  const mots = String(nom || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  const utiles = mots.filter((m) => !MOTS_GENERIQUES.has(m));
  return utiles.length ? utiles : mots;
}

/** Le nom lu sur la pièce désigne-t-il la société ? Mots distinctifs communs, ou nom collé (« ICARGOLINE »). */
export function designeLaSociete(nomLu, raisonSociale) {
  const societe = motsDistinctifs(nomSociete(raisonSociale));
  const lu = motsDistinctifs(nomLu);
  if (societe.length === 0 || lu.length === 0) return false;
  const communs = societe.filter((m) => lu.includes(m)).length;
  if (communs >= Math.ceil(societe.length / 2)) return true;
  return lu.join("").includes(societe.join(""));
}

/** "vente" si l'émetteur est la société, "achat" si le client l'est, sinon null (indécidable). */
export function typeParEmetteur({ emetteur, client }, raisonSociale) {
  const emet = designeLaSociete(emetteur, raisonSociale);
  const cli = designeLaSociete(client, raisonSociale);
  if (emet && !cli) return "vente";
  if (cli && !emet) return "achat";
  return null;
}

/** Applique la règle ci-dessus à une facture lue : type et tiers corrigés d'après l'émetteur et le client. */
export function corrigerTypeEtTiers(lecture, raisonSociale) {
  if (lecture.type === "douane") return lecture;
  const type = typeParEmetteur(lecture, raisonSociale);
  if (!type) return lecture;
  const tiers = (type === "achat" ? lecture.emetteur : lecture.client) || lecture.partie;
  if (type !== lecture.type || tiers !== lecture.partie) {
    console.log(`[ocr] type d'après l'émetteur « ${lecture.emetteur ?? "?"} » et le client « ${lecture.client ?? "?"} » : ${type} (modèle : ${lecture.type})`);
  }
  return { ...lecture, type, partie: tiers, confidence: type === lecture.type ? lecture.confidence : "haute" };
}

/** Dollars par million de jetons (entrée, sortie), tarifs Anthropic. Un service
 * revendeur peut facturer autrement : CLAUDE_PRICE_IN / CLAUDE_PRICE_OUT les remplacent. */
const TARIFS = [
  [/haiku/, [1, 5]],
  [/sonnet/, [2, 10]],
  [/opus/, [4, 20]],
];

/** Haiku refuse le paramètre `effort` (400 sur l'API officielle) ; Sonnet et Opus l'acceptent. */
export const accepteEffort = (model) => !/haiku/i.test(model);

export function coutEstime(model, entree, sortie) {
  const defaut = TARIFS.find(([motif]) => motif.test(model))?.[1];
  const prixEntree = Number(process.env.CLAUDE_PRICE_IN) || defaut?.[0];
  const prixSortie = Number(process.env.CLAUDE_PRICE_OUT) || defaut?.[1];
  if (!prixEntree || !prixSortie) return "coût inconnu";
  return `$${((entree * prixEntree + sortie * prixSortie) / 1e6).toFixed(4)}`;
}

/**
 * @param {{ imageDataUrl?: string|null, texte?: string, raisonSociale?: string, model?: string, usage?: object }} p
 */
export async function claudeExtractPage({ imageDataUrl, texte, raisonSociale, model = CLAUDE_EXTRACT_MODEL, usage, note }) {
  const system = SYSTEM_PROMPT.replaceAll("{{RAISON_SOCIALE}}", nomSociete(raisonSociale));

  const content = [];
  const image = imageDataUrl ? decodeDataUrl(imageDataUrl) : null;
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
    content.push({ type: "text", text: note ? `Analyse cette page et extrait les champs demandés. ${note}` : "Analyse cette page et extrait les champs demandés." });
  } else {
    content.push({
      type: "text",
      text: `Voici le texte de cette page (extrait numériquement d'un PDF, pas un scan) :\n\n${texte || ""}`,
    });
  }

  // Service compatible (ANTHROPIC_BASE_URL) : il ignore souvent la réponse
  // structurée et renvoie du JSON entouré de balises ```json. On décrit alors le
  // schéma dans la consigne et on lit la réponse nous-mêmes.
  const compatible = Boolean(process.env.ANTHROPIC_BASE_URL?.trim());
  const consigne = compatible
    ? `${system}

Reply with ONLY one JSON object, no markdown, no commentary, matching this JSON schema:
${JSON.stringify(z.toJSONSchema(ExtractionSchema))}`
    : system;

  const response = await getClient().messages.create({
    model,
    max_tokens: 4096,
    system: consigne,
    ...(compatible ? {} : { output_config: { ...(accepteEffort(model) ? { effort: "medium" } : {}), format: zodOutputFormat(ExtractionSchema) } }),
    messages: [{ role: "user", content }],
  });

  // Jetons consommés (comparaison de coût, voir scripts/benchmark-extraction.mjs).
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  if (usage) {
    usage.inputTokens = inputTokens;
    usage.outputTokens = outputTokens;
  }
  console.log(`[ocr] Claude ${model} : ${inputTokens} jetons entrée, ${outputTokens} sortie ≈ ${coutEstime(model, inputTokens, outputTokens)}`);
  const texteReponse = (response.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const brut = extraireJson(texteReponse);
  // Un service compatible peut omettre les champs vides : absent = null.
  if (brut) for (const cle of Object.keys(ExtractionSchema.shape)) brut[cle] ??= null;
  const parsed = ExtractionSchema.safeParse(brut);
  if (!parsed.success) throw new Error(`Réponse Claude non exploitable : ${parsed.error.issues[0]?.message ?? "format inattendu"}`);
  return corrigerTypeEtTiers(parsed.data, raisonSociale);
}

/** JSON d'une réponse de modèle, balises ```json et texte autour tolérés. */
export function extraireJson(texte) {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin < debut) return null;
  try {
    return JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    return null;
  }
}

/** Nettoie les lignes brutes du modèle (valeurs null tolérées, filtre les
 * lignes totalement vides) vers le contrat attendu côté front (voir
 * StockLigne dans src/types) — jamais de null qui se propage jusqu'à
 * l'écran. */
function normaliserLignes(lignes) {
  return (lignes || [])
    .map((l) => ({
      designation: l?.designation || "",
      quantite: l?.quantite ?? 0,
      prixUnitaire: l?.prixUnitaire ?? 0,
      montantDevise: l?.montantDevise ?? 0,
    }))
    .filter((l) => l.designation || l.quantite || l.montantDevise);
}

/** Construit les 3 jeux de champs (achat/vente/douane) à partir d'une
 * extraction Claude — même contrat que `champsPourTousLesTypes` (ocr.js),
 * pour que le reste du pipeline (routes, front) n'ait pas à distinguer la
 * source. `partie` alimente fournisseur ET client : si l'utilisateur corrige
 * le type deviné à l'écran (achat -> vente), le nom de la société reste
 * disponible plutôt que de repasser à vide. */
export function champsByTypeFromClaude(out) {
  const lignes = normaliserLignes(out.lignes);
  return {
    achat: {
      date: out.date || "",
      numFacture: out.numFacture || "",
      fournisseur: out.partie || "",
      devise: out.devise || "EUR",
      lignes,
    },
    vente: {
      date: out.date || "",
      numFacture: out.numFacture || "",
      client: out.partie || "",
      devise: out.devise || "EUR",
      lignes,
    },
    douane: {
      numDeclaration: out.numDeclaration || "",
      date: out.date || "",
      typeDeclaration: out.typeDeclaration || "",
      reference: "",
      tauxChange: out.tauxChange ?? 0,
      valeurTnd: out.valeurTnd ?? 0,
      ptfn: out.ptfn ?? 0,
      exportateur: out.exportateur || "",
      importateur: out.importateur || "",
    },
  };
}

export function champsByTypeVide() {
  return {
    achat: { date: "", numFacture: "", fournisseur: "", devise: "EUR", lignes: [] },
    vente: { date: "", numFacture: "", client: "", devise: "EUR", lignes: [] },
    douane: { numDeclaration: "", date: "", typeDeclaration: "", reference: "", tauxChange: 0, valeurTnd: 0, ptfn: 0, exportateur: "", importateur: "" },
  };
}
