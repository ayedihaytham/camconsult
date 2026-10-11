import { useRef, useState, type PointerEvent } from "react";
import { Maximize2, Minus, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const PAS = 0.25;

/** Visionneuse d'un document importé (image ou PDF) : l'image est ajustée à la largeur puis agrandissable
 * (boutons + / −, « Ajuster »), déplaçable à la souris quand elle dépasse ; un PDF garde la visionneuse du navigateur. */
export function VisionneuseDocument({ dataUrl, titre, className, onAgrandir }: {
  dataUrl: string;
  titre: string;
  /** Hauteur de la zone (classe Tailwind), 70 % de l'écran par défaut. */
  className?: string;
  /** Ouvre le document en grand : absent quand la visionneuse est déjà en grand. */
  onAgrandir?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const zone = useRef<HTMLDivElement>(null);
  const glisse = useRef<{ x: number; y: number; gauche: number; haut: number } | null>(null);
  const estImage = dataUrl.startsWith("data:image/");
  const regler = (valeur: number) => setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(valeur * 100) / 100)));

  function debut(e: PointerEvent<HTMLDivElement>) {
    if (!zone.current || zoom <= 1) return;
    glisse.current = { x: e.clientX, y: e.clientY, gauche: zone.current.scrollLeft, haut: zone.current.scrollTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function deplacement(e: PointerEvent<HTMLDivElement>) {
    if (!glisse.current || !zone.current) return;
    zone.current.scrollLeft = glisse.current.gauche - (e.clientX - glisse.current.x);
    zone.current.scrollTop = glisse.current.haut - (e.clientY - glisse.current.y);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {estImage && (
          <>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Réduire le document" disabled={zoom <= ZOOM_MIN} onClick={() => regler(zoom - PAS)}>
              <Minus className="size-3.5" />
            </Button>
            <span className="w-12 text-center text-xs font-semibold tabular-nums" aria-live="polite">{Math.round(zoom * 100)} %</span>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Agrandir le document" disabled={zoom >= ZOOM_MAX} onClick={() => regler(zoom + PAS)}>
              <Plus className="size-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={zoom === 1} onClick={() => regler(1)}>
              <ScanLine className="size-3.5" aria-hidden="true" /> Ajuster
            </Button>
          </>
        )}
        {onAgrandir && (
          <Button type="button" variant="outline" size="sm" className="ml-auto gap-1.5" onClick={onAgrandir}>
            <Maximize2 className="size-3.5" aria-hidden="true" /> Plein écran
          </Button>
        )}
      </div>
      {estImage ? (
        <div
          ref={zone}
          onPointerDown={debut}
          onPointerMove={deplacement}
          onPointerUp={() => { glisse.current = null; }}
          onPointerCancel={() => { glisse.current = null; }}
          className={cn("overflow-auto rounded border border-border bg-white", zoom > 1 && "cursor-grab active:cursor-grabbing", className ?? "h-[70vh]")}
        >
          <img src={dataUrl} alt={titre} draggable={false} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="block select-none" />
        </div>
      ) : (
        <iframe title={titre} src={dataUrl} className={cn("w-full rounded border border-border bg-white", className ?? "h-[70vh]")} />
      )}
      {estImage && zoom > 1 && <p className="text-[11px] text-muted-foreground">Faites glisser le document pour le déplacer.</p>}
    </div>
  );
}
