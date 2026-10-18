import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

/**
 * Boutons « précédent / suivant » de la barre du haut : l'état (peut-on reculer ? avancer ?) est déduit des pages visitées pendant cette
 * session de l'application, sans dépendre de l'objet history du navigateur (qui ne dit pas s'il existe une page suivante).
 *
 * La pile des clés de navigation suit la logique du navigateur : une nouvelle page (PUSH) supprime les pages « suivantes », un
 * remplacement (REPLACE) change la page courante sans bouger, un retour ou une avance (POP) se repère par la clé de la page.
 */
export function useHistoriqueNavigation() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const pile = useRef<string[]>([location.key]);
  const index = useRef(0);
  const [etat, setEtat] = useState({ peutReculer: false, peutAvancer: false });

  useEffect(() => {
    const cle = location.key;
    if (type === "PUSH") {
      pile.current = [...pile.current.slice(0, index.current + 1), cle];
      index.current = pile.current.length - 1;
    } else if (type === "REPLACE") {
      pile.current[index.current] = cle;
    } else {
      const trouve = pile.current.indexOf(cle);
      if (trouve >= 0) index.current = trouve;
      else {
        // Page inconnue (rechargement, ou entrée ouverte avant le démarrage de cette pile) : on repart de elle.
        pile.current = [cle];
        index.current = 0;
      }
    }
    setEtat({ peutReculer: index.current > 0, peutAvancer: index.current < pile.current.length - 1 });
  }, [location.key, type]);

  const reculer = useCallback(() => navigate(-1), [navigate]);
  const avancer = useCallback(() => navigate(1), [navigate]);
  return { ...etat, reculer, avancer };
}
