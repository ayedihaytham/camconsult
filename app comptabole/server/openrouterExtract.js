import { z } from "zod";

/**
 * Extraction par OpenRouter (Gemini 2.5 Flash) — chemin principal quand
 * OPENROUTER_API_KEY est configurée, devant Claude (claudeExtract.js) : même
 * contrat exact ({ imageDataUrl?, texte?, raisonSociale? } -> même schéma de
 * sortie), donc `ocr.js` n'a besoin de choisir le fournisseur qu'à un seul
 * endroit (voir `aiAvailable`/`aiExtractPage`). Sans clé, on retombe sur
 * Claude, puis sur l'OCR local — aucune régression.
 */
export function openrouterAvailable() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

const MODEL = "google/gemini-2.5-flash";

const ExtractionSchema = z.object({
  type: z.enum(["achat", "vente", "douane"]),
  confidence: z.enum(["haute", "moyenne", "faible"]),
  date: z.string().nullable(),
  numFacture: z.string().nullable(),
  partie: z.string().nullable(),
  natureMarchandise: z.string().nullable(),
  quantite: z.number().nullable(),
  prixUnitaire: z.number().nullable(),
  montantDevise: z.number().nullable(),
  devise: z.string().nullable(),
  numDeclaration: z.string().nullable(),
  regime: z.string().nullable(),
  reference: z.string().nullable(),
});

// Même contenu que le prompt Claude (claudeExtract.js) — deux fichiers pour
// que chacun reste lisible avec les particularités de son API (Claude a un
// output_config structuré natif, ici il faut demander le JSON explicitement
// dans le prompt et le valider soi-même après coup).
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
- Pour une déclaration douanière : numDeclaration est le numéro de la déclaration (souvent une suite de chiffres proche de la date d'enregistrement / du cachet), date = date d'enregistrement, regime = régime douanier, reference = référence associée s'il y en a une.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balise markdown, avec EXACTEMENT ces clés :
{"type": "achat"|"vente"|"douane", "confidence": "haute"|"moyenne"|"faible", "date": string|null, "numFacture": string|null, "partie": string|null, "natureMarchandise": string|null, "quantite": number|null, "prixUnitaire": number|null, "montantDevise": number|null, "devise": string|null, "numDeclaration": string|null, "regime": string|null, "reference": string|null}`;

/** Un modèle peut entourer le JSON de ```json ... ``` malgré la consigne —
 * filet de sécurité avant JSON.parse. */
function stripCodeFence(raw) {
  const m = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(raw);
  return m ? m[1] : raw;
}

/**
 * @param {{ imageDataUrl?: string|null, texte?: string, raisonSociale?: string }} p
 */
export async function openrouterExtractPage({ imageDataUrl, texte, raisonSociale }) {
  const system = SYSTEM_PROMPT.replaceAll(
    "{{RAISON_SOCIALE}}",
    raisonSociale || "(non précisée)",
  );

  const userContent = [];
  if (imageDataUrl) {
    userContent.push({ type: "image_url", image_url: { url: imageDataUrl } });
    userContent.push({ type: "text", text: "Analyse cette page et extrait les champs demandés, au format JSON strict décrit dans les instructions." });
  } else {
    userContent.push({
      type: "text",
      text: `Voici le texte de cette page (extrait numériquement d'un PDF, pas un scan) :\n\n${texte || ""}`,
    });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cabinet.camconsult.com.tn",
      "X-Title": "CAMCONSULT Cabinet - extraction stock",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      // Volontairement bas (idéalement 1500, marge confortable pour une
      // longue désignation) : le compte OpenRouter n'a quasiment plus de
      // crédits (~809 tokens affordables au 21/09), donc toute valeur plus
      // haute échoue systématiquement en 402 avant même de tenter l'appel.
      // À remonter à 1500 dès que le compte est rechargé (voir
      // openrouter.ai/settings/credits) — 750 reste correct pour un document
      // simple mais peut tronquer un champ texte inhabituellement long.
      max_tokens: 750,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter (${res.status}) : ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Réponse OpenRouter vide ou inattendue");

  let parsedJson;
  try {
    parsedJson = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new Error("Réponse OpenRouter non exploitable (JSON invalide)");
  }

  const result = ExtractionSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(`Réponse OpenRouter ne correspond pas au schéma attendu : ${result.error.issues[0]?.message}`);
  }
  return result.data;
}
