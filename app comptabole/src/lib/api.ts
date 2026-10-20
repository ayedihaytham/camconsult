const TOKEN_KEY = "cabinet-token";

/**
 * Base de l'API.
 *  - vide (défaut) : même origine → `/api...` (dev via proxy Vite, ou prod
 *    servie par le même serveur Node).
 *  - définie via VITE_API_URL au build : API hébergée ailleurs
 *    (ex : `https://cabinet-api.onrender.com`).
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** Mode cookie : l'API est servie par la même origine, donc le jeton de session voyage dans un cookie HttpOnly que le JavaScript ne lit pas
 * (voir server/auth.js). Avec une API hébergée ailleurs (VITE_API_URL), le cookie SameSite=Strict ne suivrait pas : on reste en « Bearer ». */
export const MODE_COOKIE = API_BASE === "";

/** En-têtes qui identifient la session d'une requête vers l'API : mode cookie + en-tête anti-CSRF, et l'ancien jeton du stockage local
 * tant qu'il n'a pas été migré vers le cookie (il disparaît à la première vérification de session réussie). */
export function enteteSession(): Record<string, string> {
  const h: Record<string, string> = {};
  if (MODE_COOKIE) {
    h["X-Session-Mode"] = "cookie";
    h["X-Requested-With"] = "cabinet";
  }
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  // Un nouveau jeton (connexion) ré-arme le signal « session expirée ».
  if (token) sessionExpiredSignaled = false;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

let sessionExpiredHandler: (() => void) | null = null;
let sessionExpiredSignaled = false;

/** Appelé quand le serveur refuse le jeton (session expirée après 12 h, serveur redéployé avec un autre secret…) : l'application
 * repasse alors à la connexion au lieu de redemander, toutes les 20 s, des notifications qui échouent. */
export function registerSessionExpiredHandler(fn: (() => void) | null) {
  sessionExpiredHandler = fn;
  sessionExpiredSignaled = false;
}

/** Signale une session expirée, une seule fois par connexion (plusieurs requêtes en vol échouent en même temps). */
export function signalSessionExpired() {
  if (sessionExpiredSignaled) return;
  sessionExpiredSignaled = true;
  sessionExpiredHandler?.();
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface RequestOptions {
  /** Abandonne la requête passé ce délai (envois lourds : on préfère un message clair à une attente sans fin). */
  timeoutMs?: number;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = enteteSession();
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  const controleur = options.timeoutMs ? new AbortController() : null;
  const minuteur = controleur ? setTimeout(() => controleur.abort(), options.timeoutMs) : null;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controleur?.signal,
    });
  } catch (err) {
    if (controleur?.signal.aborted) {
      throw new ApiError(
        "L'envoi prend trop de temps (connexion lente ou documents trop lourds). Vos données sont conservées : réessayez.",
        0,
      );
    }
    throw new ApiError(
      "Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez.",
      0,
    );
  }

  if (minuteur) clearTimeout(minuteur);
  // Session active : le serveur propose un jeton neuf avant que l'ancien n'expire (voir server/auth.js), pour ne pas déconnecter en pleine journée.
  const renouvele = res.headers.get("X-Token-Renouvele");
  if (renouvele && getToken()) setToken(renouvele);
  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : null) ||
      (res.status === 413 ? "Les fichiers joints sont trop volumineux pour être envoyés." : null) ||
      // Une page d'erreur HTML du serveur web n'est pas un message à afficher.
      (typeof payload === "string" && !payload.trimStart().startsWith("<") ? payload : null) ||
      `Erreur ${res.status}`;
    // Session expirée : purge le jeton
    if (res.status === 401) {
      setToken(null);
      // Un mauvais mot de passe ou un code erroné à la connexion n'est pas une session expirée ; l'application ignore ce signal hors session ouverte.
      if (!path.startsWith("/auth/login") && !path.startsWith("/auth/2fa") && !path.startsWith("/auth/activate")) signalSessionExpired();
    }
    throw new ApiError(message, res.status);
  }

  return payload as T;
}

/** Une lecture qui échoue parce que le serveur redémarre (réseau coupé, 502/503/504) est relancée quelques fois avant d'abandonner :
 * sans cela, la page restait vide jusqu'au rechargement manuel. Seules les lectures (GET) sont relancées, jamais une écriture. */
async function lire<T>(path: string): Promise<T> {
  const attentes = [800, 2000, 4000];
  for (let essai = 0; ; essai++) {
    try {
      return await request<T>("GET", path);
    } catch (err) {
      const passager = err instanceof ApiError && (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504);
      if (!passager || essai >= attentes.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, attentes[essai]));
    }
  }
}

export const api = {
  get: <T>(path: string) => lire<T>(path),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body ?? {}, options),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body ?? {}, options),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
