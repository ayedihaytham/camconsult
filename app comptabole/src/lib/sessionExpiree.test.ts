// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, getToken, registerSessionExpiredHandler, setToken } from "./api";
import { startLiveEvents } from "./liveEvents";

const reponse = (status: number, corps: unknown = { error: "Jeton expiré ou invalide" }) =>
  new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.useFakeTimers();
  setToken("jeton-valide");
});
afterEach(() => {
  registerSessionExpiredHandler(null);
  setToken(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("session expirée", () => {
  it("prévient l'application une seule fois quand le serveur refuse le jeton, même si plusieurs requêtes échouent", async () => {
    const expire = vi.fn();
    registerSessionExpiredHandler(expire);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => reponse(401)));
    await Promise.allSettled([api.get("/notifications"), api.get("/messages"), api.get("/data/bootstrap")]);
    expect(expire).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });

  it("ne prend pas un mauvais mot de passe pour une session expirée", async () => {
    setToken(null);
    const expire = vi.fn();
    registerSessionExpiredHandler(expire);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => reponse(401, { error: "Identifiant ou mot de passe incorrect" })));
    await expect(api.post("/auth/login", { identifiant: "x", motDePasse: "y" })).rejects.toThrow(/incorrect/);
    expect(expire).not.toHaveBeenCalled();
  });

  it("se ré-arme après une nouvelle connexion", async () => {
    const expire = vi.fn();
    registerSessionExpiredHandler(expire);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => reponse(401)));
    await api.get("/notifications").catch(() => {});
    setToken("nouveau-jeton");
    await api.get("/notifications").catch(() => {});
    expect(expire).toHaveBeenCalledTimes(2);
  });
});

describe("flux en direct", () => {
  it("n'insiste pas quand le jeton est refusé : session expirée, plus aucune reconnexion", async () => {
    const expire = vi.fn();
    registerSessionExpiredHandler(expire);
    const fetchMock = vi.fn().mockImplementation(async () => new Response("", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const stop = startLiveEvents({});
    await vi.advanceTimersByTimeAsync(100);
    expect(expire).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("espace ses reconnexions quand le serveur coupe aussitôt, au lieu de redemander chaque seconde", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(new ReadableStream({ start: (c) => c.close() }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const stop = startLiveEvents({});
    await vi.advanceTimersByTimeAsync(20_000);
    // En 20 s : 1 connexion + quelques reprises à délais croissants (1 s, 2 s, 4 s, 8 s…), pas 20.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(2);
    expect(fetchMock.mock.calls.length).toBeLessThan(8);
    stop();
  });
});
