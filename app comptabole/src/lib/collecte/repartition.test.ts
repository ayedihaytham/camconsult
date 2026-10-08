import { describe, expect, it } from "vitest";
import { TAB_BY_KEY, repartitionGroupes } from "./tabs";

const def = TAB_BY_KEY.bordereaux_remise_cheques;
const ligne = (num_bordereau: string, montant: number | string, montant_bordereau: number | string = "") => ({ num_bordereau, montant, montant_bordereau });

describe("répartition d'un bordereau de remise sur plusieurs lignes", () => {
  it("compte la somme des chèques contre le montant annoncé sur la première ligne", () => {
    const [g] = repartitionGroupes(def, [ligne("REM-42", 35000, 60000), ligne("REM-42", 10000)]);
    expect(g).toMatchObject({ nom: "REM-42", total: 60000, reparti: 45000, reste: 15000, complet: false, nbLignes: 2 });
  });

  it("est complet quand la somme atteint le montant", () => {
    const [g] = repartitionGroupes(def, [ligne("REM-42", 35000, 60000), ligne("REM-42", 25000)]);
    expect(g).toMatchObject({ reparti: 60000, reste: 0, complet: true });
  });

  it("signale un dépassement", () => {
    const [g] = repartitionGroupes(def, [ligne("REM-42", 35000, 60000), ligne("REM-42", 30000)]);
    expect(g).toMatchObject({ reste: -5000, complet: false });
  });

  it("regroupe sans tenir compte de la casse ni des espaces, et suit chaque bordereau à part", () => {
    const g = repartitionGroupes(def, [ligne("rem-1", 100, 300), ligne(" REM-1 ", 200), ligne("REM-2", 50, 50)]);
    expect(g.map((x) => [x.nom, x.reparti, x.total, x.complet])).toEqual([["rem-1", 300, 300, true], ["REM-2", 50, 50, true]]);
  });

  it("ne suit pas un bordereau sans montant annoncé, ni les lignes sans n° de bordereau", () => {
    expect(repartitionGroupes(def, [ligne("REM-9", 500), ligne("", 100, 1000)])).toEqual([]);
  });

  it("accepte un montant annoncé saisi en texte avec virgule", () => {
    const [g] = repartitionGroupes(def, [ligne("REM-3", "1 000,5", "2 000,5"), ligne("REM-3", "1 000")]);
    expect(g).toMatchObject({ total: 2000.5, reparti: 2000.5, complet: true });
  });

  it("n'existe que pour les bordereaux de remise", () => {
    expect(repartitionGroupes(TAB_BY_KEY.souche_cheques, [{ montant: 10 }])).toEqual([]);
  });
});
