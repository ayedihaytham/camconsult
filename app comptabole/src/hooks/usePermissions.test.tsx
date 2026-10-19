// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useAuth, type Session } from "@/store/auth";
import { usePermissions } from "./usePermissions";

afterEach(() => {
  cleanup();
  useAuth.setState({ status: "anon", session: null });
});

const session = (extra: Partial<Session>): Session =>
  ({ role: "employe", poste: "collaborateur", employeId: "e1", nom: "Test", fonction: "", initiales: "T", cabinetNom: "C", permissions: { consulterDossiers: true, deposerFichiers: false, modifierSocietes: false, supprimer: false, messagerie: true }, societeIds: ["s1"], ...extra }) as Session;
const contexte = (s: Session | null) => {
  useAuth.setState({ status: s ? "authed" : "anon", session: s });
  return renderHook(() => usePermissions()).result.current;
};

describe("contexte de droits selon le rôle", () => {
  it("sans session (connexion, chargement) : aucun droit, jamais le contexte administrateur", () => {
    const c = contexte(null);
    expect(c.isAdmin).toBe(false);
    expect(c.can("consulterDossiers")).toBe(false);
    expect(c.can("supprimer")).toBe(false);
    expect(c.canSeeSociete("s1")).toBe(false);
    expect(c.isCollaborateur).toBe(false);
    expect(c.canManageCollaborateurs).toBe(false);
    expect(c.lectureSeule).toBe(true);
  });

  it("administrateur : tous les droits, toutes les sociétés", () => {
    const c = contexte(session({ role: "admin", poste: null, societeIds: null }));
    expect(c).toMatchObject({ isAdmin: true, societeIds: null, canManageCollaborateurs: true, isCollaborateur: true, lectureSeule: false });
    expect(c.can("supprimer")).toBe(true);
    expect(c.canSeeSociete("n-importe-laquelle")).toBe(true);
  });

  it("responsable des collaborateurs : toutes les sociétés et la gestion d'équipe, sans être administrateur", () => {
    const c = contexte(session({ poste: "responsable_collaborateurs", societeIds: [] }));
    expect(c).toMatchObject({ isAdmin: false, societeIds: null, canManageCollaborateurs: true, isCollaborateur: true });
    expect(c.canSeeSociete("s9")).toBe(true);
  });

  it("collaborateur : seulement ses sociétés et ses droits", () => {
    const c = contexte(session({}));
    expect(c).toMatchObject({ isAdmin: false, canManageCollaborateurs: false, isCollaborateur: true, lectureSeule: false });
    expect(c.canSeeSociete("s1")).toBe(true);
    expect(c.canSeeSociete("s2")).toBe(false);
    expect(c.can("consulterDossiers")).toBe(true);
    expect(c.can("deposerFichiers")).toBe(false);
  });

  it("responsable et délégué de société : lecture seule, leur société uniquement ; le délégué est distingué", () => {
    const resp = contexte(session({ poste: "societe_employe", lectureSeule: true, delegue: false }));
    expect(resp).toMatchObject({ isCollaborateur: false, lectureSeule: true, isResponsableSociete: true, isDelegue: false, canManageCollaborateurs: false });
    expect(resp.canSeeSociete("s1")).toBe(true);
    expect(resp.canSeeSociete("s2")).toBe(false);
    const del = contexte(session({ poste: "societe_employe", lectureSeule: true, delegue: true }));
    expect(del).toMatchObject({ isResponsableSociete: true, isDelegue: true });
  });
});
