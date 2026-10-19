import { useEffect, useRef, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";

/** Contenu d'une data URL (« data:application/pdf;base64,… ») en octets. */
function octets(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binaire = atob(base64);
  const sortie = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) sortie[i] = binaire.charCodeAt(i);
  return sortie;
}

interface Props {
  dataUrl: string;
  titre: string;
  /** Largeur maximale d'une page à l'écran (px) : sur un très grand écran, une page A4 plus large qu'elle n'est lisible n'apporte rien. */
  largeurMax?: number;
}

/**
 * Affiche un PDF page par page, à pleine largeur, sans l'interface du lecteur PDF du navigateur (barre d'outils, miniatures, zoom) :
 * seul le document est montré, les pages se suivent et on les fait défiler. Rendu dans le navigateur (pdf.js), rien n'est envoyé au serveur.
 */
export function PdfPages({ dataUrl, titre, largeurMax = 1100 }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  const [nbPages, setNbPages] = useState(0);
  const [etat, setEtat] = useState<"charge" | "pret" | "erreur">("charge");
  const toiles = useRef<(HTMLCanvasElement | null)[]>([]);

  // Largeur disponible : le rendu s'adapte à la fenêtre (et se refait si on la redimensionne).
  useEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const mesurer = () => setLargeur(Math.min(largeurMax, Math.max(0, el.clientWidth - 24)));
    mesurer();
    if (typeof ResizeObserver === "undefined") return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [largeurMax]);

  useEffect(() => {
    if (largeur <= 0) return;
    let annule = false;
    let document: { numPages: number; destroy?: () => Promise<void> } | null = null;
    setEtat("charge");
    (async () => {
      try {
        const [pdfjs, travailleur] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
        pdfjs.GlobalWorkerOptions.workerSrc = travailleur.default;
        const pdf = await pdfjs.getDocument({ data: octets(dataUrl) }).promise;
        document = pdf;
        if (annule) return;
        setNbPages(pdf.numPages);
        // Les toiles existent après ce rendu : on attend qu'elles soient posées avant de dessiner.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= pdf.numPages && !annule; n++) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const echelle = largeur / base.width;
          const vue = page.getViewport({ scale: echelle * ratio });
          const toile = toiles.current[n - 1];
          const contexte = toile?.getContext("2d");
          if (!toile || !contexte) continue;
          toile.width = Math.floor(vue.width);
          toile.height = Math.floor(vue.height);
          toile.style.width = `${Math.floor(largeur)}px`;
          toile.style.height = `${Math.floor(base.height * echelle)}px`;
          await page.render({ canvasContext: contexte, viewport: vue }).promise;
        }
        if (!annule) setEtat("pret");
      } catch {
        if (!annule) setEtat("erreur");
      }
    })();
    return () => {
      annule = true;
      void document?.destroy?.();
    };
  }, [dataUrl, largeur]);

  return (
    <div ref={conteneur} className="relative h-full w-full overflow-auto bg-muted">
      {etat === "erreur" ? (
        <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
          <FileWarning className="h-7 w-7" aria-hidden="true" />
          Ce PDF n'a pas pu être affiché. Téléchargez-le pour l'ouvrir.
        </div>
      ) : (
        <>
          {etat === "charge" && (
            <div className="absolute inset-x-0 top-6 z-10 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs text-muted-foreground shadow">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Chargement…
              </span>
            </div>
          )}
          <div className="mx-auto flex w-fit flex-col gap-3 px-3 py-3" role="document" aria-label={titre}>
            {Array.from({ length: nbPages }, (_, i) => (
              <canvas
                key={i}
                ref={(el) => {
                  toiles.current[i] = el;
                }}
                role="img"
                aria-label={`${titre}, page ${i + 1} sur ${nbPages}`}
                className="block max-w-full rounded-sm bg-white shadow-md"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
