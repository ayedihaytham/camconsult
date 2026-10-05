// Moteur d'extraction « RUSPINA » (conteneur Docker `ocr-ruspina`, API
// FastAPI) pour le module Gestion de stock.
//
// Le service lit un dossier de trois pages — facture du producteur (achat),
// facture RUSPINA (vente) et déclaration douanière — avec un contrat de champs
// figé par page (voir /openapi.json du conteneur) : 32 champs producteur,
// 17 champs RUSPINA, 8 champs douane. Ce module :
//   1. envoie le fichier au service (multipart, `POST /api/v1/dossiers/process`) ;
//   2. traduit les champs du service vers ceux du module Stock
//      (`StockChamps` : date, numFacture, fournisseur/client, devise, lignes…) ;
//   3. laisse `ocr.js` replier sur le modèle de vision (Claude)
//      quand le service est absent, en échec, ou demande une revue de routage.
//
// Activation : RUSPINA_OCR_URL (ex. http://ocr-ruspina:8000). Le moteur n'est
// utilisé que pour les sociétés listées dans RUSPINA_OCR_SOCIETES (fragments
// de raison sociale, séparés par des virgules ; défaut « ruspina ») : le
// modèle est propre à ce client et ne doit pas lire les pièces des autres.

const DEFAULT_SOCIETES = "ruspina";

export function ruspinaConfigured() {
  // RUSPINA_OCR_ENABLED=false : le moteur reste installé mais n'est pas utilisé.
  if (process.env.RUSPINA_OCR_ENABLED === "false") return false;
  return Boolean(process.env.RUSPINA_OCR_URL);
}

/** Vrai quand le service est configuré ET que la société fait partie de celles
 * pour lesquelles le modèle est valable. */
export function ruspinaApplies(raisonSociale) {
  if (!ruspinaConfigured()) return false;
  const name = String(raisonSociale || "").toLowerCase();
  if (!name) return false;
  return (process.env.RUSPINA_OCR_SOCIETES || DEFAULT_SOCIETES)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((fragment) => name.includes(fragment));
}

/** Le service demande une revue de routage (page non classée avec certitude). */
export class RuspinaReviewRequired extends Error {
  constructor(routing) {
    super("Le moteur RUSPINA demande une revue de routage des pages");
    this.name = "RuspinaReviewRequired";
    this.routing = routing;
  }
}

/**
 * Envoie un fichier (PDF ou image) au service et renvoie `data`
 * ({ page1, page2, page3 }, chacun pouvant être null).
 * @param {Buffer} buffer
 * @param {string} mime
 */
export async function ruspinaProcess(buffer, mime) {
  const base = String(process.env.RUSPINA_OCR_URL).replace(/\/+$/, "");
  const timeoutMs = Number(process.env.RUSPINA_OCR_TIMEOUT_MS) || 10 * 60_000;
  const extension = mime === "application/pdf" ? "pdf" : mime.split("/")[1] || "bin";

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), `document.${extension}`);

  const response = await fetch(`${base}/api/v1/dossiers/process`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* corps non JSON : traité plus bas */
  }
  if (!response.ok) {
    const detail = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Moteur RUSPINA : ${detail}`);
  }
  if (body?.status === "completed" && body.data) return body.data;
  if (body?.routing_session_id) throw new RuspinaReviewRequired(body.routing);
  throw new Error("Moteur RUSPINA : réponse inattendue");
}

// ── Normalisation des valeurs ─────────────────────────────────────────────

/** « 02/01/2023 », « 02-01-23 » ou « 2023-01-02 » → « 2023-01-02 ». */
export function normaliserDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (!dmy) return "";
  const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
  return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
}

/** « 52000.0 », « 52 000,00 », « 1.234,56 » → nombre ; 0 si illisible. */
export function normaliserNombre(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  let s = String(raw ?? "").replace(/[\s ]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur est le séparateur décimal.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  }
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function lignes(lineItems) {
  return (lineItems || [])
    .map((l) => ({
      designation: String(l?.description ?? "").trim(),
      quantite: normaliserNombre(l?.quantity),
      prixUnitaire: normaliserNombre(l?.unit_price),
      montantDevise: normaliserNombre(l?.line_total),
    }))
    .filter((l) => l.designation || l.quantite || l.montantDevise);
}

const text = (v) => String(v ?? "").trim();

/** Facture du producteur (page 1 du service) = facture d'achat de RUSPINA. */
function champsProducteur(p) {
  const l = lignes(p.line_items);
  const devise = text(p.currency).toUpperCase() || "EUR";
  const date = normaliserDate(p.invoice_date);
  const numFacture = text(p.invoice_number);
  return {
    achat: { date, numFacture, fournisseur: text(p.seller), devise, lignes: l },
    vente: { date, numFacture, client: text(p.client), devise, lignes: l },
    douane: champsDouaneVides(),
  };
}

/** Facture RUSPINA (page 2 du service) = facture de vente. */
function champsRuspina(p) {
  const l = lignes(p.line_items);
  const devise = text(p.currency).toUpperCase() || "EUR";
  const date = normaliserDate(p.invoice_date);
  const numFacture = text(p.invoice_number);
  return {
    achat: { date, numFacture, fournisseur: "", devise, lignes: l },
    vente: { date, numFacture, client: text(p.client), devise, lignes: l },
    douane: champsDouaneVides(),
  };
}

function champsDouaneVides() {
  return {
    numDeclaration: "", date: "", regime: "", reference: "",
    tauxChange: 0, valeurTnd: 0, ptfn: 0, exportateur: "", importateur: "",
  };
}

/** Déclaration douanière (page 3 du service). */
function champsDouane(p) {
  return {
    achat: { date: "", numFacture: "", fournisseur: "", devise: "EUR", lignes: [] },
    vente: { date: "", numFacture: "", client: "", devise: "EUR", lignes: [] },
    douane: {
      numDeclaration: text(p.declaration_number),
      date: normaliserDate(p.declaration_date),
      regime: text(p.declaration_type),
      reference: "",
      tauxChange: normaliserNombre(p.currency_conversion_rate),
      valeurTnd: normaliserNombre(p.customs_total_value_tnd),
      ptfn: normaliserNombre(p.ptfn_amount),
      exportateur: text(p.exporter),
      importateur: text(p.importer),
    },
  };
}

/**
 * Traduit `{ page1, page2, page3 }` en pages du module Stock
 * (même contrat que `extractPages` : index, type deviné, confiance et
 * `champsByType` calculés pour les trois types). Seules les pages présentes
 * dans la réponse sont renvoyées.
 */
export function ruspinaVersPages(data) {
  const pages = [];
  const add = (type, champsByType, details) => {
    pages.push({
      index: pages.length,
      type,
      // Le type vient du routage du service (modèle dédié), pas d'une
      // devinette sur le texte ; ce n'est pas une mesure d'exactitude des champs.
      confidence: "haute",
      champsByType,
      ...(details ? { details } : {}),
    });
  };
  if (data?.page1) add("achat", champsProducteur(data.page1));
  if (data?.page2) add("vente", champsRuspina(data.page2));
  if (data?.page3) {
    add("douane", champsDouane(data.page3), {
      tauxChange: normaliserNombre(data.page3.currency_conversion_rate),
      valeurDouaneTnd: normaliserNombre(data.page3.customs_total_value_tnd),
    });
  }
  return pages;
}

/**
 * Import d'une seule pièce (« facture achat seule », « vente seule »,
 * « douane seule ») : on lit le groupe qui correspond au type demandé.
 * Renvoie les champs, ou null si le service n'a rien reconnu pour ce type.
 */
export function ruspinaChampsPourType(data, type) {
  const page = ruspinaVersPages(data).find((p) => p.type === type);
  return page ? page.champsByType[type] : null;
}
