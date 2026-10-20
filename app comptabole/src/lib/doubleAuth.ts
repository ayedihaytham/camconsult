import { ApiError, api, setToken } from "@/lib/api";

/** Gestion de la double authentification de l'administrateur (voir server/routes/auth.js). Les actions qui changent la version des sessions
 * (activer, désactiver) renvoient un jeton neuf : il est enregistré ici, pour que cet appareil reste connecté. */

export interface Statut2fa {
  actif: boolean;
  codesSecoursRestants: number;
}

export type Resultat<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const echec = (err: unknown, defaut: string): { ok: false; error: string } => ({ ok: false, error: err instanceof ApiError ? err.message : defaut });

export const statut2fa = () => api.get<Statut2fa>("/auth/2fa/statut");

/** Étape 1 : le mot de passe est redemandé ; le serveur renvoie un secret provisoire et l'adresse otpauth du QR code. */
export async function preparer2fa(motDePasse: string): Promise<Resultat<{ secret: string; uri: string }>> {
  try {
    return { ok: true, ...(await api.post<{ secret: string; uri: string }>("/auth/2fa/preparer", { motDePasse })) };
  } catch (err) {
    return echec(err, "Préparation impossible (serveur injoignable).");
  }
}

/** Étape 2 : le code de l'application confirme l'enregistrement. Les codes de secours ne sont montrés qu'ici, une seule fois. */
export async function activer2fa(code: string): Promise<Resultat<{ codesSecours: string[] }>> {
  try {
    const r = await api.post<{ codesSecours: string[]; token?: string }>("/auth/2fa/activer", { code });
    if (r.token) setToken(r.token);
    return { ok: true, codesSecours: r.codesSecours };
  } catch (err) {
    return echec(err, "Activation impossible (serveur injoignable).");
  }
}

export async function desactiver2fa(motDePasse: string, code: string): Promise<Resultat> {
  try {
    const r = await api.post<{ token?: string }>("/auth/2fa/desactiver", { motDePasse, code });
    if (r.token) setToken(r.token);
    return { ok: true };
  } catch (err) {
    return echec(err, "Désactivation impossible (serveur injoignable).");
  }
}

export async function regenererCodesSecours(motDePasse: string, code: string): Promise<Resultat<{ codesSecours: string[] }>> {
  try {
    return { ok: true, ...(await api.post<{ codesSecours: string[] }>("/auth/2fa/codes-secours", { motDePasse, code })) };
  } catch (err) {
    return echec(err, "Action impossible (serveur injoignable).");
  }
}
