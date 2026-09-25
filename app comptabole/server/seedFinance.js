import "dotenv/config";
import { pool, withTransaction } from "./db.js";
import {
  AFFECTAT_POSTES,
  EMPTY_COMPANY,
  FINANCE_SCENARIOS,
  balanceTotals,
  buildBalanceLines,
  financeSeedUuid,
} from "./financeSeedData.js";

const SEED_PREFIX = "[finance-seed]";
const BALANCE_ID = (index) => financeSeedUuid("a1000000", index + 1);
const LINE_ID = (scenarioIndex, lineIndex) => financeSeedUuid("a2000000", scenarioIndex * 100 + lineIndex + 1);

function assertDevelopmentDatabase() {
  if (process.env.NODE_ENV !== "development" || process.env.ALLOW_DB_SEED !== "true" || process.env.ALLOW_FINANCE_SEED !== "true") {
    throw new Error(`${SEED_PREFIX} Refusé : NODE_ENV=development, ALLOW_DB_SEED=true et ALLOW_FINANCE_SEED=true sont requis.`);
  }
  const url = new URL(process.env.DATABASE_URL || "postgres://cabinet:cabinet@localhost:5439/cabinet");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.port !== "5439" || url.username !== "cabinet" || !["cabinet", "cabinet_dev"].includes(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error(`${SEED_PREFIX} Refusé : seule la connexion PostgreSQL locale de développement (cabinet, port 5439) est autorisée.`);
  }
}

async function resolveCompanies(client) {
  const expected = new Map([...FINANCE_SCENARIOS.map(({ code, name }) => [code, name]), [EMPTY_COMPANY.code, EMPTY_COMPANY.name]]);
  const { rows } = await client.query("select id, code, raison_sociale from societes where code = any($1::text[])", [[...expected.keys()]]);
  const resolved = new Map(rows.map((row) => [row.code, row]));
  for (const [code, name] of expected) {
    if (resolved.get(code)?.raison_sociale !== name) {
      throw new Error(`${SEED_PREFIX} Société de démo absente ou différente : ${code} (${name}). Lancez d'abord le seed général sur une base locale vide.`);
    }
  }
  return resolved;
}

async function preflight(client, companies) {
  const expectedIds = new Set(FINANCE_SCENARIOS.map((_, index) => BALANCE_ID(index)));
  const ids = [...companies.values()].map((company) => company.id);
  const { rows } = await client.query("select id, societe_id, exercice from balances where societe_id = any($1::uuid[])", [ids]);
  for (const row of rows) {
    if (!expectedIds.has(row.id)) {
      throw new Error(`${SEED_PREFIX} Exercice non géré par le seed trouvé pour une société cible. Aucune donnée financière existante ne sera écrasée.`);
    }
  }
  const { rows: codes } = await client.query("select code, poste from grille_affectat_codes where code = any($1::text[])", [Object.keys(AFFECTAT_POSTES)]);
  const postes = new Map(codes.map((row) => [row.code, row.poste]));
  for (const [code, poste] of Object.entries(AFFECTAT_POSTES)) {
    if (postes.get(code) !== poste) {
      throw new Error(`${SEED_PREFIX} Grille AFFECTAT non initialisée ou personnalisée pour ${code}. Lancez db:init puis vérifiez la grille avant le seed.`);
    }
  }
}

async function seedMappings(client) {
  const mapped = new Map();
  for (const scenario of FINANCE_SCENARIOS) {
    for (const line of buildBalanceLines(scenario)) {
      if (line.affectat && !mapped.has(line.compte) && scenario.code !== "DEV-003") {
        mapped.set(line.compte, line);
      }
    }
  }
  for (const line of mapped.values()) {
    await client.query(
      `insert into grille_comptes (compte, affectat_code, libelle_compte)
       values ($1, $2, $3) on conflict (compte) do nothing`,
      [line.compte, line.affectat, line.libelle],
    );
  }
  const carthageId = (await client.query("select id from societes where code = 'DEV-003'")).rows[0].id;
  await client.query(
    `insert into grille_comptes_societe (societe_id, compte, affectat_code, libelle_compte)
     values ($1, '629100', 'CH09', 'Charge contractuelle exceptionnelle')
     on conflict (societe_id, compte) do nothing`,
    [carthageId],
  );
}

async function seedBalances(client, companies) {
  for (const [scenarioIndex, scenario] of FINANCE_SCENARIOS.entries()) {
    const societeId = companies.get(scenario.code).id;
    const id = BALANCE_ID(scenarioIndex);
    const createdAt = new Date(Date.parse(scenario.updatedAt) - 5 * 86_400_000).toISOString();
    await client.query(
      `insert into balances (id, societe_id, exercice, note, cree_le, maj_le)
       values ($1, $2, $3, $4, $5, $6) on conflict (id) do nothing`,
      [id, societeId, scenario.exercice, scenario.note, createdAt, scenario.updatedAt],
    );
    const lines = buildBalanceLines(scenario);
    for (const [lineIndex, line] of lines.entries()) {
      await client.query(
        `insert into balance_lignes (id, balance_id, ordre, compte, libelle, debit, credit, affectat)
         values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
        [LINE_ID(scenarioIndex, lineIndex), id, lineIndex + 1, line.compte, line.libelle, line.debit, line.credit, line.affectat],
      );
    }
  }
}

const ASSETS = [
  ["DEV-001", "00000000-0000-0000-0000-000000000001", "Logiciels de gestion (démo)", "2024-01-15", 12000, 33.33],
  ["DEV-001", "00000000-0000-0000-0000-000000000003", "Équipement de production (démo)", "2024-05-10", 75000, 15],
  ["DEV-001", "00000000-0000-0000-0000-000000000004", "Véhicule utilitaire (démo)", "2025-02-01", 45000, 20],
  ["DEV-001", "00000000-0000-0000-0000-000000000005", "Mobilier de bureau (démo)", "2025-06-12", 10000, 20],
  ["DEV-002", "00000000-0000-0000-0000-000000000003", "Machine textile (démo)", "2025-04-08", 52000, 15],
  ["DEV-002", "00000000-0000-0000-0000-000000000004", "Véhicule de livraison (démo)", "2026-01-20", 29000, 20],
  ["DEV-003", "00000000-0000-0000-0000-000000000007", "Postes informatiques (démo)", "2025-03-11", 18000, 33.33],
];

async function seedSupportingData(client, companies) {
  for (const [index, [code, categoryId, label, date, cost, rate]] of ASSETS.entries()) {
    await client.query(
      `insert into immo_biens (id, societe_id, categorie_id, libelle, date_acquisition, cout_acquisition, taux)
       values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing`,
      [financeSeedUuid("a3000000", index + 1), companies.get(code).id, categoryId, label, date, cost, rate],
    );
  }

  for (const [index, scenario] of FINANCE_SCENARIOS.entries()) {
    const societeId = companies.get(scenario.code).id;
    const lines = buildBalanceLines(scenario);
    const scale = scenario.scale;
    const taxableAdjustment = Math.round(1000 * scale);
    const localRevenue = lines.find((line) => line.compte === "701000").credit;
    const exportRevenue = lines.find((line) => line.compte === "701100").credit;
    await client.query(
      `insert into financement_mouvements
       (id, societe_id, exercice, emprunts_contractes, emprunts_rembourses, dividendes_distribues, capital_numeraire, interets_courus_non_echus)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (societe_id, exercice) do nothing`,
      [financeSeedUuid("a4000000", index + 1), societeId, scenario.exercice, Math.round(9000 * scale), Math.round(5000 * scale), Math.round(2000 * scale), Math.round(3000 * scale), Math.round(250 * scale)],
    );
    await client.query(
      `insert into immo_mouvements
       (id, societe_id, exercice, masse, acquisitions, cessions, dotations, reprises)
       values ($1, $2, $3, 'financieres', $4, $5, 0, 0)
       on conflict (societe_id, exercice, masse) do nothing`,
      [financeSeedUuid("a5000000", index + 1), societeId, scenario.exercice, Math.round(4000 * scale), Math.round(1000 * scale)],
    );
    await client.query(
      `insert into tdrf_parametres
       (id, societe_id, exercice, chiffre_affaires_local, chiffre_affaires_export, taux_imposition, taux_export)
       values ($1, $2, $3, $4, $5, 0.20, 0.20)
       on conflict (societe_id, exercice) do nothing`,
      [financeSeedUuid("a6000000", index + 1), societeId, scenario.exercice, localRevenue, exportRevenue],
    );
    for (const [lineIndex, [kind, label]] of [
      ["reintegration", "Charge non déductible (démo)"],
      ["deduction", "Déduction fiscale (démo)"],
    ].entries()) {
      await client.query(
        `insert into tdrf_lignes (id, societe_id, exercice, ordre, kind, libelle, montant)
         values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing`,
        [financeSeedUuid("a7000000", index * 10 + lineIndex + 1), societeId, scenario.exercice, lineIndex + 1, kind, label, taxableAdjustment],
      );
    }

    if (["DEV-001", "DEV-002", "DEV-003"].includes(scenario.code)) {
      await client.query(
        `insert into notes_exercice (societe_id, exercice, texte_override, blocs_libres)
         values ($1, $2, '', $3::jsonb) on conflict (societe_id, exercice) do nothing`,
        [societeId, scenario.exercice, JSON.stringify([{ titre: "Faits marquants — démo", texte: `Données synthétiques de l'exercice ${scenario.exercice}, réservées aux essais du dossier financier.` }])],
      );
    }
  }

  for (const [code, capital, form] of [["DEV-001", 82000, "SARL"], ["DEV-002", 72000, "SARL"]]) {
    await client.query(
      `insert into fiche_societe (societe_id, forme_juridique, statut_fiscal, capital_initial, objet_social)
       values ($1, $2, 'Régime de droit commun (démo)', $3, $4::jsonb)
       on conflict (societe_id) do nothing`,
      [companies.get(code).id, form, capital, JSON.stringify([{ titre: "Activité", texte: "Activité de démonstration pour les états financiers." }])],
    );
  }
}

async function verifyFinanceSeed(client, companies) {
  for (const [index, scenario] of FINANCE_SCENARIOS.entries()) {
    const id = BALANCE_ID(index);
    const { rows } = await client.query(
      `select b.societe_id, b.exercice, count(bl.id)::int as line_count,
              coalesce(sum(bl.debit), 0)::numeric as debit,
              coalesce(sum(bl.credit), 0)::numeric as credit
       from balances b left join balance_lignes bl on bl.balance_id = b.id
       where b.id = $1 group by b.id`,
      [id],
    );
    const row = rows[0];
    const expectedLines = buildBalanceLines(scenario);
    const expectedTotals = balanceTotals(expectedLines);
    if (!row || row.societe_id !== companies.get(scenario.code).id || row.exercice !== scenario.exercice ||
        row.line_count !== expectedLines.length || Number(row.debit) !== expectedTotals.debit || Number(row.credit) !== expectedTotals.credit) {
      throw new Error(`${SEED_PREFIX} Vérification de balance échouée : ${scenario.code} ${scenario.exercice}`);
    }
    console.log(`${scenario.code} ${scenario.exercice}: ${row.line_count} lignes, débit ${row.debit}, crédit ${row.credit}`);
  }

  const carthageId = companies.get("DEV-003").id;
  const unmapped = await client.query("select count(*)::int as n from balance_lignes where balance_id = $1 and affectat = ''", [BALANCE_ID(5)]);
  const override = await client.query("select affectat_code from grille_comptes_societe where societe_id = $1 and compte = '629100'", [carthageId]);
  const empty = await client.query("select count(*)::int as n from balances where societe_id = $1", [companies.get(EMPTY_COMPANY.code).id]);
  const support = await client.query(
    `select
       (select count(*)::int from immo_biens where id = any($1::uuid[])) as assets,
       (select count(*)::int from financement_mouvements where id = any($2::uuid[])) as financing,
       (select count(*)::int from immo_mouvements where id = any($3::uuid[])) as immo,
       (select count(*)::int from tdrf_parametres where id = any($4::uuid[])) as tdrf,
       (select count(*)::int from tdrf_lignes where id = any($5::uuid[])) as tdrf_lines`,
    [ASSETS.map((_, index) => financeSeedUuid("a3000000", index + 1)), FINANCE_SCENARIOS.map((_, index) => financeSeedUuid("a4000000", index + 1)), FINANCE_SCENARIOS.map((_, index) => financeSeedUuid("a5000000", index + 1)), FINANCE_SCENARIOS.map((_, index) => financeSeedUuid("a6000000", index + 1)), FINANCE_SCENARIOS.flatMap((_, index) => [financeSeedUuid("a7000000", index * 10 + 1), financeSeedUuid("a7000000", index * 10 + 2)])],
  );
  if (unmapped.rows[0].n !== 2 || override.rows[0]?.affectat_code !== "CH09" || empty.rows[0].n !== 0 ||
      support.rows[0].assets !== ASSETS.length || support.rows[0].financing !== FINANCE_SCENARIOS.length ||
      support.rows[0].immo !== FINANCE_SCENARIOS.length || support.rows[0].tdrf !== FINANCE_SCENARIOS.length ||
      support.rows[0].tdrf_lines !== FINANCE_SCENARIOS.length * 2) {
    throw new Error(`${SEED_PREFIX} Vérification des mappings ou données complémentaires échouée.`);
  }
  console.log(`AFFECTAT: 2 lignes non affectées (DEV-003), override 629100 → CH09 (DEV-003).`);
  console.log(`Supports: ${support.rows[0].assets} biens, ${support.rows[0].immo} mouvements d'immobilisations, ${support.rows[0].financing} financements, ${support.rows[0].tdrf} TDRF, ${support.rows[0].tdrf_lines} lignes fiscales.`);
  console.log(`${EMPTY_COMPANY.code}: 0 exercice (état vide).`);
}

async function main() {
  assertDevelopmentDatabase();
  await withTransaction(async (client) => {
    const database = (await client.query("select current_database() as name")).rows[0].name;
    if (!["cabinet", "cabinet_dev"].includes(database)) throw new Error(`${SEED_PREFIX} Base locale non autorisée : ${database}`);
    const companies = await resolveCompanies(client);
    await preflight(client, companies);
    await seedMappings(client);
    await seedBalances(client, companies);
    await seedSupportingData(client, companies);
    await verifyFinanceSeed(client, companies);
  });
  console.log(`${SEED_PREFIX} Données financières de développement prêtes ; exécution répétable sans doublons.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
