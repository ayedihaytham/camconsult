import { beforeEach, describe, expect, it, vi } from "vitest";

// scrypt est volontairement lent : on laisse de la marge quand toute la suite tourne en parallèle.
vi.setConfig({ testTimeout: 30_000 });

const db = vi.hoisted(() => ({ tokens: [], query: null }));

vi.mock("./db.js", () => ({ query: (...a) => db.query(...a) }));

import { PARAMS, besoinDeRehash, consommerJeton, creerJeton, estHash, hashPassword, lienAcces, lireJeton, motDePasseAcceptable, verifyPassword } from "./passwords.js";

/** Table password_tokens simulée : reproduit la sémantique des requêtes (usage unique, expiration). */
beforeEach(() => {
  db.tokens = [];
  db.query = async (sql, params) => {
    if (sql.startsWith("update password_tokens set used_at = now() where employe_id")) {
      db.tokens.filter((t) => t.employe_id === params[0] && !t.used).forEach((t) => (t.used = true));
      return { rows: [] };
    }
    if (sql.startsWith("insert into password_tokens")) {
      db.tokens.push({ employe_id: params[0], token_hash: params[1], but: params[2], expire: Date.now() + Number(params[3]), used: false });
      return { rows: [] };
    }
    if (sql.startsWith("select employe_id from password_tokens")) {
      const t = db.tokens.find((x) => x.token_hash === params[0] && !x.used && x.expire > Date.now());
      return { rows: t ? [{ employe_id: t.employe_id }] : [] };
    }
    if (sql.startsWith("update password_tokens set used_at = now() where token_hash")) {
      const t = db.tokens.find((x) => x.token_hash === params[0] && !x.used && x.expire > Date.now());
      if (t) t.used = true;
      return { rows: t ? [{ employe_id: t.employe_id }] : [] };
    }
    throw new Error(`requête inattendue : ${sql}`);
  };
});

describe("empreinte des mots de passe", () => {
  it("n'écrit jamais le mot de passe, et chaque empreinte a son propre sel", async () => {
    const a = await hashPassword("Secret-Tres-Long-1");
    const b = await hashPassword("Secret-Tres-Long-1");
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toContain("Secret-Tres-Long-1");
    expect(a).not.toBe(b);
    expect(estHash(a)).toBe(true);
    expect(estHash("Secret-Tres-Long-1")).toBe(false);
  });

  it("vérifie le bon mot de passe et refuse les autres, y compris une valeur en clair stockée par erreur", async () => {
    const h = await hashPassword("Secret-Tres-Long-1");
    expect(await verifyPassword("Secret-Tres-Long-1", h)).toBe(true);
    expect(await verifyPassword("Secret-Tres-Long-2", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
    expect(await verifyPassword("Secret-Tres-Long-1", "Secret-Tres-Long-1")).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
  });

  it("détecte une empreinte aux paramètres plus faibles que les paramètres actuels", async () => {
    const faible = await hashPassword("abcdefgh", { ...PARAMS, N: 2 ** 12 });
    expect(besoinDeRehash(faible)).toBe(true);
    expect(besoinDeRehash(await hashPassword("abcdefgh"))).toBe(false);
    expect(await verifyPassword("abcdefgh", faible)).toBe(true);
  });

  it("refuse un mot de passe trop court ou contenant l'identifiant", () => {
    expect(motDePasseAcceptable("court")).toMatch(/8 caractères/);
    expect(motDePasseAcceptable("motdepasse-ok")).toBeNull();
    expect(motDePasseAcceptable("xx-h.ayedi-xx", "h.ayedi")).toMatch(/identifiant/);
  });
});

describe("jetons d'activation et de réinitialisation", () => {
  it("ne conserve que l'empreinte du jeton, jamais le jeton", async () => {
    const jeton = await creerJeton("e1", "activation", "Admin");
    expect(db.tokens).toHaveLength(1);
    expect(db.tokens[0].token_hash).not.toBe(jeton);
    expect(JSON.stringify(db.tokens)).not.toContain(jeton);
    expect(jeton.length).toBeGreaterThanOrEqual(40);
  });

  it("sert une seule fois", async () => {
    const jeton = await creerJeton("e1", "activation");
    expect(await lireJeton(jeton)).toBe("e1");
    expect(await consommerJeton(jeton)).toBe("e1");
    expect(await consommerJeton(jeton)).toBeNull();
    expect(await lireJeton(jeton)).toBeNull();
  });

  it("deux utilisations simultanées : une seule réussit", async () => {
    const jeton = await creerJeton("e1", "reset");
    const [a, b] = await Promise.all([consommerJeton(jeton), consommerJeton(jeton)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("expire", async () => {
    const jeton = await creerJeton("e1", "reset");
    db.tokens[0].expire = Date.now() - 1000;
    expect(await consommerJeton(jeton)).toBeNull();
  });

  it("un nouveau jeton invalide le précédent du même compte, mais pas celui d'un autre", async () => {
    const ancien = await creerJeton("e1", "activation");
    const autre = await creerJeton("e2", "activation");
    const nouveau = await creerJeton("e1", "reset");
    expect(await consommerJeton(ancien)).toBeNull();
    expect(await consommerJeton(nouveau)).toBe("e1");
    expect(await consommerJeton(autre)).toBe("e2");
  });

  it("refuse un jeton inconnu, vide ou démesuré, et un but inconnu", async () => {
    expect(await consommerJeton("n'importe quoi de suffisamment long")).toBeNull();
    expect(await consommerJeton("")).toBeNull();
    expect(await consommerJeton("x".repeat(500))).toBeNull();
    expect(await consommerJeton(undefined)).toBeNull();
    await expect(creerJeton("e1", "autre")).rejects.toThrow();
  });

  it("construit un lien vers la page d'activation, jeton encodé", () => {
    expect(lienAcces("ab_c-d")).toMatch(/\/activation\?token=ab_c-d$/);
  });
});
