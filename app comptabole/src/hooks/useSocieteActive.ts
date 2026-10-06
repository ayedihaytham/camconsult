import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { cheminPourSociete, societeIdFromPath } from "@/lib/societeContext";
import { useSocietes } from "@/store/data";
import { useSocieteActiveStore } from "@/store/societeActive";
import type { Societe } from "@/types";

/** Société active si elle existe et si l'utilisateur a le droit de la voir. */
export function useSocieteActive(): Societe | null {
  const id = useSocieteActiveStore((s) => s.societeId);
  const societes = useSocietes();
  const { canSeeSociete } = usePermissions();
  if (!id) return null;
  const societe = societes.find((s) => s.id === id);
  return societe && canSeeSociete(societe.id) ? societe : null;
}

/** Choisit la société active : met à jour le contexte et, depuis une page de
 * module par société, ouvre le même module pour la nouvelle société. */
export function useChoisirSociete() {
  const setSocieteId = useSocieteActiveStore((s) => s.setSocieteId);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (id: string | null) => {
    setSocieteId(id);
    const cible = cheminPourSociete(pathname, id);
    if (cible && cible !== pathname) navigate(cible);
  };
}

/** Une adresse /<module>/:societeId rend cette société active (lien partagé,
 * page ouverte depuis une liste) ; une société devenue inaccessible est retirée. */
export function useSocieteRouteSync() {
  const { pathname } = useLocation();
  const societes = useSocietes();
  const { canSeeSociete } = usePermissions();
  const id = useSocieteActiveStore((s) => s.societeId);
  const setSocieteId = useSocieteActiveStore((s) => s.setSocieteId);

  useEffect(() => {
    const dansLUrl = societeIdFromPath(pathname);
    if (dansLUrl && dansLUrl !== id && societes.some((s) => s.id === dansLUrl) && canSeeSociete(dansLUrl)) {
      setSocieteId(dansLUrl);
    }
    // canSeeSociete change à chaque rendu : seuls l'adresse et les sociétés comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, societes]);

  useEffect(() => {
    if (id && societes.length > 0 && !societes.some((s) => s.id === id && canSeeSociete(s.id))) {
      setSocieteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, societes]);
}
