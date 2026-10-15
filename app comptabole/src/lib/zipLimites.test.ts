import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { ClasseurRefuse, lireTamponClasseur } from "./fichierImport";
import { LIMITES_ZIP, verifierZip } from "./zipLimites";

// Archives SYNTHÉTIQUES : seul le répertoire central est lu par verifierZip, les contenus n'ont pas besoin d'exister.
interface Entree {
  compresse: number;
  brut: number;
  nom?: string;
}
function zipAnnonce(entrees: Entree[], options: { tailleRepertoire?: number; decalage?: number } = {}): ArrayBuffer {
  const noms = entrees.map((e, i) => new TextEncoder().encode(e.nom ?? `f${i}`));
  const tailleCd = noms.reduce((s, n) => s + 46 + n.length, 0);
  const tout = new Uint8Array(tailleCd + 22);
  const v = new DataView(tout.buffer);
  let p = 0;
  entrees.forEach((e, i) => {
    v.setUint32(p, 0x02014b50, true);
    v.setUint32(p + 20, e.compresse, true);
    v.setUint32(p + 24, e.brut, true);
    v.setUint16(p + 28, noms[i].length, true);
    tout.set(noms[i], p + 46);
    p += 46 + noms[i].length;
  });
  v.setUint32(p, 0x06054b50, true);
  v.setUint16(p + 10, entrees.length, true);
  v.setUint32(p + 12, options.tailleRepertoire ?? tailleCd, true);
  v.setUint32(p + 16, options.decalage ?? 0, true);
  return tout.buffer;
}
const Mo = 1024 * 1024;
const L = LIMITES_ZIP;

describe("verifierZip : bornes (en dessous, à la limite, au-dessus)", () => {
  it("entrée : acceptée à la limite, refusée à la limite + 1", () => {
    expect(() => verifierZip(zipAnnonce([{ compresse: L.tailleEntreeMaxOctets / 2, brut: L.tailleEntreeMaxOctets }]))).not.toThrow();
    expect(() => verifierZip(zipAnnonce([{ compresse: L.tailleEntreeMaxOctets / 2, brut: L.tailleEntreeMaxOctets - 1 }]))).not.toThrow();
    expect(() => verifierZip(zipAnnonce([{ compresse: L.tailleEntreeMaxOctets / 2, brut: L.tailleEntreeMaxOctets + 1 }]))).toThrow(ClasseurRefuse);
  });
  it("total : accepté à la limite, refusé à la limite + 1 octet, même réparti", () => {
    const deux = (a: number, b: number) => zipAnnonce([{ compresse: 30 * Mo, brut: a }, { compresse: 30 * Mo, brut: b }]);
    expect(() => verifierZip(deux(L.tailleEntreeMaxOctets, L.tailleTotaleMaxOctets - L.tailleEntreeMaxOctets))).not.toThrow();
    expect(() => verifierZip(deux(L.tailleEntreeMaxOctets, L.tailleTotaleMaxOctets - L.tailleEntreeMaxOctets + 1))).toThrow(/décompressé/);
  });
  it("rapport de compression : seuil à 1000, ignoré sous 1 Mo décompressé", () => {
    expect(() => verifierZip(zipAnnonce([{ compresse: 3000, brut: 2 * Mo }]))).not.toThrow(); // rapport ≈ 699
    expect(() => verifierZip(zipAnnonce([{ compresse: 1000, brut: 2 * Mo }]))).toThrow(ClasseurRefuse);
    expect(() => verifierZip(zipAnnonce([{ compresse: 1, brut: Mo }]))).not.toThrow(); // petit : pas de refus pour un rapport élevé
  });
  it("nombre d'entrées : accepté à la limite, refusé à la limite + 1", () => {
    const n = (k: number) => zipAnnonce(Array.from({ length: k }, (_, i) => ({ compresse: 10, brut: 10, nom: `e${i}` })));
    expect(() => verifierZip(n(L.entreesMax))).not.toThrow();
    expect(() => verifierZip(n(L.entreesMax + 1))).toThrow(ClasseurRefuse);
  });
});

describe("verifierZip : structures malformées ou incohérentes (refus sûr)", () => {
  it("tailles 32 bits saturées (zip64) refusées sans débordement", () => {
    expect(() => verifierZip(zipAnnonce([{ compresse: 10, brut: 0xffffffff }]))).toThrow(ClasseurRefuse);
    expect(() => verifierZip(zipAnnonce([{ compresse: 0xffffffff, brut: 0xfffffffe }]))).toThrow(ClasseurRefuse);
  });
  it("entrées de même nom (casse comprise) refusées", () => {
    expect(() => verifierZip(zipAnnonce([{ compresse: 10, brut: 10, nom: "xl/workbook.xml" }, { compresse: 10, brut: 10, nom: "XL/Workbook.xml" }]))).toThrow(/double/);
  });
  it("répertoire dont la taille ou le décalage est incohérent, ou dont une signature est fausse", () => {
    expect(() => verifierZip(zipAnnonce([{ compresse: 1, brut: 1 }], { tailleRepertoire: 10_000 }))).toThrow(/incohérent/);
    expect(() => verifierZip(zipAnnonce([{ compresse: 1, brut: 1 }], { decalage: 5000 }))).toThrow(ClasseurRefuse);
    const mauvais = new Uint8Array(zipAnnonce([{ compresse: 1, brut: 1 }]));
    mauvais[0] = 0;
    expect(() => verifierZip(mauvais.buffer)).toThrow(/corrompu/);
  });
  it("nombre d'entrées annoncé supérieur au contenu réel : refus, jamais de lecture hors tampon", () => {
    const a = new Uint8Array(zipAnnonce([{ compresse: 1, brut: 1 }]));
    new DataView(a.buffer).setUint16(a.length - 22 + 10, 40, true);
    expect(() => verifierZip(a.buffer)).toThrow(ClasseurRefuse);
  });
  it("tampons minuscules ou sans zip : ignorés (le contrôle d'extension et de signature s'en charge)", () => {
    expect(() => verifierZip(new ArrayBuffer(0))).not.toThrow();
    expect(() => verifierZip(new ArrayBuffer(10))).not.toThrow();
    expect(() => verifierZip(new TextEncoder().encode("a;b\n".repeat(200)).buffer as ArrayBuffer)).not.toThrow();
  });
  it("le message d'erreur ne contient ni nom d'entrée ni contenu", () => {
    try {
      verifierZip(zipAnnonce([{ compresse: 10, brut: 10, nom: "secret-client.xml" }, { compresse: 10, brut: 10, nom: "secret-client.xml" }]));
    } catch (e) {
      expect((e as Error).message).not.toContain("secret-client");
    }
  });
  it("accepte un vrai classeur produit par la bibliothèque", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a", 1]]), "S");
    expect(() => verifierZip(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer)).not.toThrow();
  });
});

describe("lireTamponClasseur : un fichier refusé n'atteint jamais XLSX.read", () => {
  const avecSignature = (zip: ArrayBuffer) => new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Uint8Array(zip)]);

  it("zip excessif : refus avant de rendre le tampon (donc avant toute analyse)", async () => {
    const f = new File([avecSignature(zipAnnonce([{ compresse: 5000, brut: 20 * Mo }]))], "bombe.xlsx");
    await expect(lireTamponClasseur(f)).rejects.toBeInstanceOf(ClasseurRefuse);
  });
  it("le garde-fou s'applique aux .xlsx seulement ; csv et xls ne passent pas par l'analyse du zip", async () => {
    const csv = new File(["a;b\n1;2\n"], "ok.csv", { type: "text/csv" });
    await expect(lireTamponClasseur(csv)).resolves.toBeInstanceOf(ArrayBuffer);
  });
});
