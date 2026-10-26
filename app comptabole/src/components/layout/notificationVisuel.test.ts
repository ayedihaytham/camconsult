import { Bell, Building2, ClipboardList, FolderTree, Globe, ListChecks, MessageSquare } from "lucide-react";
import { describe, expect, it } from "vitest";
import { visuelNotification } from "./notificationVisuel";

describe("visuelNotification", () => {
  it("choisit l'icône d'après le type de la notification", () => {
    expect(visuelNotification("collecte").icone).toBe(ClipboardList);
    expect(visuelNotification("apurement").icone).toBe(ClipboardList);
    expect(visuelNotification("message").icone).toBe(MessageSquare);
    expect(visuelNotification("tache_assignee").icone).toBe(ListChecks);
    expect(visuelNotification("tache_statut").icone).toBe(ListChecks);
    expect(visuelNotification("document").icone).toBe(FolderTree);
    expect(visuelNotification("societe").icone).toBe(Building2);
    expect(visuelNotification("swift").icone).toBe(Globe);
  });

  it("le type l'emporte sur la page vers laquelle renvoie la notification", () => {
    expect(visuelNotification("swift", "/collectes/abc").icone).toBe(Globe);
    expect(visuelNotification("document", "/structuration").icone).toBe(FolderTree);
  });

  it("pour un type inconnu, se rabat sur la page de destination, requête comprise", () => {
    expect(visuelNotification("inconnu", "/collectes").icone).toBe(ClipboardList);
    expect(visuelNotification("inconnu", "/collectes/abc?tab=documents").icone).toBe(ClipboardList);
    expect(visuelNotification("inconnu", "/messagerie").icone).toBe(MessageSquare);
    expect(visuelNotification(undefined, "/etat-swift/s1").icone).toBe(Globe);
  });

  it("ne confond pas un chemin qui commence par le même mot", () => {
    expect(visuelNotification(undefined, "/collectes-archivees").icone).toBe(Bell);
    expect(visuelNotification(undefined, "/tachesx").icone).toBe(Bell);
  });

  it("prend la cloche sans type ni lien, ou pour une page inconnue", () => {
    expect(visuelNotification(undefined).icone).toBe(Bell);
    expect(visuelNotification(null, null).icone).toBe(Bell);
    expect(visuelNotification("", "").icone).toBe(Bell);
    expect(visuelNotification(undefined, "/journal").icone).toBe(Bell);
  });

  it("l'ambre signale ce qui est à examiner, le reste reste dans le ton marine", () => {
    expect(visuelNotification("collecte").tuile).toContain("warning");
    expect(visuelNotification("message").tuile).not.toContain("warning");
  });
});
