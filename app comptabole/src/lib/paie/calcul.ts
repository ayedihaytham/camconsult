import type { Bareme } from "./baremes";

/** Ce que l'on saisit pour une simulation. Tous les montants sont en millimes entiers. */
export interface EntreeSimulation {
  base: number;
  transport: number;
  primes: number;
  /** Gain soumis à la CNSS mais exonéré d'impôt. */
  panier: number;
  /** Retirées du net après impôt (avance, prêt) : sans effet sur la CNSS ni l'impôt. */
  retenues: number;
  enfants: number;
  chefFamille: boolean;
}

/** Une étape du calcul, dans l'ordre du moteur : de quoi afficher « Comment ce résultat est calculé » avec les chiffres de l'utilisateur. */
export interface EtapeCalcul {
  cle: string;
  libelle: string;
  /** Formule en clair, avec les chiffres de la simulation. */
  detail: string;
  /** Résultat, en millimes. */
  montant: number;
}

export interface ResultatSimulation {
  brut: number;
  cnss: number;
  brutImposable: number;
  netImposableMois: number;
  annuel: number;
  fraisPro: number;
  deductions: number;
  revenuImposable: number;
  impotAnnuel: number;
  irpp: number;
  css: number;
  net: number;
  netAPayer: number;
  /** CNSS patronale seule : le coût employeur d'un bulletin réel est plus élevé (taxe accident du travail, TFP…). */
  chargesPatronales: number;
}

/** Arrondi au millime le plus proche. */
export const arrondi = (n: number) => Math.round(n);
/** Montant × taux en points de base (968 = 9,68 %), arrondi au millime. */
export const appliquerTaux = (montant: number, tauxBp: number) => arrondi((montant * tauxBp) / 10_000);

/** Impôt annuel : somme de l'impôt de chaque tranche du barème progressif, arrondie UNE seule fois au millime. Bornes basses incluses, hautes exclues. */
export function impotAnnuel(revenu: number, bareme: Bareme): number {
  let total = 0;
  let borneBasse = 0;
  for (const t of bareme.tranches) {
    const borneHaute = t.jusqua ?? Infinity;
    if (revenu > borneBasse) total += ((Math.min(revenu, borneHaute) - borneBasse) * t.tauxBp) / 10_000;
    if (revenu <= borneHaute) break;
    borneBasse = borneHaute;
  }
  return arrondi(total);
}

/**
 * Du brut au net : exactement les formules du moteur du bulletin, dans l'ordre. L'impôt du mois est calculé comme si ce mois durait toute
 * l'année (annualisation), sans cumul avec les mois précédents ni régularisation de fin d'année.
 */
export function calculerSimulation(e: EntreeSimulation, bareme: Bareme): ResultatSimulation {
  const brut = e.base + e.transport + e.primes + e.panier;
  const cnss = appliquerTaux(brut, bareme.cnssSalarieBp);
  const brutImposable = brut - e.panier;
  const netImposableMois = brutImposable - cnss;
  const annuel = netImposableMois * 12;
  const fraisPro = Math.min(appliquerTaux(annuel, bareme.fraisProBp), bareme.fraisProPlafond);
  const enfants = Math.max(0, Math.min(Math.trunc(e.enfants) || 0, bareme.enfantsMax));
  const deductions = (e.chefFamille ? bareme.deductionChefFamille : 0) + enfants * bareme.deductionParEnfant;
  const revenuImposable = Math.max(0, annuel - fraisPro - deductions);
  const impot = impotAnnuel(revenuImposable, bareme);
  const irpp = arrondi(impot / 12);
  const exonere = bareme.cssSeuilExoneration !== null && revenuImposable <= bareme.cssSeuilExoneration;
  const css = exonere ? 0 : appliquerTaux(arrondi(revenuImposable / 12), bareme.cssBp);
  const net = brut - cnss - irpp - css;
  return {
    brut,
    cnss,
    brutImposable,
    netImposableMois,
    annuel,
    fraisPro,
    deductions,
    revenuImposable,
    impotAnnuel: impot,
    irpp,
    css,
    net,
    netAPayer: net - e.retenues,
    chargesPatronales: appliquerTaux(brut, bareme.cnssPatronaleBp),
  };
}

const dt = (millimes: number) => (millimes / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct = (bp: number) => `${(bp / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

/** Le déroulé du calcul avec les chiffres de la simulation, étape par étape, dans l'ordre du moteur. */
export function etapesCalcul(e: EntreeSimulation, bareme: Bareme, r: ResultatSimulation): EtapeCalcul[] {
  const enfants = Math.max(0, Math.min(Math.trunc(e.enfants) || 0, bareme.enfantsMax));
  const etapes: EtapeCalcul[] = [
    { cle: "brut", libelle: "Brut", detail: `base ${dt(e.base)} + transport ${dt(e.transport)} + primes ${dt(e.primes)} + panier ${dt(e.panier)}`, montant: r.brut },
    { cle: "cnss", libelle: "CNSS salarié", detail: `${dt(r.brut)} × ${pct(bareme.cnssSalarieBp)}`, montant: r.cnss },
    { cle: "brutImposable", libelle: "Brut imposable", detail: `brut ${dt(r.brut)} − panier non imposable ${dt(e.panier)}`, montant: r.brutImposable },
    { cle: "netImposableMois", libelle: "Net imposable du mois", detail: `${dt(r.brutImposable)} − CNSS ${dt(r.cnss)}`, montant: r.netImposableMois },
    { cle: "annuel", libelle: "Annualisé", detail: `${dt(r.netImposableMois)} × 12 (le mois est calculé comme s'il durait toute l'année, sans cumul)`, montant: r.annuel },
    { cle: "fraisPro", libelle: "Frais professionnels", detail: `${pct(bareme.fraisProBp)} de ${dt(r.annuel)}, au plus ${dt(bareme.fraisProPlafond)}`, montant: r.fraisPro },
    {
      cle: "deductions",
      libelle: "Déductions familiales",
      detail: `${e.chefFamille ? `chef de famille ${dt(bareme.deductionChefFamille)}` : "pas de chef de famille"} + ${enfants} enfant${enfants > 1 ? "s" : ""} × ${dt(bareme.deductionParEnfant)} (${bareme.enfantsMax} au plus)`,
      montant: r.deductions,
    },
    { cle: "revenuImposable", libelle: "Revenu imposable annuel", detail: `${dt(r.annuel)} − ${dt(r.fraisPro)} − ${dt(r.deductions)} (jamais négatif)`, montant: r.revenuImposable },
    { cle: "impotAnnuel", libelle: "Impôt annuel", detail: `barème progressif par tranches appliqué à ${dt(r.revenuImposable)}, arrondi une seule fois`, montant: r.impotAnnuel },
    { cle: "irpp", libelle: "IRPP du mois", detail: `${dt(r.impotAnnuel)} / 12`, montant: r.irpp },
  ];
  const exonere = bareme.cssSeuilExoneration !== null && r.revenuImposable <= bareme.cssSeuilExoneration;
  etapes.push({
    cle: "css",
    libelle: "CSS (contribution sociale de solidarité)",
    detail: exonere
      ? `revenu imposable annuel ${dt(r.revenuImposable)} ≤ ${dt(bareme.cssSeuilExoneration as number)} : exonérée`
      : `${dt(arrondi(r.revenuImposable / 12))} (revenu / 12) × ${pct(bareme.cssBp)}`,
    montant: r.css,
  });
  etapes.push({ cle: "net", libelle: "Net", detail: `brut ${dt(r.brut)} − CNSS ${dt(r.cnss)} − IRPP ${dt(r.irpp)} − CSS ${dt(r.css)}`, montant: r.net });
  etapes.push({ cle: "netAPayer", libelle: "Net à payer", detail: `net ${dt(r.net)} − retenues sur le net ${dt(e.retenues)}`, montant: r.netAPayer });
  etapes.push({ cle: "chargesPatronales", libelle: "Charges patronales de base", detail: `${dt(r.brut)} × ${pct(bareme.cnssPatronaleBp)} (CNSS patronale seule)`, montant: r.chargesPatronales });
  return etapes;
}
