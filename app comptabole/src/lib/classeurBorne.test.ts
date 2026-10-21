import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import { DepassementLimite, extraireFeuilles, type LimitesExtraction } from "./extraireClasseur";
import { DELAI_LECTURE_MS, lireClasseurIsole, type TravailleurLecture } from "./lireClasseurIsole";

// PR B (travailleur) — ne fait pas partie de la PR A. Données SYNTHÉTIQUES uniquement ; les cas lourds sont exécutés hors suite, en processus limité.

describe("extraireFeuilles (limites de feuilles, lignes, colonnes, cellules)", () => {
  const classeur = (aoa: unknown[][], noms = ["S"]) => {
    const w = XLSX.utils.book_new();
    noms.forEach((n) => XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), n));
    return XLSX.write(w, { bookType: "xlsx", type: "array", cellDates: true }) as ArrayBuffer;
  };
  const limites = (o: Partial<LimitesExtraction> = {}): LimitesExtraction => ({ feuillesMax: 3, lignesMax: 10, colonnesMax: 5, cellulesMax: 40, ...o });

  it("renvoie uniquement des données simples, dates en AAAA-MM-JJ, sans objet de la bibliothèque", () => {
    const f = extraireFeuilles(XLSX, classeur([["Compte", "Montant", "Date"], ["101", 1234.567, new Date(2026, 7, 31)], ["x", null, "t"]]), {}, limites());
    expect(f).toHaveLength(1);
    expect(f[0].rows[1]).toEqual(["101", 1234.567, { date: "2026-08-31" }]);
    expect(JSON.parse(JSON.stringify(f))).toEqual(f);
  });
  it("refuse trop de lignes, de colonnes, de feuilles ou de cellules", () => {
    const ligne = (n: number) => Array.from({ length: n }, (_, i) => i);
    expect(() => extraireFeuilles(XLSX, classeur(Array.from({ length: 12 }, () => [1])), {}, limites())).toThrow(DepassementLimite);
    expect(() => extraireFeuilles(XLSX, classeur([ligne(6)]), {}, limites())).toThrow(DepassementLimite);
    expect(() => extraireFeuilles(XLSX, classeur([[1]], ["a", "b", "c", "d"]), {}, limites())).toThrow(DepassementLimite);
    expect(() => extraireFeuilles(XLSX, classeur(Array.from({ length: 10 }, () => ligne(5)), ["a", "b"]), {}, limites({ cellulesMax: 80 }))).toThrow(DepassementLimite);
  });
  it("accepte un classeur juste dans les limites", () => {
    expect(() => extraireFeuilles(XLSX, classeur(Array.from({ length: 10 }, () => [1, 2, 3, 4, 5])), {}, limites({ cellulesMax: 50 }))).not.toThrow();
  });
  it("un fichier illisible lève une erreur ordinaire (pas un dépassement)", () => {
    expect(() => extraireFeuilles(XLSX, new Uint8Array([1, 2, 3]).buffer, {}, limites())).not.toThrow(DepassementLimite);
  });
});

describe("lireClasseurIsole (travailleur simulé)", () => {
  function faux() {
    const t: TravailleurLecture & { termine: number; recu?: unknown } = {
      termine: 0,
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage(m) {
        t.recu = m;
      },
      terminate() {
        t.termine++;
      },
    };
    return t;
  }
  const tampon = () => new ArrayBuffer(8);

  it("succès : renvoie les feuilles et termine le travailleur", async () => {
    const t = faux();
    const { promesse } = lireClasseurIsole(tampon(), { creer: () => t });
    t.onmessage?.({ data: { ok: true, feuilles: [{ nom: "S", rows: [[1]], fusions: [] }] } } as never);
    await expect(promesse).resolves.toEqual([{ nom: "S", rows: [[1]], fusions: [] }]);
    expect(t.termine).toBe(1);
  });
  it("erreur et limite : messages français sans contenu, travailleur terminé", async () => {
    const t = faux();
    const a = lireClasseurIsole(tampon(), { creer: () => t });
    t.onmessage?.({ data: { ok: false, code: "limite" } } as never);
    await expect(a.promesse).rejects.toThrow(/trop grand/);
    const t2 = faux();
    const b = lireClasseurIsole(tampon(), { creer: () => t2 });
    t2.onerror?.(new Error("détail interne"));
    await expect(b.promesse).rejects.toThrow(/illisible ou trop complexe/);
    expect(t.termine + t2.termine).toBe(2);
  });
  it("délai : le travailleur est terminé de force", async () => {
    vi.useFakeTimers();
    const t = faux();
    const { promesse } = lireClasseurIsole(tampon(), { creer: () => t, delaiMs: DELAI_LECTURE_MS });
    const attente = expect(promesse).rejects.toThrow(/trop complexe/);
    await vi.advanceTimersByTimeAsync(DELAI_LECTURE_MS + 1);
    await attente;
    expect(t.termine).toBe(1);
    vi.useRealTimers();
  });
  it("annulation : travailleur terminé, résultat tardif ignoré, nouvelle lecture possible", async () => {
    const t = faux();
    const { promesse, annuler } = lireClasseurIsole(tampon(), { creer: () => t });
    const attente = expect(promesse).rejects.toThrow(/annulée/);
    annuler();
    await attente;
    t.onmessage?.({ data: { ok: true, feuilles: [] } } as never);
    expect(t.termine).toBe(1);
    const t2 = faux();
    const c = lireClasseurIsole(tampon(), { creer: () => t2 });
    c.annuler();
    await expect(c.promesse).rejects.toThrow(/annulée/);
  });
  it("une seule lecture à la fois", async () => {
    const t = faux();
    const a = lireClasseurIsole(tampon(), { creer: () => t });
    expect(() => lireClasseurIsole(tampon(), { creer: () => faux() })).toThrow(/déjà en cours/);
    a.annuler();
    await expect(a.promesse).rejects.toThrow();
  });
  it("le tampon est transféré (pas copié) et le message ne contient que des données simples", () => {
    const t = faux();
    const d = tampon();
    const spy = vi.spyOn(t, "postMessage");
    const { annuler, promesse } = lireClasseurIsole(d, { creer: () => t });
    expect(spy).toHaveBeenCalledWith({ donnees: d, cellDates: true }, [d]);
    annuler();
    return expect(promesse).rejects.toThrow();
  });
});
