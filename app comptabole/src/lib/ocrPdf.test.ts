import { describe, expect, it } from "vitest";
import { CONFIANCE_MINIMALE, ECHELLE_OCR, bandesASurveiller, colonnesMontants, fusionnerMontantsRelus, lignesDeResultat, lignesVersItems, motsDeResultat, nombreDeLecteurs, motsVersItems, preparerPourOcr, rangeeComplete, type MotOcr } from "./ocrPdf";

const mot = (text: string, x0: number, y0: number, x1: number, y1: number, confidence = 90): MotOcr => ({ text, confidence, bbox: { x0, y0, x1, y1 } });

describe("reconnaissance de caractères : passage aux morceaux de texte d'un PDF", () => {
  it("convertit les pixels (origine en haut) en points (origine en bas) avec l'échelle de lecture", () => {
    const [item] = motsVersItems([mot("1 234,50", 250, 100, 500, 150)], ECHELLE_OCR, 842);
    expect(item).toEqual({ str: "1 234,50", x: 250 / ECHELLE_OCR, y: 842 - 150 / ECHELLE_OCR, w: 250 / ECHELLE_OCR, h: 50 / ECHELLE_OCR });
  });

  it("écarte le bruit : texte vide, signes sans lettre ni chiffre, mots de deux signes peu sûrs", () => {
    const items = motsVersItems([mot("Solde", 0, 0, 50, 10), mot("   ", 0, 0, 5, 5), mot("~~", 0, 0, 5, 5), mot("ab", 0, 0, 5, 5, 20)], 1, 100);
    expect(items.map((i) => i.str)).toEqual(["Solde"]);
  });

  it("garde un mot de trois signes ou plus même avec une confiance nulle (l'OCR donne 0 à des mots justes touchés par un reste de filet)", () => {
    const items = motsVersItems([mot("ACHAT", 0, 0, 50, 10, 0), mot("304", 60, 0, 90, 10, CONFIANCE_MINIMALE)], 1, 100);
    expect(items.map((i) => i.str)).toEqual(["ACHAT", "304"]);
  });

  it("écarte les signes isolés peu sûrs (restes de traits, bords de page) mais garde un chiffre isolé bien lu", () => {
    const items = motsVersItems([mot("|", 0, 0, 5, 20, 60), mot("=", 0, 0, 5, 20, 70), mot("5", 0, 0, 5, 20, 90), mot("€", 0, 0, 5, 20, 90)], 1, 100);
    expect(items.map((i) => i.str)).toEqual(["5"]);
  });

  it("garde un chiffre isolé lu avec une confiance moyenne (le « 1 » de « 1 250,50 »), pas une lettre", () => {
    const items = motsVersItems([mot("1", 0, 0, 5, 20, 40), mot("a", 6, 0, 11, 20, 40)], 1, 100);
    expect(items.map((i) => i.str)).toEqual(["1"]);
  });

  it("garde l'ordre vertical d'origine : une ligne plus basse sur l'image a un y plus petit", () => {
    const [haut, bas] = motsVersItems([mot("A1", 0, 10, 10, 20), mot("B2", 0, 200, 10, 210)], 1, 300);
    expect(haut.y).toBeGreaterThan(bas.y);
  });

  it("lit les mots à plat ou imbriqués dans les blocs, et un résultat vide sans erreur", () => {
    const m = mot("Total", 0, 0, 10, 10);
    expect(motsDeResultat({ words: [m] })).toEqual([m]);
    expect(motsDeResultat({ blocks: [{ paragraphs: [{ lines: [{ words: [m] }, { words: [m] }] }] }] })).toHaveLength(2);
    expect(motsDeResultat({ blocks: null })).toEqual([]);
    expect(motsDeResultat(undefined)).toEqual([]);
  });
});

describe("lignes lues par la reconnaissance de caractères", () => {
  it("tous les mots d'une ligne partagent la même hauteur de base : un « p » qui descend ne coupe pas la ligne", () => {
    const items = lignesVersItems([[mot("HOT", 0, 100, 60, 130), mot("WASHED", 70, 100, 200, 130), mot("PET", 210, 100, 270, 142), mot("FLAKES", 280, 100, 400, 130)]], 1, 500);
    expect(new Set(items.map((i) => i.y)).size).toBe(1);
    expect(items.map((i) => i.str)).toEqual(["HOT", "WASHED", "PET", "FLAKES"]);
    expect(items[0].y).toBe(500 - 130);
  });

  it("le chiffre de tête d'un montant (« 1 » de « 1 000,000 ») est gardé même avec une confiance nulle, mais pas un chiffre isolé ailleurs", () => {
    const items = lignesVersItems([[mot("Frais", 0, 0, 40, 20), mot("1", 100, 0, 112, 20, 0), mot("000,000", 118, 0, 200, 20, 90), mot("7", 300, 0, 312, 20, 0)]], 1, 100);
    expect(items.map((i) => i.str)).toEqual(["Frais", "1", "000,000"]);
  });

  it("deux lignes gardent chacune leur hauteur, et les mots écartés disparaissent de leur ligne", () => {
    const items = lignesVersItems([[mot("Total", 0, 10, 50, 30), mot("|", 60, 10, 62, 30, 20)], [mot("41", 0, 60, 30, 80)]], 1, 100);
    expect(items.map((i) => i.str)).toEqual(["Total", "41"]);
    expect(items[0].y).toBeGreaterThan(items[1].y);
  });

  it("extrait les lignes des blocs, ou à défaut un mot par ligne", () => {
    const a = mot("A", 0, 0, 5, 5), b = mot("B", 6, 0, 11, 5);
    expect(lignesDeResultat({ blocks: [{ paragraphs: [{ lines: [{ words: [a, b] }, { words: [a] }] }] }] })).toEqual([[a, b], [a]]);
    expect(lignesDeResultat({ words: [a, b] })).toEqual([[a], [b]]);
  });
});

describe("préparation de l'image avant la lecture", () => {
  const image = (largeur: number, hauteur: number, fond = 255) => new Uint8ClampedArray(largeur * hauteur * 4).fill(fond);
  const encre = (donnees: Uint8ClampedArray, largeur: number, x: number, y: number) => { for (let c = 0; c < 3; c++) donnees[(y * largeur + x) * 4 + c] = 0; };
  const gris = (donnees: Uint8ClampedArray, largeur: number, x: number, y: number) => donnees[(y * largeur + x) * 4];

  it("efface un filet long de tableau, avec sa marge, et laisse le texte voisin intact", () => {
    const l = 200, h = 60;
    const d = image(l, h);
    for (let x = 10; x < 190; x++) encre(d, l, x, 30);
    for (let y = 40; y < 50; y++) encre(d, l, 100, y);
    preparerPourOcr(d, l, h);
    expect(gris(d, l, 100, 30)).toBe(255);
    expect(gris(d, l, 100, 31)).toBe(255);
    expect(gris(d, l, 100, 45)).toBe(0);
  });

  it("un bandeau gris (en-tête de tableau) n'est pas pris pour un filet : il reste, comme son texte", () => {
    const l = 300, h = 60;
    const d = image(l, h);
    for (let y = 10; y < 30; y++) for (let x = 10; x < 290; x++) for (let c = 0; c < 3; c++) d[(y * l + x) * 4 + c] = 221;
    for (let x = 20; x < 28; x++) for (let y = 15; y < 25; y++) encre(d, l, x, y);
    preparerPourOcr(d, l, h);
    expect(gris(d, l, 24, 20)).toBeLessThan(60);
  });

  it("étire le contraste d'une photo pâle : le papier gris clair devient blanc, l'encre grise devient noire", () => {
    const l = 100, h = 100;
    const d = image(l, h, 200);
    for (let x = 40; x < 50; x++) for (let y = 40; y < 55; y++) for (let c = 0; c < 3; c++) d[(y * l + x) * 4 + c] = 120;
    preparerPourOcr(d, l, h);
    expect(gris(d, l, 5, 5)).toBe(255);
    expect(gris(d, l, 45, 45)).toBeLessThan(40);
  });
});

describe("rangées de relevé à relire", () => {
  it("une rangée est complète avec deux montants intacts et un libellé ; un montant dont le début est perdu ne l'est pas", () => {
    expect(rangeeComplete("15-09-2026 ACHAT VENTE DEVISE 15-09-2026 304 000,000 0,000")).toBe(true);
    expect(rangeeComplete("15-09-2026 000,000 0")).toBe(false);
    expect(rangeeComplete("15-09-2026 LC Payment Credit 15-09-2026 0,000")).toBe(false);
  });

  const mots = (lignes: string[]) => lignes.flatMap((texte, i) => texte.split(" ").map((t, j) => mot(t, 20 + j * 60, 100 + i * 60, 70 + j * 60, 130 + i * 60)));

  it("signale seulement les rangées incomplètes d'une page dont la plupart des rangées sont complètes", () => {
    const m = mots(["01-09-2026 Transfert 01-09-2026 0,000 331 816,000", "02-09-2026 Commission reglement 02-09-2026 2,000 0,000", "03-09-2026 000,000 0", "04-09-2026 Frais divers 04-09-2026 1,500 0,000"]);
    expect(bandesASurveiller(m, 1000)).toHaveLength(1);
  });

  it("sur une page qui n'est pas un relevé à deux colonnes de montants, rien n'est relu", () => {
    const m = mots(["01-09-2026 Texte", "02-09-2026 Texte", "03-09-2026 Texte", "04-09-2026 Texte"]);
    expect(bandesASurveiller(m, 1000)).toEqual([]);
  });
});

describe("relecture des colonnes de montants", () => {
  const it0 = (str: string, x: number, y: number, w = 40, h = 10) => ({ str, x, y, w, h });

  it("repère les centres des colonnes Débit et Crédit d'après leurs intitulés", () => {
    const c = colonnesMontants([[it0("Date", 20, 700), it0("Débit", 400, 700), it0("Crédit", 560, 700)]]);
    expect(c).toEqual({ debit: 420, credit: 580, demi: 80 });
    expect(colonnesMontants([[it0("Date", 20, 700)]])).toBeNull();
  });

  it("un montant relu remplace, sur sa rangée, ce que la colonne contenait ; les autres colonnes ne sont pas touchées", () => {
    const items = [it0("01-09-2026", 20, 600), it0("Transfert", 150, 600), it0("0,000", 405, 600), it0("17", 540, 600, 12), it0("812,500", 570, 600, 40)];
    const relus = [it0("17 812,500", 540, 601, 70), it0("0,000", 405, 601)];
    const fusion = fusionnerMontantsRelus(items, relus, { x0: 380, x1: 620 });
    expect(fusion.map((i) => i.str).sort()).toEqual(["0,000", "01-09-2026", "17 812,500", "Transfert"].sort());
  });

  it("un montant perdu par la première lecture est ajouté ; une lecture qui n'est pas un montant est ignorée", () => {
    const items = [it0("01-09-2026", 20, 600), it0("Frais", 150, 600)];
    const fusion = fusionnerMontantsRelus(items, [it0("1 000,000", 410, 600), it0("12", 410, 500)], { x0: 380, x1: 620 });
    expect(fusion.map((i) => i.str)).toEqual(["01-09-2026", "Frais", "1 000,000"]);
  });
});

describe("lecteurs de caractères en parallèle", () => {
  it("la moitié des cœurs, entre 1 et 6, sans dépasser le nombre de pages", () => {
    expect(nombreDeLecteurs(29, 12)).toBe(6);
    expect(nombreDeLecteurs(29, 16)).toBe(6);
    expect(nombreDeLecteurs(29, 4)).toBe(2);
    expect(nombreDeLecteurs(29, 1)).toBe(1);
    expect(nombreDeLecteurs(3, 12)).toBe(3);
    expect(nombreDeLecteurs(1, 12)).toBe(1);
  });
});
