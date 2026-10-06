// Notation d'une lecture par rapport à la vérité terrain (utilisée par
// benchmark-extraction.mjs ; isolée ici pour être testée).

const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
const proche = (a, b, tol = 0.005) => Math.abs((a ?? 0) - (b ?? 0)) <= Math.max(Math.abs(b ?? 0) * tol, 0.0005);

export function similaire(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  // distance d'édition relative
  const m = x.length;
  const n = y.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n) >= 0.85;
}

const COMPARATEURS = {
  type: (lu, att) => lu === att,
  date: (lu, att) => String(lu ?? "") === String(att ?? ""),
  numFacture: (lu, att) => norm(lu) === norm(att),
  numDeclaration: (lu, att) => norm(lu) === norm(att),
  partie: (lu, att) => similaire(lu, att),
  devise: (lu, att) => norm(lu) === norm(att),
  typeDeclaration: (lu, att) => norm(lu) === norm(att),
  reference: (lu, att) => norm(lu) === norm(att),
};

/** Note une lecture : { champs: {nom: true|false}, lignes: {attendues, trouvees, lues} } */
export function noter(lecture, attendu) {
  const champs = {};
  for (const [champ, comparer] of Object.entries(COMPARATEURS)) {
    if (attendu[champ] === undefined) continue;
    champs[champ] = comparer(lecture[champ], attendu[champ]);
  }
  let lignes = null;
  if (Array.isArray(attendu.lignes)) {
    const lues = [...(lecture.lignes ?? [])];
    let trouvees = 0;
    for (const att of attendu.lignes) {
      const i = lues.findIndex((l) => proche(l.quantite, att.quantite) && proche(l.montantDevise, att.montantDevise) && (att.prixUnitaire === undefined || proche(l.prixUnitaire, att.prixUnitaire)));
      if (i >= 0) {
        trouvees++;
        lues.splice(i, 1);
      }
    }
    lignes = { attendues: attendu.lignes.length, trouvees, lues: (lecture.lignes ?? []).length };
  }
  return { champs, lignes };
}

