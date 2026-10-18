import { useEffect, useState } from "react";
import { chargerLogo } from "@/lib/facturePdf";
import { useAuth } from "@/store/auth";
import { useFacturation } from "@/store/facturation";

/** Logo et coordonnées du cabinet pour l'en-tête et le pied de page des PDF. `logo` vaut `undefined` tant qu'il n'est pas chargé
 * (le PDF est alors fabriqué avec le mot CAMCONSULT) puis `null` si le fichier est introuvable. Les coordonnées ne sont lues que
 * pour l'administrateur (la route du cabinet lui est réservée) ; sans elles, l'en-tête reprend seulement le nom du cabinet. */
export function useIdentiteCabinet() {
  const cabinet = useFacturation((s) => s.cabinet);
  const fetchCabinet = useFacturation((s) => s.fetchCabinet);
  const admin = useAuth((s) => s.session?.role === "admin");
  const [logo, setLogo] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let annule = false;
    void chargerLogo(window.location.origin).then((l) => !annule && setLogo(l));
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    if (admin && !cabinet) void fetchCabinet();
  }, [admin, cabinet, fetchCabinet]);

  return { logo, cabinet: cabinet ?? null };
}
