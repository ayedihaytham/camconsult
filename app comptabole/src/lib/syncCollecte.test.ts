// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollecteFull } from "@/types";
import { setToken } from "./api";
import { startLiveEvents } from "./liveEvents";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", async (original) => {
  const reel = await original<typeof import("./api")>();
  return { ...reel, api: { ...reel.api, get } };
});
import { useCollectes } from "@/store/collectes";

const collecte = (id: string, statut: string, extra: Partial<CollecteFull> = {}) =>
  ({ id, societeId: "s", periode: "2026", statut, onglets: ["souche_cheques"], devise: "TND", sections: [], lignes: [], notes: [], fichiers: [], ...extra }) as unknown as CollecteFull;

beforeEach(() => {
  vi.useFakeTimers();
  setToken("jeton");
  get.mockReset();
  useCollectes.setState({ current: null, list: [] });
});
afterEach(() => {
  setToken(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function flux(trames: string[]) {
  return vi.fn().mockImplementation(async () =>
    new Response(
      new ReadableStream({
        start(c) {
          for (const t of trames) c.enqueue(new TextEncoder().encode(t));
        },
      }),
      { status: 200 },
    ),
  );
}

describe("flux en direct : collecte de pièces", () => {
  it("signale la collecte modifiée par quelqu'un d'autre", async () => {
    vi.stubGlobal("fetch", flux([': ok\n\n', 'data: {"type":"collecte","id":"c-1"}\n\n', 'data: {"type":"message"}\n\n']));
    const onCollecte = vi.fn();
    const onMessage = vi.fn();
    const stop = startLiveEvents({ onCollecte, onMessage });
    await vi.advanceTimersByTimeAsync(50);
    expect(onCollecte).toHaveBeenCalledWith("c-1");
    expect(onMessage).toHaveBeenCalledTimes(1);
    stop();
  });

  it("ignore un signal de collecte sans identifiant", async () => {
    vi.stubGlobal("fetch", flux(['data: {"type":"collecte"}\n\n']));
    const onCollecte = vi.fn();
    const stop = startLiveEvents({ onCollecte });
    await vi.advanceTimersByTimeAsync(50);
    expect(onCollecte).not.toHaveBeenCalled();
    stop();
  });

  it("relit tout au retour sur l'onglet et toutes les 30 secondes (filet de sécurité)", async () => {
    vi.stubGlobal("fetch", flux([': ok\n\n']));
    const onResync = vi.fn();
    const stop = startLiveEvents({ onResync });
    await vi.advanceTimersByTimeAsync(30_100);
    expect(onResync).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onResync).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("synchronisation de la collecte ouverte", () => {
  it("remplace la collecte ouverte par la version à jour", async () => {
    useCollectes.setState({ current: collecte("c-1", "brouillon") });
    get.mockResolvedValue(collecte("c-1", "transmis", { lignes: [{ id: "l", onglet: "souche_cheques", ordre: 0, data: { montant: 5 } }] as never }));
    await useCollectes.getState().synchroniser("c-1");
    expect(get).toHaveBeenCalledWith("/collectes/c-1");
    expect(useCollectes.getState().current?.statut).toBe("transmis");
    expect(useCollectes.getState().current?.lignes).toHaveLength(1);
  });

  it("n'y touche pas quand le changement concerne une autre collecte ou qu'aucune n'est ouverte", async () => {
    await useCollectes.getState().synchroniser("c-1");
    expect(get).not.toHaveBeenCalled();
    useCollectes.setState({ current: collecte("c-1", "brouillon") });
    await useCollectes.getState().synchroniser("c-2");
    expect(useCollectes.getState().current?.statut).toBe("brouillon");
    expect(get).not.toHaveBeenCalled();
  });

  it("relit la liste quand une autre collecte change et qu'une liste est affichée", async () => {
    useCollectes.setState({ current: null, list: [collecte("c-1", "brouillon") as never] });
    get.mockResolvedValue([collecte("c-1", "transmis")]);
    await useCollectes.getState().synchroniser("c-1");
    expect(get).toHaveBeenCalledWith("/collectes");
    expect(useCollectes.getState().list[0].statut).toBe("transmis");
  });

  it("sans identifiant, relit la collecte ouverte (retour sur l'onglet)", async () => {
    useCollectes.setState({ current: collecte("c-1", "brouillon") });
    get.mockResolvedValue(collecte("c-1", "valide"));
    await useCollectes.getState().synchroniser();
    expect(useCollectes.getState().current?.statut).toBe("valide");
  });

  it("regroupe les signaux rapprochés : une relecture en cours puis une seule de rattrapage", async () => {
    useCollectes.setState({ current: collecte("c-1", "brouillon") });
    let terminer: (c: CollecteFull) => void = () => {};
    get.mockImplementationOnce(() => new Promise<CollecteFull>((r) => (terminer = r))).mockResolvedValue(collecte("c-1", "transmis"));
    const premiere = useCollectes.getState().synchroniser("c-1");
    void useCollectes.getState().synchroniser("c-1");
    void useCollectes.getState().synchroniser("c-1");
    expect(get).toHaveBeenCalledTimes(1);
    terminer(collecte("c-1", "a_corriger"));
    await premiere;
    expect(get).toHaveBeenCalledTimes(2);
    expect(useCollectes.getState().current?.statut).toBe("transmis");
  });

  it("garde la collecte affichée quand la relecture échoue", async () => {
    useCollectes.setState({ current: collecte("c-1", "brouillon") });
    get.mockRejectedValue(new Error("réseau"));
    await useCollectes.getState().synchroniser("c-1");
    expect(useCollectes.getState().current?.statut).toBe("brouillon");
  });

  it("ne remplace pas la collecte si l'utilisateur en a ouvert une autre pendant la relecture", async () => {
    useCollectes.setState({ current: collecte("c-1", "brouillon") });
    get.mockImplementation(async () => {
      useCollectes.setState({ current: collecte("c-2", "valide") });
      return collecte("c-1", "transmis");
    });
    await useCollectes.getState().synchroniser("c-1");
    expect(useCollectes.getState().current?.id).toBe("c-2");
  });
});
