import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Validation de la configuration en conditions réelles de démarrage, avec des SECRETS SYNTHÉTIQUES et aucune base : la
 * DATABASE_URL pointe vers un port fermé (127.0.0.1:1). Si un script ou le serveur tentait de se connecter, le test le verrait.
 * Ce sont des vérifications LOCALES : elles ne prouvent rien sur la configuration du serveur de production.
 */
const racine = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SECRET_FORT = "synthetique-9f3a1c7e5b2d4f6a8c0e1b3d5f7a9c2e";
const MDP_BASE = "mot-de-passe-base-synthetique-Zq81";
const MDP_ADMIN = "Admin-Synthetique-Tres-Solide-77!";

const lancer = (script, args, env) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: racine,
    encoding: "utf-8",
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      DOTENV_CONFIG_PATH: join(tmpdir(), "aucun-fichier-env-pour-les-tests"),
      DATABASE_URL: `postgres://cabinet:${MDP_BASE}@127.0.0.1:1/inexistante`,
      ...env,
    },
  });

const sain = {
  NODE_ENV: "production",
  JWT_SECRET: SECRET_FORT,
  ADMIN_PASSWORD: MDP_ADMIN,
  CORS_ORIGIN: "https://cabinet.example.test",
  APP_URL: "https://cabinet.example.test",
};
const aucunSecret = (sortie) => {
  for (const secret of [SECRET_FORT, MDP_BASE, MDP_ADMIN, "dev-secret-change-me"]) expect(sortie).not.toContain(secret);
};

describe("check-config.js (variables seulement, par défaut : aucune connexion à une base)", () => {
  it("accepte une configuration saine, n'affiche aucun secret et ne tente aucune connexion", () => {
    const r = lancer("server/scripts/check-config.js", [], sain);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("[OK]     JWT_SECRET");
    expect(r.stdout).not.toContain("Base visée");
    aucunSecret(r.stdout + r.stderr);
  });

  it.each([
    ["secret par défaut", { JWT_SECRET: "dev-secret-change-me" }, "JWT_SECRET"],
    ["secret court", { JWT_SECRET: "trop-court" }, "JWT_SECRET"],
    ["secret vide", { JWT_SECRET: "" }, "JWT_SECRET"],
    ["mot de passe administrateur par défaut", { ADMIN_PASSWORD: "Cabinet2026!" }, "ADMIN_PASSWORD"],
  ])("signale %s comme bloquant (code de sortie 1)", (_nom, extra, code) => {
    const r = lancer("server/scripts/check-config.js", [], { ...sain, ...extra });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(`[ECHEC]  ${code}`);
    aucunSecret(r.stdout + r.stderr);
  });

  it("signale la conversion suspendue et la réinitialisation permise sans les cacher", () => {
    const r = lancer("server/scripts/check-config.js", [], { ...sain, MIGRATE_LEGACY_PASSWORDS: "false", ALLOW_DATA_RESET: "true" });
    expect(r.stdout).toMatch(/\[ALERTE\]\s+MIGRATE_LEGACY_PASSWORDS/);
    expect(r.stdout).toMatch(/\[ALERTE\]\s+ALLOW_DATA_RESET/);
  });

  it("--db sans DATABASE_URL : échec explicite, aucun repli sur la base locale par défaut", () => {
    const r = lancer("server/scripts/check-config.js", ["--db"], { ...sain, DATABASE_URL: undefined });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/\[ECHEC\]\s+BASE/);
    expect(r.stdout).not.toContain("Connexion à la base réussie");
  });

  it("--db affiche la cible (hôte:port/base) sans identifiants avant toute connexion, puis échoue proprement si elle est injoignable", () => {
    const r = lancer("server/scripts/check-config.js", ["--db"], sain);
    expect(r.stdout).toContain("Base visée (lecture seule) : 127.0.0.1:1/inexistante");
    expect(r.status).toBe(1);
    aucunSecret(r.stdout + r.stderr);
  });
});

describe("démarrage du serveur en production : refus sûr des secrets faibles", () => {
  it.each([
    ["absent", undefined],
    ["vide", ""],
    ["valeur de développement", "dev-secret-change-me"],
    ["trop court", "court-12345"],
  ])("JWT_SECRET %s : le serveur s'arrête avant toute connexion à une base, sans révéler de secret", (_nom, valeur) => {
    const r = lancer("server/index.js", [], { ...sain, JWT_SECRET: valeur, API_PORT: "5999", PORT: "5999" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("JWT_SECRET doit être défini en production");
    // Refus AVANT la base : aucune erreur de connexion ni de schéma dans la sortie.
    expect(r.stdout + r.stderr).not.toMatch(/\[db\]|Impossible de préparer la base|ECONNREFUSED/);
    aucunSecret(r.stdout + r.stderr);
  });
});
