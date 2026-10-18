import { chargerLogo } from "@/lib/facturePdf";
import { useAuth } from "@/store/auth";
import { useFacturation } from "@/store/facturation";

/** Logo et coordonnées du cabinet pour l'en-tête et le pied de page des PDF de tableaux, chargés au moment de fabriquer le PDF.
 * Les coordonnées ne sont lues que pour l'administrateur (la route du cabinet lui est réservée) ; sans elles, l'en-tête reprend
 * seulement le logo ou le nom du cabinet. Ne lève jamais : un PDF sans logo reste valable. */
export async function identiteCabinetPdf() {
  const logo = await chargerLogo(typeof window === "undefined" ? "" : window.location.origin);
  try {
    if (!useFacturation.getState().cabinet && useAuth.getState().session?.role === "admin") await useFacturation.getState().fetchCabinet();
  } catch {
    // coordonnées indisponibles : le pied de page n'aura pas de coordonnées
  }
  return { logo, cabinet: useFacturation.getState().cabinet };
}
