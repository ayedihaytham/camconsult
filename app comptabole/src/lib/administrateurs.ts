import { ApiError, api } from "@/lib/api";
import type { SessionAppareil } from "@/lib/appareils";

/** Gestion des administrateurs du cabinet (voir server/routes/administrateurs.js). Chaque action sensible redemande le mot de passe de l'administrateur connecté. */

export interface Administrateur {
  id: string;
  identifiant: string;
  nom: string;
  fonction: string;
  statut: "actif" | "desactive";
  /** Compte historique du cabinet : ne peut être ni désactivé ni réinitialisé par un autre. */
  principal: boolean;
  doitChangerMotDePasse: boolean;
  doubleAuthentification: boolean;
  derniereConnexion: string | null;
  creeLe: string;
  creePar: string;
  /** Vrai pour l'administrateur connecté. */
  moi: boolean;
}

export type Resultat<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const echec = (err: unknown, defaut: string): { ok: false; error: string } => ({ ok: false, error: err instanceof ApiError ? err.message : defaut });

export const listerAdministrateurs = () => api.get<Administrateur[]>("/administrateurs");

export async function creerAdministrateur(v: { nom: string; fonction: string; identifiant: string; motDePasse: string }): Promise<Resultat<{ motDePasseProvisoire: string; administrateur: Administrateur }>> {
  try {
    const { motDePasseProvisoire, ...administrateur } = await api.post<Administrateur & { motDePasseProvisoire: string }>("/administrateurs", v);
    return { ok: true, motDePasseProvisoire, administrateur };
  } catch (err) {
    return echec(err, "Création impossible (serveur injoignable).");
  }
}

export type ActionAdministrateur = "desactiver" | "reactiver" | "retirer-2fa";
export async function agirSurAdministrateur(id: string, action: ActionAdministrateur, motDePasse: string): Promise<Resultat> {
  try {
    await api.post(`/administrateurs/${id}/${action}`, { motDePasse });
    return { ok: true };
  } catch (err) {
    return echec(err, "Action impossible (serveur injoignable).");
  }
}

export async function reinitialiserAdministrateur(id: string, motDePasse: string): Promise<Resultat<{ motDePasseProvisoire: string }>> {
  try {
    const r = await api.post<{ motDePasseProvisoire: string }>(`/administrateurs/${id}/reinitialiser`, { motDePasse });
    return { ok: true, motDePasseProvisoire: r.motDePasseProvisoire };
  } catch (err) {
    return echec(err, "Réinitialisation impossible (serveur injoignable).");
  }
}

export const listerSessionsAdministrateur = (id: string) => api.get<SessionAppareil[]>(`/administrateurs/${id}/sessions`);
export const revoquerSessionAdministrateur = (id: string, sid: string) => api.post<{ ok: boolean }>(`/administrateurs/${id}/sessions/${sid}/revoquer`);
