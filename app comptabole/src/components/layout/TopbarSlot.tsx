import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type TopbarZone = "description" | "actions";

/**
 * Emplacement de la barre du haut qu'une page peut remplir : « description » (courte phrase à côté du titre) ou « actions » (bouton principal de la page).
 * Le contenu est rendu dans la barre, mais reste porté par la page : ses droits, son état et ses gestionnaires n'en sortent pas, et il disparaît avec elle.
 * `sinonSurPlace` : si la barre n'existe pas (page affichée seule), le contenu reste dans la page au lieu de disparaître.
 */
export function TopbarSlot({ zone, children, sinonSurPlace = false }: { zone: TopbarZone; children: ReactNode; sinonSurPlace?: boolean }) {
  const [noeud, setNoeud] = useState<HTMLElement | null>(null);
  const [absent, setAbsent] = useState(false);
  useEffect(() => {
    const trouve = document.getElementById(`topbar-${zone}`);
    setNoeud(trouve);
    setAbsent(!trouve);
  }, [zone]);
  if (noeud) return createPortal(children, noeud);
  return sinonSurPlace && absent ? <>{children}</> : null;
}
