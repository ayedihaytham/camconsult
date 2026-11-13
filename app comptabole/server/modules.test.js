import { describe, expect, it, vi } from "vitest";

async function charger(env) {
  vi.resetModules();
  for (const k of ["ENVIRONNEMENT", "MODULES_ACTIFS", "NODE_ENV"]) delete process.env[k];
  Object.assign(process.env, env);
  return import("./modules.js");
}

describe("configuration des modules du serveur", () => {
  it("production sans MODULES_ACTIFS : seuls les modules validés sont ouverts", async () => {
    const m = await charger({ NODE_ENV: "production" });
    expect(m.ENVIRONNEMENT).toBe("production");
    expect(m.MODULES_ACTIFS.has("stock")).toBe(true);
    expect(m.MODULES_ACTIFS.has("facturation")).toBe(false);
  });
  it("test avec « * » : tout est ouvert", async () => {
    const m = await charger({ NODE_ENV: "production", ENVIRONNEMENT: "test", MODULES_ACTIFS: "*" });
    expect(m.ENVIRONNEMENT).toBe("test");
    expect(m.MODULES_ACTIFS).toBeNull();
  });
  it("refuse (403) l'API d'un module fermé et laisse passer le reste", async () => {
    const m = await charger({ NODE_ENV: "production" });
    const res = () => { const r = { code: 0, status(c) { r.code = c; return r; }, json() { return r; } }; return r; };
    const ferme = res(); let suite = false;
    m.garderModules({ originalUrl: "/api/facturation?x=1" }, ferme, () => { suite = true; });
    expect(ferme.code).toBe(403); expect(suite).toBe(false);
    m.garderModules({ originalUrl: "/api/societes" }, res(), () => { suite = true; });
    expect(suite).toBe(true);
  });
});
