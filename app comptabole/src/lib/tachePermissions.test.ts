import { describe, expect, it } from "vitest";
import { actionTache, peutChangerStatut, type DroitsTache } from "./tachePermissions";

const droits = (patch: Partial<DroitsTache> = {}): DroitsTache => ({ isResponsableSociete: false, isDelegue: false, canManageCollaborateurs: false, employeId: "e1", ...patch });
const tache = (patch = {}) => ({ statut: "a_faire" as const, origine: "cabinet" as const, assigneId: "e1" as string | null, ...patch });

describe("droits de changement de statut (même règle que le serveur)", () => {
  it("le cabinet (administrateur, responsable des collaborateurs) fait avancer et reculer les tâches du cabinet", () => {
    const d = droits({ canManageCollaborateurs: true, employeId: null });
    expect(peutChangerStatut(tache({ assigneId: "autre" }), "en_cours", d)).toBe(true);
    expect(peutChangerStatut(tache({ statut: "termine" }), "a_faire", d)).toBe(true);
  });

  it("l'assigné avance ses propres tâches mais ne recule jamais ; une tâche d'un autre lui est fermée", () => {
    expect(peutChangerStatut(tache(), "en_cours", droits())).toBe(true);
    expect(peutChangerStatut(tache({ statut: "en_cours" }), "termine", droits())).toBe(true);
    expect(peutChangerStatut(tache({ statut: "termine" }), "en_cours", droits())).toBe(false);
    expect(peutChangerStatut(tache({ assigneId: "e2" }), "en_cours", droits())).toBe(false);
  });

  it("une tâche de société est en lecture seule pour le cabinet ; son responsable la pilote", () => {
    const societe = tache({ origine: "societe" as never, assigneId: "e2" });
    expect(peutChangerStatut(societe, "en_cours", droits({ canManageCollaborateurs: true }))).toBe(false);
    expect(peutChangerStatut(societe, "en_cours", droits({ isResponsableSociete: true }))).toBe(true);
    expect(peutChangerStatut({ ...societe, statut: "termine" }, "a_faire", droits({ isResponsableSociete: true }))).toBe(true);
  });

  it("garder le même statut est toujours permis ; aucun droit : rien", () => {
    expect(peutChangerStatut(tache({ assigneId: "e2" }), "a_faire", droits())).toBe(true);
    expect(peutChangerStatut(tache({ assigneId: "e2" }), "termine", droits())).toBe(false);
  });
});

describe("action proposée sur une carte", () => {
  it("à faire → Commencer, en cours → Terminer, terminée → Rouvrir", () => {
    expect(actionTache("a_faire")).toMatchObject({ vers: "en_cours", libelle: "Commencer" });
    expect(actionTache("en_cours")).toMatchObject({ vers: "termine", libelle: "Terminer" });
    expect(actionTache("termine")).toMatchObject({ vers: "en_cours", libelle: "Rouvrir" });
  });
});
