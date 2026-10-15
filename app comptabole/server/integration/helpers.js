import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createServer } from "node:net";

const require = createRequire(import.meta.url);
const pg = require("pg");
const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Base PostgreSQL jetable pour les tests d'intégration. TEST_DATABASE_URL pointe vers un serveur PostgreSQL de TEST (jamais la
 * production) ; chaque suite y crée sa propre base, au nom aléatoire, et la supprime à la fin. Aucune autre base n'est touchée.
 */
export async function creerBaseJetable(urlServeur = process.env.TEST_DATABASE_URL) {
  const nom = `it_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: urlServeur });
  await admin.connect();
  await admin.query(`create database ${nom}`);
  await admin.end();
  const u = new URL(urlServeur);
  u.pathname = `/${nom}`;
  const url = u.toString();
  return {
    nom,
    url,
    async supprimer() {
      const c = new pg.Client({ connectionString: urlServeur });
      await c.connect();
      await c.query(`drop database if exists ${nom} with (force)`);
      await c.end();
    },
    async client() {
      const c = new pg.Client({ connectionString: url });
      await c.connect();
      return c;
    },
  };
}

const portLibre = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

/** Démarre le vrai serveur (server/index.js, mode production) sur la base jetable. Les secrets sont aléatoires et propres au test. */
export async function demarrerServeur(urlBase, extra = {}) {
  const port = await portLibre();
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    NODE_ENV: "production",
    API_PORT: String(port),
    PORT: String(port),
    DATABASE_URL: urlBase,
    JWT_SECRET: randomBytes(32).toString("hex"),
    ADMIN_IDENTIFIANT: "admin.test",
    ADMIN_PASSWORD: "Mdp-Admin-De-Test-1!",
    CORS_ORIGIN: "http://localhost",
    APP_URL: "http://app.test",
    // Valeurs vides explicites : dotenv ne remplace jamais une variable déjà définie, donc le fichier .env du poste (SMTP, clés
    // d'IA…) n'est pas lu par le serveur de test et aucun email ni appel externe ne peut partir.
    SMTP_HOST: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_BASE_URL: "",
    RUSPINA_OCR_URL: "",
    ALLOW_DATA_RESET: "",
    CLIENT_IP_HEADER: "",
    ...extra,
  };
  const journal = [];
  const enfant = spawn(process.execPath, ["server/index.js"], { cwd: racine, env });
  enfant.stdout.on("data", (d) => journal.push(String(d)));
  enfant.stderr.on("data", (d) => journal.push(String(d)));
  const base = `http://127.0.0.1:${port}`;
  const debut = Date.now();
  for (;;) {
    if (enfant.exitCode !== null) throw new Error(`Le serveur s'est arrêté au démarrage : ${journal.join("").slice(-600)}`);
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) break;
    } catch {
      /* pas encore prêt */
    }
    if (Date.now() - debut > 30_000) throw new Error("Le serveur n'a pas démarré en 30 s");
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    base,
    env,
    journal: () => journal.join(""),
    arreter: () =>
      new Promise((resolve) => {
        if (enfant.exitCode !== null) return resolve();
        enfant.once("exit", resolve);
        enfant.kill();
      }),
  };
}

export const api = (base, jeton) => async (methode, chemin, corps) => {
  const r = await fetch(`${base}${chemin}`, {
    method: methode,
    headers: { "Content-Type": "application/json", ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await r.text();
  let json = null;
  try {
    json = JSON.parse(texte);
  } catch {
    /* corps non JSON */
  }
  return { status: r.status, json, texte, entetes: r.headers };
};

export async function connecterAdmin(base) {
  const r = await api(base)("POST", "/api/auth/login", { identifiant: "admin.test", motDePasse: "Mdp-Admin-De-Test-1!" });
  if (r.status !== 200) throw new Error(`Connexion admin impossible : ${r.status}`);
  return api(base, r.json.token);
}
