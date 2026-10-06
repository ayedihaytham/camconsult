import type { Facture, FactureLigne } from "@/types";

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

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const jjmmaaaa = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Page HTML autonome de la facture, prête à imprimer / enregistrer en PDF. */
export function htmlFacture(f: Facture): string {
  const lignes = f.lignes
    .map(
      (l) => `<tr><td>${echapper(l.description)}</td><td class="n">${formatTnd(l.quantite).replace(/,000$/, "")}</td>
        <td class="n">${formatTnd(l.montantHt)}</td><td class="n">${formatTnd(l.quantite * l.montantHt)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${echapper(f.numero)}</title>
<style>
  body{font:14px/1.5 Inter,Arial,sans-serif;color:#1c2b3a;margin:40px}
  h1{font:600 28px Georgia,serif;margin:0 0 4px}
  .tete{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #c8a96a;padding-bottom:16px;margin-bottom:24px}
  .meta{text-align:right;color:#55606b}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th{background:#f3eee4;text-align:left;padding:8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  td{padding:8px;border-bottom:1px solid #e7e0d2}
  .n{text-align:right;font-variant-numeric:tabular-nums}
  .totaux{margin:20px 0 0 auto;width:320px}
  .totaux div{display:flex;justify-content:space-between;padding:4px 0;color:#55606b}
  .totaux .net{border-top:2px solid #1c2b3a;margin-top:6px;padding-top:8px;color:#1c2b3a;font-weight:700;font-size:16px}
  .pied{margin-top:48px;color:#55606b;font-size:12px}
</style></head><body>
<div class="tete"><div><h1>Facture d'honoraires</h1><div>N° <b>${echapper(f.numero)}</b></div></div>
<div class="meta"><div>Émise le ${jjmmaaaa(f.dateEmission)}</div>${f.echeance ? `<div>Échéance : ${jjmmaaaa(f.echeance)}</div>` : ""}</div></div>
<div><div style="color:#55606b;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Client</div><b>${echapper(f.societeNom)}</b></div>
<table><thead><tr><th>Description</th><th class="n">Quantité</th><th class="n">Montant HT</th><th class="n">Total HT</th></tr></thead><tbody>${lignes}</tbody></table>
<div class="totaux"><div><span>Total HT</span><span>${formatTnd(f.totalHt)} TND</span></div>
<div><span>TVA (${f.tvaTaux} %)</span><span>${formatTnd(f.tva)} TND</span></div>
<div><span>Timbre fiscal</span><span>${formatTnd(f.timbre)} TND</span></div>
<div class="net"><span>Net à payer</span><span>${formatTnd(f.netAPayer)} TND</span></div></div>
${f.note ? `<p class="pied">${echapper(f.note)}</p>` : ""}
</body></html>`;
}

/** Ouvre la facture dans un nouvel onglet et lance l'impression. */
export function imprimerFacture(f: Facture): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(htmlFacture(f));
  w.document.close();
  w.focus();
  w.print();
  return true;
}
