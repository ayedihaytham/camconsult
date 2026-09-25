// Synthetic fixtures for the local finance seed. No runtime application imports this file.
export const FINANCE_SCENARIOS = [
  { code: "DEV-001", name: "Atlas Conseil SARL", exercice: "2024", scale: 0.82, updatedAt: "2025-03-14T10:00:00Z", note: "Démo · clôture 2024" },
  { code: "DEV-001", name: "Atlas Conseil SARL", exercice: "2025", scale: 1, updatedAt: "2026-03-18T10:00:00Z", note: "Démo · clôture 2025" },
  { code: "DEV-001", name: "Atlas Conseil SARL", exercice: "2026", scale: 1.18, updatedAt: "2026-09-16T10:00:00Z", note: "Démo · situation 2026" },
  { code: "DEV-002", name: "Medina Textile", exercice: "2025", scale: 0.72, updatedAt: "2026-03-12T10:00:00Z", note: "Démo · clôture 2025" },
  { code: "DEV-002", name: "Medina Textile", exercice: "2026", scale: 0.91, updatedAt: "2026-09-17T10:00:00Z", note: "Démo · situation 2026" },
  { code: "DEV-003", name: "Carthage Digital", exercice: "2025", scale: 0.61, updatedAt: "2026-03-20T10:00:00Z", note: "Démo · deux comptes sans AFFECTAT" },
  { code: "DEV-005", name: "Association El Wafa", exercice: "2026", scale: 0.48, updatedAt: "2026-09-18T10:00:00Z", note: "Démo · écart volontaire de 750 TND" },
];

export const EMPTY_COMPANY = { code: "DEV-008", name: "Nour Distribution" };

// Code/poste pairs already defined by the real schema's AFFECTAT reference grid.
export const AFFECTAT_POSTES = {
  AC01: "actif.immo_incorp_brut",
  AC02: "actif.immo_fin",
  AC03: "actif.immo_corp_brut",
  AC04: "actif.immo_corp_amort",
  AC08: "actif.stocks",
  AC10: "actif.clients",
  AC12: "actif.autres_courants",
  AC15: "actif.liquidites",
  CP01: "passif.capital_social",
  CP02: "passif.reserve_legale",
  CP04: "passif.resultat_reporte",
  P04: "passif.fournisseurs",
  P05: "passif.autres_passifs_courants",
  P06: "passif.emprunts",
  PR01: "cpc.ventes_marchandises",
  CH02: "cpc.achats_consommes",
  CHPR1: "cpc.achats_consommes",
  CH03: "cpc.charges_personnel",
  CH04: "cpc.dotations_amort_provisions",
  CH05: "cpc.charges_externes",
  CH07: "cpc.charges_financieres",
  CH08: "cpc.autres_produits_ordinaires",
  CH09: "cpc.autres_charges_ordinaires",
  CH10: "cpc.impot_societes",
  CH12: "cpc.impots_taxes",
};

// [account, label, debit, credit, AFFECTAT]. The 512000 bank line is calculated
// below from the remaining entries, so ordinary scenarios balance exactly.
const BASE_LINES = [
  ["201000", "Logiciels et licences", 12000, 0, "AC01"],
  ["213000", "Équipement de production", 85000, 0, "AC03"],
  ["218000", "Matériel de transport", 45000, 0, "AC03"],
  ["281300", "Amortissement équipements", 0, 25000, "AC04"],
  ["281800", "Amortissement véhicules", 0, 12000, "AC04"],
  ["261000", "Dépôts et titres immobilisés", 12000, 0, "AC02"],
  ["371000", "Stocks de marchandises", 36000, 0, "AC08"],
  ["411000", "Clients locaux", 69000, 0, "AC10"],
  ["411500", "Clients export", 22000, 0, "AC10"],
  ["421000", "Avances au personnel", 1500, 0, "AC12"],
  ["531000", "Caisse", 2400, 0, "AC15"],
  ["101000", "Capital social", 0, 100000, "CP01"],
  ["106100", "Réserve légale", 0, 15000, "CP02"],
  ["110000", "Résultat reporté", 0, 18000, "CP04"],
  ["164000", "Emprunt bancaire", 0, 45000, "P06"],
  ["401000", "Fournisseurs locaux", 0, 38000, "P04"],
  ["431000", "Cotisations sociales à payer", 0, 8000, "P05"],
  ["442000", "Taxes à payer", 0, 6000, "P05"],
  ["701000", "Ventes locales", 0, 260000, "PR01"],
  ["701100", "CA EXPORT prestations", 0, 65000, "PR01"],
  ["758000", "Autres produits ordinaires", 0, 3500, "CH08"],
  ["601000", "Achats de marchandises", 120000, 0, "CH02"],
  ["603000", "Variation de stock", 5000, 0, "CHPR1"],
  ["621000", "Rémunérations", 62000, 0, "CH03"],
  ["625000", "Cotisations patronales", 14000, 0, "CH03"],
  ["613000", "Loyers et charges locatives", 18000, 0, "CH05"],
  ["615000", "Entretien et réparations", 9000, 0, "CH05"],
  ["629100", "Honoraires et services extérieurs", 7000, 0, "CH05"],
  ["661000", "Intérêts des emprunts", 6500, 0, "CH07"],
  ["681000", "Dotations aux amortissements", 18000, 0, "CH04"],
  ["635000", "Impôts et taxes", 8000, 0, "CH12"],
  ["658000", "Autres charges ordinaires", 1500, 0, "CH09"],
];

const amount = (base, scale) => Math.round(base * scale);

export function buildBalanceLines(scenario) {
  const lines = BASE_LINES.map(([compte, libelle, debit, credit, affectat]) => ({
    compte,
    libelle: scenario.code === "DEV-003" && compte === "629100" ? "Charge contractuelle exceptionnelle" : libelle,
    debit: amount(debit, scenario.scale),
    credit: amount(credit, scenario.scale),
    affectat: scenario.code === "DEV-003" && compte === "629100" ? "CH09" : affectat,
  }));

  if (scenario.code === "DEV-003") {
    lines.push(
      { compte: "629909", libelle: "Prestation à reclasser (démo)", debit: 1200, credit: 0, affectat: "" },
      { compte: "758909", libelle: "Produit à reclasser (démo)", debit: 0, credit: 900, affectat: "" },
    );
  }

  const beforeTax = lines.reduce((sum, line) => {
    if (line.affectat === "PR01" || line.affectat === "CH08") return sum + line.credit - line.debit;
    if (line.affectat.startsWith("CH")) return sum + line.credit - line.debit;
    return sum;
  }, 0);
  lines.push({ compte: "691000", libelle: "Impôt sur les sociétés", debit: Math.round(beforeTax * 0.2), credit: 0, affectat: "CH10" });

  const totalsBeforeBank = balanceTotals(lines);
  const bank = totalsBeforeBank.credit - totalsBeforeBank.debit;
  if (bank <= 0) throw new Error(`Trésorerie de démo non positive : ${scenario.code} ${scenario.exercice}`);
  lines.push({ compte: "512000", libelle: "Banque — compte courant", debit: bank, credit: 0, affectat: "AC15" });

  if (scenario.code === "DEV-005") {
    // Deliberate raw-balance and Bilan mismatch for the warning test, never
    // included in the balancing bank calculation above.
    lines.push({ compte: "499999", libelle: "Écart volontaire de balance (démo)", debit: 750, credit: 0, affectat: "AC12" });
  }

  return lines;
}

export function balanceTotals(lines) {
  return lines.reduce((totals, line) => ({
    debit: totals.debit + line.debit,
    credit: totals.credit + line.credit,
  }), { debit: 0, credit: 0 });
}

export function financeSeedUuid(prefix, index) {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}
