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
  if (!client) client = new Anthropic();
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

const SYSTEM_PROMPT = `Tu lis UNE page d'un dossier de stock pour un cabinet comptable tunisien : facture d'achat, facture de vente, ou déclaration douanière (TTN / TradeNet). Le document peut mélanger français, anglais et arabe, être dense, incliné ou de qualité moyenne. Tu remplis exactement les champs du schéma, rien d'autre.

## 1. Type de la page ("type") et confiance ("confidence")
- "achat" : facture dont la société "{{RAISON_SOCIALE}}" est l'ACHETEUSE (destinataire / "Bill to" / "Client").
- "vente" : facture dont "{{RAISON_SOCIALE}}" est la VENDEUSE (émettrice / en-tête de la facture).
- "douane" : déclaration en détail des marchandises (vocabulaire : exportateur, importateur, déclarant, bureau de douane, régime, DUM, TTN).
- "confidence" : "haute" si le type est évident, "moyenne" ou "faible" sinon.

## 2. Champs d'une facture (achat ou vente)
- "date" : date de la facture (AAAA-MM-JJ). Pas la date d'échéance ni de livraison.
- "numFacture" : numéro de la facture tel qu'imprimé (ex. "INV-2024-018"), sans le libellé "N°".
- "partie" : nom de l'AUTRE société (le fournisseur si "achat", le client si "vente"). Jamais "{{RAISON_SOCIALE}}" elle-même.
- "devise" : code ISO de la devise de la facture (EUR, USD, TND…). Déduis-le des symboles (€, $, DT) si le code n'est pas écrit.
- "lignes" : UNE entrée par produit distinct du tableau, TOUS les produits (pas seulement le premier) :
  - "designation" : libellé du produit ;
  - "quantite" : quantité facturée (nombre) ;
  - "prixUnitaire" : prix unitaire dans la devise de la facture ;
  - "montantDevise" : montant de la ligne dans la devise de la facture.
  Un total, un sous-total, une TVA, un timbre ou des frais de port ne sont JAMAIS une ligne de produit.
- Champs de douane (numDeclaration, regime, tauxChange, valeurTnd, ptfn, exportateur, importateur) : null pour une facture.

## 3. Champs d'une déclaration douanière
- "numDeclaration" : numéro de la déclaration (série de chiffres, souvent proche du cachet / de la date d'enregistrement).
- "date" : date d'enregistrement de la déclaration (AAAA-MM-JJ).
- "regime" : régime douanier (code et/ou libellé, ex. "Mise à la consommation").
- "tauxChange" : taux de change appliqué à la déclaration (devise de la facture → TND), nombre avec ses décimales (ex. 3.3412).
- "valeurTnd" : valeur en douane totale, en dinars tunisiens (TND).
- "ptfn" : montant du PTFN déclaré (nombre en TND).
- "exportateur" : nom de l'exportateur / expéditeur étranger.
- "importateur" : nom de l'importateur tunisien.
- "numFacture", "partie", "devise" : null sauf si la déclaration les mentionne clairement ; "lignes" : null.

## 4. Règles strictes
- N'invente JAMAIS une valeur. Un champ illisible ou absent vaut null : mieux vaut vide que faux.
- Nombres en notation standard : point décimal, aucun séparateur de milliers ("52 000,00" → 52000, "1.234,50" → 1234.5, "3,3412" → 3.3412).
- Recopie les chiffres tels qu'imprimés : ne recalcule rien, n'arrondis pas.
- Noms de sociétés : recopie la raison sociale complète, sans adresse ni numéro de TVA.
- Une page sans facture ni déclaration (page de garde, annexe) : type le plus plausible avec "confidence": "faible" et tous les champs à null.`;

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
