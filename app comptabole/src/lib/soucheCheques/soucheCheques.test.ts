import { describe, expect, it } from "vitest";
import type { SoucheCheque } from "@/types";
import { toDateString } from "@/lib/importCells";
import { champPour, parseRows } from "./importRows";
import {
  chequesEnAttente,
  joursDepuis,
  soucheRows,
  totauxParBanque,
  totauxParDevise,
} from "./model";

const chq = (over: Partial<SoucheCheque>): SoucheCheque => ({
  id: "1", societeId: "s", ordre: 1, banque: "BIAT", numCheque: "0000001",
  dateEmission: "2026-09-20", beneficiaire: "Fournisseur ACME", motif: "Achat",
  montant: 1250, devise: "TND", debite: true, dateDebit: "2026-09-24",
  creeLe: "", majLe: "", ...over,
});

describe("souche de chèques — totaux et PDF", () => {
  const list = [
    chq({}),
    chq({ id: "2", numCheque: "0000002", montant: 850, debite: false, dateDebit: null }),
    chq({ id: "3", numCheque: "0000003", montant: 145.2, devise: "EUR", debite: false, dateDebit: null }),
  ];

  it("totalise par devise sans jamais mélanger les devises, avec le montant moyen", () => {
    expect(totauxParDevise(list)).toEqual([
      { devise: "TND", nb: 2, nbDebites: 1, emis: 2100, debite: 1250, restant: 850, moyenEmis: 1050 },
      { devise: "EUR", nb: 1, nbDebites: 0, emis: 145.2, debite: 0, restant: 145.2, moyenEmis: 145.2 },
    ]);
  });

  it("totalise par banque puis par devise", () => {
    const list2 = [
      chq({ banque: "BIAT" }),
      chq({ id: "4", banque: "STB", numCheque: "4", montant: 500, devise: "TND", debite: false, dateDebit: null }),
    ];
    const t = totauxParBanque(list2);
    expect(t).toEqual([
      { banque: "BIAT", devise: "TND", nb: 1, nbDebites: 1, emis: 1250, debite: 1250, restant: 0, moyenEmis: 1250 },
      { banque: "STB", devise: "TND", nb: 1, nbDebites: 0, emis: 500, debite: 0, restant: 500, moyenEmis: 500 },
    ]);
  });

  it("produit en-tête, une ligne par chèque et trois totaux par devise", () => {
    const rows = soucheRows(list);
    expect(rows).toHaveLength(1 + 3 + 6);
    expect(rows[1].slice(0, 3)).toEqual(["BIAT", "0000001", "20/09/2026"]);
    expect(rows[1][7]).toBe("Oui");
    expect(rows[2][7]).toBe("Non");
    expect(rows[4]).toEqual(["TOTAL ÉMIS", "", "", "", "", 2100, "TND", "", ""]);
    expect(rows[6]).toEqual(["RESTE À DÉBITER", "", "", "", "", 850, "TND", "", ""]);
  });
});

describe("souche de chèques — délai d'attente", () => {
  // Date locale : joursDepuis compte en jours locaux, toISOString() (UTC) décalerait d'un jour après minuit.
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ancien = new Date();
  ancien.setDate(ancien.getDate() - 45);
  const recent = new Date();
  recent.setDate(recent.getDate() - 5);

  it("compte les jours écoulés depuis l'émission", () => {
    expect(joursDepuis(iso(ancien))).toBe(45);
    expect(joursDepuis(null)).toBeNull();
  });

  it("signale les chèques non débités émis depuis plus de 30 jours", () => {
    const list = [
      chq({ dateEmission: iso(ancien), debite: false, dateDebit: null }),
      chq({ id: "2", numCheque: "2", dateEmission: iso(recent), debite: false, dateDebit: null }),
      chq({ id: "3", numCheque: "3", dateEmission: iso(ancien), debite: true }),
    ];
    const attente = chequesEnAttente(list);
    expect(attente).toHaveLength(1);
    expect(attente[0].id).toBe("1");
  });
});

describe("souche de chèques — import du modèle Excel", () => {
  const raw: unknown[][] = [
    ["BANQUE", "N° de Chèque", "Date d'Émission", "Bénéficiaire", "Motif / Description", "Montant (TND-EUR-USD)", "Statut Débité (Oui/Non)", "Date de Débit"],
    ["", "0000001", "2026-09-20", "Fournisseur ACME", "Achat matières premières", 1250, "Oui", "2026-09-24"],
    ["", "0000002", "2026-09-22", "Propriétaire Immob", "Loyer Septembre 2026", 850, "Non", ""],
    ["BIAT", "0000003", 46285, "EDF", "Facture électricité", "145,2", "non", "2026-09-30"],
    [],
    ["TOTAL", "", "", "", "", 2245.2, "", ""],
  ];

  it("reconnaît les en-têtes du modèle du cabinet", () => {
    expect(champPour("N° de Chèque")).toBe("numCheque");
    expect(champPour("Date d'Émission")).toBe("dateEmission");
    expect(champPour("Montant (TND-EUR-USD)")).toBe("montant");
    expect(champPour("Statut Débité (Oui/Non)")).toBe("debite");
    expect(champPour("Date de Débit")).toBe("dateDebit");
  });

  it("lit les chèques, garde les zéros de tête et ignore la ligne de total", () => {
    const rows = parseRows(raw);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      numCheque: "0000001", montant: 1250, debite: true, dateDebit: "2026-09-24", devise: "TND",
    });
    expect(rows[1]).toMatchObject({ debite: false, dateDebit: null });
    // date en numéro de série Excel, montant avec virgule, pas de date de débit si « Non »
    expect(rows[2]).toMatchObject({ banque: "BIAT", montant: 145.2, debite: false, dateDebit: null });
    expect(rows[2].dateEmission).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("refuse un fichier sans colonne « N° de chèque »", () => {
    expect(parseRows([["Nom", "Ville"], ["a", "b"]])).toEqual([]);
  });

  it("convertit les formats de date courants", () => {
    expect(toDateString("24/09/2026")).toBe("2026-09-24");
    expect(toDateString("2026-09-24")).toBe("2026-09-24");
    expect(toDateString(new Date(2026, 8, 24))).toBe("2026-09-24");
    expect(toDateString("n'importe quoi")).toBeNull();
  });
});

describe("souche de chèques — PDF", () => {
  it("génère un PDF avec le gabarit, banque en MAJUSCULES comprise", async () => {
    const { buildSouchePdf } = await import("./pdf");
    const { doc, fileName } = await buildSouchePdf([chq({}), chq({ id: "2", numCheque: "2", debite: false, dateDebit: null })], "CAM / 01-RUSPINA");
    expect(fileName).toBe("Souche_cheques_CAM_01_RUSPINA.pdf");
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.getTextDimensions("x").w).toBeGreaterThan(0);
  });
});
