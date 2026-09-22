/** Taille lisible : 1234 → "1,2 Ko" (unités FR). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[i]}`;
}

/** Extension en minuscules sans le point ("Rapport.PDF" → "pdf"). */
export function fileExtension(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

/** Limite de contenu stocké en base64 (localStorage) — 2 Mo. */
export const MAX_INLINE_FILE_BYTES = 2 * 1024 * 1024;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Déclenche le téléchargement d'un fichier depuis une data URL, via un Blob
 * (plus fiable qu'un `<a href="data:...">` direct — certains navigateurs,
 * surtout mobiles, tronquent ou n'honorent pas l'attribut `download` sur de
 * longues data URLs, ce qui produisait des fichiers vides/corrompus).
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  let url = dataUrl;
  try {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    // Volontairement jamais révoqué ici : sur mobile, le flux "Enregistrer
    // dans Fichiers"/partage lit le blob de façon différée (parfois bien
    // après le clic) — le révoquer trop tôt produisait un fichier vide sur
    // téléphone alors que ça marchait sur PC. Le navigateur libère de toute
    // façon les blob URLs à la fermeture/rechargement de la page ; le coût
    // mémoire d'un fichier de pièce jointe, occasionnel, est négligeable.
  } catch {
    // repli : data URL directe si le décodage base64 échoue pour une raison
    // quelconque (mieux vaut tenter l'ancien comportement que rien).
  }
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
