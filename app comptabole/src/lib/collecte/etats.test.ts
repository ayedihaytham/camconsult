import { describe, expect, it } from "vitest";
import type { CollecteFull } from "@/types";
import { checklistRows } from "./checklist";
import { computeManques } from "./manques";
import { COLLECTE_ETATS, COLLECTE_TABS, TAB_BY_KEY, etatDeTableau, ordonnerTableaux, repartitionGroupes } from "./tabs";

describe("états de la collecte : chèques, virements, traites", () => {
  it("regroupe les tableaux de chaque état", () => {
    expect(COLLECTE_ETATS.map((e) => [e.code, e.tableaux])).toEqual([
      ["CHQ", ["bordereaux_remise_cheques", "etat_cheques_emis"]],
      ["VRT", ["virements_recus", "virements_emis", "virements_salaire"]],
      ["TR", ["bordereaux_traites_recues", "traites_emises", "traites_escomptees"]],
    ]);
    expect(etatDeTableau("traites_emises")?.label).toBe("État des traites");
    expect(etatDeTableau("chiffre_affaires")).toBeUndefined();
  });

  it("nomme les tableaux comme demandé", () => {
    // La souche de chèques (remplie par le client) et l'état des chèques émis (tenu par le comptable) sont deux tableaux distincts.
    expect(TAB_BY_KEY.souche_cheques.label).toBe("Souche de chèques");
    expect(TAB_BY_KEY.etat_cheques_emis.label).toBe("État des chèques émis");
    expect(etatDeTableau("souche_cheques")).toBeUndefined();
    expect(TAB_BY_KEY.etat_cheques_emis.columns).toEqual(TAB_BY_KEY.souche_cheques.columns);
    expect(TAB_BY_KEY.etat_cheques_emis.cabinetSeul).toBe(true);
    expect(TAB_BY_KEY.souche_cheques.cabinetSeul).toBeUndefined();
    expect(TAB_BY_KEY.virements_salaire.label).toBe("Virement multiple (salaires)");
    expect(TAB_BY_KEY.traites_emises.label).toBe("État des traites émises");
    expect(TAB_BY_KEY.traites_escomptees.label).toBe("Traites escomptées");
  });

  it("range les états d'abord, dans l'ordre chèques, virements, traites, puis les autres tableaux", () => {
    expect(COLLECTE_TABS.slice(0, 9).map((t) => t.key)).toEqual([
      "bordereaux_remise_cheques", "etat_cheques_emis", "virements_recus", "virements_emis", "virements_salaire",
      "bordereaux_traites_recues", "traites_emises", "traites_escomptees", "souche_cheques",
    ]);
    expect(ordonnerTableaux(["etat_caisse", "traites_emises", "souche_cheques", "virements_recus"])).toEqual([
      "virements_recus", "traites_emises", "souche_cheques", "etat_caisse",
    ]);
  });

  it("n'a plus de date de valeur : c'est une date d'échéance", () => {
    for (const t of COLLECTE_TABS) {
      expect(t.columns.some((c) => /valeur/i.test(c.label) || c.key === "date_valeur")).toBe(false);
    }
    for (const k of ["bordereaux_remise_cheques", "bordereaux_traites_recues", "traites_emises", "traites_escomptees"]) {
      expect(TAB_BY_KEY[k].columns.map((c) => c.key)).toContain("date_echeance");
    }
  });

  it("les traites ont les mêmes attributs que les chèques, avec N° Traite", () => {
    const cles = (k: string) => TAB_BY_KEY[k].columns.map((c) => c.key);
    expect(cles("traites_emises")).toEqual(["date", "num_traite", "beneficiaire", "motif", "montant", "date_echeance", "compte_bancaire", "observations"]);
    expect(cles("bordereaux_traites_recues")).toEqual([
      "date_remise", "num_bordereau", "montant", "banque", "num_traite", "client_emetteur", "montant_traite", "date_echeance", "observations",
    ]);
  });

  it("répartit un bordereau de traites comme un bordereau de chèques", () => {
    const def = TAB_BY_KEY.bordereaux_traites_recues;
    const [g] = repartitionGroupes(def, [
      { num_bordereau: "T1", montant: 900, montant_traite: 400 },
      { num_bordereau: "T1", montant: "", montant_traite: 500 },
    ]);
    expect(g).toMatchObject({ total: 900, reparti: 900, reste: 0, complet: true });
  });

  it("calcule le net crédité d'une traite escomptée : montant − agios", () => {
    const def = TAB_BY_KEY.traites_escomptees;
    const [r] = def.derive!([{ montant: 10000, agios: 125.5 }]);
    expect(r.net_credite).toBe(9874.5);
  });

  it("la checklist suit l'ordre des états et porte leur sigle", () => {
    const c = { onglets: ["etat_caisse", "traites_escomptees", "bordereaux_remise_cheques", "souche_cheques"], lignes: [], sections: [], statut: "brouillon" } as unknown as CollecteFull;
    expect(checklistRows(c).map((r) => [r.onglet, r.etat])).toEqual([
      ["bordereaux_remise_cheques", "CHQ"], ["traites_escomptees", "TR"], ["souche_cheques", undefined], ["etat_caisse", undefined],
    ]);
  });

  it("l'état des chèques émis, tenu par le cabinet, n'est ni dans la checklist ni dans le récap du client", () => {
    const c = {
      onglets: ["souche_cheques", "etat_cheques_emis"],
      sections: [],
      statut: "brouillon",
      lignes: [{ id: "1", onglet: "etat_cheques_emis", ordre: 0, data: { date: "2026-01-01", montant: 5 } }],
    } as unknown as CollecteFull;
    expect(checklistRows(c).map((r) => r.onglet)).toEqual(["souche_cheques"]);
    expect(computeManques(c).every((m) => m.onglet === "souche_cheques")).toBe(true);
  });

  it("ne demande pas le montant du bordereau sur les traites suivantes, mais le montant de chaque traite", () => {
    const c = {
      onglets: ["bordereaux_traites_recues"],
      sections: [],
      lignes: [
        { id: "1", onglet: "bordereaux_traites_recues", ordre: 0, data: { date_remise: "2026-05-01", num_bordereau: "T1", montant: 900, banque: "BNA", num_traite: "1", client_emetteur: "X", montant_traite: 400, date_echeance: "2026-07-01", observations: "ok" } },
        { id: "2", onglet: "bordereaux_traites_recues", ordre: 1, data: { date_remise: "2026-05-01", num_bordereau: "T1", montant: "", banque: "BNA", num_traite: "2", client_emetteur: "X", montant_traite: "", date_echeance: "2026-07-02", observations: "ok" } },
      ],
    } as unknown as CollecteFull;
    expect(computeManques(c).map((m) => m.col)).toEqual(["montant_traite"]);
  });
});
