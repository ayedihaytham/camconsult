import { describe, expect, it } from "vitest";
import type { CollecteFull } from "@/types";
import { sectionReport } from "./exportXlsx";

const ligne = (ordre: number, data: Record<string, unknown>) => ({ id: `l${ordre}`, onglet: "bordereaux_remise_cheques", ordre, data });
const entete = { date_remise: "2026-05-22", num_bordereau: "391", montant: 10310, banque: "", montant_cheque: "" };
const cheque = (num: string, nom: string, montant: number) => ({ date_remise: "2026-05-22", num_bordereau: "391", montant: "", banque: "BTK", num_cheque: num, client_emetteur: nom, montant_cheque: montant });

const collecte = (lignes: ReturnType<typeof ligne>[]) =>
  ({ id: "c", societeId: "s", periode: "2026", statut: "brouillon", onglets: ["bordereaux_remise_cheques"], devise: "TND", sections: [], lignes, notes: [], fichiers: [] }) as unknown as CollecteFull;

describe("document PDF / impression des bordereaux de remise", () => {
  const rep = sectionReport(collecte([ligne(0, entete), ligne(1, cheque("111", "haytham", 10000)), ligne(2, cheque("121", "ccc", 310))]), "bordereaux_remise_cheques", "I CARGO LINE")!;

  it("n'a ni date de valeur ni observations", () => {
    expect(rep.header).toEqual([
      "Date de remise",
      "N° Bordereau",
      "Montant du bordereau (TND)",
      "Banque",
      "N° Chèque",
      "Nom du client émetteur (nominatif)",
      "Montant du chèque (TND)",
    ]);
    expect(rep.rows.every((r) => r.length === rep.header.length)).toBe(true);
  });

  it("supprime la ligne d'en-tête : le montant du bordereau passe sur le premier chèque, le total reste juste", () => {
    expect(rep.rows).toHaveLength(3);
    expect(rep.rows[0]).toEqual(["22/05/2026", "391", "10 310,000", "BTK", "111", "haytham", "10 000,000"]);
    expect(rep.rows[1]).toEqual(["22/05/2026", "391", "", "BTK", "121", "ccc", "310,000"]);
    expect(rep.rows[2][0]).toBe("TOTAL");
    expect(rep.rows[2][2]).toBe("10 310,000");
  });

  it("garde la ligne d'en-tête tant qu'aucun chèque n'est saisi", () => {
    const seul = sectionReport(collecte([ligne(0, entete)]), "bordereaux_remise_cheques", "X")!;
    expect(seul.rows[0][2]).toBe("10 310,000");
    expect(seul.rows).toHaveLength(2);
  });

  it("garde chaque bordereau avec son montant quand il y en a plusieurs", () => {
    const autre = { ...entete, num_bordereau: "392", montant: 500 };
    const r = sectionReport(
      collecte([ligne(0, entete), ligne(1, cheque("111", "a", 10310)), ligne(2, autre), ligne(3, { ...cheque("9", "b", 500), num_bordereau: "392" })]),
      "bordereaux_remise_cheques",
      "X",
    )!;
    expect(r.rows.slice(0, 2).map((x) => [x[1], x[2], x[6]])).toEqual([["391", "10 310,000", "10 310,000"], ["392", "500,000", "500,000"]]);
    expect(r.rows[2][2]).toBe("10 810,000");
  });

  it("ne change rien aux autres tableaux", () => {
    const c = collecte([]);
    c.onglets = ["souche_cheques"];
    c.lignes = [{ id: "s1", onglet: "souche_cheques", ordre: 0, data: { date: "2026-01-06", num_cheque: "4001", beneficiaire: "X", motif: "m", montant: 10, compte_bancaire: "ZITO", observations: "ok" } }] as never;
    expect(sectionReport(c, "souche_cheques", "X")!.header).toContain("Observations");
  });
});
