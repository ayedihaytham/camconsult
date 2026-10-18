import { describe, expect, it } from "vitest";
import type { FactureCabinet, FactureEinvoice, SignatureEtat, TtnEtat } from "@/types";
import { libelleProgression } from "./EinvoiceProgression";
import { chronologieEinvoice } from "./FactureDetailSheet";
import { etapesMiseEnRoute, joursRestants } from "./miseEnRoute";

// Données SYNTHÉTIQUES uniquement.
const MAINTENANT = new Date("2026-10-18T10:00:00Z");
const dans = (jours: number) => new Date(MAINTENANT.getTime() + jours * 24 * 3600 * 1000).toISOString();
const cabinetComplet: FactureCabinet = {
  nom: "CABINET EXEMPLE", raisonSociale: "CABINET EXEMPLE SARL", adresse: "", matriculeFiscal: "1234567ABM000", telephone: "", email: "", rib: "", mentions: "",
  rue: "12 rue du Lac", ville: "Tunis", codePostal: "1053", pays: "TN", rc: "",
};
const certificat = (jours: number): SignatureEtat => ({
  configuree: true,
  certificat: { sujet: "CN=Test", emetteur: "CN=CA", serie: "01", validDu: dans(-300), validAu: dans(jours), empreinte: "a".repeat(64), chargeLe: dans(-100), chargePar: "Admin", expire: jours < 0 },
  deverrouille: false,
  expireLe: null,
});
const ttnAvec = (extra: Record<string, unknown> = {}): TtnEtat => ({
  configuree: true,
  connexion: { url: "https://ttn.exemple/x", login: "compte", matricule: "", environnement: "test", motDePasseDefini: true, majLe: dans(-2), majPar: "Admin", dernierEssai: null, ...extra },
});
const etape = (liste: ReturnType<typeof etapesMiseEnRoute>, id: string) => liste.find((e) => e.id === id)!;

describe("liste de mise en route de la facture électronique", () => {
  it("tout est à vérifier tant que rien n'est chargé (aucune étape déclarée terminée par erreur)", () => {
    const e = etapesMiseEnRoute({ cabinet: null, signature: null, ttn: null, maintenant: MAINTENANT });
    expect(e.map((x) => x.etat)).toEqual(["attente", "attente", "attente", "attente"]);
  });

  it("identité du cabinet : liste précisément ce qui manque, avec l'action pour le compléter", () => {
    const e = etape(etapesMiseEnRoute({ cabinet: { ...cabinetComplet, matriculeFiscal: "123", rue: "", codePostal: "" }, signature: null, ttn: null, maintenant: MAINTENANT }), "identite");
    expect(e.etat).toBe("a_faire");
    expect(e.detail).toContain("matricule fiscal valide");
    expect(e.detail).toContain("rue");
    expect(e.detail).toContain("code postal");
    expect(e.action).toEqual({ libelle: "Compléter le cabinet", cible: "cabinet" });
    expect(etape(etapesMiseEnRoute({ cabinet: cabinetComplet, signature: null, ttn: null, maintenant: MAINTENANT }), "identite").etat).toBe("ok");
  });

  it("certificat : absent, expiré, valide, valide mais bientôt expiré (à surveiller), serveur sans clé", () => {
    const certif = (signature: SignatureEtat) => etape(etapesMiseEnRoute({ cabinet: cabinetComplet, signature, ttn: null, maintenant: MAINTENANT }), "certificat");
    expect(certif({ configuree: true, certificat: null, deverrouille: false, expireLe: null })).toMatchObject({ etat: "a_faire", action: { cible: "signature" } });
    expect(certif(certificat(-5))).toMatchObject({ etat: "a_faire", detail: expect.stringContaining("Expiré") });
    expect(certif(certificat(200))).toMatchObject({ etat: "ok", avertissement: false });
    expect(certif(certificat(200)).action).toBeUndefined();
    expect(certif(certificat(24))).toMatchObject({ etat: "ok", avertissement: true, action: { cible: "signature" } });
    expect(certif(certificat(24)).detail).toContain("24 jours");
    expect(certif({ configuree: false, certificat: null, deverrouille: false, expireLe: null })).toMatchObject({ etat: "a_faire" });
    expect(certif({ configuree: false, certificat: null, deverrouille: false, expireLe: null }).action).toBeUndefined();
  });

  it("accès TTN puis essai de connexion : jamais essayé, échoué, réussi ; l'essai n'est proposé qu'une fois les accès enregistrés", () => {
    const e = (ttn: TtnEtat) => etapesMiseEnRoute({ cabinet: cabinetComplet, signature: certificat(200), ttn, maintenant: MAINTENANT });
    const sans = e({ configuree: true, connexion: null });
    expect(etape(sans, "ttn")).toMatchObject({ etat: "a_faire", action: { cible: "ttn" } });
    expect(etape(sans, "essai").etat).toBe("a_faire");
    expect(etape(sans, "essai").action).toBeUndefined();

    const jamais = e(ttnAvec());
    expect(etape(jamais, "ttn").etat).toBe("ok");
    expect(etape(jamais, "ttn").detail).toContain("de test");
    expect(etape(jamais, "essai")).toMatchObject({ etat: "a_faire", action: { cible: "tester", libelle: "Tester la connexion" } });

    const echec = e(ttnAvec({ dernierEssai: { ok: false, le: dans(-1) } }));
    expect(etape(echec, "essai")).toMatchObject({ etat: "a_faire", action: { libelle: "Tester de nouveau" } });
    expect(etape(echec, "essai").detail).toContain("échoué");

    const bon = e(ttnAvec({ environnement: "reel", dernierEssai: { ok: true, le: dans(-1) } }));
    expect(etape(bon, "essai").etat).toBe("ok");
    expect(etape(bon, "ttn").detail).toContain("réel");
    expect(bon.every((x) => x.etat === "ok")).toBe(true);
  });

  it("jours restants : arrondi au jour supérieur, négatif une fois expiré", () => {
    expect(joursRestants(dans(24), MAINTENANT)).toBe(24);
    expect(joursRestants(dans(0.5), MAINTENANT)).toBe(1);
    expect(joursRestants(dans(-3), MAINTENANT)).toBeLessThanOrEqual(-2);
  });
});

describe("progression de la facture électronique", () => {
  it("libellés et ton : l'action attendue est signalée, validée en vert, rejetée en rouge", () => {
    expect(libelleProgression("aucune")).toEqual({ texte: "Non préparée", ton: "neutre" });
    expect(libelleProgression("prete")).toEqual({ texte: "Préparée — à signer", ton: "action" });
    expect(libelleProgression("signee")).toEqual({ texte: "Signée — à déposer", ton: "action" });
    expect(libelleProgression("deposee").ton).toBe("neutre");
    expect(libelleProgression("validee")).toEqual({ texte: "Validée par TTN", ton: "ok" });
    expect(libelleProgression("rejetee")).toEqual({ texte: "Rejetée par TTN", ton: "ko" });
  });

  it("chronologie du panneau de détail : étapes faites avec leur date, prochaine étape, rejet", () => {
    const ei = (extra: Partial<FactureEinvoice>): FactureEinvoice => ({ statut: "prete", genereLe: "2026-10-17T10:12:00Z", sha256: "", ...extra });
    const sans = chronologieEinvoice(null);
    expect(sans.map((e) => e.etat)).toEqual(["suivante", "avenir", "avenir", "avenir"]);

    const signee = chronologieEinvoice(ei({ statut: "signee", signeLe: "2026-10-17T10:42:00Z" }));
    expect(signee.map((e) => e.etat)).toEqual(["fait", "fait", "suivante", "avenir"]);
    expect(signee[1].detail).toContain("17/10/2026");

    const validee = chronologieEinvoice(ei({ statut: "validee", signeLe: "2026-10-17T10:42:00Z", deposeLe: "2026-10-17T10:45:00Z", refTtn: "REF-42", refTtnDate: "2026-10-17T10:50:00Z" }));
    expect(validee.map((e) => e.etat)).toEqual(["fait", "fait", "fait", "fait"]);
    expect(validee[3].libelle).toContain("REF-42");

    const rejetee = chronologieEinvoice(ei({ statut: "rejetee", signeLe: "2026-10-17T10:42:00Z", deposeLe: "2026-10-17T10:45:00Z", acquittements: [{ message: "Matricule invalide" }] }));
    expect(rejetee.map((e) => e.etat)).toEqual(["fait", "fait", "fait", "rejet"]);
    expect(rejetee[3].libelle).toBe("Rejetée par TTN");
    expect(rejetee[3].detail).toContain("1 motif");
  });
});
