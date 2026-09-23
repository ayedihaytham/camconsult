import { describe, expect, it } from "vitest";
import type { Employe, Tache } from "@/types";
import { allowedPermissionCount, assignmentPreview, openTasksByCollaborator } from "./teamLedger";

const employe = {
  id: "collab-1",
  societesAssignees: ["s1", "s2", "s3"],
  permissions: {
    consulterDossiers: true,
    deposerFichiers: false,
    modifierSocietes: true,
    supprimer: false,
    messagerie: true,
  },
} as Employe;

describe("Team Ledger summaries", () => {
  it("counts only assigned, unfinished tasks from the existing task statuses", () => {
    const tasks = [
      { assigneId: "collab-1", statut: "a_faire" },
      { assigneId: "collab-1", statut: "en_cours" },
      { assigneId: "collab-1", statut: "termine" },
      { assigneId: "collab-2", statut: "en_cours" },
      { assigneId: null, statut: "a_faire" },
    ] as Tache[];
    expect(openTasksByCollaborator(tasks).get("collab-1")).toBe(2);
    expect(openTasksByCollaborator(tasks).get("collab-2")).toBe(1);
  });

  it("summarizes the five actual permission flags without treating them as a score", () => {
    expect(allowedPermissionCount(employe)).toBe(3);
  });

  it("makes additional assignments explicit and falls back to an unknown id", () => {
    expect(assignmentPreview(employe, new Map([["s1", "Atlas"], ["s2", "Carthage"]]))).toBe("Atlas · Carthage +1");
    expect(assignmentPreview({ ...employe, societesAssignees: ["s3"] }, new Map())).toBe("s3");
  });
});
