import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db.js", () => db);
vi.mock("./sse.js", () => ({ pushToUser: vi.fn() }));

import { clesAdmins, concernedBySociete, notifKey, notify } from "./notifications.js";

beforeEach(() => {
  db.query.mockReset();
});

describe("clés de notification des administrateurs", () => {
  it("chaque administrateur a sa clé ; un employé garde son identifiant", () => {
    expect(notifKey({ role: "admin", adminId: "a-1" })).toBe("admin:a-1");
    expect(notifKey({ role: "employe", employeId: "e-9" })).toBe("e-9");
  });

  it("« personnes concernées » : tous les administrateurs actifs, et l'auteur peut donc s'exclure par sa propre clé", async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes("from administrateurs")) return { rows: [{ id: "a-1" }, { id: "a-2" }] };
      return { rows: [] };
    });
    expect(await clesAdmins()).toEqual(["admin:a-1", "admin:a-2"]);
    const concernes = await concernedBySociete("soc-1", { includeAdmin: true });
    expect(concernes).toEqual(["admin:a-1", "admin:a-2"]);
    const sansAuteur = concernes.filter((k) => k !== notifKey({ role: "admin", adminId: "a-1" }));
    expect(sansAuteur).toEqual(["admin:a-2"]);
    expect(await concernedBySociete("soc-1", { includeAdmin: false })).toEqual([]);
    expect(await concernedBySociete(null, { includeAdmin: true })).toEqual(["admin:a-1", "admin:a-2"]);
  });

  it("notify(« admin ») écrit une notification par administrateur actif, et aucune sous la clé « admin »", async () => {
    const ecrits = [];
    db.query.mockImplementation(async (sql, params) => {
      if (sql.includes("from administrateurs")) return { rows: [{ id: "a-1" }, { id: "a-2" }] };
      if (sql.includes("insert into notifications")) ecrits.push(params[0]);
      return { rows: [] };
    });
    notify("admin", "message", "Titre");
    await new Promise((r) => setTimeout(r, 30));
    expect(ecrits.sort()).toEqual(["admin:a-1", "admin:a-2"]);
  });
});
