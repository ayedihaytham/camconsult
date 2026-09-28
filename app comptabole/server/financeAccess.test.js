import { describe, expect, it } from "vitest";
import { canAccessFinanceSociete, canViewGlobalAffectat } from "./financeAccess.js";

describe("financial société scope", () => {
  it("allows admins to access global and company mappings", () => {
    const admin = { role: "admin", poste: null, societeIds: null };
    expect(canViewGlobalAffectat(admin)).toBe(true);
    expect(canAccessFinanceSociete(admin, "societe-a")).toBe(true);
  });

  it("allows collaborators only for sociétés in their finance scope", () => {
    const collaborateur = {
      role: "employe",
      poste: "collaborateur",
      societeIds: ["societe-a"],
    };
    expect(canViewGlobalAffectat(collaborateur)).toBe(true);
    expect(canAccessFinanceSociete(collaborateur, "societe-a")).toBe(true);
    expect(canAccessFinanceSociete(collaborateur, "societe-b")).toBe(false);
  });

  it("keeps company employees out of both global and company finance mappings", () => {
    const companyEmployee = {
      role: "employe",
      poste: "societe_employe",
      societeIds: ["societe-a"],
    };
    expect(canViewGlobalAffectat(companyEmployee)).toBe(false);
    expect(canAccessFinanceSociete(companyEmployee, "societe-a")).toBe(false);
  });
});
