import { ClasseurRefuse } from "./fichierImport";

/** Limites PROVISOIRES sur le contenu d'un .xlsx (zip), à confirmer par le propriétaire d'après des classeurs réels. Elles bornent la
 * taille DÉCOMPRESSÉE annoncée par le répertoire central, donc la quantité de XML que la bibliothèque devra analyser (et la mémoire). */
export const LIMITES_ZIP = {
  entreesMax: 2000,
  tailleEntreeMaxOctets: 64 * 1024 * 1024,
  tailleTotaleMaxOctets: 128 * 1024 * 1024,
  rapportMax: 1000,
} as const;

const trop = () => new ClasseurRefuse("Classeur trop volumineux une fois décompressé — fichier refusé.");

/**
 * Lit le répertoire central d'un zip (sans rien décompresser) et refuse un classeur dont le contenu annoncé est excessif.
 * Limite : le répertoire central est déclaratif ; un zip mensonger sur ses tailles n'est pas détecté ici, d'où le délai et l'isolation
 * de la lecture (voir lireClasseurIsole). Un fichier qui n'est pas un zip est ignoré (le contrôle d'extension s'en occupe).
 */
export function verifierZip(tampon: ArrayBuffer, limites: { [K in keyof typeof LIMITES_ZIP]: number } = LIMITES_ZIP): void {
  const o = new DataView(tampon);
  const n = tampon.byteLength;
  if (n < 22) return;
  let fin = -1;
  for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) {
    if (o.getUint32(i, true) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return;
  const entrees = o.getUint16(fin + 10, true);
  let pos = o.getUint32(fin + 16, true);
  if (entrees === 0xffff || pos === 0xffffffff) throw trop(); // zip64 : jamais produit par un classeur ordinaire de cette taille
  const tailleRepertoire = o.getUint32(fin + 12, true);
  if (entrees > limites.entreesMax) throw trop();
  if (pos + tailleRepertoire > fin) throw new ClasseurRefuse("Classeur corrompu (répertoire du fichier incohérent).");
  const noms = new Set<string>();
  let total = 0;
  for (let k = 0; k < entrees; k++) {
    if (pos + 46 > n || o.getUint32(pos, true) !== 0x02014b50) throw new ClasseurRefuse("Classeur corrompu (répertoire du fichier illisible).");
    const longueurNom = o.getUint16(pos + 28, true);
    if (pos + 46 + longueurNom > n) throw new ClasseurRefuse("Classeur corrompu (répertoire du fichier illisible).");
    // Deux entrées de même nom : lecteurs différents, contenus différents (confusion d'archive) — refusé.
    const nom = String.fromCharCode(...new Uint8Array(tampon, pos + 46, longueurNom)).toLowerCase();
    if (noms.has(nom)) throw new ClasseurRefuse("Classeur corrompu (entrées en double).");
    noms.add(nom);
    const compresse = o.getUint32(pos + 20, true);
    const brut = o.getUint32(pos + 24, true);
    if (brut === 0xffffffff || brut > limites.tailleEntreeMaxOctets) throw trop();
    if (compresse > 0 && brut / compresse > limites.rapportMax && brut > 1024 * 1024) throw trop();
    total += brut;
    if (total > limites.tailleTotaleMaxOctets) throw trop();
    pos += 46 + o.getUint16(pos + 28, true) + o.getUint16(pos + 30, true) + o.getUint16(pos + 32, true);
  }
}
