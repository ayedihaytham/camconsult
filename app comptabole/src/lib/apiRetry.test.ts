import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

const reponse = (status: number, corps: unknown = {}) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

describe("lectures relancées pendant une coupure passagère du serveur", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("relance une lecture qui reçoit un 502, puis rend la réponse", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reponse(502, "")).mockResolvedValueOnce(reponse(502, "")).mockResolvedValueOnce(reponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const attente = api.get<{ ok: boolean }>("/data/bootstrap");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await attente).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("abandonne après quelques essais et rend l'erreur", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reponse(503, "")));
    vi.stubGlobal("fetch", fetchMock);
    const attente = api.get("/collectes");
    const resultat = attente.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(20_000);
    const erreur = await resultat;
    expect(erreur).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("ne relance pas une erreur définitive, ni une écriture", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(reponse(404, { error: "Introuvable" })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.get("/collectes/x")).rejects.toThrow("Introuvable");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const ecriture = vi.fn().mockImplementation(() => Promise.resolve(reponse(502, "")));
    vi.stubGlobal("fetch", ecriture);
    await expect(api.post("/collectes", {})).rejects.toBeInstanceOf(ApiError);
    expect(ecriture).toHaveBeenCalledTimes(1);
  });
});
