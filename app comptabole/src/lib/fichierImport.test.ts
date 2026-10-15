import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ClasseurRefuse, lireTamponClasseur, messageImport, TAILLE_MAX_CLASSEUR_OCTETS, verifierClasseur } from "./fichierImport";

// Fichiers SYNTHÉTIQUES uniquement (aucun classeur réel, aucune donnée de client).
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const fichier = (nom: string, octets: number[] | string, type = "") => new File([typeof octets === "string" ? octets : new Uint8Array(octets)], nom, { type });
const refus = async (f: File, options?: Parameters<typeof verifierClasseur>[1]) => {
  try {
    await verifierClasseur(f, options);
  } catch (e) {
    expect(e).toBeInstanceOf(ClasseurRefuse);
    return (e as Error).message;
  }
  throw new Error("le fichier aurait dû être refusé");
};

describe("verifierClasseur : fichiers acceptés", () => {
  it.each([
    ["balance.xlsx", ZIP, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["balance.XLSX", ZIP, ""],
    ["ancien.xls", OLE, "application/vnd.ms-excel"],
    ["export.xls", "<?xml version=\"1.0\"?><Workbook/>", "application/vnd.ms-excel"],
    ["liste.csv", "compte;libelle\n101;Capital\n", "text/csv"],
    ["liste.csv", "compte;libelle\n", "application/vnd.ms-excel"],
    ["liste.csv", "a;b\n", "application/octet-stream"],
  ])("%s", async (nom, contenu, type) => {
    await expect(verifierClasseur(fichier(nom, contenu as number[] | string, type))).resolves.toBeUndefined();
  });

  it("un CSV en UTF-16 (BOM) est accepté malgré ses octets nuls", async () => {
    await expect(verifierClasseur(fichier("unicode.csv", [0xff, 0xfe, 0x61, 0x00, 0x3b, 0x00]))).resolves.toBeUndefined();
  });
});

describe("verifierClasseur : fichiers refusés", () => {
  it("extension non prise en charge, ou absente", async () => {
    expect(await refus(fichier("document.pdf", [0x25, 0x50, 0x44, 0x46]))).toMatch(/Format non pris en charge/);
    expect(await refus(fichier("balance.xlsm", ZIP))).toMatch(/Format non pris en charge/);
    expect(await refus(fichier("sans-extension", ZIP))).toMatch(/Format non pris en charge/);
  });

  it("l'extension doit être autorisée par l'écran (ex. pas de .csv pour les conversions et les relevés)", async () => {
    expect(await refus(fichier("liste.csv", "a;b\n"), { formats: ["xlsx", "xls"] })).toMatch(/\.xlsx, \.xls/);
  });

  it("fichier vide", async () => {
    expect(await refus(fichier("vide.xlsx", []))).toBe("Le fichier est vide.");
  });

  it("fichier au-dessus de la limite (la limite est celle demandée, donc configurable)", async () => {
    const f = fichier("gros.xlsx", ZIP);
    expect(await refus(f, { tailleMax: 4 })).toMatch(/trop volumineux.*limite : 0 Mo|trop volumineux/);
    const enorme = new File([new Uint8Array(TAILLE_MAX_CLASSEUR_OCTETS + 1)], "enorme.xlsx");
    expect(await refus(enorme)).toMatch(/Fichier trop volumineux \(10 Mo\) — limite : 10 Mo/);
  });

  it("type MIME incompatible", async () => {
    expect(await refus(fichier("balance.xlsx", ZIP, "text/html"))).toMatch(/Type de fichier non pris en charge/);
    expect(await refus(fichier("balance.xlsx", ZIP, "image/png"))).toMatch(/Type de fichier non pris en charge/);
  });

  it("extension trompeuse : contenu qui ne correspond pas", async () => {
    expect(await refus(fichier("faux.xlsx", "ceci n'est pas un classeur zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))).toMatch(/ne correspond pas/);
    expect(await refus(fichier("faux.xlsx", OLE))).toMatch(/ne correspond pas/);
    expect(await refus(fichier("faux.xls", [0x41, 0x00, 0x42, 0x00, 0x43]))).toMatch(/ne correspond pas/);
    expect(await refus(fichier("zip.xls", ZIP))).toMatch(/ne correspond pas/);
    expect(await refus(fichier("classeur-deguise.csv", ZIP))).toMatch(/ne correspond pas/);
    expect(await refus(fichier("ancien-deguise.csv", OLE))).toMatch(/ne correspond pas/);
  });

  it("un type MIME fiable ne remplace pas le contrôle du contenu (type correct, contenu faux : refusé)", async () => {
    expect(await refus(fichier("balance.xlsx", "texte", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))).toMatch(/ne correspond pas/);
  });
});

describe("lireTamponClasseur : l'analyse n'est jamais atteinte pour un fichier refusé", () => {
  it("le contenu n'est lu en entier que si le contrôle réussit", async () => {
    const mauvais = fichier("faux.xlsx", "pas un zip");
    const lecture = vi.spyOn(mauvais, "arrayBuffer");
    await expect(lireTamponClasseur(mauvais)).rejects.toBeInstanceOf(ClasseurRefuse);
    expect(lecture).not.toHaveBeenCalled();

    const bon = fichier("bon.xlsx", ZIP);
    const lectureBon = vi.spyOn(bon, "arrayBuffer");
    const tampon = await lireTamponClasseur(bon);
    expect(lectureBon).toHaveBeenCalledTimes(1);
    expect(tampon.byteLength).toBe(ZIP.length);
  });
});

describe("messageImport", () => {
  it("affiche le message d'un refus, et le message par défaut pour toute autre erreur", () => {
    expect(messageImport(new ClasseurRefuse("Le fichier est vide."), "défaut")).toBe("Le fichier est vide.");
    expect(messageImport(new Error("détail interne de la bibliothèque"), "Fichier illisible")).toBe("Fichier illisible");
    expect(messageImport("autre", "Fichier illisible")).toBe("Fichier illisible");
  });
});

describe("les huit écrans d'import passent tous par le contrôle commun (vérification statique)", () => {
  const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf-8");
  const directs = [
    "pages/etatsFinanciers/ImportBalanceDialog.tsx",
    "pages/etatsFinanciers/ImportBiensDialog.tsx",
    "pages/honoraires/HonoraireImportDialog.tsx",
    "pages/soucheCheques/SoucheChequeImportDialog.tsx",
    "pages/suiviDevise/SuiviDeviseImportDialog.tsx",
    "pages/ConversionsPage.tsx",
  ];

  it.each(directs)("%s lit le classeur via lireTamponClasseur, jamais directement", (chemin) => {
    const source = lire(chemin);
    expect(source).toContain("lireTamponClasseur");
    expect(source).not.toMatch(/XLSX\.read\(\s*await file\.arrayBuffer\(\)/);
    expect(source).not.toMatch(/const buf = await file\.arrayBuffer\(\)/);
  });

  it("relevés bancaires et états fournisseurs passent par lireClasseurExcel, qui utilise le contrôle", () => {
    expect(lire("lib/classeurExcel.ts")).toContain("lireTamponClasseur");
    expect(lire("lib/classeurExcel.ts")).not.toMatch(/XLSX\.read\(await file\.arrayBuffer\(\)/);
    expect(lire("pages/banque/ImportReleveDialog.tsx")).toContain("lireClasseurExcel(file)");
    expect(lire("pages/fournisseurs/ImportEtatFournisseursDialog.tsx")).toContain("lireClasseurExcel(file)");
  });

  it("aucun autre fichier de l'application ne lit un classeur par XLSX.read", () => {
    const lecteurs = ["lib/classeurExcel.ts", ...directs];
    const autres = [
      "lib/pdfToTables.ts", "lib/banqueExport.ts", "lib/export.ts", "lib/fournisseursExport.ts",
      "lib/etatsFinanciers/exportClasseur.ts", "pages/bordereaux/BordereauxPage.tsx", "pages/stock/StockSocietePage.tsx",
    ];
    for (const chemin of autres) expect(lire(chemin), chemin).not.toMatch(/XLSX\.read\(/);
    for (const chemin of lecteurs) expect(lire(chemin), chemin).toContain("lireTamponClasseur");
  });
});
