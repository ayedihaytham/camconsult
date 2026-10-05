// Banc d'essai de l'extraction des pièces du module Stock : passe les MÊMES
// documents dans plusieurs modèles de vision (Claude, Gemini via OpenRouter…)
// et compare, champ par champ, leur exactitude, leur durée et leur coût.
//
//   npm run benchmark:extraction -- --claude claude-sonnet-5-5,claude-haiku-4-5-20251001 \
//        --openrouter google/gemini-2.5-flash,google/gemini-2.5-pro --societe "01-RUSPINA"
//
// Documents : un dossier `benchmark/` (ou --dir) contenant des PDF/images, une
// PAGE par pièce. Pour mesurer l'exactitude, ajoutez à côté de chaque document
// un fichier de vérité `nom.expected.json` (voir docs/benchmark-extraction.md).
// Sans fichier de vérité, le rapport affiche les valeurs lues côte à côte pour
// une comparaison à l'œil.
//
// Clés : OPENROUTER_API_KEY / ANTHROPIC_API_KEY lues dans .env (--env-file).
// Rien n'est enregistré dans l'application : le script ne fait que lire.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { claudeAvailable, claudeExtractPage } from "../claudeExtract.js";
import { openrouterAvailable, openrouterExtractPage } from "../openrouterExtract.js";
import { rasterizeAllPages, tryPdfTextPages } from "../ocr.js";
import { noter } from "./benchmarkScoring.js";

// ── Arguments ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};
const options = (nom) => args.flatMap((a, i) => (a === `--${nom}` && args[i + 1] ? [args[i + 1]] : []));

const dossier = resolve(option("dir", "benchmark"));
const sortie = resolve(option("out", "benchmark-results"));
const societe = option("societe", "");
const repetitions = Number(option("repeat", "1")) || 1;
const modelesClaude = (option("claude", "") || "").split(",").filter(Boolean);
const modelesOpenRouter = (option("openrouter", "") || "").split(",").filter(Boolean);
// --price modele=entrée,sortie  (dollars par million de jetons) — à relever sur les pages de tarifs.
const prix = Object.fromEntries(
  options("price").map((p) => {
    const [modele, valeurs] = p.split("=");
    const [entree, sortieP] = (valeurs || "").split(",").map(Number);
    return [modele, { entree, sortie: sortieP }];
  }),
);

const modeles = [
  ...modelesClaude.map((m) => ({ id: `claude:${m}`, nom: m, fournisseur: "Claude", extraire: (p) => claudeExtractPage({ ...p, model: m }), disponible: claudeAvailable(), cle: "ANTHROPIC_API_KEY" })),
  ...modelesOpenRouter.map((m) => ({ id: `openrouter:${m}`, nom: m, fournisseur: "OpenRouter", extraire: (p) => openrouterExtractPage({ ...p, model: m, maxTokens: 1500 }), disponible: openrouterAvailable(), cle: "OPENROUTER_API_KEY" })),
];

if (modeles.length === 0) {
  console.error("Indiquez au moins un modèle : --claude <ids> et/ou --openrouter <ids>.");
  console.error("Ex. : --claude claude-sonnet-5-5 --openrouter google/gemini-2.5-flash");
  process.exit(1);
}
for (const m of modeles) {
  if (!m.disponible) {
    console.error(`Clé manquante pour ${m.fournisseur} (${m.cle}) : ${m.nom} ignoré.`);
  }
}
const actifs = modeles.filter((m) => m.disponible);
if (actifs.length === 0) process.exit(1);

// ── Documents ─────────────────────────────────────────────────────────────
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Une entrée par page : { nom, entree: { imageDataUrl } | { texte }, attendu } */
async function chargerDocuments() {
  let fichiers;
  try {
    fichiers = (await readdir(dossier)).sort();
  } catch {
    console.error(`Dossier introuvable : ${dossier}\nCréez-le et placez-y vos pièces (voir docs/benchmark-extraction.md).`);
    process.exit(1);
  }
  const documents = [];
  for (const f of fichiers) {
    const ext = extname(f).toLowerCase();
    const base = basename(f, extname(f));
    const lireAttendu = async (suffixe = "") => {
      try {
        return JSON.parse(await readFile(join(dossier, `${base}${suffixe}.expected.json`), "utf8"));
      } catch {
        return null;
      }
    };
    if (MIME[ext]) {
      const buf = await readFile(join(dossier, f));
      documents.push({ nom: f, entree: { imageDataUrl: `data:${MIME[ext]};base64,${buf.toString("base64")}` }, attendu: await lireAttendu() });
    } else if (ext === ".pdf") {
      const buf = await readFile(join(dossier, f));
      const textes = await tryPdfTextPages(buf);
      if (textes.some((t) => t.trim().length > 20)) {
        // PDF numérique : même chemin que l'application (texte envoyé au modèle).
        for (let i = 0; i < textes.length; i++) {
          if (textes[i].trim().length < 20) continue;
          documents.push({ nom: textes.length > 1 ? `${f} p.${i + 1}` : f, entree: { texte: textes[i] }, attendu: (await lireAttendu(textes.length > 1 ? `.p${i + 1}` : "")) });
        }
      } else {
        const pages = await rasterizeAllPages(buf);
        if (pages.length === 0) {
          console.error(`${f} : impossible de rendre les pages (poppler/pdftoppm absent ?). Installez-le (choco install poppler) ou fournissez des images.`);
          continue;
        }
        for (const { index, png } of pages) {
          documents.push({
            nom: pages.length > 1 ? `${f} p.${index + 1}` : f,
            entree: { imageDataUrl: `data:image/png;base64,${png.toString("base64")}` },
            attendu: await lireAttendu(pages.length > 1 ? `.p${index + 1}` : ""),
          });
        }
      }
    }
  }
  return documents;
}

// ── Exécution ─────────────────────────────────────────────────────────────
function cout(modele, usage) {
  const p = prix[modele.nom];
  if (!p || Number.isNaN(p.entree) || Number.isNaN(p.sortie)) return null;
  return ((usage.inputTokens ?? 0) * p.entree + (usage.outputTokens ?? 0) * p.sortie) / 1e6;
}

const documents = await chargerDocuments();
if (documents.length === 0) {
  console.error(`Aucun document dans ${dossier} (PDF, PNG, JPG attendus).`);
  process.exit(1);
}
console.log(`${documents.length} page(s) × ${actifs.length} modèle(s)${repetitions > 1 ? ` × ${repetitions} passes` : ""}\n`);

const resultats = []; // { document, modele, passe, lecture, erreur, ms, usage, note }
for (const doc of documents) {
  for (const modele of actifs) {
    for (let passe = 1; passe <= repetitions; passe++) {
      const usage = {};
      const debut = Date.now();
      let lecture = null;
      let erreur = null;
      try {
        lecture = await modele.extraire({ ...doc.entree, raisonSociale: societe || undefined, usage });
      } catch (err) {
        erreur = err.message;
      }
      const ms = Date.now() - debut;
      const note = lecture && doc.attendu ? noter(lecture, doc.attendu) : null;
      resultats.push({ document: doc.nom, modele: modele.id, passe, lecture, erreur, ms, usage, note });
      const etat = erreur ? `ERREUR ${erreur.slice(0, 80)}` : note ? `${Object.values(note.champs).filter(Boolean).length}/${Object.keys(note.champs).length} champs` : "lu";
      console.log(`${doc.nom.padEnd(36)} ${modele.nom.padEnd(32)} ${String(ms).padStart(6)} ms  ${etat}`);
    }
  }
}

// ── Synthèse ──────────────────────────────────────────────────────────────
const synthese = actifs.map((modele) => {
  const rs = resultats.filter((r) => r.modele === modele.id);
  const ok = rs.filter((r) => r.lecture);
  const notes = ok.filter((r) => r.note);
  const champsTotal = notes.reduce((t, r) => t + Object.keys(r.note.champs).length, 0);
  const champsJustes = notes.reduce((t, r) => t + Object.values(r.note.champs).filter(Boolean).length, 0);
  const lignesAtt = notes.reduce((t, r) => t + (r.note.lignes?.attendues ?? 0), 0);
  const lignesTrouvees = notes.reduce((t, r) => t + (r.note.lignes?.trouvees ?? 0), 0);
  const lignesLues = notes.reduce((t, r) => t + (r.note.lignes?.lues ?? 0), 0);
  const jetonsEntree = rs.reduce((t, r) => t + (r.usage.inputTokens ?? 0), 0);
  const jetonsSortie = rs.reduce((t, r) => t + (r.usage.outputTokens ?? 0), 0);
  const couts = rs.map((r) => cout(modele, r.usage)).filter((c) => c !== null);
  const coutTotal = couts.length === rs.length && rs.length ? couts.reduce((a, b) => a + b, 0) : null;
  return {
    modele: modele.nom,
    fournisseur: modele.fournisseur,
    lectures: rs.length,
    erreurs: rs.length - ok.length,
    exactitudeChamps: champsTotal ? champsJustes / champsTotal : null,
    rappelLignes: lignesAtt ? lignesTrouvees / lignesAtt : null,
    precisionLignes: lignesLues ? lignesTrouvees / lignesLues : null,
    dureeMoyenneMs: rs.length ? Math.round(rs.reduce((t, r) => t + r.ms, 0) / rs.length) : 0,
    jetonsEntree,
    jetonsSortie,
    coutTotal,
    coutParPage: coutTotal !== null && rs.length ? coutTotal / rs.length : null,
  };
});

const pct = (v) => (v === null ? "—" : `${(v * 100).toFixed(1)} %`);
const usd = (v) => (v === null ? "—" : `${v.toFixed(4)} $`);
console.log("\n══ Synthèse ══");
console.table(
  synthese.map((s) => ({
    Modèle: s.modele,
    Lectures: s.lectures,
    Erreurs: s.erreurs,
    "Champs justes": pct(s.exactitudeChamps),
    "Lignes retrouvées": pct(s.rappelLignes),
    "Lignes exactes": pct(s.precisionLignes),
    "Durée moy. (s)": (s.dureeMoyenneMs / 1000).toFixed(1),
    "Jetons ent./sort.": `${s.jetonsEntree}/${s.jetonsSortie}`,
    "Coût / page": usd(s.coutParPage),
    "Coût total": usd(s.coutTotal),
  })),
);
if (!resultats.some((r) => r.note)) {
  console.log("Aucun fichier .expected.json trouvé : comparez les valeurs dans le rapport HTML.");
}

// ── Rapports ──────────────────────────────────────────────────────────────
await mkdir(sortie, { recursive: true });
const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
await writeFile(join(sortie, `resultats-${horodatage}.json`), JSON.stringify({ synthese, resultats }, null, 2));

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const resume = (l) =>
  l
    ? `<b>${esc(l.type)}</b> · ${esc(l.date)} · n° ${esc(l.numFacture || l.numDeclaration)}<br>${esc(l.partie)} · ${esc(l.devise)}${l.regime ? ` · régime ${esc(l.regime)}` : ""}<br>` +
      (l.lignes ?? []).map((x) => `${esc(x.designation)} — qté ${x.quantite} · PU ${x.prixUnitaire} · ${x.montantDevise}`).join("<br>")
    : "";
let html = `<!doctype html><meta charset="utf-8"><title>Banc d'essai d'extraction</title><style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #ccc;padding:8px;vertical-align:top;font-size:13px}th{background:#f4f1ea}.bad{background:#fde8e8}.ok{background:#e8f6ec}</style><h1>Banc d'essai d'extraction</h1><h2>Synthèse</h2><table><tr><th>Modèle</th><th>Lectures</th><th>Erreurs</th><th>Champs justes</th><th>Lignes retrouvées</th><th>Lignes exactes</th><th>Durée moy.</th><th>Jetons</th><th>Coût / page</th></tr>`;
for (const s of synthese) html += `<tr><td>${esc(s.modele)}</td><td>${s.lectures}</td><td>${s.erreurs}</td><td>${pct(s.exactitudeChamps)}</td><td>${pct(s.rappelLignes)}</td><td>${pct(s.precisionLignes)}</td><td>${(s.dureeMoyenneMs / 1000).toFixed(1)} s</td><td>${s.jetonsEntree}/${s.jetonsSortie}</td><td>${usd(s.coutParPage)}</td></tr>`;
html += `</table><h2>Détail par document</h2>`;
for (const doc of documents) {
  html += `<h3>${esc(doc.nom)}</h3><table><tr><th>Modèle</th><th>Lecture</th><th>Durée</th><th>Vérification</th></tr>`;
  if (doc.attendu) html += `<tr><td><i>Attendu</i></td><td>${resume(doc.attendu)}</td><td></td><td></td></tr>`;
  for (const r of resultats.filter((x) => x.document === doc.nom && x.passe === 1)) {
    const mauvais = r.note ? Object.entries(r.note.champs).filter(([, ok]) => !ok).map(([c]) => c) : [];
    const verdict = r.erreur ? `Erreur : ${esc(r.erreur)}` : r.note ? (mauvais.length ? `Écarts : ${mauvais.join(", ")}${r.note.lignes ? ` · lignes ${r.note.lignes.trouvees}/${r.note.lignes.attendues}` : ""}` : `Tous les champs justes${r.note.lignes ? ` · lignes ${r.note.lignes.trouvees}/${r.note.lignes.attendues}` : ""}`) : "";
    html += `<tr class="${r.erreur || mauvais.length ? "bad" : r.note ? "ok" : ""}"><td>${esc(r.modele)}</td><td>${resume(r.lecture)}</td><td>${(r.ms / 1000).toFixed(1)} s</td><td>${verdict}</td></tr>`;
  }
  html += `</table>`;
}
await writeFile(join(sortie, `rapport-${horodatage}.html`), html);
console.log(`\nRapport : ${join(sortie, `rapport-${horodatage}.html`)}\nDonnées : ${join(sortie, `resultats-${horodatage}.json`)}`);
