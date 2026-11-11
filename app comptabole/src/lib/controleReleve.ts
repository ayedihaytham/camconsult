import type { PdfCell } from "@/lib/pdfTables";
import type { PdfTextItem } from "@/lib/pdfToTables";

/**
 * Contrôles d'un relevé converti, ceux qu'un comptable ferait à la main : les totaux des colonnes Débit et Crédit doivent être ceux que le relevé
 * imprime (« Totaux »), et solde d'ouverture + crédits − débits doit donner le solde final. Une égalité exacte à trois décimales est la preuve que
 * chaque montant a été lu juste ; un écart dit exactement de combien et dans quelle colonne il faut chercher.
 */

export interface ControleLigne {
  libelle: string;
  calcule: number;
  releve: number;
  ecart: number;
  ok: boolean;
}

export interface ControleReleve {
  lignes: ControleLigne[];
  ok: boolean;
}

const MONTANT = /(?<![\d,.])(?:\d{1,3}(?:[  ]\d{3})+|\d+)[,.]\d{2,3}(?!\d)/g;

/** « 3 139 858,580 » → 3139858.58 ; null si ce n'est pas un montant. */
export function montantDe(texte: string): number | null {
  const propre = String(texte ?? "").replace(/[  ]/g, "").replace(",", ".").trim();
  return /^-?\d+(\.\d+)?$/.test(propre) ? Number(propre) : null;
}

/** Lignes de texte d'une page : les morceaux de même hauteur de base sont réunis, de gauche à droite. */
function lignesDeTexte(items: PdfTextItem[]): string[] {
  const tries = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lignes: PdfTextItem[][] = [];
  for (const item of tries) {
    const derniere = lignes[lignes.length - 1];
    if (derniere && Math.abs(derniere[0].y - item.y) <= Math.max(2, derniere[0].h * 0.6)) derniere.push(item);
    else lignes.push([item]);
  }
  return lignes.map((l) => l.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join(" "));
}

const montantsDeLigne = (ligne: string): number[] => [...ligne.matchAll(MONTANT)].map((m) => montantDe(m[0])).filter((n): n is number => n !== null);
const arrondi = (n: number) => Math.round(n * 1000) / 1000;

/** Totaux et solde imprimés par le relevé (dernière ligne « Totaux » et dernière ligne « Solde » sans date), s'ils existent. */
export function totauxImprimes(pages: PdfTextItem[][]): { debit: number; credit: number; soldeDebit?: number; soldeCredit?: number } | null {
  let totaux: { debit: number; credit: number } | null = null;
  let solde: { debit: number; credit: number } | null = null;
  for (const items of pages) {
    for (const ligne of lignesDeTexte(items)) {
      const montants = montantsDeLigne(ligne);
      if (montants.length < 2) continue;
      if (/\bTotaux?\b/i.test(ligne)) totaux = { debit: montants[montants.length - 2], credit: montants[montants.length - 1] };
      else if (/^\W*Solde\b/i.test(ligne) && !/\d{2}[-/.]\d{2}[-/.]\d{4}/.test(ligne)) solde = { debit: montants[montants.length - 2], credit: montants[montants.length - 1] };
    }
  }
  if (!totaux) return null;
  return { ...totaux, ...(solde ? { soldeDebit: solde.debit, soldeCredit: solde.credit } : {}) };
}

/** Solde de départ et solde final imprimés (« Solde départ au 01 SEP 26 … », « Solde fin 26 OCT 26 … »), pour les relevés sans ligne « Totaux ». */
export function soldesImprimes(pages: PdfTextItem[][]): { depart: number; fin: number } | null {
  let depart: number | null = null;
  let fin: number | null = null;
  for (const items of pages) {
    for (const brute of lignesDeTexte(items)) {
      // Une date (« 26 OCT 26 », « 01/09/2026 ») collée au montant ne doit pas s'y ajouter : « 26 OCT 26 494 710,12 » vaut 494 710,12.
      const ligne = brute.replace(/\d{1,2}[ /.-]?(?:janv?|f[ée]vr?|mars?|avr|mai|juin|juil|ao[uû]t?|sept?|oct|nov|d[ée]c|jan|feb|mar|apr|may|jun|jul|aug|sep|dec)[a-zéû]*\.?[ /.-]?\d{2,4}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/gi, " ");
      const montants = montantsDeLigne(ligne);
      if (montants.length === 0) continue;
      if (/^\W*(ancien\s+solde|solde\s+(d[ée]part|initial|pr[ée]c[ée]dent|d'ouverture|ouverture|report))/i.test(ligne) && depart === null) depart = montants[montants.length - 1];
      else if (/^\W*(nouveau\s+solde|solde\s+(fin|final|nouveau|de\s+cl[oô]ture|cl[oô]ture|arr[êe]t[ée]))/i.test(ligne)) fin = montants[montants.length - 1];
    }
  }
  return depart !== null && fin !== null ? { depart, fin } : null;
}

const ligneControle = (libelle: string, calcule: number, releve: number): ControleLigne => ({ libelle, calcule: arrondi(calcule), releve: arrondi(releve), ecart: arrondi(calcule - releve), ok: Math.abs(calcule - releve) < 0.0051 });

/** Preuve ligne par ligne d'un relevé qui imprime une colonne « Solde » : chaque solde doit être le précédent, plus les crédits et moins les débits
 * (ou l'inverse selon la banque, ou dans l'ordre inverse des dates). Une ligne dont le solde ne suit pas a un montant mal lu ou rangé dans la mauvaise colonne. */
export function verifierChaineSoldes(mouvements: string[][], depart: number | null): { verifiees: number; suspectes: { rang: number; libelle: string; attendu: number; lu: number }[] } | null {
  const entete = mouvements[0] ?? [];
  const iDebit = entete.findIndex((c) => /d[ée]bit/i.test(c));
  const iCredit = entete.findIndex((c) => /cr[ée]dit/i.test(c));
  const iSolde = entete.findIndex((c) => /^solde$/i.test(c.trim()));
  const iLibelle = entete.findIndex((c) => /libell|d[ée]signation/i.test(c));
  if (iDebit < 0 || iCredit < 0 || iSolde < 0) return null;
  const lignes = mouvements.slice(1).map((l, rang) => ({ rang: rang + 1, libelle: l[iLibelle] ?? "", d: montantDe(l[iDebit] ?? "") ?? 0, c: montantDe(l[iCredit] ?? "") ?? 0, s: montantDe(l[iSolde] ?? "") }));
  if (lignes.filter((l) => l.s !== null).length < 3) return null;

  // sens : +1 = le crédit augmente le solde ; l'ordre des lignes peut être celui des dates ou son inverse.
  const essai = (sens: 1 | -1, inverse: boolean) => {
    const suite = inverse ? [...lignes].reverse() : lignes;
    let precedent = !inverse ? depart : null;
    let bons = 0;
    const mauvaises: { rang: number; libelle: string; attendu: number; lu: number }[] = [];
    for (const l of suite) {
      if (l.s === null) continue;
      if (precedent !== null) {
        const attendu = arrondi(precedent + sens * (l.c - l.d));
        if (Math.abs(attendu - l.s) < 0.0051) bons++;
        else mauvaises.push({ rang: l.rang, libelle: l.libelle, attendu, lu: l.s });
      }
      precedent = l.s;
    }
    return { bons, mauvaises };
  };
  const choix = ([1, -1] as const).flatMap((sens) => [false, true].map((inverse) => essai(sens, inverse))).sort((a, b) => b.bons - a.bons)[0];
  const total = choix.bons + choix.mauvaises.length;
  // Si aucun sens ne tient pour la majorité des lignes, ce n'est pas une colonne de solde courant : on ne conclut rien.
  if (total < 3 || choix.bons / total < 0.6) return null;
  return { verifiees: total, suspectes: choix.mauvaises };
}

/** Compare les mouvements extraits (en-tête, puis une ligne par opération) aux preuves que le relevé imprime : totaux, soldes de départ et final,
 * colonne « Solde » ligne par ligne. Renvoie null si le relevé n'imprime aucune preuve (il est alors « non vérifiable »). */
export function controleReleve(pages: PdfTextItem[][], mouvements: string[][]): ControleReleve | null {
  const entete = mouvements[0] ?? [];
  const iDebit = entete.findIndex((c) => /d[ée]bit/i.test(c));
  const iCredit = entete.findIndex((c) => /cr[ée]dit/i.test(c));
  const iLibelle = entete.findIndex((c) => /libell|d[ée]signation/i.test(c));
  if (iDebit < 0 || iCredit < 0) return null;
  const imprimes = totauxImprimes(pages);
  const soldes = soldesImprimes(pages);
  const lignes: ControleLigne[] = [];

  let debit = 0;
  let credit = 0;
  let ouverture = 0;
  for (const ligne of mouvements.slice(1)) {
    const d = montantDe(ligne[iDebit] ?? "") ?? 0;
    const c = montantDe(ligne[iCredit] ?? "") ?? 0;
    if (imprimes && iLibelle >= 0 && /^\W*solde\b/i.test(ligne[iLibelle] ?? "")) { ouverture += c - d; continue; }
    debit += d;
    credit += c;
  }
  if (imprimes) {
    lignes.push(ligneControle("Total débit", debit, imprimes.debit), ligneControle("Total crédit", credit, imprimes.credit));
    if (imprimes.soldeCredit !== undefined && imprimes.soldeDebit !== undefined) {
      lignes.push(ligneControle("Solde final (ouverture + crédits − débits)", ouverture + credit - debit, imprimes.soldeCredit - imprimes.soldeDebit));
    }
  } else if (soldes) {
    lignes.push(ligneControle("Solde final (départ + crédits − débits)", soldes.depart + credit - debit, soldes.fin));
  }

  const chaine = verifierChaineSoldes(mouvements, soldes?.depart ?? null);
  if (chaine) {
    lignes.push({ libelle: `Lignes dont le solde ne suit pas (sur ${chaine.verifiees})`, calcule: chaine.suspectes.length, releve: 0, ecart: chaine.suspectes.length, ok: chaine.suspectes.length === 0 });
    for (const m of chaine.suspectes.slice(0, 12)) lignes.push({ libelle: `Ligne ${m.rang} : ${m.libelle.slice(0, 45)}`, calcule: m.attendu, releve: m.lu, ecart: arrondi(m.attendu - m.lu), ok: false });
  }
  if (lignes.length === 0) return null;
  return { lignes, ok: lignes.every((l) => l.ok) };
}

/** Feuille « Contrôle » de l'Excel : ce qui est calculé, ce que le relevé imprime, l'écart et le verdict. */
export function feuilleControle(controle: ControleReleve): { name: string; rows: PdfCell[][]; headerRow: boolean } {
  return {
    name: "Contrôle",
    headerRow: true,
    rows: [
      ["Contrôle", "Calculé", "Relevé", "Écart", "Résultat"],
      ...controle.lignes.map((l) => [l.libelle, l.calcule, l.releve, l.ecart, l.ok ? "OK" : "À vérifier"] as PdfCell[]),
    ],
  };
}

const sansFautes = (libelle: string) => libelle.toLowerCase().replace(/[^a-z0-9]/g, "");

function distance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  let precedent = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const courant = [i];
    for (let j = 1; j <= n; j++) courant[j] = Math.min(precedent[j] + 1, courant[j - 1] + 1, precedent[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    precedent = courant;
  }
  return precedent[n];
}

/** « Virement recu de l'etranger Virement recu de l'etr » : une description reprise deux fois, la seconde tronquée, redevient la première. */
export function sansRepetition(libelle: string): string {
  const mots = libelle.split(/\s+/);
  for (let k = 1; k < mots.length; k++) {
    const a = mots.slice(0, k).join(" ");
    const b = mots.slice(k).join(" ");
    if (b.length >= 10 && b.length < a.length && a.toLowerCase().startsWith(b.toLowerCase())) return a;
  }
  return libelle;
}

/**
 * Libellés lus par OCR : une variante abîmée (« Cemmission reglement », « Commissionreglement ») est ramenée au libellé le plus fréquent du relevé quand
 * elle n'en diffère que d'une ou deux lettres et que ce libellé revient au moins trois fois plus souvent. Les libellés rares ou qui contiennent des
 * chiffres (références) ne sont jamais touchés : on ne « corrige » que ce que le relevé lui-même confirme.
 */
export function harmoniserLibelles(mouvements: string[][], connus: string[] = []): string[][] {
  const entete = mouvements[0] ?? [];
  const iLibelle = entete.findIndex((c) => /libell|d[ée]signation/i.test(c));
  if (iLibelle < 0) return mouvements;
  const frequences = new Map<string, number>();
  for (const l of mouvements.slice(1)) {
    const texte = (l[iLibelle] ?? "").trim();
    if (texte) frequences.set(texte, (frequences.get(texte) ?? 0) + 1);
  }
  // Libellés déjà enregistrés dans le compte : ils servent de modèles au même titre que les libellés fréquents du relevé.
  for (const k of new Set(connus.map((x) => x.trim()))) if (k) frequences.set(k, (frequences.get(k) ?? 0) + 3);
  const modeles = [...frequences.entries()].filter(([t, n]) => n >= 3 && t.length >= 8 && !/\d/.test(t)).sort((a, b) => b[1] - a[1]);
  const corriger = (texte: string): string => {
    const t = sansRepetition(texte.trim());
    if (!t || /\d/.test(t) || t.length < 8) return texte;
    const n = frequences.get(t) ?? 0;
    const cle = sansFautes(t);
    for (const [modele, nombre] of modeles) {
      if (modele === t || nombre < n * 3) continue;
      const d = distance(cle, sansFautes(modele));
      if (d <= 2) return modele;
    }
    // Aucun modèle plus fréquent, mais la description répétée (« … de l'etranger … de l'etr ») est tout de même réduite à une seule.
    return t;
  };
  return [mouvements[0], ...mouvements.slice(1).map((l) => l.map((c, i) => (i === iLibelle ? corriger(c) : c)))];
}
