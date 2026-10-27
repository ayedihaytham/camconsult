import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type TopbarZone = "description" | "actions";

/**
 * Emplacement de la barre du haut qu'une page peut remplir : « description » (courte phrase à côté du titre) ou « actions » (bouton principal de la page).
 * Le contenu est rendu dans la barre, mais reste porté par la page : ses droits, son état et ses gestionnaires n'en sortent pas, et il disparaît avec elle.
 */
export function TopbarSlot({ zone, children }: { zone: TopbarZone; children: ReactNode }) {
  const [noeud, setNoeud] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNoeud(document.getElementById(`topbar-${zone}`));
  }, [zone]);
  return noeud ? createPortal(children, noeud) : null;
}
