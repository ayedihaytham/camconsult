/** Clé de regroupement d'un fournisseur : sans accents, casse ni ponctuation. */
export function cleFournisseur(nom) {
  return String(nom || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Fusions de fournisseurs d'une société (« SOTACIB » regroupé avec « SOTACIB KAIROUAN ») : clé d'origine -> clé retenue.
 * `q` est tout objet qui a une méthode `query(sql, params)` (client de transaction ou pool). */
export async function chargerFusions(q, societeId) {
  const { rows } = await q.query("select cle_source, cle_cible from fournisseur_fusions where societe_id = $1", [societeId]);
  return new Map(rows.map((r) => [r.cle_source, r.cle_cible]));
}

/** Clé retenue pour une clé d'origine (les fusions ne forment jamais de boucle ; la garde évite un blocage si la base était altérée). */
export function resoudre(fusions, cle) {
  let courante = cle;
  for (let i = 0; i < 20 && fusions.has(courante); i++) courante = fusions.get(courante);
  return courante;
}

/** Deux noms désignent le même fournisseur, fusions comprises. */
export const memeFournisseur = (fusions, a, b) => resoudre(fusions, cleFournisseur(a)) === resoudre(fusions, cleFournisseur(b));
