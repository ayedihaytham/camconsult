import { describe, expect, it } from "vitest";
import { cleCompte, libelleAppareil } from "./sessions.js";

describe("libellé de l'appareil", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Chrome / Brave sur Windows"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "Edge sur Windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", "Safari sur macOS"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "Safari sur iPhone"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "Chrome / Brave sur Android"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox sur Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox sur Linux"],
    ["node", "Application"],
    ["", "Appareil inconnu"],
    [undefined, "Appareil inconnu"],
  ])("« %s » -> %s", (ua, attendu) => {
    expect(libelleAppareil(ua)).toBe(attendu);
  });
});

describe("clé du compte", () => {
  it("« admin:<id> » pour l’administrateur, l'identifiant pour un employé", () => {
    expect(cleCompte({ role: "admin", adminId: "a-1" })).toBe("admin:a-1");
    expect(cleCompte({ role: "employe", employeId: "e-123" })).toBe("e-123");
  });
});
