import { create } from "zustand";
import { api, setToken, getToken, ApiError, MODE_COOKIE } from "@/lib/api";
import { effacerTousLesBrouillons } from "@/lib/brouillons";
import type { EmployePermissions, EmployeRole } from "@/types";

export interface Session {
  role: "admin" | "employe";
  /** pour role = "employe" : type de compte ; null pour l'admin */
  poste?: EmployeRole | null;
  /** true = employé de société cliente (dossiers en lecture seule) */
  lectureSeule?: boolean;
  employeId: string | null;
  /** Identifiant de connexion du compte. */
  identifiant?: string;
  nom: string;
  fonction: string;
  initiales: string;
  /** Nom affiché du responsable du cabinet (pour l'étiquette « partenaire » côté employé). */
  cabinetNom: string;
  /** Dernière connexion du responsable (ISO) — affichée côté employé. */
  cabinetDerniereConnexion?: string | null;
  permissions: EmployePermissions;
  /** null = accès à toutes les sociétés (admin) */
  societeIds: string[] | null;
  /** true = doit changer son mot de passe avant d'accéder au reste de
   * l'app (1ère connexion, ou après une réinitialisation). */
  doitChangerMotDePasse?: boolean;
  /** Employé de société délégué (sous le responsable de sa société). */
  delegue?: boolean;
}

/** `indisponible` : le serveur ne répond pas (redémarrage, réseau coupé). La session n'est PAS perdue : le jeton est gardé et on peut réessayer. */
type Status = "loading" | "authed" | "anon" | "indisponible";

interface AuthState {
  status: Status;
  session: Session | null;
  restore: () => Promise<void>;
  /** `etape: "2fa"` : mot de passe correct, mais un code de double authentification est demandé (le ticket prouve le mot de passe, sans donner de droits). */
  login: (
    identifiant: string,
    motDePasse: string,
  ) => Promise<{ ok: boolean; error?: string; etape?: "2fa"; ticket?: string }>;
  /** Deuxième étape de la connexion : code à 6 chiffres de l'application, ou code de secours. */
  verifier2fa: (ticket: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  /** Ferme toutes les autres sessions du compte (autres appareils) ; celle-ci reste ouverte avec un jeton neuf. */
  deconnecterAutresAppareils: () => Promise<{ ok: boolean; error?: string }>;
  /** Activation d'un compte ou nouveau mot de passe par un lien à usage unique ; connecte la personne. */
  activer: (jeton: string, motDePasse: string) => Promise<{ ok: boolean; error?: string }>;
  changeCredentials: (
    currentPassword: string,
    next: { identifiant?: string; motDePasse?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  updateAdminProfile: (next: {
    nom?: string;
    role?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Changement de mot de passe forcé (1ère connexion / après réinitialisation) —
   * l'employé choisit lui-même son mot de passe définitif. */
  changePassword: (
    motDePasse: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  session: null,

  restore: async () => {
    try {
      let session: Session;
      const avaitAncienJeton = Boolean(getToken());
      try {
        ({ session } = await api.get<{ session: Session }>("/auth/me"));
      } catch (err) {
        // Ancien jeton périmé resté dans le stockage local : on l'écarte et on retente avec le seul cookie.
        if (!(err instanceof ApiError && err.status === 401 && avaitAncienJeton)) throw err;
        setToken(null);
        ({ session } = await api.get<{ session: Session }>("/auth/me"));
      }
      // Migration : le serveur vient de poser le cookie HttpOnly pour cet ancien jeton, qui n'a plus à rester lisible par le JavaScript.
      if (MODE_COOKIE) setToken(null);
      set({ status: "authed", session });
    } catch (err) {
      // Seul un refus du serveur (jeton expiré, compte désactivé, mot de passe changé ailleurs) met fin à la session. Une panne passagère
      // (redémarrage, réseau coupé) ne déconnecte personne : le jeton reste, l'écran propose de réessayer.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setToken(null);
        set({ status: "anon", session: null });
      } else {
        set({ status: "indisponible", session: null });
      }
    }
  },

  login: async (identifiant, motDePasse) => {
    try {
      const r = await api.post<{ token?: string; session?: Session; etape?: "2fa"; ticket?: string }>("/auth/login", { identifiant, motDePasse });
      if (r.etape === "2fa" && r.ticket) return { ok: false, etape: "2fa", ticket: r.ticket };
      if (r.token) setToken(r.token);
      set({ status: "authed", session: r.session! });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof ApiError
            ? err.message
            : "Connexion impossible (serveur injoignable).",
      };
    }
  },

  verifier2fa: async (ticket, code) => {
    try {
      const { token, session } = await api.post<{ token?: string; session: Session }>("/auth/2fa", { ticket, code });
      if (token) setToken(token);
      set({ status: "authed", session });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Vérification impossible (serveur injoignable)." };
    }
  },

  activer: async (jeton, motDePasse) => {
    try {
      const { token, session } = await api.post<{ token?: string; session: Session }>("/auth/activate", { token: jeton, motDePasse });
      if (token) setToken(token);
      set({ status: "authed", session });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Activation impossible (serveur injoignable)." };
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    effacerTousLesBrouillons();
    setToken(null);
    set({ status: "anon", session: null });
  },

  deconnecterAutresAppareils: async () => {
    try {
      const { token } = await api.post<{ token?: string }>("/auth/deconnecter-autres");
      if (token) setToken(token);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Action impossible (serveur injoignable)." };
    }
  },

  changeCredentials: async (currentPassword, next) => {
    try {
      const r = await api.patch<{ ok: boolean; token?: string }>("/auth/credentials", { currentPassword, ...next });
      if (r?.token) setToken(r.token); // un nouveau mot de passe annule les anciens jetons : celui-ci garde cette session ouverte
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof ApiError ? err.message : "Modification impossible.",
      };
    }
  },

  updateAdminProfile: async (next) => {
    try {
      const { session } = await api.patch<{ session: Session }>(
        "/auth/profile",
        next,
      );
      set({ session });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof ApiError ? err.message : "Mise à jour impossible.",
      };
    }
  },

  changePassword: async (motDePasse) => {
    try {
      const { session, token } = await api.post<{ session: Session; token?: string }>(
        "/auth/change-password",
        { motDePasse },
      );
      // Le changement de mot de passe annule les anciens jetons : celui-ci les remplace pour cet appareil.
      if (token) setToken(token);
      set({ session });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof ApiError ? err.message : "Changement impossible.",
      };
    }
  },
}));
