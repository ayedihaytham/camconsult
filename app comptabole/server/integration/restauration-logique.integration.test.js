import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, connecterAdmin, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Restauration LOGIQUE sur deux bases jetables locales, avec des données synthétiques : on sauvegarde chaque table de la base A au
 * format JSON, on restaure dans une base B vierge (schéma appliqué par le serveur), puis on vérifie l'identité des données, les
 * requêtes de `docs/verification-restauration.sql`, le démarrage de l'application et la lecture d'un fichier.
 *
 * ATTENTION : ce n'est PAS le test de la procédure réelle (`pg_dump` -Fc puis `pg_restore`), qui exige les outils PostgreSQL clients ;
 * il valide la cohérence du schéma, des relations, des vérifications SQL et du démarrage sur des données restaurées, pas les outils.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

describe.skipIf(!actif)("restauration logique (bases jetables, données synthétiques)", () => {
  let baseA, baseB, serveurA, serveurB, sqlA, sqlB, adminA;
  const mesures = {};
  const contenuFichier = `data:application/pdf;base64,${randomBytes(300_000).toString("base64")}`;
  const idFichier = randomUUID();

  const tables = async (c) => (await c.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1")).rows.map((r) => r.table_name);

  /** Ordre d'insertion : les tables référencées avant celles qui les référencent (auto-références ignorées : une seule instruction). */
  async function ordreInsertion(c) {
    const noms = await tables(c);
    const deps = new Map(noms.map((t) => [t, new Set()]));
    for (const r of (await c.query("select conrelid::regclass::text enfant, confrelid::regclass::text parent from pg_constraint where contype = 'f'")).rows) {
      const e = r.enfant.replace(/"/g, "");
      const p = r.parent.replace(/"/g, "");
      if (e !== p && deps.has(e) && deps.has(p)) deps.get(e).add(p);
    }
    const ordre = [];
    const faits = new Set();
    while (ordre.length < noms.length) {
      const pret = noms.find((t) => !faits.has(t) && [...deps.get(t)].every((p) => faits.has(p)));
      if (!pret) throw new Error("cycle de dépendances entre tables");
      ordre.push(pret);
      faits.add(pret);
    }
    return ordre;
  }

  const empreinteTable = async (c, t) => (await c.query(`select count(*)::int n, coalesce(md5(string_agg(to_jsonb(x)::text, '' order by to_jsonb(x)::text)), '') h from "${t}" x`)).rows[0];

  beforeAll(async () => {
    baseA = await creerBaseJetable();
    baseB = await creerBaseJetable();
    serveurA = await demarrerServeur(baseA.url);
    adminA = await connecterAdmin(serveurA.base);
    sqlA = await baseA.client();

    // --- Données synthétiques représentatives dans la base A ---
    const s1 = (await adminA("POST", "/api/societes", { raisonSociale: "Société Synthétique 1", code: "RES-A1", email: "a1@example.test" })).json.id;
    const s2 = (await adminA("POST", "/api/societes", { raisonSociale: "Société Synthétique 2", code: "RES-A2" })).json.id;
    const emp = await adminA("POST", "/api/employes", { nom: "Restaure", prenom: "Compte", identifiant: "restaure.logique", email: "r@example.test", type: "Comptable" });
    await api(serveurA.base)("POST", "/api/auth/activate", { token: new URL(emp.json.lienAcces).searchParams.get("token"), motDePasse: "Mdp-Restauration-Test-31" });
    const f = (await sqlA.query("insert into factures (societe_id, numero, tva_taux, timbre) values ($1, '2026-7001', 19, 1) returning id", [s1])).rows[0].id;
    await sqlA.query("insert into facture_lignes (facture_id, ordre, description, quantite, montant_ht) values ($1, 0, 'Prestation synthétique', 3, 100.005), ($1, 1, 'Autre prestation', 2, 49.995)", [f]);
    const m = (await sqlA.query("insert into stock_mouvements (societe_id, fournisseur, achat_num_facture, achat_devise) values ($1, 'FOURNISSEUR SYNTHETIQUE', 'FA-RES-1', 'EUR') returning id", [s1])).rows[0].id;
    await sqlA.query("insert into stock_lignes (mouvement_id, categorie, designation, quantite, prix_unitaire, montant_devise) values ($1, 'achat', 'Marchandise', 10, 100, 1000)", [m]);
    await adminA("POST", "/api/fournisseurs/reglements", { societeId: s1, fournisseurCle: "fournisseur synthetique", mode: "virement", reference: "RES-REG-1", devise: "EUR", affectations: [{ mouvementId: m, montant: 400 }] });
    await sqlA.query("insert into comptes_bancaires (societe_id, banque, intitule, devise) values ($1, 'BANQUE SYNTHETIQUE', 'Compte courant', 'TND')", [s1]).catch(() => undefined);
    await sqlA.query("insert into swift_virements (societe_id, date_operation, montant, libelle, banque, envoye, equivalent_devise, devise) values ($1, '2026-10-01', 8000, 'Virement synthétique', 'BIAT', true, 2500, 'EUR')", [s2]);
    await sqlA.query("insert into noeuds (id, libelle, type, societe_id, format, taille, data_url) values ($1, 'releve-synthetique.pdf', 'fichier', $2, 'pdf', '225 Ko', $3)", [idFichier, s1, contenuFichier]);
    await sqlA.query("insert into collectes (societe_id, periode) values ($1, 'T3 2026')", [s1]);
  });

  afterAll(async () => {
    await sqlA?.end();
    await sqlB?.end();
    await serveurA?.arreter();
    await serveurB?.arreter();
    await baseA?.supprimer();
    await baseB?.supprimer();
  });

  it("sauvegarde chaque table, restaure dans une base vierge dans l'ordre des relations, et retrouve exactement les mêmes données", async () => {
    await serveurA.arreter();

    let debut = Date.now();
    const sauvegarde = {};
    for (const t of await tables(sqlA)) sauvegarde[t] = (await sqlA.query(`select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) rows from "${t}" x`)).rows[0].rows;
    mesures.sauvegardeMs = Date.now() - debut;
    mesures.octets = Buffer.byteLength(JSON.stringify(sauvegarde));

    // Base B : le serveur applique le schéma sur une base vierge, puis on la vide (comme après pg_restore --create)
    serveurB = await demarrerServeur(baseB.url);
    await serveurB.arreter();
    sqlB = await baseB.client();
    expect(await tables(sqlB)).toEqual(await tables(sqlA));
    await sqlB.query(`truncate ${(await tables(sqlB)).map((t) => `"${t}"`).join(", ")} restart identity cascade`);

    debut = Date.now();
    for (const t of await ordreInsertion(sqlB))
      if (sauvegarde[t].length > 0) await sqlB.query(`insert into "${t}" select * from jsonb_populate_recordset(null::"${t}", $1::jsonb)`, [JSON.stringify(sauvegarde[t])]);
    mesures.restaurationMs = Date.now() - debut;

    const differences = [];
    let lignes = 0;
    for (const t of await tables(sqlA)) {
      const a = await empreinteTable(sqlA, t);
      const b = await empreinteTable(sqlB, t);
      lignes += a.n;
      if (a.n !== b.n || a.h !== b.h) differences.push(`${t}: ${a.n} vs ${b.n}`);
    }
    mesures.lignes = lignes;
    expect(differences).toEqual([]);
    expect(lignes).toBeGreaterThan(10);
    console.log(`[restauration logique] ${lignes} lignes, ${(mesures.octets / 1048576).toFixed(2)} Mo de JSON ; sauvegarde ${mesures.sauvegardeMs} ms, restauration ${mesures.restaurationMs} ms`);
  });

  it("les vérifications de docs/verification-restauration.sql donnent les résultats attendus sur la base restaurée", async () => {
    const script = readFileSync(fileURLToPath(new URL("../../../docs/verification-restauration.sql", import.meta.url)), "utf-8");
    const requetes = script.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";").map((q) => q.trim()).filter(Boolean);
    expect(requetes.length).toBeGreaterThanOrEqual(10);
    const resultats = [];
    for (const q of requetes) resultats.push((await sqlB.query(q)).rows);
    const [volumes, nonValidees, affOrph, lignesOrph, swiftOrph, societesInconnues, fichiersVides, comptes, declencheur, admin] = resultats;
    expect(volumes.find((r) => r.t === "factures").count).toBe("1");
    expect(volumes.find((r) => r.t === "facture_lignes").count).toBe("2");
    expect(nonValidees).toHaveLength(0);
    expect([affOrph, lignesOrph, swiftOrph, societesInconnues].map((r) => r[0].count ?? Object.values(r[0])[0])).toEqual(["0", "0", "0", "0"]);
    expect(Object.values(fichiersVides[0])[0]).toBe("0");
    expect(comptes[0]).toEqual({ avec_empreinte: "1", en_clair: "0", sans_acces: "0" });
    expect(declencheur).toHaveLength(1);
    expect(Object.values(admin[0])[0]).toBe("1");
  });

  it("l'application démarre sur la base restaurée : administrateur et compte restauré se connectent, le fichier se relit à l'identique", async () => {
    serveurB = await demarrerServeur(baseB.url);
    const connexionAdmin = await api(serveurB.base)("POST", "/api/auth/login", { identifiant: "admin.test", motDePasse: "Mdp-Admin-De-Test-1!" });
    expect(connexionAdmin.status).toBe(200);
    const compte = await api(serveurB.base)("POST", "/api/auth/login", { identifiant: "restaure.logique", motDePasse: "Mdp-Restauration-Test-31" });
    expect(compte.status).toBe(200);
    const fichier = await api(serveurB.base, connexionAdmin.json.token)("GET", `/api/noeuds/${idFichier}/contenu`);
    expect(fichier.status).toBe(200);
    expect(createHash("sha256").update(fichier.json.dataUrl).digest("hex")).toBe(createHash("sha256").update(contenuFichier).digest("hex"));
    // Le total d'une facture restaurée se recalcule avec la même règle (100,005 x 3 + 49,995 x 2 = 400,005 ; TVA 76,001 ; net 477,006).
    const factures = await api(serveurB.base, connexionAdmin.json.token)("GET", "/api/facturation");
    expect(factures.json[0]).toMatchObject({ numero: "2026-7001", totalHt: 400.005, tva: 76.001, netAPayer: 477.006 });
  });
});
