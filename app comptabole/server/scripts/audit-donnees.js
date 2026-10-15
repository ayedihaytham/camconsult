// Mesures de lecture seule pour préparer les migrations (précision des montants, identifiants de société, fichiers en base, mots de passe).
//   node server/scripts/audit-donnees.js
// Dans le conteneur de production : docker exec app-comptable node server/scripts/audit-donnees.js
// Ne fait que des SELECT dans une session en lecture seule ; n'affiche que des COMPTAGES et des TAILLES, jamais une valeur.
import "dotenv/config";
import { cibleBase } from "./cible.js";

console.log(`Base visée (lecture seule) : ${cibleBase()}\n`);
const { pool } = await import("../db.js");

const client = await pool.connect();
const sortie = [];
const log = (t) => sortie.push(t);
try {
  await client.query("set default_transaction_read_only = on");

  const colonnes = (await client.query("select column_name from information_schema.columns where table_name = 'societes' and column_name in ('identifiant','mot_de_passe')")).rows.map((r) => r.column_name);
  log(`societes : colonnes héritées présentes = ${colonnes.join(", ") || "aucune"}`);
  if (colonnes.length === 2) {
    const s = (await client.query("select count(*)::int total, count(*) filter (where identifiant <> '')::int identifiants, count(*) filter (where mot_de_passe <> '')::int mots_de_passe from societes")).rows[0];
    log(`societes : total=${s.total}, avec identifiant=${s.identifiants}, avec mot de passe=${s.mots_de_passe}`);
  }

  const aHash = (await client.query("select 1 from information_schema.columns where table_name = 'employes' and column_name = 'mdp_hash'")).rowCount;
  if (aHash) {
    const e = (await client.query("select count(*)::int total, count(*) filter (where mdp_hash is not null)::int empreinte, count(*) filter (where mot_de_passe <> '' and mdp_hash is null)::int en_clair, count(*) filter (where mdp_hash is null and mot_de_passe = '')::int sans_acces from employes")).rows[0];
    log(`employes : total=${e.total}, empreinte=${e.empreinte}, mot de passe en clair=${e.en_clair}, sans accès activé=${e.sans_acces}`);
  } else log("employes : colonne mdp_hash absente (la nouvelle version n'a pas encore démarré sur cette base)");

  const nombres = (await client.query("select table_name, column_name, numeric_precision from information_schema.columns where table_schema = 'public' and data_type = 'numeric' order by 1, 2")).rows;
  log(`numeric : ${nombres.length} colonnes, dont ${nombres.filter((c) => c.numeric_precision === null).length} sans précision déclarée`);
  const detail = [];
  for (const c of nombres) {
    const n = (await client.query(`select count(*)::int n from "${c.table_name}" where "${c.column_name}" is not null and "${c.column_name}" <> round("${c.column_name}", 3)`)).rows[0].n;
    if (n > 0) detail.push(`${c.table_name}.${c.column_name}=${n}`);
  }
  log(`lignes à plus de 3 décimales (taux, prix et quantités peuvent légitimement en avoir) : ${detail.join("; ") || "aucune"}`);

  const fichiers = [
    ["noeuds", "data_url"],
    ["collecte_fichiers", "data_url"],
    ["honoraires_lignes", "piece_data_url"],
    ["swift_factures", "piece_data_url"],
  ];
  for (const [t, col] of fichiers) {
    const ok = (await client.query("select 1 from information_schema.columns where table_name = $1 and column_name = $2", [t, col])).rowCount;
    if (!ok) {
      log(`${t}.${col} : absent`);
      continue;
    }
    const r = (await client.query(`select count(*) filter (where "${col}" is not null and "${col}" <> '')::int n, coalesce(sum(length("${col}")), 0)::bigint total, coalesce(max(length("${col}")), 0)::bigint plus_gros from "${t}"`)).rows[0];
    log(`${t}.${col} : ${r.n} fichier(s), ${(Number(r.total) / 1048576).toFixed(1)} Mo, plus gros ${(Number(r.plus_gros) / 1048576).toFixed(2)} Mo`);
  }
  const m = (await client.query("select count(*) filter (where piece_jointe is not null)::int n, coalesce(sum(length(piece_jointe::text)), 0)::bigint total from messages")).rows[0];
  log(`messages.piece_jointe : ${m.n} pièce(s), ${(Number(m.total) / 1048576).toFixed(1)} Mo`);
  log(`taille de la base : ${(await client.query("select pg_size_pretty(pg_database_size(current_database())) s")).rows[0].s}`);
} finally {
  client.release();
  await pool.end();
}
console.log(sortie.join("\n"));
