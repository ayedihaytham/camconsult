import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * Extraction par Claude (Sonnet 5) — remplace l'OCR local (tesseract) +
 * heuristiques regex quand une clé API est configurée : Claude lit
 * directement l'image de la page (ou le texte, pour un PDF natif) et
 * classe + extrait en un seul appel, avec une bien meilleure tolérance aux
 * documents denses/bilingues (déclarations douanières) que l'OCR local —
 * voir la discussion avec l'utilisateur sur les limites de l'OCR local.
 * Sans clé (ANTHROPIC_API_KEY absente), `claudeAvailable()` renvoie false et
 * `ocr.js` retombe sur le pipeline local existant — aucune régression pour
 * un environnement de dev sans clé configurée.
 */
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
  reference: z.string().nullable(),
});

const SYSTEM_PROMPT = `Tu analyses une page d'un document commercial ou douanier scanné (facture d'achat, facture de vente, ou déclaration douanière tunisienne — souvent via TTN/TradeNet), pour un cabinet comptable. Le document peut mélanger français, anglais et arabe, et l'image peut être dense, inclinée, ou de qualité moyenne.

Détermine :
- "type" : "achat" si la société "{{RAISON_SOCIALE}}" est l'ACHETEUSE / le destinataire de la facture, "vente" si elle est la VENDEUSE / l'émettrice, "douane" si c'est une déclaration en détail des marchandises (vocabulaire : exportateur, importateur, déclarant, bureau de douane, régime douanier).
- "confidence" : ta confiance sur le type détecté ("haute" / "moyenne" / "faible").
- Les champs lus directement sur le document.

Règles strictes :
- N'invente JAMAIS une valeur. Si un champ n'est pas clairement lisible sur l'image, renvoie null pour ce champ plutôt qu'une supposition — mieux vaut un champ vide qu'un champ faux.
- Dates au format ISO (AAAA-MM-JJ).
- Nombres en notation standard (point décimal, sans séparateur de milliers) : ex. "52 000,00" → 52000.
- "partie" = le nom de l'AUTRE société (le fournisseur si type="achat", le client si type="vente") — jamais "{{RAISON_SOCIALE}}" elle-même.
- "lignes" : UNE entrée par ligne de produit/marchandise distincte dans le tableau de la facture (désignation, quantité, prix unitaire, montant) — le tableau contient souvent plusieurs produits avec des quantités différentes, liste-les TOUS, pas seulement le premier. Un total/sous-total/TVA en bas de tableau n'est jamais une ligne de produit.
- Pour une déclaration douanière : numDeclaration est le numéro de la déclaration (souvent une suite de chiffres proche de la date d'enregistrement / du cachet), date = date d'enregistrement, regime = régime douanier, reference = référence associée s'il y en a une ; "lignes" reste vide (null) pour ce type.`;

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

/**
 * @param {{ imageDataUrl?: string|null, texte?: string, raisonSociale?: string }} p
 */
export async function claudeExtractPage({ imageDataUrl, texte, raisonSociale }) {
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
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system,
    output_config: { effort: "medium", format: zodOutputFormat(ExtractionSchema) },
    messages: [{ role: "user", content }],
  });

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
      reference: out.reference || "",
    },
  };
}

export function champsByTypeVide() {
  return {
    achat: { date: "", numFacture: "", fournisseur: "", devise: "EUR", lignes: [] },
    vente: { date: "", numFacture: "", client: "", devise: "EUR", lignes: [] },
    douane: { numDeclaration: "", date: "", regime: "", reference: "" },
  };
}
