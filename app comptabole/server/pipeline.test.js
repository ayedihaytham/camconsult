import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSP_RAPPORT_SEUL, securityHeaders } from "./securityHeaders.js";
import { calculerTotaux } from "../shared/factureTotaux.js";

const workflow = readFileSync(new URL("../../.github/workflows/app-comptable.yml", import.meta.url), "utf-8");

describe("chaîne de déploiement", () => {
  const indexDocker = workflow.indexOf("\n  docker:");

  it("l'image n'est publiée qu'après les contrôles (types, tests, construction, intégration PostgreSQL), qui sont obligatoires", () => {
    expect(workflow).toMatch(/\n {2}tests:/);
    expect(workflow).toMatch(/\n {2}integration:/);
    expect(workflow).toMatch(/docker:\s*\n\s*needs:\s*\[tests,\s*integration\]/);
    const avant = workflow.slice(0, indexDocker);
    expect(avant).toContain("npm run lint");
    expect(avant).toContain("npm test");
    expect(avant).toContain("npm run build");
    expect(avant).toContain("npm run test:integration");
    // Aucun contournement : ni continue-on-error, ni condition qui saute les contrôles.
    expect(workflow).not.toMatch(/continue-on-error:\s*true/);
    expect(workflow).not.toMatch(/if:\s*false/);
  });

  it("la publication est impossible depuis une pull request ou une autre branche que main", () => {
    const docker = workflow.slice(indexDocker);
    expect(docker).toMatch(/if:\s*github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/);
    expect(workflow).toMatch(/pull_request:/);
  });

  it("aucun secret n'est accessible aux contrôles (ils tournent aussi pour les pull requests) et les droits sont en lecture seule", () => {
    expect(workflow.slice(0, indexDocker)).not.toContain("secrets.");
    expect(workflow).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });

  it("la base de test de la CI est un conteneur de service jetable, avec un mot de passe propre au test", () => {
    expect(workflow).toContain("services:");
    expect(workflow).toContain("postgres:16-alpine");
    expect(workflow).toContain("TEST_DATABASE_URL");
  });

  it("le lancement manuel passe par les mêmes contrôles (même fichier, mêmes dépendances)", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow.match(/^\s{2}(tests|integration|docker):/gm)).toHaveLength(3);
  });
});

describe("autres chemins de publication", () => {
  const site = readFileSync(new URL("../../.github/workflows/camconsult-site.yml", import.meta.url), "utf-8");

  it("le workflow du site vitrine (même Watchtower) ne publie plus depuis une autre branche que main", () => {
    expect(site).toMatch(/docker:\s*\n\s*if:\s*github\.ref == 'refs\/heads\/main'/);
    expect(site).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });

  it("aucun workflow ne se déclenche sur une étiquette ou une publication (release)", () => {
    for (const w of [workflow, site]) {
      // Seule la section « on: » compte (« tags: » apparaît aussi dans les étiquettes de l'image publiée).
      const declencheurs = w.slice(w.indexOf("\non:"), w.indexOf("\njobs:"));
      expect(declencheurs).toMatch(/push:/);
      expect(declencheurs).not.toMatch(/\n\s*(tags|release|registry_package|schedule|workflow_run):/);
    }
  });
});

describe("configuration nginx du dépôt (revue statique ; nginx n'a pas pu être lancé ici)", () => {
  const nginx = readFileSync(new URL("../../deploy/nginx-camconsult.conf", import.meta.url), "utf-8");
  const bloc = nginx.slice(nginx.indexOf("server_name cabinet.camconsult.com.tn"), nginx.indexOf("server_name monitor.camconsult.com.tn"));

  it("masque la version de nginx et X-Powered-By pour l'application", () => {
    expect(bloc).toContain("server_tokens off;");
    expect(bloc).toContain("proxy_hide_header X-Powered-By;");
  });

  it("chaque emplacement transmet le protocole et la chaîne d'adresses, et ne vise que le port local de l'application", () => {
    const emplacements = bloc.match(/location [^{]+\{[^}]*\}/g) ?? [];
    expect(emplacements.length).toBe(3);
    for (const e of emplacements) {
      expect(e).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
      expect(e).toContain("proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;");
      expect(e).toContain("proxy_pass http://127.0.0.1:5181;");
    }
  });

  it("ne répète aucun en-tête de sécurité (ils sont posés par l'application : pas de doublon)", () => {
    expect(nginx).not.toMatch(/add_header\s+(Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options|Referrer-Policy|Permissions-Policy|Content-Security-Policy)/i);
  });

  it("le compose de production ne publie l'application que sur l'interface locale", () => {
    const compose = readFileSync(new URL("../../deploy/docker-compose.yml", import.meta.url), "utf-8");
    expect(compose).toContain('"127.0.0.1:5181:8080"');
    expect(compose).not.toMatch(/-\s*"(0\.0\.0\.0:)?5181:/);
  });
});

describe("en-têtes de sécurité", () => {
  const appliquer = (secure) => {
    const entetes = {};
    let suite = false;
    securityHeaders({ secure }, { setHeader: (k, v) => (entetes[k] = v) }, () => (suite = true));
    return { entetes, suite };
  };

  it("pose les protections de base sur toute réponse", () => {
    const { entetes, suite } = appliquer(false);
    expect(suite).toBe(true);
    expect(entetes["X-Content-Type-Options"]).toBe("nosniff");
    expect(entetes["X-Frame-Options"]).toBe("DENY");
    expect(entetes["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(entetes["Content-Security-Policy-Report-Only"]).toBe(CSP_RAPPORT_SEUL);
    expect(entetes["Strict-Transport-Security"]).toBeUndefined();
  });

  it("n'active HSTS qu'en HTTPS", () => {
    expect(appliquer(true).entetes["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
  });

  it("la politique CSP reste compatible avec l'application : polices Google, images en données, aperçu PDF en iframe, aucun script externe", () => {
    expect(CSP_RAPPORT_SEUL).toContain("script-src 'self'");
    expect(CSP_RAPPORT_SEUL).toContain("https://fonts.googleapis.com");
    expect(CSP_RAPPORT_SEUL).toContain("img-src 'self' data: blob:");
    expect(CSP_RAPPORT_SEUL).toContain("frame-src 'self' data: blob:");
    expect(CSP_RAPPORT_SEUL).toContain("frame-ancestors 'none'");
  });
});

describe("FIN-03 : totaux d'une facture, exemples documentés (règle de calcul, pas politique fiscale)", () => {
  const cas = [
    // [description, lignes, tva %, timbre, HT, TVA, net]
    ["une ligne simple", [{ quantite: 1, montantHt: 100 }], 19, 1, 100, 19, 120],
    ["TVA arrondie au millime vers le haut (76,00095 → 76,001)", [{ quantite: 3, montantHt: 100.005 }, { quantite: 2, montantHt: 49.995 }], 19, 1, 400.005, 76.001, 477.006],
    ["TVA calculée sur le total, pas ligne par ligne", [{ quantite: 1, montantHt: 0.005 }, { quantite: 1, montantHt: 0.005 }], 19, 0, 0.01, 0.002, 0.012],
    ["taux 0 % : timbre seul s'ajoute", [{ quantite: 2, montantHt: 50 }], 0, 1, 100, 0, 101],
    ["quantité fractionnaire", [{ quantite: 2.5, montantHt: 10.1 }], 7, 0, 25.25, 1.768, 27.018],
    ["somme de flottants (0,1 + 0,2)", [{ quantite: 1, montantHt: 0.1 }, { quantite: 1, montantHt: 0.2 }], 0, 0, 0.3, 0, 0.3],
  ];

  it.each(cas)("%s", (_nom, lignes, tva, timbre, ht, taxe, net) => {
    expect(calculerTotaux(lignes, tva, timbre)).toEqual({ totalHt: ht, tva: taxe, netAPayer: net });
  });

  it("lignes vides ou champs invalides : zéro, jamais NaN", () => {
    expect(calculerTotaux([], 19, 1)).toEqual({ totalHt: 0, tva: 0, netAPayer: 1 });
    expect(calculerTotaux([{ quantite: Number.NaN, montantHt: 10 }], 19, 0).totalHt).toBe(0);
  });
});

describe("FIN-03 : arrondi au millime sans erreur de flottant", () => {
  it("arrondit vers le haut tous les demi-millimes exacts (l'ancien calcul en ratait environ 0,6 %)", async () => {
    const { arrondi3 } = await import("../shared/arrondi.js");
    expect(arrondi3(2.0035)).toBe(2.004);
    expect(arrondi3(2.0115)).toBe(2.012);
    expect(arrondi3(1.005)).toBe(1.005);
    let faux = 0;
    for (let n = 0; n < 200_000; n++) if (Math.abs(arrondi3((n * 10 + 5) / 10000) - (n + 1) / 1000) > 1e-9) faux++;
    expect(faux).toBe(0);
  });

  it("TVA sur un HT dont les millimes finissent par 50 (demi-millime de TVA à 19 %)", () => {
    // 100,050 x 19 % = 19,0095 -> 19,010 ; net = 100,050 + 19,010 + 1 = 120,060
    expect(calculerTotaux([{ quantite: 1, montantHt: 100.05 }], 19, 1)).toEqual({ totalHt: 100.05, tva: 19.01, netAPayer: 120.06 });
  });
});
