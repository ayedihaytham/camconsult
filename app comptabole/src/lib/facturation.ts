import type { Facture, FactureCabinet, FactureLigne } from "@/types";
import qrcode from "qrcode-generator";
import { calculerTotaux as calculerTotauxPartage } from "../../shared/factureTotaux.js";


export const TVA_TAUX = [19, 13, 7, 0] as const;
export const TIMBRE_DEFAUT = 1;
export const DELAI_PAIEMENT_JOURS = 30;

export interface Totaux {
  totalHt: number;
  tva: number;
  netAPayer: number;
}

/** Totaux d'une facture : règle unique partagée avec le serveur (shared/factureTotaux.js). */
export const calculerTotaux: (
  lignes: Pick<FactureLigne, "quantite" | "montantHt">[],
  tvaTaux: number,
  timbre: number,
) => Totaux = calculerTotauxPartage;

/** Numéro qu'aura la prochaine facture : AAAA-0001… par année d'émission (même règle que le serveur, qui reste seul maître du numéro). */
export function prochainNumero(numeros: string[], dateEmission: string): string {
  const annee = (dateEmission || new Date().toISOString().slice(0, 10)).slice(0, 4);
  const dernier = numeros.reduce((max, n) => {
    const m = new RegExp(`^${annee}-(\\d+)$`).exec(n);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `${annee}-${String(dernier + 1).padStart(4, "0")}`;
}

export const formatTnd = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Date ISO (AAAA-MM-JJ) à `jours` jours de `depuis`. */
export function ajouterJours(depuis: string, jours: number): string {
  const d = new Date(`${depuis}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** Une facture émise (ni payée ni annulée) dont l'échéance est dépassée. */
export function estEnRetard(f: Pick<Facture, "statut" | "echeance">, jour = aujourdhui()): boolean {
  return f.statut === "emise" && Boolean(f.echeance) && (f.echeance as string) < jour;
}

// ── Montant en toutes lettres (dinars et millimes) : règle partagée avec le serveur (shared/montantEnLettres.js) ──
export { nombreEnLettres, montantEnLettres } from "../../shared/montantEnLettres.js";
import { montantEnLettres } from "../../shared/montantEnLettres.js";

// ── Modèle d'impression ───────────────────────────────────────────────────

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const jjmmaaaa = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const lignesTexte = (s: string) => echapper(s).replace(/\n/g, "<br>");

const quantiteTexte = (q: number) => q.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/** Chaîne encodée dans le QR de contrôle d'une facture signée : de quoi retrouver et contrôler le fichier signé (ce n'est PAS le QR de la plateforme TTN). */
export function contenuQrControle(f: Pick<Facture, "numero" | "netAPayer">, cabinet: Pick<FactureCabinet, "matriculeFiscal"> | null, shaSigne: string): string {
  return ["FACTURE-SIGNEE", f.numero, cabinet?.matriculeFiscal ?? "", f.netAPayer.toFixed(3), shaSigne].join("|");
}

/** QR en SVG (autonome, sans canvas) ; vide si le contenu est trop long pour un QR. */
export function qrSvg(contenu: string): string {
  try {
    const q = qrcode(0, "M");
    q.addData(contenu);
    q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  } catch {
    return "";
  }
}

/** Stades où la facture électronique est signée (le fichier signé existe et ne change plus). */
const STADES_SIGNES = ["signee", "deposee", "validee", "rejetee"];

/** Page A4 autonome de la facture (modèle « Registre » : logo et coordonnées du cabinet, émetteur et client côte à côte avec leurs
 * identifiants fiscaux, lignes avec taux de TVA, règlement, totaux et récapitulatif de TVA, bloc de facture électronique signée),
 * prête à imprimer ou à enregistrer en PDF. `origine` sert à charger le logo depuis l'application. */
export function htmlFacture(f: Facture, cabinet: FactureCabinet | null, origine = ""): string {
  const c = cabinet ?? { nom: "", adresse: "", matriculeFiscal: "", telephone: "", email: "", rib: "", mentions: "" };
  const nomCabinet = (c.raisonSociale || c.nom || "").trim();
  const villeCabinet = [c.codePostal, c.ville].filter(Boolean).join(" ");
  const adresseCabinet = c.adresse?.trim() || [c.rue, villeCabinet].filter(Boolean).join(", ");
  const tauxTexte = `${f.tvaTaux.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
  const lignes = f.lignes
    .map(
      (l, i) => `<tr><td class="num">${i + 1}</td><td>${lignesTexte(l.description)}</td>
        <td class="n">${quantiteTexte(l.quantite)}</td><td class="n">${formatTnd(l.montantHt)}</td>
        <td class="n">${tauxTexte}</td><td class="n">${formatTnd(l.quantite * l.montantHt)}</td></tr>`,
    )
    .join("");
  const coordCabinet = [
    adresseCabinet && lignesTexte(adresseCabinet),
    c.telephone && `Tél. : ${echapper(c.telephone)}`,
    c.email && echapper(c.email),
  ].filter(Boolean);
  const identiteCabinet = [
    c.matriculeFiscal && ["MF", c.matriculeFiscal],
    c.rc && ["RC", c.rc],
    adresseCabinet && ["Adresse", adresseCabinet],
  ].filter(Boolean) as [string, string][];
  const identiteClient = [
    f.clientTva && ["MF", f.clientTva],
    f.clientRne && ["RNE / RC", f.clientRne],
    f.clientAdresse && ["Adresse", f.clientAdresse],
  ].filter(Boolean) as [string, string][];
  const champs = (l: [string, string][]) => (l.length ? `<dl>${l.map(([k, v]) => `<dt>${echapper(k)}</dt><dd>${lignesTexte(v)}</dd>`).join("")}</dl>` : "");
  const reglement =
    c.rib || f.echeance
      ? `<div class="reglement">${f.echeance ? `<p><b>Règlement avant le ${jjmmaaaa(f.echeance)}</b>${c.rib ? " par virement :" : "."}</p>` : ""}${c.rib ? `<p>RIB / IBAN <b>${echapper(c.rib)}</b></p>` : ""}</div>`
      : "";
  const pied = c.mentions
    ? lignesTexte(c.mentions)
    : [nomCabinet, c.rc && `RC ${echapper(c.rc)}`, c.matriculeFiscal && `MF ${echapper(c.matriculeFiscal)}`].filter(Boolean).join(" · ") || `Facture ${echapper(f.numero)}`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${echapper(f.numero)}</title>
<style>
  /* Marge 0 : le navigateur n'imprime plus son en-tête/pied (URL, date) ; les marges sont dans .page. */
  @page{size:A4;margin:0}
  *{box-sizing:border-box}
  body{font:12.5px/1.45 Inter,Arial,sans-serif;color:#1b2a3d;margin:0;font-variant-numeric:tabular-nums}
  .page{min-height:296mm;padding:12mm 13mm 10mm;display:flex;flex-direction:column;gap:12px}
  .eyebrow{font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#5a6676}
  .tete{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:12px;border-bottom:2px solid #c8a96a}
  .tete img{height:46px;display:block;margin-bottom:6px}
  .cabinet{font-size:11px;color:#55606b}
  .cabinet b{display:block;font:600 14px Georgia,serif;color:#17325c;margin-bottom:2px}
  .titre{text-align:right}
  .titre h1{font:600 25px Georgia,serif;margin:0 0 6px;letter-spacing:.06em;color:#17325c}
  .meta{display:grid;grid-template-columns:auto auto;gap:1px 14px;justify-content:end;margin:0;font-size:11.5px}
  .meta dt{color:#5a6676;text-align:left}.meta dd{margin:0;font-weight:600;text-align:right}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .partie{border:1px solid #dfe3e8;border-radius:4px;padding:9px 11px}
  .partie.client{background:#faf7f0;border-color:#e6dcc3}
  .partie b{display:block;font-size:13px;margin:2px 0 4px}
  .partie dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:1px 9px;font-size:11px;color:#5a6676}
  .partie dd{margin:0;color:#1b2a3d}
  table{width:100%;border-collapse:collapse}
  th{background:#17325c;color:#fff;text-align:left;padding:7px 8px;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em}
  td{padding:8px;border-bottom:1px solid #dfe3e8;vertical-align:top}
  .n{text-align:right;white-space:nowrap}
  .num{width:26px;color:#8a7a52}
  th.n{text-align:right}
  .bas{display:grid;grid-template-columns:1fr 255px;gap:18px;align-items:start;break-inside:avoid}
  .gauche{display:grid;gap:10px}
  .reglement{border-left:3px solid #c8a96a;background:#faf7f0;padding:9px 12px;font-size:11.5px}
  .reglement p{margin:2px 0}
  .lettres{font-size:12px}
  .note{font-size:11.5px;color:#55606b}
  .totaux div{display:flex;justify-content:space-between;padding:3px 0;color:#5a6676}
  .totaux .net{margin-top:5px;padding:8px 10px;background:#17325c;color:#fff;font-weight:700;font-size:14px;border-radius:3px}
  .recap{margin-top:10px;font-size:10.5px}
  .recap th{background:none;color:#5a6676;border-bottom:1px solid #dfe3e8;padding:4px 0}
  .recap td{padding:4px 0;border:0}
  .esign{display:flex;gap:14px;align-items:center;border:1px solid #cfe3d4;background:#f4faf5;border-radius:4px;padding:10px 14px;font-size:10.5px;color:#3b5a45;break-inside:avoid}
  .esign svg{width:76px;height:76px;flex:none;background:#fff}
  .esign b{display:block;font-size:12px;color:#1f4d2e;margin-bottom:2px}
  .esign code{font:10px/1.4 Consolas,monospace;word-break:break-all;color:#1c2b3a}
  .bas-page{margin-top:auto;display:grid;gap:10px}
  .pied-ligne{display:grid;grid-template-columns:1fr 200px;gap:14px;align-items:end}
  .legal{font-size:9.5px;line-height:1.4;color:#7a838c;border-top:1px solid #dfe3e8;padding-top:8px}
  .signature{height:58px;border:1px dashed #c4ccd6;border-radius:4px;padding:6px 8px}
</style></head><body><div class="page">
<div class="tete">
  <div class="cabinet"><img src="${echapper(origine)}/brand/logo-cabinet-navy.png" alt="">
    ${nomCabinet ? `<b>${echapper(nomCabinet)}</b>` : ""}${coordCabinet.map((l) => `<div>${l}</div>`).join("")}</div>
  <div class="titre"><h1>FACTURE</h1>
    <dl class="meta"><dt>N°</dt><dd>${echapper(f.numero)}</dd><dt>Date d'émission</dt><dd>${jjmmaaaa(f.dateEmission)}</dd>${f.echeance ? `<dt>Échéance</dt><dd>${jjmmaaaa(f.echeance)}</dd>` : ""}<dt>Devise</dt><dd>TND</dd></dl></div>
</div>
<div class="parties">
  <div class="partie"><span class="eyebrow">Émetteur</span><b>${echapper(nomCabinet || "Cabinet")}</b>${champs(identiteCabinet.filter(([k]) => k !== "Adresse"))}</div>
  <div class="partie client"><span class="eyebrow">Facturé à</span><b>${echapper(f.societeNom)}</b>${champs(identiteClient)}</div>
</div>
<table><thead><tr><th>#</th><th>Désignation</th><th class="n">Qté</th><th class="n">P.U. HT</th><th class="n">TVA</th><th class="n">Total HT</th></tr></thead>
<tbody>${lignes}</tbody></table>
<div class="bas">
  <div class="gauche">${reglement}
    <div class="lettres"><span class="eyebrow">Arrêtée la présente facture à la somme de</span><br><b>${echapper(montantEnLettres(f.netAPayer))}</b>.</div>
    ${f.note ? `<div class="note">${lignesTexte(f.note)}</div>` : ""}</div>
  <div>
    <div class="totaux"><div><span>Total HT</span><span>${formatTnd(f.totalHt)} TND</span></div>
    <div><span>TVA (${tauxTexte})</span><span>${formatTnd(f.tva)} TND</span></div>
    <div><span>Droit de timbre</span><span>${formatTnd(f.timbre)} TND</span></div>
    <div class="net"><span>Net à payer</span><span>${formatTnd(f.netAPayer)} TND</span></div></div>
    <table class="recap"><thead><tr><th>Taux TVA</th><th class="n">Base HT</th><th class="n">Montant TVA</th></tr></thead>
    <tbody><tr><td>${tauxTexte}</td><td class="n">${formatTnd(f.totalHt)}</td><td class="n">${formatTnd(f.tva)}</td></tr></tbody></table>
  </div>
</div>
<div class="bas-page">
${blocSignatureElectronique(f, c)}
<div class="pied-ligne"><div class="legal">${pied}</div><div class="signature"><span class="eyebrow">Cachet et signature</span></div></div>
</div>
</div></body></html>`;
}

/** Facture VALIDÉE par TTN : référence, date de validation et QR officiel (PNG renvoyé par TTN, jamais fabriqué ici). */
function blocValideTtn(f: Facture): string {
  const ei = f.einvoice;
  if (!ei || ei.statut !== "validee" || !ei.refTtn) return "";
  const qr = ei.qrPng && /^[A-Za-z0-9+/=]+$/.test(ei.qrPng) ? `<img src="data:image/png;base64,${ei.qrPng}" alt="QR code El Fatoora" style="width:84px;height:84px;flex:none;background:#fff">` : "";
  return `<div class="esign">${qr}<div><b>Facture électronique validée par TTN (El Fatoora)</b>
    Référence TTN : <b style="display:inline">${echapper(ei.refTtn)}</b>${ei.refTtnDate ? `<br>Validée le ${jjmmaaaa(ei.refTtnDate)} à ${new Date(ei.refTtnDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" })}` : ""}
    ${ei.shaSigne ? `<br>Empreinte SHA-256 du fichier signé :<br><code>${echapper(ei.shaSigne)}</code>` : ""}</div></div>`;
}

function blocSignatureElectronique(f: Facture, c: Pick<FactureCabinet, "matriculeFiscal">): string {
  const ei = f.einvoice;
  if (ei?.statut === "validee" && ei.refTtn) return blocValideTtn(f);
  if (!ei || !STADES_SIGNES.includes(ei.statut) || !ei.shaSigne) return "";
  const qr = qrSvg(contenuQrControle(f, c, ei.shaSigne));
  return `<div class="esign">${qr}<div><b>Facture électronique signée</b>
    Signée${ei.signeLe ? ` le ${jjmmaaaa(ei.signeLe)}` : ""} avec le certificat du cabinet (format El Fatoora / TEIF).<br>
    Empreinte SHA-256 du fichier signé :<br><code>${echapper(ei.shaSigne)}</code><br>
    Le QR ci-contre permet de contrôler l'intégrité du fichier ; le QR officiel de la plateforme TTN n'est ajouté qu'après le dépôt de la facture.</div></div>`;
}

/** Imprime la facture depuis la page courante : un cadre invisible porte le
 * modèle et ouvre directement la fenêtre d'impression (aucun onglet ni fenêtre
 * supplémentaire). Le titre de la page devient « Facture <n°> » le temps de
 * l'impression : c'est le nom proposé pour l'enregistrement en PDF. */
export function imprimerFacture(f: Facture, cabinet: FactureCabinet | null): boolean {
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  cadre.tabIndex = -1;
  Object.assign(cadre.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(cadre);
  const doc = cadre.contentDocument;
  const fenetre = cadre.contentWindow;
  if (!doc || !fenetre) {
    cadre.remove();
    return false;
  }

  doc.open();
  doc.write(htmlFacture(f, cabinet, window.location.origin));
  doc.close();

  const titreInitial = document.title;
  document.title = `Facture ${f.numero}`;
  let nettoye = false;
  const nettoyer = () => {
    if (nettoye) return;
    nettoye = true;
    document.title = titreInitial;
    cadre.remove();
  };
  fenetre.addEventListener("afterprint", nettoyer);
  window.setTimeout(nettoyer, 5 * 60_000);

  const lancer = () => {
    fenetre.focus();
    fenetre.print();
  };
  // Le logo doit être chargé avant l'ouverture de l'aperçu.
  const logo = doc.images[0];
  if (logo && !logo.complete) {
    logo.onload = logo.onerror = lancer;
  } else {
    lancer();
  }
  return true;
}
