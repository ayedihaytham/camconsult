// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, getToken, setToken } from "@/lib/api";
import { useAuth } from "./auth";

const reponse = (status: number, corps: unknown = {}, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json", ...entetes } });
const SESSION = { role: "employe", poste: "collaborateur", employeId: "e1", nom: "A B", fonction: "", initiales: "AB", cabinetNom: "Cabinet", permissions: {}, societeIds: [] };

beforeEach(() => {
  localStorage.clear();
  useAuth.setState({ status: "loading", session: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("restauration de la session au chargement de la page", () => {
  it("sans ancien jeton : la session est cherchée par le cookie HttpOnly (mode cookie, sans Authorization) ; refus : déconnecté", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(401, { error: "Non authentifié" }));
    vi.stubGlobal("fetch", fetchMock);
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("anon");
    const entetes = fetchMock.mock.calls[0][1].headers;
    expect(entetes["X-Session-Mode"]).toBe("cookie");
    expect(entetes["X-Requested-With"]).toBe("cabinet");
    expect(entetes.Authorization).toBeUndefined();
  });

  it("cookie valide : connecté, sans aucun jeton dans le stockage local", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { session: SESSION })));
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("authed");
    expect(getToken()).toBeNull();
  });

  it("migration : l'ancien jeton du stockage local est présenté une dernière fois, puis supprimé (le serveur pose le cookie)", async () => {
    setToken("ancien-jeton");
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { session: SESSION }));
    vi.stubGlobal("fetch", fetchMock);
    await useAuth.getState().restore();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer ancien-jeton");
    expect(useAuth.getState().status).toBe("authed");
    expect(getToken()).toBeNull();
  });

  it("ancien jeton périmé mais cookie valide : l'ancien jeton est écarté et la session reprise par le cookie", async () => {
    setToken("jeton-perime");
    const fetchMock = vi.fn().mockResolvedValueOnce(reponse(401, { error: "Jeton expiré ou invalide" })).mockResolvedValueOnce(reponse(200, { session: SESSION }));
    vi.stubGlobal("fetch", fetchMock);
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("authed");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(getToken()).toBeNull();
  });

  it("jeton valide : connecté avec sa session", async () => {
    setToken("jeton-valide");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { session: SESSION })));
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("authed");
    expect(useAuth.getState().session?.nom).toBe("A B");
  });

  it("jeton refusé (401) : la session est terminée et le jeton effacé", async () => {
    setToken("jeton-expire");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => reponse(401, { error: "Jeton expiré ou invalide" })));
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("anon");
    expect(getToken()).toBeNull();
  });

  it("serveur qui redémarre (réseau coupé, 503) : la session est CONSERVÉE, l'écran propose de réessayer", async () => {
    vi.useFakeTimers();
    setToken("jeton-valide");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(503, "")));
    const fin = useAuth.getState().restore();
    await vi.advanceTimersByTimeAsync(20_000);
    await fin;
    expect(useAuth.getState().status).toBe("indisponible");
    expect(getToken()).toBe("jeton-valide");
  });

  it("réessayer après la panne rétablit la session sans nouvelle connexion", async () => {
    vi.useFakeTimers();
    setToken("jeton-valide");
    const fetchMock = vi.fn().mockResolvedValue(reponse(503, ""));
    vi.stubGlobal("fetch", fetchMock);
    const premier = useAuth.getState().restore();
    await vi.advanceTimersByTimeAsync(20_000);
    await premier;
    expect(useAuth.getState().status).toBe("indisponible");
    fetchMock.mockResolvedValue(reponse(200, { session: SESSION }));
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("authed");
  });

  it("compte désactivé ou mot de passe changé ailleurs (403/401) : déconnecté proprement", async () => {
    setToken("jeton");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(403, { error: "Accès réservé" })));
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("anon");
    expect(getToken()).toBeNull();
  });
});

describe("jetons : renouvellement et changement de mot de passe", () => {
  it("une réponse qui porte un jeton neuf le remplace (la session active ne s'interrompt pas)", async () => {
    setToken("ancien");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { ok: true }, { "X-Token-Renouvele": "neuf" })));
    await api.get("/societes");
    expect(getToken()).toBe("neuf");
  });

  it("sans jeton envoyé (connexion), un jeton « renouvelé » n'est jamais retenu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { token: "t", session: SESSION }, { "X-Token-Renouvele": "intrus" })));
    await useAuth.getState().login("a.b", "mdp");
    expect(getToken()).toBe("t");
  });

  it("changer son mot de passe garde cet appareil connecté avec le jeton neuf", async () => {
    setToken("ancien");
    useAuth.setState({ status: "authed", session: { ...SESSION, doitChangerMotDePasse: true } as never });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { token: "apres-changement", session: { ...SESSION, doitChangerMotDePasse: false } })));
    const r = await useAuth.getState().changePassword("Nouveau-Mdp-1234");
    expect(r.ok).toBe(true);
    expect(getToken()).toBe("apres-changement");
    expect(useAuth.getState().session?.doitChangerMotDePasse).toBe(false);
  });

  it("administrateur : un nouveau mot de passe renvoie un jeton neuf, gardé ; sans nouveau mot de passe, le jeton ne change pas", async () => {
    setToken("ancien");
    const fetchMock = vi.fn().mockResolvedValueOnce(reponse(200, { ok: true, token: "admin-neuf" })).mockResolvedValueOnce(reponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await useAuth.getState().changeCredentials("actuel", { motDePasse: "Nouveau-Admin-1234" })).ok).toBe(true);
    expect(getToken()).toBe("admin-neuf");
    expect((await useAuth.getState().changeCredentials("actuel", { identifiant: "autre.id" })).ok).toBe(true);
    expect(getToken()).toBe("admin-neuf");
  });

  it("une erreur de connexion garde le message du serveur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(429, { error: "Trop de tentatives. Réessayez dans 15 minute(s)." })));
    const r = await useAuth.getState().login("a.b", "mdp");
    expect(r).toEqual({ ok: false, error: "Trop de tentatives. Réessayez dans 15 minute(s)." });
    expect(ApiError).toBeDefined();
  });
});

describe("déconnecter mes autres appareils", () => {
  it("garde cet appareil connecté avec le jeton neuf", async () => {
    setToken("ancien");
    useAuth.setState({ status: "authed", session: SESSION as never });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { token: "neuf" })));
    expect(await useAuth.getState().deconnecterAutresAppareils()).toEqual({ ok: true });
    expect(getToken()).toBe("neuf");
    expect(useAuth.getState().status).toBe("authed");
  });

  it("en cas d'échec : le message du serveur, et le jeton actuel est conservé", async () => {
    setToken("ancien");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(500, { error: "Erreur serveur" })));
    expect(await useAuth.getState().deconnecterAutresAppareils()).toEqual({ ok: false, error: "Erreur serveur" });
    expect(getToken()).toBe("ancien");
  });
});

describe("connexion de l'administrateur en deux étapes", () => {
  it("mot de passe correct avec 2FA active : pas de session, un ticket est rendu et aucun jeton n'est enregistré", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { etape: "2fa", ticket: "ticket-court" })));
    const r = await useAuth.getState().login("admin", "mdp");
    expect(r).toEqual({ ok: false, etape: "2fa", ticket: "ticket-court" });
    expect(getToken()).toBeNull();
    expect(useAuth.getState().status).not.toBe("authed");
  });

  it("le bon code ouvre la session et enregistre le jeton", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponse(200, { token: "jeton-session", session: { ...SESSION, role: "admin" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await useAuth.getState().verifier2fa("ticket-court", "123456")).toEqual({ ok: true });
    expect(getToken()).toBe("jeton-session");
    expect(useAuth.getState().status).toBe("authed");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/auth/2fa");
    expect(JSON.parse(init.body)).toEqual({ ticket: "ticket-court", code: "123456" });
  });

  it("un code incorrect rend le message du serveur, sans session ni jeton", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(401, { error: "Code incorrect." })));
    expect(await useAuth.getState().verifier2fa("t", "000000")).toEqual({ ok: false, error: "Code incorrect." });
    expect(getToken()).toBeNull();
    expect(useAuth.getState().status).not.toBe("authed");
  });

  it("sans double authentification, la connexion reste directe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { token: "t", session: SESSION })));
    expect(await useAuth.getState().login("a.b", "mdp")).toEqual({ ok: true });
    expect(getToken()).toBe("t");
  });
});
