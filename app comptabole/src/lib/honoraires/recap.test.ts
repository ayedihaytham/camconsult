import { describe, expect, it } from "vitest";
import type { HonoraireLigne, HonoraireRecapClient } from "@/types";
import { anneeDeLigne, recapSociete, totauxClients, trierParSolde } from "./recap";

const ligne = (patch: Partial<HonoraireLigne>): HonoraireLigne => ({
  id: "l",
  societeId: "s",
  ordre: 1,
  type: "mensuelle",
  nature: "",
  periode: "",
  libelle: "",
  cnss: "",
  numQuittance: "",
  montantDeclaration: 0,
  honoraire: 0,
  reglement: 0,
  dateReglement: null,
  note: "",
  pieceNom: "",
  pieceFormat: "",
  pieceTaille: "",
  aPiece: false,
  total: 0,
  solde: 0,
  creeLe: "2026-02-01T10:00:00Z",
  majLe: "",
  ...patch,
});

describe("année d'une ligne", () => {
  it("lit l'année dans la période, puis le libellé, puis la création", () => {
    expect(anneeDeLigne(ligne({ periode: "01-2025" }))).toBe("2025");
    expect(anneeDeLigne(ligne({ libelle: "DMI avril 2026" }))).toBe("2026");
    expect(anneeDeLigne(ligne({ periode: "2024", libelle: "DMI avril 2026" }))).toBe("2024");
    expect(anneeDeLigne(ligne({}))).toBe("2026");
  });

  it("ne confond pas un numéro avec une année", () => {
    expect(anneeDeLigne(ligne({ libelle: "Quittance 1203456" }))).toBe("2026");
    expect(anneeDeLigne(ligne({ libelle: "AP 01-2025" }))).toBe("2025");
  });
});

describe("récapitulatif d'une société", () => {
  const list = [
    ligne({ id: "1", type: "mensuelle", libelle: "DMI avril 2026", montantDeclaration: 30, honoraire: 30, reglement: 30.333, dateReglement: "2026-05-03" }),
    ligne({ id: "2", type: "trimestrielle", libelle: "T4 2025", montantDeclaration: 100, honoraire: 50, reglement: 0 }),
    ligne({ id: "3", type: "mensuelle", libelle: "DMI mai 2026", montantDeclaration: 40, honoraire: 20, reglement: 60, dateReglement: "2026-06-12" }),
  ];

  it("totalise déclaré, honoraires, règlements et solde", () => {
    const r = recapSociete(list);
    expect(r.nbLignes).toBe(3);
    expect(r.declare).toBe(170);
    expect(r.honoraires).toBe(100);
    expect(r.total).toBe(270);
    expect(r.reglements).toBe(90.333);
    expect(r.solde).toBe(179.667);
  });

  it("retient le règlement le plus récent", () => {
    expect(recapSociete(list).dernierReglement).toBe("2026-06-12");
    expect(recapSociete([ligne({ reglement: 5 })]).dernierReglement).toBeNull();
  });

  it("détaille par type, dans l'ordre des types, avec le solde de chaque type", () => {
    const { parType } = recapSociete(list);
    expect(parType.map((g) => g.libelle)).toEqual(["Mensuelle", "Trimestrielle"]);
    expect(parType[0]).toMatchObject({ nbLignes: 2, declare: 70, honoraires: 50, total: 120, reglements: 90.333, solde: 29.667 });
    expect(parType[1]).toMatchObject({ nbLignes: 1, total: 150, solde: 150 });
  });

  it("détaille par année, la plus récente d'abord", () => {
    const { parAnnee } = recapSociete(list);
    expect(parAnnee.map((g) => g.cle)).toEqual(["2026", "2025"]);
    expect(parAnnee[0].nbLignes).toBe(2);
    expect(parAnnee[1].total).toBe(150);
  });

  it("gère une société sans ligne", () => {
    const r = recapSociete([]);
    expect(r).toMatchObject({ nbLignes: 0, total: 0, solde: 0, dernierReglement: null, parType: [], parAnnee: [] });
  });
});

describe("récapitulatif de tous les clients", () => {
  const client = (patch: Partial<HonoraireRecapClient>): HonoraireRecapClient => ({
    societeId: "s",
    raisonSociale: "A",
    code: "",
    statut: "actif",
    nbLignes: 1,
    declare: 0,
    honoraires: 0,
    total: 0,
    reglements: 0,
    solde: 0,
    dernierReglement: null,
    ...patch,
  });

  const rows = [
    client({ societeId: "1", raisonSociale: "05-I CARGO LINE", total: 400, reglements: 400, solde: 0 }),
    client({ societeId: "2", raisonSociale: "01-RUSPINA", declare: 130, honoraires: 80, total: 210, reglements: 30.333, solde: 179.667 }),
    client({ societeId: "3", raisonSociale: "03-ACME", total: 50, solde: 50 }),
  ];

  it("totalise et compte les clients ayant un solde dû", () => {
    expect(totauxClients(rows)).toEqual({ clients: 3, avecSolde: 2, declare: 130, honoraires: 80, total: 660, reglements: 430.333, solde: 229.667 });
  });

  it("trie par solde décroissant puis par nom", () => {
    expect(trierParSolde(rows).map((r) => r.societeId)).toEqual(["2", "3", "1"]);
    const egaux = trierParSolde([client({ societeId: "b", raisonSociale: "B" }), client({ societeId: "a", raisonSociale: "A" })]);
    expect(egaux.map((r) => r.societeId)).toEqual(["a", "b"]);
  });
});
