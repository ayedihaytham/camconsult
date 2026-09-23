import { create } from "zustand";
import { api, setToken, getToken, ApiError } from "@/lib/api";
import type { EmployePermissions, EmployeRole } from "@/types";

export interface Session {
  role: "admin" | "employe";
  /** pour role = "employe" : type de compte ; null pour l'admin */
  poste?: EmployeRole | null;
  /** true = employé de société cliente (dossiers en lecture seule) */
  lectureSeule?: boolean;
  employeId: string | null;
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
}

type Status = "loading" | "authed" | "anon";

interface AuthState {
  status: Status;
  session: Session | null;
  restore: () => Promise<void>;
  login: (
    identifiant: string,
    motDePasse: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
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
    if (!getToken()) {
      set({ status: "anon", session: null });
      return;
    }
    try {
      const { session } = await api.get<{ session: Session }>("/auth/me");
      set({ status: "authed", session });
    } catch {
      setToken(null);
      set({ status: "anon", session: null });
    }
  },

  login: async (identifiant, motDePasse) => {
    try {
      const { token, session } = await api.post<{
        token: string;
        session: Session;
      }>("/auth/login", { identifiant, motDePasse });
      setToken(token);
      set({ status: "authed", session });
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

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    setToken(null);
    set({ status: "anon", session: null });
  },

  changeCredentials: async (currentPassword, next) => {
    try {
      await api.patch("/auth/credentials", { currentPassword, ...next });
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
      const { session } = await api.post<{ session: Session }>(
        "/auth/change-password",
        { motDePasse },
      );
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
