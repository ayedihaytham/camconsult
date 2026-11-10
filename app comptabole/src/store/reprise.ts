import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { create } from "zustand";
import { safeLocalStorage } from "@/lib/safeStorage";

/** « Reprendre » : la dernière page quittée (retenue d'une session à l'autre), pour y revenir d'un clic depuis la barre du haut. */
const CLE = "cc.reprise.v1";

function lire(): string | null {
  const v = safeLocalStorage.getItem(CLE);
  return v && v.startsWith("/") && v !== "/" && !v.startsWith("/login") ? v : null;
}

interface RepriseState {
  chemin: string | null;
  noter: (chemin: string) => void;
}

export const useReprise = create<RepriseState>((set) => ({
  chemin: lire(),
  noter: (chemin) => {
    if (chemin === "/" || chemin.startsWith("/login") || chemin.startsWith("/activation")) return;
    safeLocalStorage.setItem(CLE, chemin);
    set({ chemin });
  },
}));

/** À monter une fois dans l'application : retient la page que l'on vient de quitter. */
export function useSuiviReprise() {
  const { pathname, search } = useLocation();
  const precedent = useRef<string | null>(null);
  useEffect(() => {
    const courant = pathname + search;
    if (precedent.current && precedent.current !== courant) useReprise.getState().noter(precedent.current);
    precedent.current = courant;
  }, [pathname, search]);
}
