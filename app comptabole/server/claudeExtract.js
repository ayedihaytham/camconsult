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
  // Une ligne par marchandise/quantité distincte du tableau — une facture
  // liste souvent plusieurs produits, jamais un seul champ par facture.
  lignes: z.array(LigneSchema).nullable(),
  devise: z.string().nullable(),
  numDeclaration: z.string().nullable(),
  regime: z.string().nullable(),
  // Déclaration douanière uniquement (null pour une facture).
  tauxChange: z.number().nullable(),
  valeurTnd: z.number().nullable(),
  ptfn: z.number().nullable(),
  exportateur: z.string().nullable(),
  importateur: z.string().nullable(),
});

const SYSTEM_PROMPT = `You read ONE page of a stock file for a Tunisian accounting firm: a purchase invoice, a sales invoice, or a customs declaration (TTN / TradeNet). The page may mix French, English and Arabic, and may be dense, skewed or of average scan quality. Fill exactly the fields of the schema, nothing else.

## 1. Page type ("type") and confidence ("confidence")
- "achat" (purchase): an invoice where the company "{{RAISON_SOCIALE}}" is the BUYER (recipient, "Bill to", "Client", "Consignee").
- "vente" (sale): an invoice where "{{RAISON_SOCIALE}}" is the SELLER (the issuer, named in the invoice header).
- "douane" (customs): a goods declaration (words: exportateur, importateur, déclarant, bureau de douane, régime, DUM, TTN).
- "confidence": "haute" if the type is obvious, otherwise "moyenne" or "faible".

## 2. Invoice fields (achat or vente)
- "date": invoice date (YYYY-MM-DD), not the due date or delivery date. Dates are written DAY/MONTH/YEAR (02/01/2023 = 2 January 2023, never 1 February).
- "numFacture": the number printed in the invoice's own "Invoice N°" / "Facture N°" box (e.g. "6608000533"), without the label. Ignore cross-reference numbers: "As per invoice", "conform to the proforma invoice", purchase order, contract number.
- "partie": the name of the OTHER company (the supplier if "achat", the customer if "vente"). Never "{{RAISON_SOCIALE}}" itself.
- "devise": ISO currency code of the invoice (EUR, USD, TND…). Deduce it from the symbol (€, $, DT) if the code is not written.
- "lignes": ONE entry per distinct product row of the table, ALL products (not only the first). Read the table COLUMN BY COLUMN following the headers (Quantity / Unit / Designation / Unit price / Total, or Description of goods / Quantity / Unit price / Total price). Never mix columns: a quantity is not a price.
  - "designation": the product label. If it spans several lines in the same cell (product, packing, standard), join them into one text;
  - "quantite": the number in the Quantity column (e.g. 1000 for "1000 MT"), not a number of bags or packages quoted inside the designation;
  - "prixUnitaire": the Unit price column, in the invoice currency;
  - "montantDevise": the row amount (Total column), in the invoice currency.
  These are NEVER product rows: "HS CODE" lines, "conform to the proforma", "Total including all taxes", "Total", subtotals, VAT, stamp duty, shipping costs, amounts written in words.
  An empty or unreadable cell is null. If the quantity and the row total are readable but not the unit price, leave prixUnitaire null (do not compute it).
- Customs fields (numDeclaration, regime, tauxChange, valeurTnd, ptfn, exportateur, importateur): null for an invoice.

## 3. Customs declaration fields
The TTN form is a grid of numbered boxes: locate each value by the label of ITS box, not by its position.
- "numDeclaration": the "Numéro" of the "Déclaration" box (top right, next to its "Date"), e.g. 447898. Do not confuse it with the repertoire number, the "Titre CE" number, the liquidation number or handwritten margin notes.
- "date": the "Date" of that same "Déclaration" box (03-01-2023 = 3 January 2023 -> 2023-01-03).
- "regime": the declared customs regime (box "Régimes douaniers": code and/or label).
- "tauxChange": box "Cours de conversion de la devise de facturation" (e.g. 3.2842000 -> 3.2842).
- "valeurTnd": "Valeur douane totale (en dinars)" (e.g. 170778.400 -> 170778.4), not the FOB value of a single item.
- "ptfn": the amount of the "PTFN" line next to "Devis" (e.g. 52000.000 -> 52000), in the invoicing currency.
- "exportateur": the name in the "Exportateur" box (name only, no address).
- "importateur": the name in the "Importateur" box (name only, no address).
- "numFacture", "partie", "devise": null unless the declaration clearly states them; "lignes": null.

## 4. Strict rules
- NEVER invent a value. An unreadable or absent field is null: empty is better than wrong.
- Numbers use standard notation: decimal point, no thousands separator ("52 000,00 €" -> 52000, "1.234,50" -> 1234.5, "3,3412" -> 3.3412, "1 000.000" -> 1000, "53.00EUR" -> 53). A space is always a thousands separator. When a thousands separator is followed by another separator, the LAST separator is the decimal one ("1 000.000" = 1000, "170778.400" = 170778.4).
- Read EVERY decimal digit exactly as printed, including trailing zeros and the third decimal: Tunisian dinar amounts have 3 decimals (millimes), e.g. "170778.405" -> 170778.405, never "170778.4" or "170778.41". Never round, never drop a decimal, never recompute anything. Never multiply a value by 1000 because of zeros after the decimal point.
- Copy digits exactly as printed. Check each digit of long numbers (invoice, declaration numbers) twice.
- Company names: copy the full company name, without address or VAT number.
- A page that is neither an invoice nor a declaration (cover sheet, appendix): most plausible type with "confidence": "faible" and every field null.`;

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

/**
 * @param {{ imageDataUrl?: string|null, texte?: string, raisonSociale?: string, model?: string, usage?: object }} p
 */
export async function claudeExtractPage({ imageDataUrl, texte, raisonSociale, model = CLAUDE_EXTRACT_MODEL, usage }) {
  const system = SYSTEM_PROMPT.replaceAll(
    "{{RAISON_SOCIALE}}",
    raisonSociale || "(non précisée)",
  );

  const content = [];
  const image = imageDataUrl ? decodeDataUrl(imageDataUrl) : null;
  if (image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    });
    content.push({ type: "text", text: "Analyse cette page et extrait les champs demandés." });
  } else {
    content.push({
      type: "text",
      text: `Voici le texte de cette page (extrait numériquement d'un PDF, pas un scan) :\n\n${texte || ""}`,
    });
  }

  const response = await getClient().messages.parse({
    model,
    max_tokens: 4096,
    system,
    output_config: { effort: "medium", format: zodOutputFormat(ExtractionSchema) },
    messages: [{ role: "user", content }],
  });

  // Jetons consommés (comparaison de coût, voir scripts/benchmark-extraction.mjs).
  if (usage) {
    usage.inputTokens = response.usage?.input_tokens ?? 0;
    usage.outputTokens = response.usage?.output_tokens ?? 0;
  }
  if (!response.parsed_output) throw new Error("Réponse Claude non exploitable (parsing échoué)");
  return response.parsed_output;
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
      regime: out.regime || "",
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
    douane: { numDeclaration: "", date: "", regime: "", reference: "", tauxChange: 0, valeurTnd: 0, ptfn: 0, exportateur: "", importateur: "" },
  };
}
