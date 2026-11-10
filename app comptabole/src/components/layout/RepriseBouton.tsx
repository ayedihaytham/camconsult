import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useReprise } from "@/store/reprise";
import { labelDeChemin } from "./breadcrumbs";

/** Pastille « Reprendre » : retourne à la dernière page quittée (retenue d'une session à l'autre). Absente tant qu'il n'y en a pas, ou si l'on y est déjà. */
export function RepriseBouton() {
  const chemin = useReprise((s) => s.chemin);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  if (!chemin || chemin === pathname + search || chemin.split("?")[0] === pathname) return null;
  const label = labelDeChemin(chemin);
  return (
    <button type="button" onClick={() => navigate(chemin)} className="topbar-reprise" aria-label={`Reprendre : ${label}`}>
      <span className="topbar-reprise__texte">
        <b>Reprendre</b>
        <small>{label}</small>
      </span>
      <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
    </button>
  );
}
