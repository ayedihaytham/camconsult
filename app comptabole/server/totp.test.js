import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, chiffrerSecret, codeDuPas, dechiffrerSecret, empreinteSecours, genererCodesSecours, genererSecret, pasCourant, ressembleAUnCodeDeSecours, uriOtpauth, verifierCode } from "./totp.js";

// Vecteurs de test de la RFC 6238 (annexe B), clé ASCII « 12345678901234567890 », SHA-1, 6 chiffres (les 6 derniers des codes à 8 chiffres).
const CLE_RFC = base32Encode(Buffer.from("12345678901234567890"));
const VECTEURS = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("TOTP (RFC 6238)", () => {
  it.each(VECTEURS)("à T=%s la RFC donne %s", (t, attendu) => {
    expect(codeDuPas(CLE_RFC, Math.floor(t / 30))).toBe(attendu);
  });

  it("base32 : aller-retour, tolérant aux espaces, minuscules et au remplissage", () => {
    const octets = Buffer.from("Bonjour le cabinet !");
    expect(base32Decode(base32Encode(octets)).toString()).toBe("Bonjour le cabinet !");
    expect(base32Decode(` ${base32Encode(octets).toLowerCase()}==== `).toString()).toBe("Bonjour le cabinet !");
    expect(() => base32Decode("0189")).toThrow();
  });

  it("un secret généré est en base32, de 160 bits, différent à chaque fois", () => {
    const a = genererSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(genererSecret()).not.toBe(a);
  });
});

describe("vérification d'un code saisi", () => {
  const secret = genererSecret();
  const t0 = 1_700_000_000_000;
  const pas = pasCourant(t0);
  const code = (decalage = 0) => codeDuPas(secret, pas + decalage);

  it("accepte le code du pas courant, avec ou sans espace, et renvoie le pas", () => {
    expect(verifierCode(secret, code(), { maintenant: t0 })).toBe(pas);
    expect(verifierCode(secret, `${code().slice(0, 3)} ${code().slice(3)}`, { maintenant: t0 })).toBe(pas);
  });

  it("tolère un décalage d'horloge d'un pas, pas de deux", () => {
    expect(verifierCode(secret, code(-1), { maintenant: t0 })).toBe(pas - 1);
    expect(verifierCode(secret, code(1), { maintenant: t0 })).toBe(pas + 1);
    expect(verifierCode(secret, code(-2), { maintenant: t0 })).toBeNull();
    expect(verifierCode(secret, code(2), { maintenant: t0 })).toBeNull();
  });

  it("refuse un code mal formé ou faux", () => {
    expect(verifierCode(secret, "12345", { maintenant: t0 })).toBeNull();
    expect(verifierCode(secret, "abcdef", { maintenant: t0 })).toBeNull();
    expect(verifierCode(secret, "", { maintenant: t0 })).toBeNull();
    expect(verifierCode(secret, undefined, { maintenant: t0 })).toBeNull();
    const faux = code() === "000000" ? "000001" : "000000";
    expect(verifierCode(secret, faux, { maintenant: t0 })).toBeNull();
  });

  it("anti-rejeu : un code déjà utilisé (pas égal ou antérieur au dernier) est refusé, un pas plus récent reste accepté", () => {
    expect(verifierCode(secret, code(), { maintenant: t0, dernierPas: pas })).toBeNull();
    expect(verifierCode(secret, code(-1), { maintenant: t0, dernierPas: pas })).toBeNull();
    expect(verifierCode(secret, code(1), { maintenant: t0, dernierPas: pas })).toBe(pas + 1);
    expect(verifierCode(secret, code(), { maintenant: t0, dernierPas: pas - 1 })).toBe(pas);
  });
});

describe("adresse otpauth", () => {
  it("contient le secret, l'émetteur et les paramètres que lit l'application", () => {
    const uri = uriOtpauth({ secret: "ABCDEFGH", compte: "admin", emetteur: "Cabinet Ayadi" });
    expect(uri).toBe("otpauth://totp/Cabinet%20Ayadi%3Aadmin?secret=ABCDEFGH&issuer=Cabinet%20Ayadi&algorithm=SHA1&digits=6&period=30");
  });
});

describe("secret chiffré", () => {
  it("se déchiffre à l'identique, sans jamais contenir le secret en clair, avec un aléa différent à chaque fois", () => {
    const secret = genererSecret();
    const a = chiffrerSecret(secret);
    expect(a.startsWith("v1:")).toBe(true);
    expect(a).not.toContain(secret);
    expect(dechiffrerSecret(a)).toBe(secret);
    expect(chiffrerSecret(secret)).not.toBe(a);
  });

  it("une valeur altérée ou illisible est refusée", () => {
    const a = chiffrerSecret("SECRET");
    const parties = a.split(":");
    parties[3] = Buffer.from("autre chose").toString("base64");
    expect(() => dechiffrerSecret(parties.join(":"))).toThrow();
    expect(() => dechiffrerSecret("n'importe quoi")).toThrow();
    expect(() => dechiffrerSecret(null)).toThrow();
  });

  it("un autre secret maître ne déchiffre pas", () => {
    const avant = process.env.AUTH_2FA_SECRET;
    process.env.AUTH_2FA_SECRET = "premier-secret-maitre-de-test-1234567890";
    const a = chiffrerSecret("SECRET");
    process.env.AUTH_2FA_SECRET = "second-secret-maitre-de-test-0987654321";
    try {
      expect(() => dechiffrerSecret(a)).toThrow();
    } finally {
      if (avant === undefined) delete process.env.AUTH_2FA_SECRET;
      else process.env.AUTH_2FA_SECRET = avant;
    }
  });
});

describe("codes de secours", () => {
  it("dix codes distincts au format XXXXX-XXXXX ; l'empreinte ignore tiret, casse et espaces", () => {
    const codes = genererCodesSecours();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    const [c] = codes;
    expect(empreinteSecours(c.toLowerCase().replace("-", " "))).toBe(empreinteSecours(c));
    expect(empreinteSecours(c)).not.toBe(empreinteSecours(codes[1]));
  });

  it("distingue un code de secours d'un code à 6 chiffres", () => {
    expect(ressembleAUnCodeDeSecours("ABCDE-23456")).toBe(true);
    expect(ressembleAUnCodeDeSecours("abcde 23456")).toBe(true);
    expect(ressembleAUnCodeDeSecours("123456")).toBe(false);
  });
});
