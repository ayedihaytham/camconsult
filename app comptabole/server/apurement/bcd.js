import { parse, day, fail } from "./domain.js";
import { totals, millimes } from "./amounts.js";
export const BCD_PROFILE = "bcd-observed-2026-v0";
const widths = { EF: 220, DF: 521, TF: 198 };
function date(raw) {
  if (!/^\d{8}$/.test(raw)) fail(422, "BCD_DATE", "Date BCD invalide.");
  return parse(day, `${raw.slice(4)}-${raw.slice(2, 4)}-${raw.slice(0, 2)}`);
}
export function parseBcd(bytes) {
  if (bytes.length > 10485760 || bytes.some((b) => b > 127 || b === 0))
    fail(
      422,
      "BCD_ENCODAGE",
      "Profil observé ASCII uniquement, 10 Mo maximum.",
    );
  const lines = bytes
    .toString("ascii")
    .replace(/\r?\n$/, "")
    .split(/\r?\n/);
  if (lines.length < 3 || lines.length > 2002)
    fail(
      422,
      "BCD_STRUCTURE",
      "Nombre d’enregistrements BCD invalide (maximum 2000 détails).",
    );
  if (!lines[0].startsWith("EF") || !lines.at(-1).startsWith("TF"))
    fail(422, "BCD_STRUCTURE", "En-tête EF et pied TF requis.");
  const prefix = lines[0].slice(2, 20);
  if (!/^\d{7}[A-Z]{2}\d{3}\d{4}T[1-4]$/.test(prefix))
    fail(
      422,
      "BCD_PROFIL",
      "Identité ou période non reconnue dans le profil observé.",
    );
  for (let i = 0; i < lines.length; i++) {
    const expected = i === 0 ? "EF" : i === lines.length - 1 ? "TF" : "DF";
    if (
      lines[i].slice(0, 2) !== expected ||
      lines[i].length !== widths[expected] ||
      lines[i].slice(2, 20) !== prefix
    )
      fail(
        422,
        "BCD_LARGEUR",
        `Ligne ${i + 1} : profil, largeur ou identité incohérente.`,
      );
  }
  const rows = lines.slice(1, -1).map((l, i) => {
    if (l.slice(20, 26) !== String(i + 1).padStart(6, "0"))
      fail(422, "BCD_SEQUENCE", `Séquence invalide ligne ${i + 2}.`);
    if (
      !/^\d{15}$/.test(l.slice(168, 183)) ||
      !/^\d{15}$/.test(l.slice(183, 198))
    )
      fail(422, "BCD_MONTANT", "Montant BCD invalide.");
    if (!l.slice(198).startsWith("<") || !l.endsWith("/>"))
      fail(422, "BCD_SUFFIXE", "Suffixe achat non reconnu.");
    return {
      row: i + 2,
      autorisation: l.slice(26, 56).trim(),
      bcNumero: l.slice(56, 69).trim(),
      dateBc: date(l.slice(69, 77)),
      fournisseurMf: l.slice(77, 90).trim(),
      fournisseur: l.slice(90, 130).trim(),
      numeroFacture: l.slice(130, 160).trim(),
      dateFacture: date(l.slice(160, 168)),
      datePrecision: "day",
      dateBrute: l.slice(160, 168),
      montantHtMillimes: millimes(l.slice(168, 183)),
      tvaSuspendueMillimes: millimes(l.slice(183, 198)),
      objet: l.slice(199, -2).trim(),
      raw: l,
    };
  });
  const footer = lines.at(-1);
  if (
    !/^\d{6}$/.test(footer.slice(20, 26)) ||
    Number(footer.slice(20, 26)) !== rows.length
  )
    fail(422, "BCD_COMPTE", "Nombre de détails incohérent.");
  const sumHt = rows.reduce((n, r) => n + BigInt(r.montantHtMillimes), 0n),
    sumVat = rows.reduce((n, r) => n + BigInt(r.tvaSuspendueMillimes), 0n);
  if (!/^\d{30}$/.test(footer.slice(168, 198)))
    fail(422, "BCD_PIED", "Totaux du pied invalides.");
  const warnings = [];
  const deltaHt = BigInt(footer.slice(168, 183)) - sumHt,
    deltaVat = BigInt(footer.slice(183, 198)) - sumVat;
  if (deltaHt !== 0n || deltaVat !== 0n)
    warnings.push({
      code: "BCD_ECART_PIED",
      ht: deltaHt.toString(),
      tva: deltaVat.toString(),
      message:
        "Le pied diffère de la somme des détails. Aucune correction implicite.",
    });
  const h = lines[0];
  return {
    profile: BCD_PROFILE,
    annee: Number(prefix.slice(12, 16)),
    trimestre: prefix.slice(16, 18),
    rows,
    warnings,
    profil: {
      matriculeFiscal: prefix.slice(0, 12),
      raisonSociale: h.slice(20, 60).trim(),
      activite: h.slice(60, 100).trim(),
      ville: h.slice(100, 140).trim(),
      rue: h.slice(140, 212).trim(),
      numero: h.slice(212, 216).trim(),
      codePostal: h.slice(216, 220).trim(),
    },
    totals: {
      ht: sumHt.toString(),
      tva: sumVat.toString(),
      piedHt: BigInt(footer.slice(168, 183)).toString(),
      piedTva: BigInt(footer.slice(183, 198)).toString(),
    },
  };
}
function field(value, width, numeric = false) {
  const s = String(value ?? "");
  if (
    !/^[\x20-\x7e]*$/.test(s) ||
    s.length > width ||
    (numeric && !/^\d+$/.test(s))
  )
    fail(
      422,
      "BCD_CHAMP",
      "Champ non représentable dans le profil BCD ASCII observé.",
    );
  return numeric ? s.padStart(width, "0") : s.padEnd(width, " ");
}
const dmy = (v) => {
  const s = typeof v === "string" ? v.slice(0, 10) : null;
  parse(day, s);
  return `${s.slice(8, 10)}${s.slice(5, 7)}${s.slice(0, 4)}`;
};
export function exportBcdTest(snapshot) {
  const p = snapshot.profil;
  if (!/^\d{7}[A-Z]{2}\d{3}$/.test(p.matriculeFiscal))
    fail(
      422,
      "BCD_IDENTITE",
      "Matricule déclarant incompatible avec le profil observé.",
    );
  const prefix = p.matriculeFiscal + snapshot.annee + snapshot.trimestre;
  const header =
    "EF" +
    prefix +
    field(p.raisonSociale, 40) +
    field(p.activite, 40) +
    field(p.ville, 40) +
    field(p.rue, 72) +
    field(p.numero, 4) +
    field(p.codePostal, 4);
  const rows = snapshot.lignes.map((r, i) => {
    if (
      r.date_precision !== "day" ||
      !r.bc_numero ||
      !/^\d{7}[A-Z]{3}\d{3}$/.test(r.matricule_fiscal_normalise)
    )
      fail(
        422,
        "BCD_INCOMPLET",
        "Dates, BC et identités du profil observé requises pour le test strict.",
      );
    return (
      "DF" +
      prefix +
      field(i + 1, 6, true) +
      field(r.autorisation_numero, 30) +
      field(r.bc_numero, 13, true) +
      dmy(r.date_bc) +
      field(r.matricule_fiscal_normalise, 13) +
      field(r.raison_sociale, 40) +
      field(r.numero_facture, 30) +
      dmy(r.date_facture) +
      field(r.montant_ht_millimes, 15, true) +
      field(r.tva_suspendue_millimes, 15, true) +
      "<" +
      field(r.objet || "ACHAT", 320) +
      "/>"
    );
  });
  const sums = totals(snapshot.lignes);
  const footer =
    "TF" +
    prefix +
    field(rows.length, 6, true) +
    " ".repeat(142) +
    field(sums.ht, 15, true) +
    field(sums.tvaLignes, 15, true);
  const bytes = Buffer.from(
    [header, ...rows, footer].join("\r\n") + "\r\n",
    "ascii",
  );
  parseBcd(bytes);
  return bytes;
}
export function officialBcd() {
  // Environment flag alone cannot bypass absence of a signed official profile.
  fail(
    423,
    "FORMAT_GATE_FERME",
    process.env.APUREMENT_OFFICIAL_BCD_ENABLED === "true"
      ? "Indicateur activé sans profil officiel signé : export refusé (B1/B2)."
      : "Export BCD officiel désactivé (B1/B2).",
  );
}
