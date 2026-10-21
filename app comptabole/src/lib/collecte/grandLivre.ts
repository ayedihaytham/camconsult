import { convertirNombre } from "@/lib/pdfToTables";
import { TAB_BY_KEY, type TabRow } from "./tabs";

import { arrondi3 as r3 } from "../../../shared/arrondi.js";
/** Une écriture du grand-livre d'un compte (Sage 100 : date, code journal, n° de pièce, libellé, débit, crédit). */
export interface EcritureLivre {
  date: string;
  journal: string;
  piece: string;
  /** Libellé complet, lignes de suite comprises (« PAIEMENT CHQ N°144167 ADEL EDHAWTHI »). */
  libelle: string;
  debit: number;
  credit: number;
  nature: NatureEcriture;
  /** Sens précis, lisible : « Chèque encaissé », « Règlement par chèque », « Virement étranger »… */
  sousType: string;
  /** Compte du grand-livre d'où vient l'écriture (code à 6 chiffres) et son type, qui fixe le sens débit/crédit. */
  compte: string;
  classe: ClasseCompte;
  /** Client ou fournisseur du compte (grand-livre d'un compte de tiers) : l'émetteur ou le bénéficiaire que le libellé ne donne pas. */
  tiers: string;
  /** Repère imprimé dans « Observations » : retrouve l'écriture d'origine et évite de l'importer deux fois. */
  origine: string;
  /** Montant de l'opération : le côté du compte qui représente l'argent reçu ou payé (le crédit d'un compte d'attente, le débit d'une banque…). */
  montant: number;
}

export type NatureEcriture = "cheque_emis" | "cheque_recu" | "effet_recu" | "virement_emis" | "virement_recu" | "swift" | "carte_bancaire" | "report" | "autre";

/** Type de compte : fixe quel côté (débit ou crédit) est un encaissement et lequel un paiement. */
export type ClasseCompte = "attente" | "banque" | "client" | "fournisseur" | "inconnue";

export interface GrandLivre {
  societe: string;
  compte: string;
  /** Tous les comptes du document (un grand-livre « complet » en contient plusieurs) ; `compte` est le premier. */
  comptes: { compte: string; classe: ClasseCompte; ecritures: number; totaux: { debit: number; credit: number } | null }[];
  ecritures: EcritureLivre[];
  /** Totaux « À reporter » / « Total » imprimés au pied du document. */
  totaux: { debit: number; credit: number } | null;
  /** Les écritures lues additionnent bien les totaux imprimés (aucune ligne perdue à la lecture). */
  controle: boolean | null;
}

const montant = (v: string) => {
  const t = v.trim();
  if (!t) return 0;
  const n = convertirNombre(t.replace(/^-/, ""));
  return n === null ? 0 : Math.abs(r3(n));
};

/** « 060126 » -> « 2026-01-06 ». */
function dateSage(v: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (!m) return null;
  const [, jj, mm, aa] = m;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(jj) < 1 || Number(jj) > 31) return null;
  return `20${aa}-${mm}-${jj}`;
}

const maj = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

/** Type d'un compte d'après son numéro (plan comptable tunisien) : 46/47 attente, 51/52 banque, 41 clients, 40 fournisseurs. */
export function classeCompte(numero: string): ClasseCompte {
  if (/^(46|47)/.test(numero)) return "attente";
  if (/^(51|52)/.test(numero)) return "banque";
  if (/^41/.test(numero)) return "client";
  if (/^40/.test(numero)) return "fournisseur";
  return "inconnue";
}

/** Côté du compte où se lit un encaissement (entrée d'argent) et un paiement (sortie). Compte d'attente : le crédit est une somme reçue,
 * le débit une somme payée. Banque : l'inverse. Client : seul le règlement (crédit) compte, le débit est une facture. Fournisseur :
 * seul le paiement (débit) compte, le crédit est une facture. Compte non reconnu : lu comme un compte d'attente. */
const SENS: Record<ClasseCompte, { entrant: "debit" | "credit" | null; sortant: "debit" | "credit" | null }> = {
  attente: { entrant: "credit", sortant: "debit" },
  banque: { entrant: "debit", sortant: "credit" },
  client: { entrant: "credit", sortant: null },
  fournisseur: { entrant: null, sortant: "debit" },
  inconnue: { entrant: "credit", sortant: "debit" },
};

/** Nature d'une écriture d'après son libellé et son sens : chèque émis, chèque ou effet encaissé, virement… */
export function natureEcriture(libelle: string, debit: number, credit: number, journal = "", classe: ClasseCompte = "attente"): NatureEcriture {
  const l = maj(libelle);
  if (/^RAN$/.test(maj(journal)) || /SOLDE ANTERIEUR|REPORT A NOUVEAU/.test(l)) return "report";
  const sens = SENS[classe];
  const entrant = sens.entrant === "credit" ? credit : sens.entrant === "debit" ? debit : 0;
  const sortant = sens.sortant === "credit" ? credit : sens.sortant === "debit" ? debit : 0;
  const recu = entrant > 0 && sortant === 0;
  const paye = sortant > 0 && entrant === 0;
  // « ACHAT NEGOCIE SUR LE MARCHE » (ou « NEGOCE ») : achat de devises négocié sur le marché, réglé par un virement SWIFT à justifier par une facture.
  if (/\bACHATS?\s+NEGOCI?E?\s+SUR\s+(LE\s+)?MARCHE\b/.test(l)) return "swift";
  // « REG PAR CB » (règlement par carte bancaire) : un paiement chez un commerçant, à justifier par son ticket ou sa facture.
  if (/\b(REG|REGLEMENT|PAIEMENT)\s+(PAR\s+)?CB\b|\bCARTE\s+BANCAIRE\b/.test(l) && (debit > 0 || credit > 0)) return "carte_bancaire";
  if (/\bVIR\w*\s+EMIS\b|\bVIREMENT\s+EMIS\b/.test(l)) return "virement_emis";
  if (/\bEFFET\b/.test(l) && entrant > 0) return "effet_recu";
  if (paye && /\bBLOCAGE\b/.test(l)) return "cheque_emis";
  if (/\bCHQ\b|\bCHEQUE\b/.test(l)) {
    if (recu) return "cheque_recu";
    if (paye) return "cheque_emis";
    return entrant > 0 ? "cheque_recu" : "autre";
  }
  if (/\bVIR|TRANSPFET|TRANSFERT/.test(l)) {
    if (recu) return "virement_recu";
    if (paye) return "virement_emis";
  }
  return "autre";
}

/** Sens précis d'une écriture, pour la revue avant import : chèque encaissé, règlement par chèque, virement étranger… */
export function sousTypeEcriture(libelle: string, nature: NatureEcriture): string {
  const l = maj(libelle);
  const etranger = /ETRANGER|ETRNAGER/.test(l);
  switch (nature) {
    case "report":
      return "Solde antérieur";
    case "cheque_emis":
      if (/\bREG(LEMENT)?\s+(CHQ|CHEQUE)/.test(l)) return "Règlement par chèque";
      if (/PAIEMENT/.test(l)) return "Paiement par chèque";
      if (/BLOCAGE/.test(l)) return "Chèque bloqué";
      if (/RESERV/.test(l)) return "Chèque réservé";
      return "Chèque émis";
    case "cheque_recu":
      if (/\bENC/.test(l)) return "Chèque encaissé";
      if (/REMISE/.test(l)) return "Chèque remis à la banque";
      return "Chèque reçu";
    case "effet_recu":
      if (/REMISE/.test(l)) return "Effet remis à l'encaissement";
      if (/\bENC/.test(l)) return "Effet encaissé";
      return "Effet reçu";
    case "virement_recu":
      if (/TRANSPFET|TRANSFERT/.test(l)) return etranger ? "Transfert de l'étranger" : "Transfert reçu";
      return etranger ? "Virement de l'étranger" : "Virement reçu";
    case "virement_emis":
      return etranger ? "Virement vers l'étranger" : "Virement émis";
    case "swift":
      return "Achat négocié sur le marché (SWIFT à vérifier)";
    case "carte_bancaire":
      return "Règlement par carte bancaire";
    default:
      return "À classer";
  }
}

/** Lit le grand-livre d'un compte d'après le tableau reconstruit d'un PDF Sage 100 (cellules : « date journal pièce », libellé,
 * débit, crédit, solde progressif). Renvoie null si ce n'est pas un grand-livre de ce format. */
export function lireGrandLivre(pages: string[][][]): GrandLivre | null {
  const rows = pages.flat();
  const enTete = rows.findIndex((r) => /^date\s+c\.?j/i.test(r[0] ?? "") || r.some((c) => /^libell[ée] [ée]criture/i.test(c)));
  if (enTete < 0 || !rows.some((r) => r.some((c) => /^grand-?livre/i.test(c)))) return null;

  const societe = (rows[0]?.[0] ?? "").trim();
  const estCompte = (c: string) => /^\d{6}\s+\S/.test(c) && !/^\d{6}\s+[A-Z]{2,5}\s+\d+$/.test(c);

  const ecritures: EcritureLivre[] = [];
  // Un grand-livre « complet » enchaîne plusieurs comptes : chacun a son en-tête (« 461000 COMPTES D'ATTENTE »), son sens et ses totaux.
  const comptes: (GrandLivre["comptes"][number] & { libelle: string })[] = [];
  let courant = null as (typeof comptes)[number] | null; // modifié par ouvrir() : le `as` évite que TypeScript le croie toujours nul
  const ouvrir = (intitule: string) => {
    const numero = intitule.slice(0, 6);
    courant = { compte: intitule.trim(), libelle: intitule.slice(6).trim(), classe: classeCompte(numero), ecritures: 0, totaux: null };
    comptes.push(courant);
  };
  const premier = rows.slice(enTete + 1).map((r) => (r[0] ?? "").trim()).find(estCompte) ?? rows.map((r) => (r[0] ?? "").trim()).find(estCompte);
  if (premier) ouvrir(premier);
  for (const r of rows.slice(enTete + 1)) {
    const [c0 = "", c1 = "", c2 = "", c3 = ""] = r.map((c) => c ?? "");
    const m = /^(\d{6})\s+(\S+)\s+(\d+)$/.exec(c0.trim());
    if (m && dateSage(m[1])) {
      if (!courant) ouvrir("000000");
      const cpt = courant!;
      const debit = montant(c2);
      const credit = montant(c3);
      const numero = cpt.compte.slice(0, 6);
      const tiers = cpt.classe === "client" || cpt.classe === "fournisseur" ? cpt.libelle : "";
      cpt.ecritures += 1;
      ecritures.push({
        date: dateSage(m[1])!, journal: m[2], piece: m[3], libelle: c1.trim(), debit, credit, nature: "autre", montant: 0, sousType: "",
        compte: numero, classe: cpt.classe, tiers, origine: `GL ${numero} · ${m[2]} · p.${m[3]}`,
      });
      continue;
    }
    if (estCompte(c0.trim()) && !m) {
      if (!courant || courant.compte !== c0.trim()) ouvrir(c0.trim());
      continue;
    }
    if (!c0.trim() && /^(a reporter|report|total)\b/i.test(c1.trim())) {
      if (courant) courant.totaux = { debit: montant(c2), credit: montant(c3) };
      continue;
    }
    // « Total compte 461000   du 010126 au 311226   129 838,496   24 404,150 » : le total du compte, imprimé sur une seule ligne.
    const totalCompte = /^total\s+compte\s+(\d{6})\b/i.exec(c0.trim());
    if (totalCompte) {
      const cible = comptes.find((c) => c.compte.startsWith(totalCompte[1])) ?? courant;
      if (cible) cible.totaux = { debit: montant(c2), credit: montant(c3) };
      continue;
    }
    // Suite du libellé de l'écriture précédente (« N°144167 ADEL » puis « EDHAWTHI »), sans montant.
    if (!c0.trim() && c1.trim() && !c2.trim() && !c3.trim() && ecritures.length > 0) {
      const derniere = ecritures[ecritures.length - 1];
      derniere.libelle = `${derniere.libelle} ${c1.trim()}`.replace(/N°\s+(?=\d)/g, "N°").replace(/\s+/g, " ").trim();
    }
  }
  if (ecritures.length === 0) return null;
  for (const e of ecritures) {
    e.nature = natureEcriture(e.libelle, e.debit, e.credit, e.journal, e.classe);
    e.sousType = sousTypeEcriture(e.libelle, e.nature);
    const sens = SENS[e.classe];
    const entrant = sens.entrant === "credit" ? e.credit : sens.entrant === "debit" ? e.debit : 0;
    const sortant = sens.sortant === "credit" ? e.credit : sens.sortant === "debit" ? e.debit : 0;
    e.montant = entrant > 0 ? entrant : sortant > 0 ? sortant : Math.max(e.debit, e.credit);
  }

  // Contrôle : pour chaque compte qui imprime ses totaux, les écritures lues doivent les retrouver (aucune ligne perdue à la lecture).
  const verifies = comptes.map((c) => {
    if (!c.totaux) return null;
    const lues = ecritures.filter((e) => e.compte === c.compte.slice(0, 6));
    const sd = r3(lues.reduce((s, e) => s + e.debit, 0));
    const sc = r3(lues.reduce((s, e) => s + e.credit, 0));
    return Math.abs(sd - c.totaux.debit) < 0.005 && Math.abs(sc - c.totaux.credit) < 0.005;
  });
  const avecTotaux = verifies.filter((v): v is boolean => v !== null);
  return {
    societe,
    compte: comptes[0]?.compte ?? "",
    comptes: comptes.map(({ compte, classe, ecritures: n, totaux }) => ({ compte, classe, ecritures: n, totaux })),
    ecritures,
    totaux: comptes.length === 1 ? comptes[0].totaux : null,
    controle: avecTotaux.length > 0 ? avecTotaux.every(Boolean) : null,
  };
}

/** Tableaux de la collecte qu'un grand-livre peut alimenter, et la nature d'écriture de chacun. */
export const TABLEAUX_GRAND_LIVRE: Record<string, { natures: NatureEcriture[]; titre: string }> = {
  souche_cheques: { natures: ["cheque_emis"], titre: "Chèques émis" },
  etat_cheques_emis: { natures: ["cheque_emis"], titre: "Chèques émis" },
  bordereaux_remise_cheques: { natures: ["cheque_recu"], titre: "Chèques encaissés" },
  bordereaux_traites_recues: { natures: ["effet_recu"], titre: "Traites encaissées" },
  virements_recus: { natures: ["virement_recu"], titre: "Virements reçus" },
  virements_emis: { natures: ["virement_emis"], titre: "Virements émis" },
  etat_swift: { natures: ["swift"], titre: "Virements SWIFT à vérifier" },
  reglements_cb: { natures: ["carte_bancaire"], titre: "Règlements par carte bancaire" },
};

const MOTIFS: Partial<Record<string, string>> = { "REG CHQ": "Règlement par chèque", "PAIEMENT CHQ": "Paiement par chèque", "BLOCAGE CHQ": "Chèque bloqué", "RESERVATION CHQ": "Chèque réservé" };

/** Numéro du chèque ou de l'effet, et texte qui suit (le nom du bénéficiaire ou de l'émetteur) : « REG CHQ N°4001511 BATTERIE QODS AUT ». */
export function decouperLibelle(libelle: string): { base: string; numero: string; reste: string } {
  const l = libelle.replace(/\s+/g, " ").trim();
  const m = /^(.*?)\s*N°\s*(\d+)\s*(.*)$/.exec(l);
  if (m) return { base: m[1].trim(), numero: m[2], reste: m[3].trim() };
  // « VIR ETRANGER EMIS » est le type de l'opération, pas un nom : le bénéficiaire n'est pas dans le libellé (il reste à compléter).
  const cb = /^(REGLEMENT PAR CB|REG PAR CB|PAIEMENT PAR CB|PAIEMENT CB|REG CB)\b\s*(.*)$/i.exec(l);
  if (cb) return { base: cb[1].trim(), numero: "", reste: cb[2].trim() };
  const v = /^(VIREMENT ETRANGER EMIS|VIR ETRANGER EMIS|VIREMENT EMIS|VIR EMIS|VIREMENT ETRANGER|VIR ETRANGER|VIREMENT|VIR|TRANSPFET ETRNAGER|TRANSPFET ETRANGER|TRANSFERT ETRANGER)\b\s*(.*)$/i.exec(l);
  if (v) return { base: v[1].trim(), numero: "", reste: v[2].trim() };
  return { base: l, numero: "", reste: "" };
}

/** Lignes d'un tableau de la collecte d'après les écritures du grand-livre qui le concernent. */
export function lignesPourTableau(onglet: string, ecritures: EcritureLivre[]): TabRow[] {
  const cible = TABLEAUX_GRAND_LIVRE[onglet];
  if (!cible) return [];
  return ecritures.filter((e) => cible.natures.includes(e.nature)).map((e) => ligneDepuisEcriture(onglet, e));
}

/** Ligne d'un tableau de la collecte pour une écriture. Le nom lu dans le libellé prime ; à défaut, le client ou fournisseur du compte. */
export function ligneDepuisEcriture(onglet: string, e: EcritureLivre): TabRow {
  const { base, numero, reste } = decouperLibelle(e.libelle);
  const nom = reste || e.tiers;
  // « Observations » garde le sens précis et le repère de l'écriture d'origine : on retrouve la ligne dans le grand-livre, et on ne l'importe pas deux fois.
  const observations = `${e.sousType} · ${e.origine}`;
  switch (onglet) {
    case "souche_cheques":
    case "etat_cheques_emis":
      return { date: e.date, num_cheque: numero, beneficiaire: nom, motif: MOTIFS[maj(base)] ?? base, montant: e.montant, banque: e.journal, observations };
    case "bordereaux_remise_cheques":
      // Le crédit du compte est la remise entière : c'est le montant du bordereau, pas celui d'un chèque (que la société complète).
      // « CREDIT DIVERS CHQ N°5096519 » : le n° est celui du bordereau.
      const remise = /^CREDIT DIVERS/.test(maj(base));
      return { date_remise: e.date, num_bordereau: remise ? numero : "", montant: e.montant, banque: e.journal, num_cheque: remise ? "" : numero, client_emetteur: nom, montant_cheque: "", date_echeance: "", observations };
    case "bordereaux_traites_recues":
      return { date_remise: e.date, num_bordereau: "", montant: "", banque: e.journal, num_traite: numero, client_emetteur: nom, montant_traite: e.montant, date_echeance: "", observations };
    case "virements_recus":
      return { date: e.date, emetteur: nom, reference: base, montant: e.montant, compte_bancaire: e.journal, observations };
    case "reglements_cb":
      // Le commerçant n'est pas toujours dans le libellé : la société le complète, avec le ticket ou la facture en pièce jointe.
      return { date: e.date, commercant: nom, reference: "", montant: e.montant, compte_bancaire: e.journal, observations };
    case "etat_swift":
      // Ligne d'en-tête d'un virement : la société y ajoute ses factures jusqu'à atteindre le montant (comme un bordereau).
      return { date: e.date, ref: `${e.journal} ${e.piece}`, libelle: base, banque: e.journal, montant: e.montant, num_facture: "", devise: "", montant_devise: "", taux: "", montant_tnd: "", observations };
    default:
      return { date: e.date, beneficiaire: nom, reference: base, montant: e.montant, compte_bancaire: e.journal, observations };
  }
}

/** Tableau de la collecte où le cabinet range chaque nature d'écriture. Les chèques émis vont dans « État des chèques émis » (tenu par
 * le cabinet) : la souche est remplie par la société elle-même et reste fermée au cabinet. Report et écritures à classer : aucun tableau. */
export const TABLEAU_PAR_NATURE: Record<NatureEcriture, string | null> = {
  cheque_emis: "etat_cheques_emis",
  cheque_recu: "bordereaux_remise_cheques",
  effet_recu: "bordereaux_traites_recues",
  virement_recu: "virements_recus",
  virement_emis: "virements_emis",
  swift: "etat_swift",
  carte_bancaire: "reglements_cb",
  report: null,
  autre: null,
};

/** Vrai si une ligne déjà dans le tableau vient de cette écriture : même repère dans « Observations », ou, pour une ligne saisie à la main,
 * même numéro de chèque ou d'effet avec le même montant (virements : même date, banque et montant). */
export function dejaPresente(onglet: string, e: EcritureLivre, existantes: TabRow[]): boolean {
  const ligne = ligneDepuisEcriture(onglet, e);
  const num = String(ligne.num_cheque || ligne.num_traite || ligne.num_bordereau || "").trim();
  const cleMontant = (v: unknown) => Math.round(Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) * 1000);
  const montantLigne = cleMontant(e.montant);
  return existantes.some((r) => {
    if (String(r.observations ?? "").includes(e.origine)) return true;
    if (num) {
      const autre = String(r.num_cheque || r.num_traite || r.num_bordereau || "").trim();
      const valeur = [r.montant_cheque, r.montant_traite, r.montant].find((v) => String(v ?? "").trim() !== "");
      return autre === num && cleMontant(valeur) === montantLigne;
    }
    return String(r.date ?? "") === e.date && cleMontant(r.montant) === montantLigne && String(r.compte_bancaire ?? r.banque ?? "") === e.journal;
  });
}

/** Lignes à ajouter à chaque tableau pour des écritures : chacune est rangée dans son tableau (`TABLEAU_PAR_NATURE`), colonnes manquantes
 * remplies par leur valeur par défaut. `seulement` limite aux tableaux voulus (les tableaux de la collecte). */
export function lignesParTableau(ecritures: EcritureLivre[], seulement?: string[]): Record<string, TabRow[]> {
  const sortie: Record<string, TabRow[]> = {};
  for (const e of ecritures) {
    const onglet = TABLEAU_PAR_NATURE[e.nature];
    if (!onglet || (seulement && !seulement.includes(onglet))) continue;
    const vide = Object.fromEntries((TAB_BY_KEY[onglet]?.columns ?? []).map((c) => [c.key, c.defaut ?? ""]));
    (sortie[onglet] ??= []).push({ ...vide, ...ligneDepuisEcriture(onglet, e) });
  }
  return sortie;
}

/** Contenu complet d'un tableau à enregistrer : lignes existantes, puis nouvelles lignes, colonnes calculées recalculées. */
export function lignesEnregistrables(onglet: string, existantes: TabRow[], nouvelles: TabRow[]): { data: TabRow; ordre: number }[] {
  const toutes = [...existantes, ...nouvelles];
  const def = TAB_BY_KEY[onglet];
  return (def?.derive ? def.derive(toutes) : toutes).map((data, ordre) => ({ data, ordre }));
}
