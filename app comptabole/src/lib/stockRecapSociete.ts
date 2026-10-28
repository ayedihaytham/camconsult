import type { PdfCell, PdfSheet } from "@/lib/pdfTables";
import { totauxCote, uniteCommune } from "@/lib/stockRecap";
import type { StockMouvement } from "@/types";

/**
 * Récapitulatif des mouvements d'une société, tel que le cabinet le tient dans son tableur : une ligne par mouvement, les ventes à gauche
 * (date, facture, nature, client, quantité, montant en devise, devise, montant en dinars), l'écart au milieu, les achats à droite (même chose avec le fournisseur et le cours).
 * Les colonnes de la déclaration douanière (type, déclaration, taux de change) n'y sont plus : elles restent dans le détail de chaque mouvement.
 */

export interface CoteRecap {
  date: string | null;
  numFacture: string;
  tiers: string;
  quantite: number;
  enDevise: number;
  devise: string;
  mtTnd: number;
  /** Cours de la facture (TND pour 1 unité de devise) ; 0 = non renseigné. */
  cours: number;
  present: boolean;
}

/** Déclaration douanière du mouvement (colonnes facultatives du récapitulatif). */
export interface DouaneRecap {
  numDeclaration: string;
  date: string | null;
  type: string;
  tauxChange: number;
  valeurTnd: number;
}

export interface LigneRecapSociete {
  rang: number;
  id: string;
  nature: string;
  vente: CoteRecap;
  achat: CoteRecap;
  /** Écart de quantité (achat − vente) du mouvement, ramené à l'unité du tableau. */
  ecart: number;
  douane: DouaneRecap;
}

export interface TotauxRecapSociete {
  vente: { quantite: number; enDevise: number | null; mtTnd: number };
  achat: { quantite: number; enDevise: number | null; mtTnd: number };
  ecart: number;
  douaneValeurTnd: number;
}

export interface RecapSociete {
  lignes: LigneRecapSociete[];
  totaux: TotauxRecapSociete;
  /** Unité commune des quantités (T si des kilos et des tonnes se mélangent) ; vide si aucune. */
  unite: string;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function cote(lignes: StockMouvement["venteLignes"], date: string | null, numFacture: string, tiers: string, devise: string, cours: number, unite: string): CoteRecap {
  const t = totauxCote(lignes, unite);
  return { date, numFacture, tiers, quantite: t.quantite, enDevise: t.montantDevise, devise, mtTnd: t.montantTnd, cours, present: lignes.length > 0 || Boolean(numFacture) };
}

/** Récapitulatif des mouvements (déjà triés et filtrés par l'écran). */
export function recapSociete(mouvements: StockMouvement[]): RecapSociete {
  const unite = uniteCommune(mouvements.flatMap((m) => [...m.achatLignes, ...m.venteLignes]));
  const lignes = mouvements.map((m, i): LigneRecapSociete => ({
    rang: i + 1,
    id: m.id,
    nature: m.natureMarchandise,
    vente: cote(m.venteLignes, m.venteDate, m.venteNumFacture, m.client, m.venteDevise, m.venteCours, unite),
    achat: cote(m.achatLignes, m.achatDate, m.achatNumFacture, m.fournisseur, m.achatDevise, m.achatCours, unite),
    ecart: r3(unite === "T" && m.ecartUnite === "KG" ? m.ecart / 1000 : m.ecart),
    douane: { numDeclaration: m.douaneNumDeclaration, date: m.douaneDate, type: m.douaneTypeDeclaration, tauxChange: m.douaneTauxChange, valeurTnd: m.douaneValeurTnd },
  }));
  return { lignes, unite, totaux: totauxDe(lignes) };
}

/** Totaux d'un ensemble de lignes (toutes, ou seulement celles qu'un filtre laisse visibles). */
export function totauxDe(lignes: LigneRecapSociete[]): TotauxRecapSociete {
  // Les montants en devise ne s'additionnent que dans une même devise : sinon le total est laissé vide.
  const total = (cotes: CoteRecap[]) => {
    const presentes = cotes.filter((c) => c.present);
    const devises = new Set(presentes.map((c) => c.devise).filter(Boolean));
    return {
      quantite: r3(presentes.reduce((s, c) => s + c.quantite, 0)),
      enDevise: devises.size <= 1 ? r3(presentes.reduce((s, c) => s + c.enDevise, 0)) : null,
      mtTnd: r3(presentes.reduce((s, c) => s + c.mtTnd, 0)),
    };
  };
  return { vente: total(lignes.map((l) => l.vente)), achat: total(lignes.map((l) => l.achat)), ecart: r3(lignes.reduce((s, l) => s + l.ecart, 0)), douaneValeurTnd: r3(lignes.reduce((s, l) => s + l.douane.valeurTnd, 0)) };
}

/** « 2025-01-02 » → « 02/01/2025 » (le format que l'Excel du cabinet reconnaît comme date). */
export function dateJourMoisAnnee(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export const COLONNES_RECAP_SOCIETE = {
  vente: { de: 1, a: 8 },
  ecart: 9,
  achat: { de: 10, a: 18 },
  douane: { de: 19, a: 23 },
};

/** Feuille du récapitulatif pour l'Excel et le PDF : en-têtes, une ligne par mouvement, ligne de totaux ; les groupes VENTE, ACHAT (et DOUANE si elle est affichée) sont posés au-dessus des colonnes. */
export function feuilleRecapSociete(recap: RecapSociete, options: { douane?: boolean } = {}): PdfSheet {
  const q = recap.unite ? ` (${recap.unite})` : "";
  const douane = options.douane === true;
  const entetes = ["N°", "Date", "N° facture", "Nature", "Client", `Quantité${q}`, "En devise", "Devise", "MT TND", `Écart${q}`, "Date", "N° facture", "Nature", "Fournisseur", `Quantité${q}`, "En devise", "Devise", "Cours", "MT TND", ...(douane ? ["N° déclaration", "Date", "Type", "Taux de change", "Valeur (TND)"] : [])];
  const nombre = (n: number): PdfCell => n;
  const lignes = recap.lignes.map((l): PdfCell[] => [
    l.rang,
    dateJourMoisAnnee(l.vente.date), l.vente.numFacture, l.vente.present ? l.nature : "", l.vente.tiers, l.vente.present ? nombre(l.vente.quantite) : "", l.vente.present ? nombre(l.vente.enDevise) : "", l.vente.devise, l.vente.present ? nombre(l.vente.mtTnd) : "",
    nombre(l.ecart),
    dateJourMoisAnnee(l.achat.date), l.achat.numFacture, l.achat.present ? l.nature : "", l.achat.tiers, l.achat.present ? nombre(l.achat.quantite) : "", l.achat.present ? nombre(l.achat.enDevise) : "", l.achat.devise, l.achat.cours ? nombre(l.achat.cours) : "", l.achat.present ? nombre(l.achat.mtTnd) : "",
    ...(douane ? [l.douane.numDeclaration, dateJourMoisAnnee(l.douane.date), l.douane.type, l.douane.tauxChange ? nombre(l.douane.tauxChange) : "", l.douane.valeurTnd ? nombre(l.douane.valeurTnd) : ""] : []),
  ]);
  const t = recap.totaux;
  const pied: PdfCell[] = ["", "", "", "TOTAL", "", nombre(t.vente.quantite), t.vente.enDevise === null ? "" : nombre(t.vente.enDevise), "", nombre(t.vente.mtTnd), nombre(t.ecart), "", "", "", "", nombre(t.achat.quantite), t.achat.enDevise === null ? "" : nombre(t.achat.enDevise), "", "", nombre(t.achat.mtTnd), ...(douane ? ["", "", "", "", t.douaneValeurTnd ? nombre(t.douaneValeurTnd) : ""] : [])];
  return {
    name: "Récapitulatif",
    headerRow: true,
    rows: [entetes, ...lignes, pied],
    totalRows: 1,
    groupes: [
      { titre: "VENTE", de: COLONNES_RECAP_SOCIETE.vente.de, a: COLONNES_RECAP_SOCIETE.vente.a },
      { titre: "ACHAT", de: COLONNES_RECAP_SOCIETE.achat.de, a: COLONNES_RECAP_SOCIETE.achat.a },
      ...(douane ? [{ titre: "DOUANE", de: COLONNES_RECAP_SOCIETE.douane.de, a: COLONNES_RECAP_SOCIETE.douane.a }] : []),
    ],
  };
}
