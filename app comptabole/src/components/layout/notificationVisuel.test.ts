import { Bell, ClipboardList, ListChecks, MessageSquare } from "lucide-react";
import { describe, expect, it } from "vitest";
import { visuelNotification } from "./notificationVisuel";

describe("visuelNotification", () => {
  it("choisit l'icône d'après la page vers laquelle renvoie la notification", () => {
    expect(visuelNotification("/collectes").icone).toBe(ClipboardList);
    expect(visuelNotification("/collectes/abc").icone).toBe(ClipboardList);
    expect(visuelNotification("/messagerie").icone).toBe(MessageSquare);
    expect(visuelNotification("/taches").icone).toBe(ListChecks);
  });

  it("ne confond pas un chemin qui commence par le même mot", () => {
    expect(visuelNotification("/collectes-archivees").icone).toBe(Bell);
    expect(visuelNotification("/tachesx").icone).toBe(Bell);
  });

  it("prend la cloche sans lien ou pour une page inconnue", () => {
    expect(visuelNotification(undefined).icone).toBe(Bell);
    expect(visuelNotification(null).icone).toBe(Bell);
    expect(visuelNotification("").icone).toBe(Bell);
    expect(visuelNotification("/journal").icone).toBe(Bell);
  });

  it("l'ambre signale ce qui est à examiner, le reste reste neutre", () => {
    expect(visuelNotification("/collectes").tuile).toContain("warning");
    expect(visuelNotification("/messagerie").tuile).not.toContain("warning");
  });
});
