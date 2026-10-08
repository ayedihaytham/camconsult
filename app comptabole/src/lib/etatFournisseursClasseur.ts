import { cleNumero } from "@/lib/facturesDoublons";
import { dateFlexible, montantCellule, normaliser, texte } from "@/lib/banque";
import type { FusionVerticale } from "@/lib/banqueClasseur";
import type { ModeReglement } from "@/types";

/** Proforma d'un fournisseur, telle qu'elle figure en tête d'un groupe de factures. */
export interface ProformaClasseur {
  num: string;
  date: string | null;
  qte: number | null;
  montant: number | null;
  etat: string;
}

/** Une ligne de facture d'achat du classeur : une facture, ou un lot de factures regroupées dans une même cellule. */
export interface FactureClasseur {
  /** Première ligne du classeur (à partir de 1). */
  ligne: number;
  /** Numéro tel qu'écrit dans le classeur. */
  texteNumero: string;
  /** Numéros de facture distincts de la cellule, sans espaces ni ponctuation. */
  numeros: string[];
  date: string | null;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  venteNumFacture: string;
  declaration: string;
  proforma: ProformaClasseur | null;
  numTitre: string;
  etatChargement: string;
  vuPasse: string;
  /** Règlement qui solde cette ligne (indice dans `reglements`), quand les règlements sont alignés sur les factures. */
  reglement: number | null;
}

export interface ReglementClasseur {
  /** Lignes du classeur (à partir de 1) couvertes par ce règlement. */
  lignes: number[];
  date: string | null;
  mode: ModeReglement;
  reference: string;
  banque: string;
  rsNumero: string;
  rsMontant: number;
  /** Montant réellement viré (net de retenue). */
  vire: number;
  /** Indices dans `factures` des lignes soldées, ou vide quand le règlement n'est pas aligné sur une facture. */
  factures: number[];
}

export interface FeuilleFournisseur {
  nom: string;
  /** Règlements qui ne tombent sur aucune ligne de facture (listés à part) : ils soldent les factures restantes, dans l'ordre. */
  orphelins: number;
  factures: FactureClasseur[];
  reglements: ReglementClasseur[];
  avertissements: string[];
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const entete = (v: unknown) => normaliser(texte(v)).toLowerCase().replace(/[°º]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

type Role =
  | "numProforma" | "dateProforma" | "qteProforma" | "montProforma" | "numFacture" | "dateFacture" | "qte" | "qteFact"
  | "designation" | "pu" | "montFac" | "montFact" | "dateReglement" | "mode" | "numRs" | "rs" | "vire" | "banque"
  | "venteNum" | "etatProf" | "declaration" | "titre" | "chargement" | "vuPasse";

const ROLES: [Role, RegExp][] = [
  ["numProforma", /^n (fact )?prof$/],
  ["dateProforma", /^date prof$/],
  ["qteProforma", /^qte prof$/],
  ["montProforma", /^mont(ant)? prof$/],
  ["numFacture", /^n (fact(ure)?)( achat)?$/],
  ["dateFacture", /^date fact(ure)?$/],
  ["qteFact", /^qte fact$/],
  ["qte", /^qte$/],
  ["designation", /^designation$/],
  ["pu", /^(p u|pu)$/],
  ["montFact", /^mont fact$/],
  ["montFac", /^mont fac$/],
  ["dateReglement", /^date transf( chq)?$/],
  ["mode", /^mode de r/],
  ["numRs", /^n rs$/],
  ["rs", /^rs$/],
  ["vire", /^mont (virmt|reg)/],
  ["banque", /^(bq|banque)$/],
  ["venteNum", /^fact vente n$/],
  ["etatProf", /^etat prof$/],
  ["declaration", /^n declaration$/],
  ["titre", /^n titre$/],
  ["chargement", /^etat de chargement$/],
  ["vuPasse", /^vu passe$/],
];

/** Mode et référence d'une cellule « MODE DE RGLT » : « CHQ N°9200013 », « CHEQ N° 4000126   CHQ N° 9200020 », « TRANSFERT »… */
export function lireMode(brut: string): { mode: ModeReglement; reference: string } {
  const t = normaliser(brut).trim();
  const numeros = [...new Set(t.match(/\d{4,}/g) ?? [])];
  if (/CHQ|CHEQ/.test(t)) return { mode: "cheque", reference: numeros.join(" / ") };
  if (/EFFET/.test(t)) return { mode: "effet", reference: numeros.join(" / ") };
  if (/ESP/.test(t)) return { mode: "especes", reference: "" };
  if (/VIR|TRANSF/.test(t)) return { mode: "virement", reference: numeros.join(" / ") };
  return { mode: "autre", reference: brut.trim() };
}

/** Banque d'un règlement : « BARAKA », « ALBARAKA » et « AL BARAKA » sont la même banque. */
export function normaliserBanque(brut: string): string {
  const t = normaliser(brut).replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (/\bBTL\b/.test(t) && /BARAKA/.test(t)) return "BTL / AL BARAKA";
  if (/AL ?BARAKA|BARAKA/.test(t)) return "AL BARAKA";
  return t;
}

/** Numéros de facture d'une cellule : « 902033185   902033341 », « 902034155/902034136 », « 160/2026 » (un seul numéro). */
export function numerosFacture(brut: string): string[] {
  const out: string[] = [];
  for (const morceau of brut.split(/\s+/)) {
    if (!morceau) continue;
    const parties = /^\d{1,4}\/\d{4}$/.test(morceau) ? [morceau] : morceau.split(/[/;,]+/);
    for (const p of parties) {
      const n = cleNumero(p);
      if (n.length >= 6 && /\d/.test(n) && !out.includes(n)) out.push(n);
      else if (/^\d{1,4}\/\d{4}$/.test(p) && !out.includes(cleNumero(p))) out.push(cleNumero(p));
    }
  }
  return out;
}

const dateCellule = (v: unknown): string | null => (v instanceof Date || typeof v === "string" ? dateFlexible(v) : null);
const nombre = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" ? montantCellule(v) : 0);
const plein = (v: unknown) => v !== null && v !== undefined && texte(v) !== "";

/** Une feuille d'état fournisseur du cabinet : une facture par ligne (ou un lot de factures par cellule), la proforma qui les
 * regroupe à gauche, et les règlements à droite — fusionnés sur les lignes qu'ils soldent, ou listés à part. */
export function lireFeuilleFournisseur(nom: string, rows: unknown[][], fusions: FusionVerticale[]): FeuilleFournisseur | null {
  // ── en-tête ─────────────────────────────────────────────────────────────
  let enTete = -1;
  const colonnes = new Map<Role, number[]>();
  for (let i = 0; i < Math.min(rows.length, 10) && enTete < 0; i++) {
    const trouve = new Map<Role, number[]>();
    (rows[i] ?? []).forEach((cell, c) => {
      const t = entete(cell);
      const role = t ? ROLES.find(([, re]) => re.test(t))?.[0] : undefined;
      if (role) trouve.set(role, [...(trouve.get(role) ?? []), c]);
    });
    if (trouve.has("numFacture") && (trouve.has("montFact") || trouve.has("montFac"))) {
      enTete = i;
      trouve.forEach((v, k) => colonnes.set(k, v));
    }
  }
  if (enTete < 0) return null;
  const colNum = colonnes.get("numFacture")![0];
  const premiere = (role: Role) => colonnes.get(role)?.[0];
  /** Colonne du côté facture (à droite du n° de facture) quand l'en-tête existe en double (désignation, P.U). */
  const cote = (role: Role, apres: boolean) => {
    const l = colonnes.get(role) ?? [];
    return apres ? l.find((c) => c > colNum) ?? l[0] : l.find((c) => c < colNum) ?? l[0];
  };

  const fus = (colonne: number, ligne: number) => fusions.find((f) => f.colonne === colonne && ligne >= f.ligne1 && ligne <= f.ligne2);
  /** Valeur d'une cellule, ou celle de la cellule fusionnée qui la contient. */
  const val = (ligne: number, colonne: number | undefined): unknown => {
    if (colonne === undefined) return null;
    const v = (rows[ligne] ?? [])[colonne];
    if (plein(v)) return v;
    const f = fus(colonne, ligne);
    return f && f.ligne1 < ligne ? (rows[f.ligne1] ?? [])[colonne] : v;
  };
  const propre = (ligne: number, colonne: number | undefined) => texte(val(ligne, colonne)).replace(/\s+/g, " ").trim();

  const cDesignFact = cote("designation", true);
  const cDesignProf = cote("designation", false);
  const cPu = cote("pu", true);
  const cMont = premiere("montFact") ?? premiere("montFac");
  const cQte = premiere("qteFact") ?? premiere("qte");
  const cDateFact = premiere("dateFacture");

  const premierData = enTete + 1;
  const derniere = rows.length - 1;

  // ── règlements : cellules de la zone « règlement » regroupées par fusion ──
  const colsReglement = (["dateReglement", "mode", "numRs", "rs", "vire", "banque"] as Role[]).flatMap((r) => colonnes.get(r) ?? []);
  const parent = new Map<number, number>();
  const racine = (x: number): number => {
    let r = x;
    while ((parent.get(r) ?? r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: number, b: number) => parent.set(racine(a), racine(b));
  // Seules les cellules qui identifient un règlement (date, mode, montant viré) regroupent des lignes ; le n° de RS ou la banque
  // peuvent être fusionnés sur deux règlements distincts.
  const colsIdentite = (['dateReglement', 'mode', 'vire'] as Role[]).flatMap((r) => colonnes.get(r) ?? []);
  for (const f of fusions) {
    if (!colsIdentite.includes(f.colonne) || f.ligne1 < premierData) continue;
    for (let l = f.ligne1 + 1; l <= f.ligne2; l++) union(f.ligne1, l);
  }
  const aPaiement = (l: number) =>
    colsReglement.some((c) => plein((rows[l] ?? [])[c]) || (fus(c, l) && fus(c, l)!.ligne1 < l));
  const groupes = new Map<number, number[]>();
  for (let l = premierData; l <= derniere; l++) {
    if (!aPaiement(l)) continue;
    const g = racine(l);
    groupes.set(g, [...(groupes.get(g) ?? []), l]);
  }

  // ── factures ─────────────────────────────────────────────────────────────
  const factures: FactureClasseur[] = [];
  const avertissements: string[] = [];
  const indexParLigne = new Map<number, number>();
  for (let l = premierData; l <= derniere; ) {
    const brut = propre(l, colNum);
    const f = fus(colNum, l);
    const fin = f ? Math.min(f.ligne2, derniere) : l;
    const numeros = numerosFacture(brut);
    // Plusieurs lignes d'une même cellule fusionnée : un seul lot de factures, les quantités et montants s'additionnent.
    let quantite = 0;
    let montant = 0;
    for (let k = l; k <= fin; k++) {
      quantite += nombre((rows[k] ?? [])[cQte ?? -1]);
      montant += nombre((rows[k] ?? [])[cMont ?? -1]);
    }
    if (/annul|^liste/i.test(brut)) {
      avertissements.push(`Ligne ${l + 1} : « ${brut} » ignorée.`);
      l = fin + 1;
      continue;
    }
    // Une ligne avec des quantités et un montant mais sans n° de facture (pas encore facturée) reste une ligne du classeur.
    if (numeros.length === 0 && !(montant > 0 && quantite > 0)) {
      l = fin + 1;
      continue;
    }
    const prf = (role: Role) => premiere(role);
    const numProf = propre(l, prf("numProforma"));
    const proforma: ProformaClasseur | null = numProf
      ? {
          num: numProf,
          date: dateCellule(val(l, prf("dateProforma"))),
          qte: plein(val(l, prf("qteProforma"))) ? nombre(val(l, prf("qteProforma"))) : null,
          montant: plein(val(l, prf("montProforma"))) ? nombre(val(l, prf("montProforma"))) : null,
          etat: propre(l, prf("etatProf")),
        }
      : null;
    const entree: FactureClasseur = {
      ligne: l + 1,
      texteNumero: brut,
      numeros,
      date: cDateFact === undefined ? null : dateCellule(val(l, cDateFact)),
      designation: propre(l, cDesignFact) || propre(l, cDesignProf),
      quantite: r3(quantite),
      prixUnitaire: nombre(val(l, cPu)),
      montant: r3(montant),
      venteNumFacture: propre(l, prf("venteNum")),
      declaration: propre(l, prf("declaration")),
      proforma,
      numTitre: propre(l, prf("titre")),
      etatChargement: propre(l, prf("chargement")),
      vuPasse: propre(l, prf("vuPasse")),
      reglement: null,
    };
    for (let k = l; k <= fin; k++) indexParLigne.set(k, factures.length);
    factures.push(entree);
    l = fin + 1;
  }

  // ── règlements ───────────────────────────────────────────────────────────
  const reglements: ReglementClasseur[] = [];
  let orphelins = 0;
  for (const lignes of [...groupes.values()].sort((a, b) => a[0] - b[0])) {
    const somme = (role: Role) =>
      lignes.reduce((s, l) => s + (colonnes.get(role) ?? []).reduce((t, c) => t + nombre((rows[l] ?? [])[c]), 0), 0);
    const premiereValeur = (role: Role) => {
      for (const l of lignes) {
        const t = propre(l, premiere(role));
        if (t) return t;
      }
      return "";
    };
    const date = lignes.map((l) => dateCellule((rows[l] ?? [])[premiere("dateReglement") ?? -1])).find(Boolean) ?? null;
    const { mode, reference } = lireMode(premiereValeur("mode"));
    const numsRs = [...new Set(lignes.map((l) => propre(l, premiere("numRs"))).filter(Boolean))];
    const idx = [...new Set(lignes.map((l) => indexParLigne.get(l)).filter((x): x is number => x !== undefined))];
    if (idx.length === 0) orphelins++;
    reglements.push({
      lignes: lignes.map((l) => l + 1),
      date,
      mode,
      reference,
      banque: normaliserBanque(premiereValeur("banque")),
      rsNumero: numsRs.join(" / "),
      rsMontant: r3(somme("rs")),
      vire: r3(somme("vire")),
      factures: idx,
    });
  }
  reglements.forEach((r, i) => r.factures.forEach((f) => (factures[f].reglement ??= i)));

  if (factures.length === 0) return null;
  return { nom, orphelins, factures, reglements, avertissements };
}

/** Feuilles d'un classeur d'états fournisseurs : une feuille par fournisseur (ou par site de production). */
export function lireEtatsFournisseurs(feuilles: { nom: string; rows: unknown[][]; fusions: FusionVerticale[] }[]): {
  feuilles: FeuilleFournisseur[];
  ignorees: string[];
} {
  const lues: FeuilleFournisseur[] = [];
  const ignorees: string[] = [];
  for (const f of feuilles) {
    const lue = lireFeuilleFournisseur(f.nom.trim(), f.rows, f.fusions);
    if (lue) lues.push(lue);
    else ignorees.push(f.nom.trim());
  }
  return { feuilles: lues, ignorees };
}
