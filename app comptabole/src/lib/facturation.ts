import type { Facture, FactureCabinet, FactureLigne } from "@/types";

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export const TVA_TAUX = [19, 13, 7, 0] as const;
export const TIMBRE_DEFAUT = 1;
export const DELAI_PAIEMENT_JOURS = 30;

export interface Totaux {
  totalHt: number;
  tva: number;
  netAPayer: number;
}

/** Totaux d'une facture : même règle que le serveur (ligne = quantité x HT unitaire,
 * TVA sur le total HT, timbre fiscal ajouté après TVA). */
export function calculerTotaux(
  lignes: Pick<FactureLigne, "quantite" | "montantHt">[],
  tvaTaux: number,
  timbre: number,
): Totaux {
  const totalHt = r3(lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.montantHt) || 0), 0));
  const tva = r3((totalHt * tvaTaux) / 100);
  return { totalHt, tva, netAPayer: r3(totalHt + tva + (Number(timbre) || 0)) };
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

// ── Montant en toutes lettres (dinars et millimes) ────────────────────────

const UNITES = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
  "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 1 à 99. `accord` : « quatre-vingts » prend son s seulement en fin de nombre. */
function moinsDeCent(n: number, accord: boolean): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d <= 6) return DIZAINES[d] + (u === 1 ? " et un" : u > 0 ? `-${UNITES[u]}` : "");
  if (d === 7) return `soixante${u === 1 ? " et onze" : `-${UNITES[10 + u]}`}`;
  if (d === 8) return `quatre-vingt${u === 0 ? (accord ? "s" : "") : `-${UNITES[u]}`}`;
  return `quatre-vingt-${UNITES[10 + u]}`;
}

/** 1 à 999. */
function moinsDeMille(n: number, accord: boolean): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (c > 0) s = (c === 1 ? "cent" : `${UNITES[c]} cent`) + (c > 1 && r === 0 && accord ? "s" : "");
  if (r > 0) s += (s ? " " : "") + moinsDeCent(r, accord);
  return s;
}

/** Entier de 0 à 999 999 999 en lettres (français). */
export function nombreEnLettres(n: number): string {
  if (n === 0) return "zéro";
  const millions = Math.floor(n / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const parts: string[] = [];
  if (millions > 0) parts.push(millions === 1 ? "un million" : `${moinsDeMille(millions, true)} millions`);
  if (milliers > 0) parts.push(milliers === 1 ? "mille" : `${moinsDeMille(milliers, false)} mille`);
  if (reste > 0) parts.push(moinsDeMille(reste, true));
  return parts.join(" ");
}

/** « Deux mille six cent dix-neuf dinars et cinq cent quatre-vingt-quinze millimes ». */
export function montantEnLettres(montant: number): string {
  const dinars = Math.floor(montant + 1e-9);
  const millimes = Math.round((montant - dinars) * 1000);
  const dinarsTxt = `${nombreEnLettres(dinars)} dinar${dinars > 1 ? "s" : ""}`;
  const texte = millimes > 0 ? `${dinarsTxt} et ${nombreEnLettres(millimes)} millime${millimes > 1 ? "s" : ""}` : dinarsTxt;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// ── Modèle d'impression ───────────────────────────────────────────────────

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const jjmmaaaa = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

const lignesTexte = (s: string) => echapper(s).replace(/\n/g, "<br>");

const quantiteTexte = (q: number) => q.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

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
  @page{size:A4;margin:16mm 14mm}
  *{box-sizing:border-box}
  body{font:13px/1.5 Inter,Arial,sans-serif;color:#1c2b3a;margin:0}
  .page{min-height:265mm;display:flex;flex-direction:column}
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
<div class="signature"><div>Cachet et signature</div></div>
<div class="pied">${c.mentions ? lignesTexte(c.mentions) : `${echapper(c.nom || "Cabinet")} — Facture ${echapper(f.numero)}`}</div>
</div></body></html>`;
}

/** Ouvre la facture dans un nouvel onglet et lance l'impression (après le logo). */
export function imprimerFacture(f: Facture, cabinet: FactureCabinet | null): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(htmlFacture(f, cabinet, window.location.origin));
  w.document.close();
  w.focus();
  const logo = w.document.images[0];
  if (logo && !logo.complete) {
    logo.onload = logo.onerror = () => w.print();
  } else {
    w.print();
  }
  return true;
}
