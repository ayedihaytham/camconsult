import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { api, creerBaseJetable, demarrerServeur } from "./helpers.js";

/**
 * Audit automatique : TOUTES les routes de l'API (relevées dans le code source, pas écrites à la main) refusent une requête sans jeton
 * ou avec un jeton invalide, sauf la courte liste des routes publiques. Une route ajoutée plus tard sans `requireAuth` fait échouer ce test.
 * Vrai PostgreSQL jetable (TEST_DATABASE_URL) ; ignoré sans cette variable.
 */
const actif = Boolean(process.env.TEST_DATABASE_URL);
vi.setConfig({ testTimeout: 120_000, hookTimeout: 90_000 });

const serveurDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const ID = "00000000-0000-0000-0000-000000000000";

/** Routes publiques voulues : santé, connexion et activation par lien. Tout le reste exige un jeton valide. */
const PUBLIQUES = new Set(["GET /api/health", "POST /api/auth/login", "POST /api/auth/activate"]);

/** Relève « méthode + chemin complet » dans server/index.js (montages) et server/routes/*.js (routes). */
export function releverRoutes() {
  const index = readFileSync(join(serveurDir, "index.js"), "utf-8");
  const imports = new Map(); // nom du routeur -> fichier
  for (const m of index.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*"\.\/routes\/([\w-]+)\.js"/g)) imports.set(m[1], m[2]);
  const montages = [...index.matchAll(/app\.use\(\s*"(\/api\/[\w/-]+)"\s*,\s*(\w+)\s*\)/g)].map((m) => ({ prefixe: m[1], fichier: imports.get(m[2]) }));
  const routes = [];
  for (const { prefixe, fichier } of montages) {
    if (!fichier) continue;
    const source = readFileSync(join(serveurDir, "routes", `${fichier}.js`), "utf-8");
    for (const m of source.matchAll(/\b\w*[Rr]outer\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]*)["'`]/g)) {
      const chemin = `${prefixe}${m[2] === "/" ? "" : m[2]}`.replace(/:\w+\??/g, ID);
      routes.push({ methode: m[1].toUpperCase(), chemin });
    }
  }
  return routes;
}

describe("relevé des routes", () => {
  it("trouve les routes de l'API (garde-fou : le relevé ne doit jamais être vide)", () => {
    const routes = releverRoutes();
    expect(routes.length).toBeGreaterThan(150);
    expect(routes.some((r) => r.methode === "POST" && r.chemin === "/api/auth/login")).toBe(true);
    expect(readdirSync(join(serveurDir, "routes")).filter((f) => f.endsWith(".js") && !f.endsWith(".test.js")).length).toBeGreaterThan(20);
  });
});

describe.skipIf(!actif)("intégration PostgreSQL : aucune route sans authentification", () => {
  let base, serveur;
  beforeAll(async () => {
    base = await creerBaseJetable();
    serveur = await demarrerServeur(base.url);
  });
  afterAll(async () => {
    await serveur?.arreter();
    await base?.supprimer();
  });

  it("sans jeton : 401 partout, sauf santé, connexion et activation", async () => {
    const appel = api(serveur.base);
    const ouvertes = [];
    for (const { methode, chemin } of releverRoutes()) {
      if (PUBLIQUES.has(`${methode} ${chemin}`)) continue;
      const r = await appel(methode, chemin, methode === "GET" || methode === "DELETE" ? undefined : {});
      if (r.status !== 401) ouvertes.push(`${methode} ${chemin} -> ${r.status}`);
    }
    expect(ouvertes).toEqual([]);
  });

  it("jeton falsifié, expiré ou d'un autre secret : 401 sur une route protégée", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const faux = [
      "Bearer n'importe-quoi",
      `Bearer ${jwt.sign({ role: "admin" }, "un-autre-secret-de-plus-de-24-caracteres", { expiresIn: "1h" })}`,
      `Bearer ${jwt.sign({ role: "admin" }, "x", { algorithm: "HS256", expiresIn: -10 })}`,
      // jeton « alg: none » (non signé) : l'attaque classique
      `Bearer ${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${Buffer.from('{"role":"admin"}').toString("base64url")}.`,
    ];
    for (const entete of faux) {
      const r = await fetch(`${serveur.base}/api/societes`, { headers: { Authorization: entete } });
      expect(r.status).toBe(401);
    }
  });
});
