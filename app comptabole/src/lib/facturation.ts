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

/** Page A4 autonome de la facture (en-tête cabinet, client, lignes, totaux, montant
 * en lettres, coordonnées bancaires, mentions), prête à imprimer ou à enregistrer
 * en PDF. `origine` sert à charger le logo depuis l'application. */
export function htmlFacture(f: Facture, cabinet: FactureCabinet | null, origine = ""): string {
  const c = cabinet ?? { nom: "", adresse: "", matriculeFiscal: "", telephone: "", email: "", rib: "", mentions: "" };
  const lignes = f.lignes
    .map(
      (l, i) => `<tr><td class="num">${i + 1}</td><td>${lignesTexte(l.description)}</td>
        <td class="n">${quantiteTexte(l.quantite)}</td><td class="n">${formatTnd(l.montantHt)}</td>
        <td class="n">${formatTnd(l.quantite * l.montantHt)}</td></tr>`,
    )
    .join("");
  const coordCabinet = [
    c.adresse && lignesTexte(c.adresse),
    c.matriculeFiscal && `MF : ${echapper(c.matriculeFiscal)}`,
    c.telephone && `Tél. : ${echapper(c.telephone)}`,
    c.email && echapper(c.email),
  ].filter(Boolean);
  const coordClient = [
    f.clientAdresse && lignesTexte(f.clientAdresse),
    f.clientTva && `MF / TVA : ${echapper(f.clientTva)}`,
    f.clientRne && `RNE : ${echapper(f.clientRne)}`,
  ].filter(Boolean);

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${echapper(f.numero)}</title>
<style>
  /* Marge 0 : le navigateur n'imprime plus son en-tête/pied (URL, date) ; les marges sont dans .page. */
  @page{size:A4;margin:0}
  *{box-sizing:border-box}
  body{font:13px/1.5 Inter,Arial,sans-serif;color:#1c2b3a;margin:0}
  .page{min-height:296mm;padding:16mm 14mm;display:flex;flex-direction:column}
  .tete{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:14px;border-bottom:2px solid #c8a96a}
  .tete img{height:46px;display:block;margin-bottom:8px}
  .cabinet{font-size:12px;color:#55606b}
  .cabinet b{display:block;font:600 16px Georgia,serif;color:#1c2b3a}
  .titre{text-align:right}
  .titre h1{font:600 26px Georgia,serif;margin:0;letter-spacing:.02em}
  .titre .no{font-size:15px;margin-top:2px}
  .titre .dates{margin-top:6px;color:#55606b;font-size:12px}
  .blocs{display:flex;justify-content:flex-end;margin:22px 0 18px}
  .client{width:48%;border:1px solid #e3d9c2;background:#faf7f0;border-radius:6px;padding:12px 14px}
  .client small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#8a7a52;margin-bottom:4px}
  .client b{font-size:14px}
  .client div{color:#55606b;font-size:12px}
  table{width:100%;border-collapse:collapse}
  th{background:#1c2b3a;color:#fff;text-align:left;padding:8px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em}
  td{padding:9px 10px;border-bottom:1px solid #e7e0d2;vertical-align:top}
  .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .num{width:28px;color:#8a7a52}
  th.n{text-align:right}
  .totaux{margin:18px 0 0 auto;width:300px}
  .totaux div{display:flex;justify-content:space-between;padding:4px 0;color:#55606b}
  .totaux .net{border-top:2px solid #1c2b3a;margin-top:6px;padding-top:8px;color:#1c2b3a;font-weight:700;font-size:15px}
  .lettres{margin-top:18px;padding:10px 14px;border-left:3px solid #c8a96a;background:#faf7f0;font-size:12px}
  .paiement{margin-top:14px;font-size:12px;color:#55606b}
  .paiement b{color:#1c2b3a}
  .pied{margin-top:auto;padding-top:28px;border-top:1px solid #e7e0d2;font-size:11px;color:#7a838c;text-align:center}
  .signature{margin-top:26px;display:flex;justify-content:flex-end}
  .esign{margin-top:18px;display:flex;gap:14px;align-items:center;border:1px solid #cfe3d4;background:#f4faf5;border-radius:6px;padding:10px 14px;font-size:11px;color:#3b5a45;break-inside:avoid}
  .esign svg{width:76px;height:76px;flex:none;background:#fff}
  .esign b{display:block;font-size:12px;color:#1f4d2e;margin-bottom:2px}
  .esign code{font:10px/1.4 Consolas,monospace;word-break:break-all;color:#1c2b3a}
  .signature div{width:220px;height:80px;border:1px dashed #cfc5ad;border-radius:6px;padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#8a7a52}
</style></head><body><div class="page">
<div class="tete">
  <div class="cabinet"><img src="${echapper(origine)}/brand/logo-cabinet-navy.png" alt="">
    ${c.nom ? `<b>${echapper(c.nom)}</b>` : ""}${coordCabinet.map((l) => `<div>${l}</div>`).join("")}</div>
  <div class="titre"><h1>FACTURE</h1><div class="no">N° <b>${echapper(f.numero)}</b></div>
    <div class="dates">Date : ${jjmmaaaa(f.dateEmission)}${f.echeance ? `<br>Échéance : ${jjmmaaaa(f.echeance)}` : ""}</div></div>
</div>
<div class="blocs"><div class="client"><small>Facturé à</small><b>${echapper(f.societeNom)}</b>
  ${coordClient.map((l) => `<div>${l}</div>`).join("")}</div></div>
<table><thead><tr><th>#</th><th>Désignation</th><th class="n">Qté</th><th class="n">P.U. HT</th><th class="n">Total HT</th></tr></thead>
<tbody>${lignes}</tbody></table>
<div class="totaux"><div><span>Total HT</span><span>${formatTnd(f.totalHt)} TND</span></div>
<div><span>TVA (${f.tvaTaux} %)</span><span>${formatTnd(f.tva)} TND</span></div>
<div><span>Timbre fiscal</span><span>${formatTnd(f.timbre)} TND</span></div>
<div class="net"><span>Net à payer</span><span>${formatTnd(f.netAPayer)} TND</span></div></div>
<div class="lettres">Arrêtée la présente facture à la somme de : <b>${echapper(montantEnLettres(f.netAPayer))}</b>.</div>
${c.rib || f.echeance ? `<div class="paiement">${f.echeance ? `Règlement avant le <b>${jjmmaaaa(f.echeance)}</b>. ` : ""}${c.rib ? `Virement : <b>${echapper(c.rib)}</b>` : ""}</div>` : ""}
${f.note ? `<div class="paiement">${lignesTexte(f.note)}</div>` : ""}
${blocSignatureElectronique(f, c)}
<div class="signature"><div>Cachet et signature</div></div>
<div class="pied">${c.mentions ? lignesTexte(c.mentions) : `${echapper(c.nom || "Cabinet")} — Facture ${echapper(f.numero)}`}</div>
</div></body></html>`;
}

function blocSignatureElectronique(f: Facture, c: Pick<FactureCabinet, "matriculeFiscal">): string {
  const ei = f.einvoice;
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
