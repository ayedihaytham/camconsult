/** Image (PNG, JPEG…) sous forme de data URL ; les PDF restent tels quels. */
export const estImageDataUrl = (dataUrl: string | null | undefined): dataUrl is string =>
  typeof dataUrl === "string" && /^data:image\/(png|jpe?g|webp|bmp|gif);base64,/i.test(dataUrl);

/** Taille de l'image réduite : plus grand côté ramené à `maxCote`, jamais agrandie. */
export function tailleReduite(largeur: number, hauteur: number, maxCote: number) {
  const echelle = Math.min(1, maxCote / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * echelle)), hauteur: Math.max(1, Math.round(hauteur * echelle)) };
}

/**
 * Allège une image avant de la joindre à un mouvement : un scan en PNG pèse
 * plusieurs Mo, le même en JPEG (grand côté 1 800 px, qualité 82 %) quelques
 * centaines de Ko, encore parfaitement lisible pour vérifier les chiffres. Le
 * document est envoyé à chaque enregistrement et rechargé à chaque ouverture de
 * la liste : le poids détermine directement la lenteur de l'application.
 *
 * Renvoie l'original si ce n'est pas une image, si la conversion échoue ou si le
 * résultat n'est pas plus léger.
 */
export async function alleger(dataUrl: string, maxCote = 1800, qualite = 0.82): Promise<string> {
  if (!estImageDataUrl(dataUrl) || typeof document === "undefined") return dataUrl;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image illisible"));
      img.src = dataUrl;
    });
    const { largeur, hauteur } = tailleReduite(image.naturalWidth, image.naturalHeight, maxCote);
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    // Fond blanc : un PNG transparent deviendrait noir en JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.drawImage(image, 0, 0, largeur, hauteur);
    const jpeg = canvas.toDataURL("image/jpeg", qualite);
    return jpeg.length < dataUrl.length ? jpeg : dataUrl;
  } catch {
    return dataUrl;
  }
}

/** Poids approximatif d'une chaîne envoyée au serveur, en Mo. */
export const poidsMo = (texte: string) => texte.length / 1_048_576;
