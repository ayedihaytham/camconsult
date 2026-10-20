import { api } from "@/lib/api";

/** Une session ouverte (un appareil / navigateur) d'un compte. */
export interface SessionAppareil {
  id: string;
  /** Vrai pour la session de cet appareil. */
  courante: boolean;
  /** « Chrome / Brave sur Windows », « Safari sur iPhone »… */
  appareil: string;
  adresse: string;
  creeLe: string;
  derniereActivite: string;
  expireLe: string;
}

/** Mes appareils connectés. */
export const listerSessions = () => api.get<SessionAppareil[]>("/auth/sessions");
/** Ferme UNE autre session (un autre appareil). */
export const revoquerSession = (id: string) => api.post<{ ok: boolean }>(`/auth/sessions/${id}/revoquer`);

/** Administrateur : appareils connectés d'un employé, fermeture d'un appareil, fermeture de tous. */
export const listerSessionsEmploye = (employeId: string) => api.get<SessionAppareil[]>(`/employes/${employeId}/sessions`);
export const revoquerSessionEmploye = (employeId: string, sid: string) => api.post<{ ok: boolean }>(`/employes/${employeId}/sessions/${sid}/revoquer`);
export const revoquerToutesSessionsEmploye = (employeId: string) => api.post<{ ok: boolean; revoquees: number }>(`/employes/${employeId}/sessions/revoquer-toutes`);
