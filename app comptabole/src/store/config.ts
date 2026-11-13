import { create } from "zustand";
import { api } from "@/lib/api";
import { cheminOuvert } from "../../shared/modules.js";

interface ConfigServeur {
  environnement: string;
  modulesActifs: string[] | null;
}

interface ConfigState {
  chargee: boolean;
  environnement: string;
  /** null : tous les modules sont ouverts (test, développement). */
  modulesActifs: string[] | null;
  charger: () => Promise<void>;
}

/** Réglages de l'environnement lus sur le serveur : quel environnement, quels modules sont ouverts. */
export const useConfig = create<ConfigState>((set) => ({
  chargee: false,
  environnement: "developpement",
  modulesActifs: null,
  charger: async () => {
    try {
      const c = await api.get<ConfigServeur>("/config");
      set({ chargee: true, environnement: c.environnement, modulesActifs: c.modulesActifs });
    } catch {
      // Serveur injoignable : l'écran de connexion gère l'erreur ; le serveur refuse de toute façon un module fermé.
      set({ chargee: true });
    }
  },
}));

/** La page est-elle ouverte dans cet environnement ? (lecture directe, pour le menu et les raccourcis) */
export function cheminActif(chemin: string): boolean {
  const { modulesActifs } = useConfig.getState();
  return cheminOuvert(modulesActifs ? new Set(modulesActifs) : null, chemin);
}

/** Hook : même règle, et le composant se met à jour quand la configuration arrive. */
export function useCheminActif(chemin: string): boolean {
  const modulesActifs = useConfig((s) => s.modulesActifs);
  return cheminOuvert(modulesActifs ? new Set(modulesActifs) : null, chemin);
}
