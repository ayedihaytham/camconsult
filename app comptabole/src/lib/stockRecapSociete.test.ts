import { describe, expect, it } from "vitest";
import { dateJourMoisAnnee, feuilleRecapSociete, recapSociete } from "./stockRecapSociete";
import type { StockLigne, StockMouvement } from "@/types";

const ligne = (quantite: number, unite: string, montantDevise: number, montantTnd: number): StockLigne => ({ designation: "HOT WASHED PET FLAKES", quantite, prixUnitaire: 10, montantDevise, montantTnd, unite });

const base = (id: string, patch: Partial<StockMouvement>): StockMouvement => ({
  id, societeId: "s", ordre: 0, natureMarchandise: "HOT WASHED PET FLAKES",
  achatDate: null, achatNumFacture: "", achatDocType: "", fournisseur: "", achatDevise: "EUR", achatCours: 0, achatLignes: [],
  venteDate: null, venteNumFacture: "", venteDocType: "", client: "", venteDevise: "EUR", venteCours: 0, venteLignes: [],
  douaneNumDeclaration: "", douaneDate: null, douaneRegime: "", douaneTypeDeclaration: "", douaneReference: "", douaneTauxChange: 0, douaneValeurTnd: 0, douanePtfn: 0, douaneExportateur: "", douaneImportateur: "",
  achatDocDataUrl: null, venteDocDataUrl: null, douaneDocDataUrl: null, note: "", ecart: 0, ecartUnite: "T", ecartParDesignation: [], creeLe: "", majLe: "", ...patch,
});

const complet = base("a", {
  achatDate: "2025-01-02", achatNumFacture: "260082", fournisseur: "GREEN RECYCLING SARL", achatCours: 3.4, achatLignes: [ligne(44.277, "T", 1000, 3400)],
  venteDate: "2025-01-10", venteNumFacture: "2600084", client: "EVERTIS ITALIA", venteLignes: [ligne(44, "T", 1100, 3700)], ecart: 0.277,
});
const venteSeule = base("b", { venteDate: "2025-02-01", venteNumFacture: "2600085", client: "ENPLATER", venteLignes: [ligne(10, "T", 200, 700)], ecart: -10 });

describe("récapitulatif des mouvements d'une société", () => {
  it("une ligne par mouvement, vente et achat côte à côte, écart entre les deux", () => {
    const r = recapSociete([complet, venteSeule]);
    expect(r.unite).toBe("T");
    expect(r.lignes.map((l) => l.rang)).toEqual([1, 2]);
    expect(r.lignes[0].vente).toMatchObject({ numFacture: "2600084", tiers: "EVERTIS ITALIA", quantite: 44, enDevise: 1100, mtTnd: 3700, present: true });
    expect(r.lignes[0].achat).toMatchObject({ numFacture: "260082", tiers: "GREEN RECYCLING SARL", quantite: 44.277, cours: 3.4, mtTnd: 3400 });
    expect(r.lignes[0].ecart).toBe(0.277);
    expect(r.lignes[1].achat.present).toBe(false);
  });

  it("les totaux ne comptent que les côtés renseignés ; le total en devise est omis si les devises diffèrent", () => {
    const r = recapSociete([complet, venteSeule]);
    expect(r.totaux.vente).toEqual({ quantite: 54, enDevise: 1300, mtTnd: 4400 });
    expect(r.totaux.achat).toEqual({ quantite: 44.277, enDevise: 1000, mtTnd: 3400 });
    expect(r.totaux.ecart).toBe(-9.723);
    const mixte = recapSociete([complet, base("c", { venteNumFacture: "9", venteDevise: "USD", venteLignes: [ligne(1, "T", 5, 15)] })]);
    expect(mixte.totaux.vente.enDevise).toBeNull();
  });

  it("la feuille d'export reprend les colonnes de l'écran, sans les colonnes de douane, avec deux groupes et une ligne de totaux", () => {
    const f = feuilleRecapSociete(recapSociete([complet, venteSeule]));
    expect(f.rows[0]).toHaveLength(19);
    expect(f.rows[0].filter((h) => h === "Taux de change" || h === "Type")).toHaveLength(0);
    expect(f.groupes).toEqual([{ titre: "VENTE", de: 1, a: 8 }, { titre: "ACHAT", de: 10, a: 18 }]);
    expect(f.rows).toHaveLength(4);
    expect(f.rows[1][1]).toBe("10/01/2025");
    expect(f.rows[1][17]).toBe(3.4);
    expect(f.rows[2][10]).toBe("");
    expect(f.rows[3][3]).toBe("TOTAL");
    expect(f.totalRows).toBe(1);
  });

  it("une date ISO devient jour/mois/année", () => {
    expect(dateJourMoisAnnee("2025-01-02")).toBe("02/01/2025");
    expect(dateJourMoisAnnee(null)).toBe("");
  });
});

describe("export Excel du récapitulatif", () => {
  it("pose les bandeaux VENTE et ACHAT fusionnés au-dessus des en-têtes et met la ligne de totaux en gras", async () => {
    const { classeurExcelModele } = await import("./modeleExcelCabinet");
    const ExcelJS = (await import("exceljs")).default;
    const octets = await classeurExcelModele([feuilleRecapSociete(recapSociete([complet, venteSeule]))], { titre: "Récap", sousTitre: "2 mouvements" });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(octets) as never);
    const ws = wb.worksheets[0];
    expect(ws.getCell(3, 2).value).toBe("VENTE");
    expect(ws.getCell(3, 11).value).toBe("ACHAT");
    expect(ws.getCell(4, 2).value).toBe("Date");
    expect(ws.getCell(7, 4).value).toBe("TOTAL");
    expect(ws.getCell(7, 4).font?.bold).toBe(true);
  });
});
