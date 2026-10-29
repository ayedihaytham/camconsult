import { describe, expect, it } from "vitest";
import { verifierImport } from "./verifierImport";
import type { ControleReleve } from "./controleReleve";

const l = (dateOp: string, libelle: string, debit: number, credit: number) => ({ dateOp, libelle, debit, credit });
const fichier = [l("2026-09-01", "LC Payment Credit", 0, 24640), l("2026-09-01", "TVA sur Com", 0.38, 0), l("2026-09-01", "TVA sur Com", 0.38, 0)];
const controle = (ok = true): ControleReleve => ({
  ok,
  lignes: [
    { libelle: "Total débit", calcule: 0.76, releve: 0.76, ecart: 0, ok },
    { libelle: "Total crédit", calcule: 24640, releve: 24640, ecart: 0, ok },
  ],
});

describe("vérification d'un import de relevé", () => {
  it("tout est retrouvé à l'identique dans le compte et les totaux sont ceux du relevé : exact", () => {
    const v = verifierImport(fichier, [...fichier, l("2026-08-01", "ANCIEN", 5, 0)], controle());
    expect(v.ok).toBe(true);
    expect(v.manquantes).toEqual([]);
    expect(v.lignes.map((x) => [x.libelle, x.releve, x.fichier, x.compte, x.ok])).toEqual([
      ["Total débit", 0.76, 0.76, 0.76, true],
      ["Total crédit", 24640, 24640, 24640, true],
      ["Nombre de lignes", null, 3, 3, true],
    ]);
  });

  it("une ligne absente du compte (ou en moins d'exemplaires) est nommée et rend le contrôle inexact", () => {
    const v = verifierImport(fichier, fichier.slice(0, 2));
    expect(v.ok).toBe(false);
    expect(v.manquantes).toEqual([fichier[2]]);
    expect(v.lignes.find((x) => x.libelle === "Nombre de lignes")).toMatchObject({ fichier: 3, compte: 2, ok: false });
  });

  it("une ligne dont le montant a été modifié n'est pas la même ligne", () => {
    const v = verifierImport(fichier, [fichier[0], fichier[1], l("2026-09-01", "TVA sur Com", 0.83, 0)]);
    expect(v.ok).toBe(false);
    expect(v.manquantes).toHaveLength(1);
  });

  it("des totaux qui ne sont pas ceux du relevé imprimé rendent le contrôle inexact même si tout est enregistré", () => {
    const faux: ControleReleve = { ok: false, lignes: [{ libelle: "Total débit", calcule: 0.76, releve: 1.76, ecart: -1, ok: false }, { libelle: "Total crédit", calcule: 24640, releve: 24640, ecart: 0, ok: true }] };
    const v = verifierImport(fichier, fichier, faux);
    expect(v.ok).toBe(false);
    expect(v.lignes.find((x) => x.libelle === "Total débit")?.ok).toBe(false);
  });

  it("espaces et casse du libellé ne comptent pas", () => {
    expect(verifierImport([l("2026-09-01", "LC  Payment Credit ", 0, 5)], [l("2026-09-01", "lc payment credit", 0, 5)]).ok).toBe(true);
  });
});
