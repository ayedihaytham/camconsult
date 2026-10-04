import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RuspinaReviewRequired,
  normaliserDate,
  normaliserNombre,
  ruspinaApplies,
  ruspinaChampsPourType,
  ruspinaProcess,
  ruspinaVersPages,
} from "./ruspinaOcr.js";

// Valeurs fictives qui reprennent la forme d'une réponse du service
// (contrat producteur 32 champs / RUSPINA 17 champs / douane 8 champs).
const dossier = {
  page1: {
    seller: "SOCIETE PRODUCTRICE SA",
    invoice_number: "A-1001",
    invoice_date: "02/01/2023",
    client: "RUSPINA IMPORT EXPORT",
    currency: "EUR",
    total: "52000.0",
    line_items: [
      { description: "Ciment CEM I 42,5 N", quantity: 1000, unit: "MT", unit_price: "52.0", line_total: "52000.0" },
    ],
  },
  page2: {
    invoice_number: "V-2002",
    invoice_date: "2023-01-03",
    client: "CLIENT LIBYE",
    currency: "EUR",
    total: "53000.0",
    line_items: [
      { description: "CEMENT CEM I 42.5N", quantity: 1000, unit: "T", unit_price: "53.0", line_total: "53000.0" },
    ],
  },
  page3: {
    declaration_number: "447898",
    declaration_date: "2023-01-03",
    declaration_type: "E",
    exporter: "STE EXPORTATRICE",
    importer: "RUSPINA",
    ptfn_amount: "52000.000",
    currency_conversion_rate: "3.2842000",
    customs_total_value_tnd: "170778.400",
  },
};

describe("normalisation", () => {
  it("convertit les dates en ISO", () => {
    expect(normaliserDate("02/01/2023")).toBe("2023-01-02");
    expect(normaliserDate("2-1-23")).toBe("2023-01-02");
    expect(normaliserDate("2023-01-03")).toBe("2023-01-03");
    expect(normaliserDate("n/a")).toBe("");
    expect(normaliserDate(null)).toBe("");
  });

  it("lit les nombres aux formats français, anglais et mixtes", () => {
    expect(normaliserNombre("52000.0")).toBe(52000);
    expect(normaliserNombre("52 000,50")).toBe(52000.5);
    expect(normaliserNombre("1.234,56")).toBe(1234.56);
    expect(normaliserNombre("1,234.56")).toBe(1234.56);
    expect(normaliserNombre(null)).toBe(0);
    expect(normaliserNombre("abc")).toBe(0);
  });
});

describe("ruspinaApplies", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("exige le service configuré et une société couverte", () => {
    expect(ruspinaApplies("01-RUSPINA")).toBe(false);
    vi.stubEnv("RUSPINA_OCR_URL", "http://ocr:8000");
    expect(ruspinaApplies("01-RUSPINA")).toBe(true);
    expect(ruspinaApplies("06-IHL LOGISTICS")).toBe(false);
    expect(ruspinaApplies(undefined)).toBe(false);
  });

  it("accepte une liste de sociétés personnalisée", () => {
    vi.stubEnv("RUSPINA_OCR_URL", "http://ocr:8000");
    vi.stubEnv("RUSPINA_OCR_SOCIETES", "ruspina, cargo");
    expect(ruspinaApplies("05-I CARGO LINE")).toBe(true);
  });
});

describe("ruspinaVersPages", () => {
  const pages = ruspinaVersPages(dossier);

  it("restitue les trois groupes dans l'ordre achat, vente, douane", () => {
    expect(pages.map((p) => p.type)).toEqual(["achat", "vente", "douane"]);
    expect(pages.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it("traduit la facture du producteur en achat", () => {
    const achat = pages[0].champsByType.achat;
    expect(achat).toMatchObject({
      date: "2023-01-02",
      numFacture: "A-1001",
      fournisseur: "SOCIETE PRODUCTRICE SA",
      devise: "EUR",
    });
    expect(achat.lignes).toEqual([
      { designation: "Ciment CEM I 42,5 N", quantite: 1000, prixUnitaire: 52, montantDevise: 52000 },
    ]);
  });

  it("traduit la facture RUSPINA en vente", () => {
    expect(pages[1].champsByType.vente).toMatchObject({
      date: "2023-01-03",
      numFacture: "V-2002",
      client: "CLIENT LIBYE",
    });
    expect(pages[1].champsByType.vente.lignes[0].montantDevise).toBe(53000);
  });

  it("traduit la déclaration douanière et conserve ses informations annexes", () => {
    expect(pages[2].champsByType.douane).toEqual({
      numDeclaration: "447898",
      date: "2023-01-03",
      regime: "E",
      reference: "",
      tauxChange: 3.2842,
      valeurTnd: 170778.4,
      ptfn: 52000,
      exportateur: "STE EXPORTATRICE",
      importateur: "RUSPINA",
    });
    expect(pages[2].details).toMatchObject({ tauxChange: 3.2842, valeurDouaneTnd: 170778.4 });
  });

  it("ignore les groupes absents", () => {
    expect(ruspinaVersPages({ page1: null, page2: dossier.page2, page3: null }).map((p) => p.type)).toEqual(["vente"]);
    expect(ruspinaVersPages({})).toEqual([]);
  });

  it("renvoie les champs d'une pièce seule, ou null si le type est absent", () => {
    expect(ruspinaChampsPourType(dossier, "douane")?.numDeclaration).toBe("447898");
    expect(ruspinaChampsPourType({ page2: dossier.page2 }, "achat")).toBeNull();
  });
});

describe("ruspinaProcess", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function mockFetch(status, body) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RUSPINA_OCR_URL", "http://ocr:8000/");
    return fetchMock;
  }

  it("envoie le fichier au service et renvoie les données", async () => {
    const fetchMock = mockFetch(200, { status: "completed", data: dossier });
    const data = await ruspinaProcess(Buffer.from("%PDF"), "application/pdf");
    expect(data.page3.declaration_number).toBe("447898");
    expect(fetchMock.mock.calls[0][0]).toBe("http://ocr:8000/api/v1/dossiers/process");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("signale une revue de routage", async () => {
    mockFetch(200, { status: "review_required", routing_session_id: "abc", routing: [{ physical_page: 1, candidate_types: ["page1"] }] });
    await expect(ruspinaProcess(Buffer.from("x"), "application/pdf")).rejects.toBeInstanceOf(RuspinaReviewRequired);
  });

  it("remonte le message d'erreur du service", async () => {
    mockFetch(415, { error: { code: "unsupported", message: "Extension non prise en charge" } });
    await expect(ruspinaProcess(Buffer.from("x"), "application/pdf")).rejects.toThrow(/Extension non prise en charge/);
  });
});
