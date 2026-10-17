import { describe, expect, it } from "vitest";
import { aEchec, evaluerConfiguration } from "./configCheck.js";

const bonne = {
  NODE_ENV: "production",
  JWT_SECRET: "a3f9c1e7b2d84f60915e7c3a8b4d2f1e0c9a7b5d3e1f8a6c",
  ADMIN_PASSWORD: "Un-Mot-De-Passe-Admin-Solide-9",
  DATABASE_URL: "postgres://cabinet:Xk9-longue-phrase-secrete@db:5432/cabinet",
  CORS_ORIGIN: "https://cabinet.camconsult.com.tn",
  APP_URL: "https://cabinet.camconsult.com.tn",
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "u",
  SMTP_PASSWORD: "p",
  CLIENT_IP_HEADER: "cf-connecting-ip",
};
const niveau = (res, code) => res.find((r) => r.code === code)?.niveau;

describe("contrôle de configuration de production", () => {
  it("accepte une configuration saine", () => {
    const res = evaluerConfiguration(bonne);
    expect(aEchec(res)).toBe(false);
    expect(niveau(res, "JWT_SECRET")).toBe("ok");
  });

  it.each([
    ["absent", undefined],
    ["vide", ""],
    ["valeur de développement", "dev-secret-change-me"],
    ["trop court", "court-secret"],
  ])("refuse un JWT_SECRET %s", (_nom, valeur) => {
    expect(niveau(evaluerConfiguration({ ...bonne, JWT_SECRET: valeur }), "JWT_SECRET")).toBe("echec");
  });

  it("refuse le mot de passe administrateur par défaut et une base au mot de passe trivial", () => {
    expect(niveau(evaluerConfiguration({ ...bonne, ADMIN_PASSWORD: "Cabinet2026!" }), "ADMIN_PASSWORD")).toBe("echec");
    expect(niveau(evaluerConfiguration({ ...bonne, DATABASE_URL: "postgres://cabinet:cabinet@db/cabinet" }), "DATABASE_URL")).toBe("echec");
    expect(niveau(evaluerConfiguration({ ...bonne, DATABASE_URL: undefined }), "DATABASE_URL")).toBe("echec");
  });

  it("signale la réinitialisation permise et l'adresse visiteur non configurée", () => {
    const res = evaluerConfiguration({ ...bonne, ALLOW_DATA_RESET: "true", CLIENT_IP_HEADER: undefined });
    expect(niveau(res, "ALLOW_DATA_RESET")).toBe("alerte");
    expect(niveau(res, "CLIENT_IP_HEADER")).toBe("alerte");
  });

  it("clé de chiffrement du certificat de signature : absente = info, trop courte ou répétitive = alerte, valide = ok, sans jamais l'afficher", () => {
    const solide = "k7Qp2xV9mT4wZ8nB3cF6hJ1sD5gL0rYa";
    expect(niveau(evaluerConfiguration(bonne), "SIGNATURE_CLE_SECRET")).toBe("info");
    expect(niveau(evaluerConfiguration({ ...bonne, SIGNATURE_CLE_SECRET: "court" }), "SIGNATURE_CLE_SECRET")).toBe("alerte");
    expect(niveau(evaluerConfiguration({ ...bonne, SIGNATURE_CLE_SECRET: "a".repeat(40) }), "SIGNATURE_CLE_SECRET")).toBe("alerte");
    const res = evaluerConfiguration({ ...bonne, SIGNATURE_CLE_SECRET: solide });
    expect(niveau(res, "SIGNATURE_CLE_SECRET")).toBe("ok");
    expect(aEchec(res)).toBe(false);
    expect(JSON.stringify(res)).not.toContain(solide);
  });

  it("n'affiche jamais la valeur d'un secret", () => {
    const texte = JSON.stringify(evaluerConfiguration(bonne));
    expect(texte).not.toContain(bonne.JWT_SECRET);
    expect(texte).not.toContain(bonne.ADMIN_PASSWORD);
    expect(texte).not.toContain("Xk9-longue-phrase-secrete");
    expect(texte).not.toContain(bonne.SMTP_PASSWORD + "\"");
  });
});
